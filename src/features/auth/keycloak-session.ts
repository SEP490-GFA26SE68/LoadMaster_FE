import { backendConfig, type BackendConfig } from '@/lib/backend-config'
import { AuthError } from './auth-api'
import { browserRedirect, challengeOf, randomText, type RedirectPort } from './keycloak-browser'
import {
  authorizationUrl,
  endKeycloakSession,
  KeycloakSessionEnded,
  requestCodeGrant,
  requestPasswordGrant,
  requestRefreshGrant,
  type KeycloakTokens,
} from './keycloak-token-api'

/**
 * Phiên đăng nhập ở Keycloak của backend (realm dùng chung với app mobile). Người dùng nhập email và mật khẩu **trên màn của app**:
 * app đổi chúng lấy token ở Keycloak (password grant, `keycloak-token-api.ts`) — không chuyển sang trang nào của Keycloak.
 * Chỉ `AuthProvider` dùng module này; test truyền một phiên giả cùng kiểu.
 *
 * Dự phòng: client của realm chưa bật Direct Access Grants (Keycloak trả `unauthorized_client`) thì `login` chuyển sang trang đăng nhập
 * của Keycloak (authorization code + PKCE, `redirect`), và `start` đổi mã Keycloak trả về `/dang-nhap` lấy token. Bật Direct Access
 * Grants rồi thì không bao giờ đi đường này.
 *
 * Token truy cập chỉ nằm trong bộ nhớ. Refresh token nằm trong `sessionStorage` của tab (AGENTS.md cấm `localStorage`) để tải lại
 * trang không bị đăng xuất; tab mới mở xin refresh token của tab đang đăng nhập qua `BroadcastChannel`, nên mở liên kết sang tab
 * mới không phải đăng nhập lại.
 *
 * Kênh giữa các tab chỉ tới được ngữ cảnh cùng origin, nhưng tab không tin mọi thư trên đó: mỗi lần đăng nhập sinh một **mã phiên**
 * ngẫu nhiên, đi cùng refresh token sang tab nhận phiên. Thư "đăng xuất" chỉ đóng tab có cùng mã phiên — tab của phiên khác (người
 * khác đăng nhập ở tab khác) không bị đăng xuất theo. Tab mới chỉ nhận refresh token trả lời **đúng lần hỏi của nó** (mã hỏi ngẫu
 * nhiên); thư trao phiên không ai hỏi bị bỏ, nên không tab nào cài được phiên của mình vào tab khác.
 */
export type KeycloakSession = {
  /** Gọi một lần khi mở app: `true` khi mở lại được phiên (của chính tab, hoặc của một tab khác đang đăng nhập). */
  start(): Promise<boolean>
  /** Đăng nhập bằng email và mật khẩu. Keycloak từ chối thì ném `AuthError` mang mã lý do. */
  login(email: string, password: string): Promise<void>
  /** Đóng phiên ở Keycloak, quên token và báo các tab khác cùng thoát. */
  logout(): Promise<void>
  /** Token truy cập còn hạn (tự làm mới khi sắp hết); `null` khi không còn phiên. */
  token(): Promise<string | null>
  /**
   * Làm mới token ngay, bỏ qua hạn còn lại — máy chủ vừa trả 401 cho token đang giữ. `null` khi Keycloak đã đóng phiên (phiên kết thúc,
   * `onEnded` được báo); mạng hỏng thì ném và phiên giữ nguyên.
   */
  refreshToken(): Promise<string | null>
  /** Máy chủ vẫn từ chối token vừa làm mới: đóng phiên ở mọi tab, báo `onEnded`. */
  reject(): void
  /** Phiên hết giữa chừng — không làm mới được nữa, tab khác vừa đăng xuất, hoặc máy chủ từ chối phiên. Trả hàm huỷ đăng ký. */
  onEnded(listener: () => void): () => void
}

/** Thư các tab trao nhau. Refresh token chỉ đi giữa các tab cùng origin, trả lời đúng mã hỏi; đăng xuất mang mã phiên. */
type TabMessage =
  | { type: 'ask'; nonce: string }
  | { type: 'share'; nonce: string; refreshToken: string; session: string }
  | { type: 'logout'; session: string }

export type { RedirectPort } from './keycloak-browser'

/** Kênh tối thiểu giữa các tab; app dùng `BroadcastChannel`, test truyền bản giả. */
export type AuthTabChannel = {
  postMessage(message: TabMessage): void
  subscribe(listener: (message: TabMessage) => void): () => void
}

export type KeycloakSessionDeps = {
  /** Mặc định `sessionStorage`; `null` là không lưu (tải lại trang thì phải đăng nhập lại). */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
  /** Mặc định `BroadcastChannel` khi trình duyệt có; `null` là không chia phiên giữa các tab. */
  channel?: AuthTabChannel | null
  now?: () => number
  /** Mặc định `window.location` + `history`; `null` là không có đường dự phòng qua trang Keycloak. */
  redirect?: RedirectPort | null
}

/** Đường dự phòng đang chờ Keycloak trả về: giữ trong `sessionStorage` của tab qua lần chuyển trang. */
type PendingRedirect = { state: string; verifier: string; redirectUri: string }

const PKCE_KEY = 'loadmaster.dang-nhap-keycloak'
/** Keycloak trả về màn đăng nhập; có người dùng rồi thì màn đó tự mở màn chính của vai trò. */
const REDIRECT_PATH = '/dang-nhap'

const REFRESH_KEY = 'loadmaster.phien-keycloak'
const SESSION_KEY = 'loadmaster.phien-keycloak-ma'
const CHANNEL_NAME = 'loadmaster-auth-v1'
/** Token của realm sống 60 giây: làm mới khi còn dưới ngần này. */
const MIN_TOKEN_VALIDITY_MS = 20_000
/** Tab mới chờ tab khác trả lời trong ngần này rồi coi như chưa đăng nhập. */
const ASK_TIMEOUT_MS = 300

function isTabMessage(value: unknown): value is TabMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false
  const text = (key: string) => typeof (value as Record<string, unknown>)[key] === 'string'
  if (value.type === 'ask') return text('nonce')
  if (value.type === 'share') return text('nonce') && text('refreshToken') && text('session')
  return value.type === 'logout' && text('session')
}

function browserStorage(): KeycloakSessionDeps['storage'] {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

function browserChannel(): AuthTabChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  const channel = new BroadcastChannel(CHANNEL_NAME)
  return {
    postMessage: (message) => channel.postMessage(message),
    subscribe(listener) {
      const onMessage = (event: MessageEvent) => {
        if (isTabMessage(event.data)) listener(event.data)
      }
      channel.addEventListener('message', onMessage)
      return () => channel.removeEventListener('message', onMessage)
    },
  }
}

export function createKeycloakSession(config: BackendConfig['keycloak'] = backendConfig.keycloak, deps: KeycloakSessionDeps = {}): KeycloakSession {
  const storage = deps.storage === undefined ? browserStorage() : deps.storage
  const channel = deps.channel === undefined ? browserChannel() : deps.channel
  const now = deps.now ?? Date.now
  const redirect = deps.redirect === undefined ? browserRedirect() : deps.redirect
  const listeners = new Set<() => void>()
  let access: { token: string; expiresAt: number } | null = null
  let refreshing: Promise<string | null> | null = null
  let started: Promise<boolean> | undefined

  /** Mã phiên còn trong bộ nhớ khi `storage` không lưu được: phiên chỉ sống tới khi tải lại trang, như refresh token. */
  let sessionInMemory: string | null = null
  const read = (key: string): string | null => {
    try {
      return storage?.getItem(key) ?? null
    } catch {
      return null
    }
  }
  const write = (key: string, value: string | null) => {
    try {
      if (value === null) storage?.removeItem(key)
      else storage?.setItem(key, value)
    } catch {
      // Không lưu được thì phiên chỉ sống tới khi tải lại trang
    }
  }
  const readRefreshToken = () => read(REFRESH_KEY)
  const writeRefreshToken = (value: string | null) => write(REFRESH_KEY, value)
  const readSession = () => read(SESSION_KEY) ?? sessionInMemory
  const writeSession = (value: string | null) => {
    sessionInMemory = value
    write(SESSION_KEY, value)
  }

  /** Giữ token; `session` là mã phiên mới (đăng nhập) — vắng khi chỉ làm mới: mã đang có giữ nguyên. */
  function keep(tokens: KeycloakTokens, session?: string) {
    access = { token: tokens.accessToken, expiresAt: now() + tokens.expiresInSeconds * 1000 }
    writeRefreshToken(tokens.refreshToken)
    if (session !== undefined) writeSession(session)
    else if (readSession() === null) writeSession(randomText(16))
  }

  function forget() {
    access = null
    refreshing = null
    writeRefreshToken(null)
    writeSession(null)
  }

  /** Báo các tab cùng phiên đăng xuất theo; tab của phiên khác bỏ qua thư này. */
  function broadcastLogout(session: string | null) {
    if (session !== null) channel?.postMessage({ type: 'logout', session })
  }

  /** Phiên mất từ bên ngoài: quên token và báo `AuthProvider` (chỉ khi tab đang có phiên). */
  function end() {
    const hadSession = access !== null || readRefreshToken() !== null
    forget()
    if (hadSession) listeners.forEach((listener) => listener())
  }

  /** Một lượt làm mới cho mọi lượt gọi cùng lúc. Phiên đã đóng ở Keycloak thì trả `null`; mạng hỏng thì ném. */
  function refresh(): Promise<string | null> {
    const refreshToken = readRefreshToken()
    if (refreshToken === null) return Promise.resolve(null)
    refreshing ??= requestRefreshGrant(config, refreshToken)
      .then(
        (tokens) => {
          keep(tokens)
          return tokens.accessToken
        },
        (error: unknown) => {
          if (!(error instanceof KeycloakSessionEnded)) throw error
          end()
          return null
        },
      )
      .finally(() => {
        refreshing = null
      })
    return refreshing
  }

  /** Xin phiên của tab đang đăng nhập; chỉ nhận thư trả lời đúng mã hỏi của lần này. */
  function askOtherTabs(): Promise<{ refreshToken: string; session: string } | null> {
    if (channel === null) return Promise.resolve(null)
    const nonce = randomText(16)
    return new Promise((resolve) => {
      const stop = channel.subscribe((message) => {
        if (message.type !== 'share' || message.nonce !== nonce) return
        clearTimeout(timer)
        stop()
        resolve({ refreshToken: message.refreshToken, session: message.session })
      })
      const timer = setTimeout(() => {
        stop()
        resolve(null)
      }, ASK_TIMEOUT_MS)
      channel.postMessage({ type: 'ask', nonce })
    })
  }

  function readPending(): PendingRedirect | null {
    try {
      const raw = storage?.getItem(PKCE_KEY) ?? null
      storage?.removeItem(PKCE_KEY)
      const value: unknown = raw === null ? null : JSON.parse(raw)
      if (typeof value !== 'object' || value === null) return null
      const { state, verifier, redirectUri } = value as Record<string, unknown>
      return typeof state === 'string' && typeof verifier === 'string' && typeof redirectUri === 'string' ? { state, verifier, redirectUri } : null
    } catch {
      return null
    }
  }

  /** Sang trang đăng nhập của Keycloak; trang này không quay lại nữa (Keycloak đưa về `/dang-nhap`). */
  async function beginRedirect(port: RedirectPort, loginHint: string): Promise<never> {
    const pending: PendingRedirect = { state: randomText(16), verifier: randomText(48), redirectUri: new URL(REDIRECT_PATH, port.href()).toString() }
    storage?.setItem(PKCE_KEY, JSON.stringify(pending))
    port.assign(authorizationUrl(config, { redirectUri: pending.redirectUri, state: pending.state, codeChallenge: await challengeOf(pending.verifier), loginHint }))
    return new Promise<never>(() => undefined)
  }

  /** Keycloak vừa trả về kèm `code`: đổi lấy token và xoá `code`, `state` khỏi URL. `false` khi URL không phải lượt trả về của tab này. */
  async function completeRedirect(port: RedirectPort): Promise<boolean> {
    const url = new URL(port.href())
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (url.pathname !== REDIRECT_PATH || state === null || (code === null && !url.searchParams.has('error'))) return false
    const pending = readPending()
    for (const name of ['code', 'state', 'session_state', 'iss', 'error', 'error_description']) url.searchParams.delete(name)
    port.replace(url.pathname + url.search + url.hash)
    if (pending === null || pending.state !== state || code === null) return false
    keep(await requestCodeGrant(config, code, pending.verifier, pending.redirectUri), randomText(16))
    return true
  }

  channel?.subscribe((message) => {
    const refreshToken = readRefreshToken()
    const session = readSession()
    if (message.type === 'ask' && refreshToken !== null && session !== null) {
      channel.postMessage({ type: 'share', nonce: message.nonce, refreshToken, session })
    }
    if (message.type === 'logout' && session !== null && message.session === session) end()
  })

  return {
    // React (StrictMode) chạy effect hai lần: các lần gọi sau nhận lại đúng kết quả lần đầu
    start() {
      started ??= (async () => {
        if (redirect !== null && (await completeRedirect(redirect))) return true
        if (readRefreshToken() === null) {
          const shared = await askOtherTabs()
          if (shared === null) return false
          writeRefreshToken(shared.refreshToken)
          writeSession(shared.session)
        }
        return (await refresh()) !== null
      })()
      return started
    },
    async login(email, password) {
      try {
        keep(await requestPasswordGrant(config, email, password), randomText(16))
      } catch (error) {
        // Client chưa bật Direct Access Grants: đăng nhập ở trang của Keycloak thay vì báo lỗi cấu hình
        if (redirect !== null && error instanceof AuthError && error.code === 'login-not-enabled') await beginRedirect(redirect, email)
        throw error
      }
    },
    async logout() {
      const refreshToken = readRefreshToken()
      const session = readSession()
      forget()
      broadcastLogout(session)
      if (refreshToken !== null) await endKeycloakSession(config, refreshToken)
    },
    async token() {
      if (access !== null && access.expiresAt - now() > MIN_TOKEN_VALIDITY_MS) return access.token
      try {
        return await refresh()
      } catch {
        // Mạng hỏng lúc làm mới: giữ phiên để lượt sau thử lại; lượt này đi không token và nhận 401
        return null
      }
    },
    refreshToken: () => refresh(),
    reject() {
      const refreshToken = readRefreshToken()
      const session = readSession()
      end()
      broadcastLogout(session)
      // Đóng cả phiên ở Keycloak; hỏng thì thôi — tab này đã quên token
      if (refreshToken !== null) endKeycloakSession(config, refreshToken).catch(() => undefined)
    },
    onEnded(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
