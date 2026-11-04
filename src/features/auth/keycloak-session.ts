import { backendConfig, type BackendConfig } from '@/lib/backend-config'
import {
  endKeycloakSession,
  KeycloakSessionEnded,
  requestPasswordGrant,
  requestRefreshGrant,
  type KeycloakTokens,
} from './keycloak-token-api'

/**
 * Phiên đăng nhập ở Keycloak của backend (realm dùng chung với app mobile). Người dùng nhập email và mật khẩu **trên màn của app**:
 * app đổi chúng lấy token ở Keycloak (password grant, `keycloak-token-api.ts`) — không chuyển sang trang nào của Keycloak.
 * Chỉ `AuthProvider` dùng module này; test truyền một phiên giả cùng kiểu.
 *
 * Token truy cập chỉ nằm trong bộ nhớ. Refresh token nằm trong `sessionStorage` của tab (AGENTS.md cấm `localStorage`) để tải lại
 * trang không bị đăng xuất; tab mới mở xin refresh token của tab đang đăng nhập qua `BroadcastChannel`, nên mở liên kết sang tab
 * mới không phải đăng nhập lại.
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
  /** Phiên hết giữa chừng — không làm mới được nữa, hoặc tab khác vừa đăng xuất. Trả hàm huỷ đăng ký. */
  onEnded(listener: () => void): () => void
}

/** Thư các tab trao nhau. Refresh token chỉ đi giữa các tab cùng origin. */
type TabMessage = { type: 'ask' } | { type: 'share'; refreshToken: string } | { type: 'logout' }

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
}

const REFRESH_KEY = 'loadmaster.phien-keycloak'
const CHANNEL_NAME = 'loadmaster-auth-v1'
/** Token của realm sống 60 giây: làm mới khi còn dưới ngần này. */
const MIN_TOKEN_VALIDITY_MS = 20_000
/** Tab mới chờ tab khác trả lời trong ngần này rồi coi như chưa đăng nhập. */
const ASK_TIMEOUT_MS = 300

function isTabMessage(value: unknown): value is TabMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false
  if (value.type === 'share') return 'refreshToken' in value && typeof value.refreshToken === 'string'
  return value.type === 'ask' || value.type === 'logout'
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
  const listeners = new Set<() => void>()
  let access: { token: string; expiresAt: number } | null = null
  let refreshing: Promise<string | null> | null = null
  let started: Promise<boolean> | undefined

  const readRefreshToken = (): string | null => {
    try {
      return storage?.getItem(REFRESH_KEY) ?? null
    } catch {
      return null
    }
  }
  const writeRefreshToken = (value: string | null) => {
    try {
      if (value === null) storage?.removeItem(REFRESH_KEY)
      else storage?.setItem(REFRESH_KEY, value)
    } catch {
      // Không lưu được thì phiên chỉ sống tới khi tải lại trang
    }
  }

  function keep(tokens: KeycloakTokens) {
    access = { token: tokens.accessToken, expiresAt: now() + tokens.expiresInSeconds * 1000 }
    writeRefreshToken(tokens.refreshToken)
  }

  function forget() {
    access = null
    refreshing = null
    writeRefreshToken(null)
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

  function askOtherTabs(): Promise<string | null> {
    if (channel === null) return Promise.resolve(null)
    return new Promise((resolve) => {
      const stop = channel.subscribe((message) => {
        if (message.type !== 'share') return
        clearTimeout(timer)
        stop()
        resolve(message.refreshToken)
      })
      const timer = setTimeout(() => {
        stop()
        resolve(null)
      }, ASK_TIMEOUT_MS)
      channel.postMessage({ type: 'ask' })
    })
  }

  channel?.subscribe((message) => {
    const refreshToken = readRefreshToken()
    if (message.type === 'ask' && refreshToken !== null) channel.postMessage({ type: 'share', refreshToken })
    if (message.type === 'logout') end()
  })

  return {
    // React (StrictMode) chạy effect hai lần: các lần gọi sau nhận lại đúng kết quả lần đầu
    start() {
      started ??= (async () => {
        if (readRefreshToken() === null) {
          const shared = await askOtherTabs()
          if (shared === null) return false
          writeRefreshToken(shared)
        }
        return (await refresh()) !== null
      })()
      return started
    },
    async login(email, password) {
      keep(await requestPasswordGrant(config, email, password))
    },
    async logout() {
      const refreshToken = readRefreshToken()
      forget()
      channel?.postMessage({ type: 'logout' })
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
    onEnded(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
