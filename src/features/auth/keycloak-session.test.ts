import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { AuthError } from './auth-api'
import { createKeycloakSession, type AuthTabChannel } from './keycloak-session'

/**
 * Phiên Keycloak đăng nhập ngay trong app (password grant), với Keycloak giả, `sessionStorage` giả và kênh giữa các tab giả.
 * Câu lỗi của Keycloak giả là đúng câu realm thật trả (đã thử trên Keycloak 26 của backend).
 */

const CONFIG = { url: 'http://kc.test', realm: 'loadmaster', clientId: 'loadmaster-web' }
const TOKEN_URL = 'http://kc.test/realms/loadmaster/protocol/openid-connect/token'
const LOGOUT_URL = 'http://kc.test/realms/loadmaster/protocol/openid-connect/logout'

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
  test('trades email and password for tokens at the realm token endpoint and keeps only the refresh token in the tab storage', async () => {
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
    expect([...storage.items.values()]).toStrictEqual(['refresh-1'])
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
    expect([...storage.items.values()]).toStrictEqual(['refresh-2'])
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
    expect(storage.items.size).toBe(1)
    expect(await session.token()).toBe('access-2')
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
    expect(secondStorage.items.size).toBe(1)

    await first.logout()
    expect(keycloak.calls.at(-1)).toStrictEqual({ url: LOGOUT_URL, form: { client_id: 'loadmaster-web', refresh_token: 'refresh-1' } })
    await vi.waitFor(() => expect(secondEnded).toHaveBeenCalledTimes(1))
    expect(await second.token()).toBeNull()
    expect(secondStorage.items.size).toBe(0)
  })
})
