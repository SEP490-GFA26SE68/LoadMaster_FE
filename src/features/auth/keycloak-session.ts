import type Keycloak from 'keycloak-js'
import { backendConfig, type BackendConfig } from '@/lib/backend-config'

/**
 * Phiên đăng nhập ở Keycloak của backend (realm dùng chung với app mobile). App không tự thu mật khẩu: nó chuyển người dùng sang
 * trang đăng nhập của Keycloak (PKCE) rồi nhận phiên về. Chỉ `AuthProvider` dùng module này; test truyền một phiên giả cùng kiểu.
 */
export type KeycloakSession = {
  /** Gọi một lần khi mở app: `true` khi trình duyệt còn phiên ở Keycloak (kể cả vừa quay về từ trang đăng nhập). */
  start(): Promise<boolean>
  /** Chuyển sang trang đăng nhập của Keycloak; xong thì Keycloak đưa người dùng về `returnTo`. */
  login(returnTo: string): Promise<void>
  /** Đóng phiên ở Keycloak rồi về `returnTo`. */
  logout(returnTo: string): Promise<void>
  /** Token truy cập còn hạn (tự làm mới khi sắp hết); `null` khi không còn phiên. */
  token(): Promise<string | null>
}

/** Token của realm sống 60 giây: làm mới khi còn dưới ngần này giây. */
const MIN_TOKEN_VALIDITY_SECONDS = 20

/**
 * `keycloak-js` chỉ được tải khi app chạy ở chế độ Keycloak (import động): chế độ kho mẫu không gánh thư viện này.
 * Kiểm tra phiên có sẵn bằng iframe ẩn tới `public/silent-check-sso.html`, nên mở app không bị chuyển trang qua lại.
 */
export function createKeycloakSession(config: BackendConfig['keycloak'] = backendConfig.keycloak): KeycloakSession {
  let instance: Promise<Keycloak> | undefined
  let started: Promise<boolean> | undefined
  const keycloak = () => {
    instance ??= import('keycloak-js').then(({ default: KeycloakClient }) => new KeycloakClient(config))
    return instance
  }

  return {
    // `keycloak-js` chỉ cho khởi tạo một lần; React (StrictMode) chạy effect hai lần, nên các lần gọi sau nhận lại đúng kết quả đầu
    start() {
      started ??= keycloak().then((client) =>
        client.init({
          onLoad: 'check-sso',
          pkceMethod: 'S256',
          silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
          checkLoginIframe: false,
        }),
      )
      return started
    },
    async login(returnTo) {
      await (await keycloak()).login({ redirectUri: returnTo })
    },
    async logout(returnTo) {
      await (await keycloak()).logout({ redirectUri: returnTo })
    },
    async token() {
      const client = await keycloak()
      if (!client.authenticated) return null
      try {
        await client.updateToken(MIN_TOKEN_VALIDITY_SECONDS)
      } catch {
        // Phiên ở Keycloak đã hết: coi như chưa đăng nhập, lượt gọi backend sẽ nhận 401
        return null
      }
      return client.token ?? null
    },
  }
}
