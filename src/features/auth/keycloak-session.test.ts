import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { AuthError } from './auth-api'
import { createKeycloakSession, type AuthTabChannel, type RedirectPort } from './keycloak-session'

/**
 * Phiên Keycloak đăng nhập ngay trong app (password grant), với Keycloak giả, `sessionStorage` giả và kênh giữa các tab giả.
 * Câu lỗi của Keycloak giả là đúng câu realm thật trả (đã thử trên Keycloak 26 của backend).
 */

const CONFIG = { url: 'http://kc.test', realm: 'loadmaster', clientId: 'loadmaster-web' }
const TOKEN_URL = 'http://kc.test/realms/loadmaster/protocol/openid-connect/token'
const LOGOUT_URL = 'http://kc.test/realms/loadmaster/protocol/openid-connect/logout'
const REFRESH_KEY = 'loadmaster.phien-keycloak'
const SESSION_KEY = 'loadmaster.phien-keycloak-ma'

type KeycloakCall = { url: string; form: Record<string, string> }

/** Keycloak giả: một tài khoản `an@fastmove.vn` / `dung-mat-khau`; mỗi lần cấp token đánh số tăng dần để test biết token nào là mới. */
function stubKeycloak(options: { account?: 'ok' | 'temporary' | 'disabled'; client?: 'direct-grants' | 'no-direct-grants' } = {}) {
  const calls: KeycloakCall[] = []
  const live = new Set<string>()
  let issued = 0
  const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }))
  const grant = () => {
    issued += 1
    live.add(`refresh-${issued}`)
    return reply(200, { access_token: `access-${issued}`, expires_in: 60, refresh_token: `refresh-${issued}`, token_type: 'Bearer' })
  }
  const fetchMock = vi.fn((input: string, init: RequestInit = {}) => {
    const form = Object.fromEntries(new URLSearchParams(String(init.body)))
    calls.push({ url: input, form })
    if (input === LOGOUT_URL) {
      live.clear()
      return Promise.resolve(new Response(null, { status: 204 }))
    }
    // Lượt trả về của trang đăng nhập Keycloak (dự phòng): mã chỉ dùng được với đúng code_verifier
    if (form.grant_type === 'authorization_code') {
      return form.code === 'kc-code' && form.code_verifier !== undefined && form.code_verifier.length >= 43 ? grant() : reply(400, { error: 'invalid_grant' })
    }
    if (options.client === 'no-direct-grants') return reply(400, { error: 'unauthorized_client', error_description: 'Client not allowed for direct access grants' })
    if (form.grant_type === 'refresh_token') {
      return live.has(form.refresh_token ?? '') ? grant() : reply(400, { error: 'invalid_grant', error_description: 'Session not active' })
    }
    if (form.username !== 'an@fastmove.vn' || form.password !== 'dung-mat-khau') {
      return reply(401, { error: 'invalid_grant', error_description: 'Invalid user credentials' })
    }
    if (options.account === 'disabled') return reply(400, { error: 'invalid_grant', error_description: 'Account disabled' })
    if (options.account === 'temporary') return reply(400, { error: 'invalid_grant', error_description: 'Account is not fully set up' })
    return grant()
  })
  vi.stubGlobal('fetch', fetchMock)
  return { calls, fetchMock, endAllSessions: () => live.clear() }
}

function memoryStorage() {
  const items = new Map<string, string>()
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

/** Các tab cùng trình duyệt: thư một tab gửi tới mọi tab khác, sau lượt hiện tại — như `BroadcastChannel`. */
function tabHub() {
  type Listener = Parameters<AuthTabChannel['subscribe']>[0]
  const tabs = new Set<Set<Listener>>()
  return {
    tab(): AuthTabChannel {
      const own = new Set<Listener>()
      tabs.add(own)
      return {
        postMessage(message) {
          for (const other of tabs) if (other !== own) for (const listener of [...other]) queueMicrotask(() => listener(message))
        },
        subscribe(listener) {
          own.add(listener)
          return () => own.delete(listener)
        },
      }
    },
  }
}

let clock = 0
const now = () => clock

beforeEach(() => {
  clock = 1_000_000
})
afterEach(() => vi.unstubAllGlobals())

describe('signing in on the app screen', () => {
  test('trades email and password for tokens at the realm token endpoint and keeps only the refresh token and the session id in the tab storage', async () => {
    const keycloak = stubKeycloak()
    const storage = memoryStorage()
    const session = createKeycloakSession(CONFIG, { storage, channel: null, now })

    await session.login('an@fastmove.vn', 'dung-mat-khau')

    expect(keycloak.calls).toStrictEqual([
      {
        url: TOKEN_URL,
        form: { client_id: 'loadmaster-web', grant_type: 'password', username: 'an@fastmove.vn', password: 'dung-mat-khau', scope: 'openid' },
      },
    ])
    // Gửi như một form thường, không header riêng: trình duyệt không cần hỏi trước CORS
    const init = keycloak.fetchMock.mock.calls[0]?.[1]
    expect(init?.headers).toStrictEqual({ 'Content-Type': 'application/x-www-form-urlencoded' })
    expect(await session.token()).toBe('access-1')
    expect([...storage.items.keys()]).toStrictEqual([REFRESH_KEY, SESSION_KEY])
    expect(storage.items.get(REFRESH_KEY)).toBe('refresh-1')
  })

  test.each([
    ['a wrong password', {}, 'sai', 'invalid-credentials'],
    ['a temporary password', { account: 'temporary' as const }, 'dung-mat-khau', 'password-change-required'],
    ['a disabled account', { account: 'disabled' as const }, 'dung-mat-khau', 'account-suspended'],
    ['a client without direct grants', { client: 'no-direct-grants' as const }, 'dung-mat-khau', 'login-not-enabled'],
  ])('%s is refused with a code the login screen translates', async (_name, options, password, code) => {
    stubKeycloak(options)
    const storage = memoryStorage()
    const session = createKeycloakSession(CONFIG, { storage, channel: null, now })

    const error = await session.login('an@fastmove.vn', password).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(AuthError)
    expect(error).toMatchObject({ code })
    expect(storage.items.size).toBe(0)
    expect(await session.token()).toBeNull()
  })
})

describe('a realm whose client has no direct grants', () => {
  function fakeBrowser(href: string) {
    const port = { current: href, assigned: [] as string[], replaced: [] as string[] }
    const redirect: RedirectPort = {
      href: () => port.current,
      assign: (url) => void port.assigned.push(url),
      replace: (url) => void port.replaced.push(url),
    }
    return { port, redirect }
  }

  test('signing in goes to the Keycloak login page with PKCE, and the code it sends back opens the session', async () => {
    const keycloak = stubKeycloak({ client: 'no-direct-grants' })
    const storage = memoryStorage()
    const before = fakeBrowser('http://localhost:5173/dang-nhap')
    const session = createKeycloakSession(CONFIG, { storage, channel: null, now, redirect: before.redirect })

    void session.login('an@fastmove.vn', 'dung-mat-khau')
    await vi.waitFor(() => expect(before.port.assigned).toHaveLength(1))
    const target = new URL(before.port.assigned[0] ?? '')
    expect(target.origin + target.pathname).toBe('http://kc.test/realms/loadmaster/protocol/openid-connect/auth')
    expect(Object.fromEntries([...target.searchParams].filter(([name]) => !['state', 'code_challenge'].includes(name)))).toStrictEqual({
      client_id: 'loadmaster-web',
      redirect_uri: 'http://localhost:5173/dang-nhap',
      response_type: 'code',
      response_mode: 'query',
      scope: 'openid',
      code_challenge_method: 'S256',
      login_hint: 'an@fastmove.vn',
    })
    const state = target.searchParams.get('state') ?? ''

    // Keycloak đưa trình duyệt về màn đăng nhập: trang tải lại, phiên mới đổi mã lấy token
    const after = fakeBrowser(`http://localhost:5173/dang-nhap?state=${state}&session_state=s1&code=kc-code`)
    const reloaded = createKeycloakSession(CONFIG, { storage, channel: null, now, redirect: after.redirect })
    expect(await reloaded.start()).toBe(true)
    expect(after.port.replaced).toStrictEqual(['/dang-nhap'])
    expect(await reloaded.token()).toBe('access-1')
    expect(keycloak.calls.at(-1)?.form).toMatchObject({ grant_type: 'authorization_code', code: 'kc-code', redirect_uri: 'http://localhost:5173/dang-nhap' })
  })

  test('a code that does not match the state this tab sent is dropped from the URL and opens nothing', async () => {
    const keycloak = stubKeycloak({ client: 'no-direct-grants' })
    const after = fakeBrowser('http://localhost:5173/dang-nhap?state=khong-phai&code=kc-code')
    const session = createKeycloakSession(CONFIG, { storage: memoryStorage(), channel: null, now, redirect: after.redirect })
    expect(await session.start()).toBe(false)
    expect(after.port.replaced).toStrictEqual(['/dang-nhap'])
    expect(keycloak.calls).toHaveLength(0)
  })
})

describe('keeping the session', () => {
  test('a token close to expiry is refreshed once, even when several calls ask at the same time', async () => {
    const keycloak = stubKeycloak()
    const storage = memoryStorage()
    const session = createKeycloakSession(CONFIG, { storage, channel: null, now })
    await session.login('an@fastmove.vn', 'dung-mat-khau')

    clock += 30_000
    expect(await session.token()).toBe('access-1')
    clock += 15_000
    expect(await Promise.all([session.token(), session.token(), session.token()])).toStrictEqual(['access-2', 'access-2', 'access-2'])
    expect(keycloak.calls.filter((call) => call.form.grant_type === 'refresh_token')).toHaveLength(1)
    expect(storage.items.get(REFRESH_KEY)).toBe('refresh-2')
  })

  test('reloading the page restores the session from the tab storage without asking for the password', async () => {
    stubKeycloak()
    const storage = memoryStorage()
    await createKeycloakSession(CONFIG, { storage, channel: null, now }).login('an@fastmove.vn', 'dung-mat-khau')

    const reloaded = createKeycloakSession(CONFIG, { storage, channel: null, now })
    expect(await reloaded.start()).toBe(true)
    expect(await reloaded.start()).toBe(true)
    expect(await reloaded.token()).toBe('access-2')
  })

  test('a tab with nothing stored and no other tab open starts signed out without calling Keycloak', async () => {
    const keycloak = stubKeycloak()
    const session = createKeycloakSession(CONFIG, { storage: memoryStorage(), channel: null, now })
    expect(await session.start()).toBe(false)
    expect(keycloak.calls).toHaveLength(0)
  })

  test('a session closed at Keycloak ends the app session and tells the listener', async () => {
    const keycloak = stubKeycloak()
    const storage = memoryStorage()
    const session = createKeycloakSession(CONFIG, { storage, channel: null, now })
    const ended = vi.fn()
    session.onEnded(ended)
    await session.login('an@fastmove.vn', 'dung-mat-khau')

    keycloak.endAllSessions()
    clock += 60_000
    expect(await session.token()).toBeNull()
    expect(ended).toHaveBeenCalledTimes(1)
    expect(storage.items.size).toBe(0)
  })

  test('a network failure while refreshing keeps the session so the next call tries again', async () => {
    const keycloak = stubKeycloak()
    const storage = memoryStorage()
    const session = createKeycloakSession(CONFIG, { storage, channel: null, now })
    await session.login('an@fastmove.vn', 'dung-mat-khau')

    clock += 60_000
    keycloak.fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await session.token()).toBeNull()
    expect(storage.items.get(REFRESH_KEY)).toBe('refresh-1')
    expect(await session.token()).toBe('access-2')
  })
})

describe('a 401 from the server', () => {
  test('refreshToken refreshes at once even when the token still looks valid; a network failure throws and keeps the session', async () => {
    const keycloak = stubKeycloak()
    const storage = memoryStorage()
    const session = createKeycloakSession(CONFIG, { storage, channel: null, now })
    await session.login('an@fastmove.vn', 'dung-mat-khau')

    expect(await session.refreshToken()).toBe('access-2')
    expect(await session.token()).toBe('access-2')
    keycloak.fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(session.refreshToken()).rejects.toThrow()
    expect(storage.items.get(REFRESH_KEY)).toBe('refresh-2')
  })

  test('reject ends the session in every tab and closes it at Keycloak', async () => {
    const keycloak = stubKeycloak()
    const hub = tabHub()
    const storage = memoryStorage()
    const first = createKeycloakSession(CONFIG, { storage, channel: hub.tab(), now })
    const second = createKeycloakSession(CONFIG, { storage: memoryStorage(), channel: hub.tab(), now })
    const firstEnded = vi.fn()
    const secondEnded = vi.fn()
    first.onEnded(firstEnded)
    second.onEnded(secondEnded)
    await first.login('an@fastmove.vn', 'dung-mat-khau')
    expect(await second.start()).toBe(true)

    first.reject()
    expect(firstEnded).toHaveBeenCalledTimes(1)
    expect(storage.items.size).toBe(0)
    await vi.waitFor(() => expect(secondEnded).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(keycloak.calls.at(-1)?.url).toBe(LOGOUT_URL))
    expect(await first.token()).toBeNull()
  })
})

describe('several tabs of the same browser', () => {
  test('a new tab takes the session of a signed-in tab, and signing out in one tab signs every tab out', async () => {
    const keycloak = stubKeycloak()
    const hub = tabHub()
    const first = createKeycloakSession(CONFIG, { storage: memoryStorage(), channel: hub.tab(), now })
    await first.login('an@fastmove.vn', 'dung-mat-khau')

    const secondStorage = memoryStorage()
    const second = createKeycloakSession(CONFIG, { storage: secondStorage, channel: hub.tab(), now })
    const secondEnded = vi.fn()
    second.onEnded(secondEnded)
    expect(await second.start()).toBe(true)
    expect(await second.token()).toBe('access-2')
    expect(secondStorage.items.get(REFRESH_KEY)).toBe('refresh-2')
    expect(secondStorage.items.get(SESSION_KEY)).toBeDefined()

    await first.logout()
    expect(keycloak.calls.at(-1)).toStrictEqual({ url: LOGOUT_URL, form: { client_id: 'loadmaster-web', refresh_token: 'refresh-1' } })
    await vi.waitFor(() => expect(secondEnded).toHaveBeenCalledTimes(1))
    expect(await second.token()).toBeNull()
    expect(secondStorage.items.size).toBe(0)
  })
})

describe('trusting only the right messages on the tab channel', () => {
  test('signing out in a tab of another session leaves this tab signed in', async () => {
    stubKeycloak()
    const hub = tabHub()
    const first = createKeycloakSession(CONFIG, { storage: memoryStorage(), channel: hub.tab(), now })
    const other = createKeycloakSession(CONFIG, { storage: memoryStorage(), channel: hub.tab(), now })
    const firstEnded = vi.fn()
    first.onEnded(firstEnded)
    await first.login('an@fastmove.vn', 'dung-mat-khau')
    await other.login('an@fastmove.vn', 'dung-mat-khau')

    await other.logout()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(firstEnded).not.toHaveBeenCalled()
    expect(await first.token()).toBe('access-1')
  })

  test('a logout message without the session id, or with another one, is ignored', async () => {
    stubKeycloak()
    const hub = tabHub()
    const storage = memoryStorage()
    const session = createKeycloakSession(CONFIG, { storage, channel: hub.tab(), now })
    const ended = vi.fn()
    session.onEnded(ended)
    await session.login('an@fastmove.vn', 'dung-mat-khau')

    const rogue = hub.tab()
    rogue.postMessage({ type: 'logout', session: 'doan-bua' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(ended).not.toHaveBeenCalled()

    rogue.postMessage({ type: 'logout', session: storage.items.get(SESSION_KEY) ?? '' })
    await vi.waitFor(() => expect(ended).toHaveBeenCalledTimes(1))
  })

  test('a new tab takes only the answer to its own question: a session nobody asked for is not installed', async () => {
    stubKeycloak()
    const hub = tabHub()
    const rogue = hub.tab()
    const storage = memoryStorage()
    const fresh = createKeycloakSession(CONFIG, { storage, channel: hub.tab(), now })
    // Tab lạ trả lời mọi câu hỏi bằng phiên của nó, nhưng sai mã hỏi
    rogue.subscribe((message) => {
      if (message.type === 'ask') rogue.postMessage({ type: 'share', nonce: 'khong-phai', refreshToken: 'refresh-la', session: 'phien-la' })
    })

    expect(await fresh.start()).toBe(false)
    expect(storage.items.size).toBe(0)
  })
})
