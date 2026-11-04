/**
 * Hàm → endpoint Keycloak (realm `VITE_KEYCLOAK_REALM`, client công khai `VITE_KEYCLOAK_CLIENT_ID`, cần bật Direct Access Grants):
 *   requestPasswordGrant → POST /realms/{realm}/protocol/openid-connect/token (grant_type=password)
 *   requestRefreshGrant  → POST /realms/{realm}/protocol/openid-connect/token (grant_type=refresh_token)
 *   endKeycloakSession   → POST /realms/{realm}/protocol/openid-connect/logout
 *
 * Nơi duy nhất của app gọi `fetch` tới Keycloak (backend LoadMaster đi qua `lib/api-client.ts`). Chỉ `keycloak-session.ts` dùng.
 */

import type { BackendConfig } from '@/lib/backend-config'
import { AuthError, type AuthErrorCode } from './auth-api'

type KeycloakConfig = BackendConfig['keycloak']

export type KeycloakTokens = {
  readonly accessToken: string
  /** Thời gian sống của token truy cập, giây (realm hiện đặt 60). */
  readonly expiresInSeconds: number
  readonly refreshToken: string
}

/** Refresh token không dùng được nữa: phiên ở Keycloak đã đóng (đăng xuất ở tab khác, quá hạn, quản trị viên đóng phiên). */
export class KeycloakSessionEnded extends Error {
  constructor() {
    super('KEYCLOAK_SESSION_ENDED')
    this.name = 'KeycloakSessionEnded'
  }
}

const TIMEOUT_MS = 15_000

/**
 * Câu `error_description` của lỗi `invalid_grant` → mã của app. Keycloak trả câu sai mật khẩu cả khi tài khoản đang bị khoá tạm vì
 * nhập sai nhiều lần (cố ý, để không lộ tài khoản nào có thật). "Account is not fully set up" chỉ đến khi mật khẩu **đúng** nhưng
 * tài khoản còn việc phải làm — với tài khoản do backend tạo là đặt mật khẩu mới thay mật khẩu tạm.
 */
const GRANT_ERRORS: Readonly<Record<string, AuthErrorCode>> = {
  'Invalid user credentials': 'invalid-credentials',
  'Account disabled': 'account-suspended',
  'Account is not fully set up': 'password-change-required',
}

const endpoint = (config: KeycloakConfig, path: 'token' | 'logout') =>
  `${config.url}/realms/${encodeURIComponent(config.realm)}/protocol/openid-connect/${path}`

/** Form urlencoded, không header riêng: trình duyệt gửi thẳng, không cần preflight CORS. */
async function post(url: string, fields: Record<string, string>): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await response.json()
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

async function tokensOf(response: Response): Promise<KeycloakTokens> {
  const body = await bodyOf(response)
  const { access_token: accessToken, expires_in: expiresInSeconds, refresh_token: refreshToken } = body
  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string' || typeof expiresInSeconds !== 'number') {
    throw new Error('Keycloak trả token không đúng dạng')
  }
  return { accessToken, expiresInSeconds, refreshToken }
}

// POST /realms/{realm}/protocol/openid-connect/token (grant_type=password)
export async function requestPasswordGrant(config: KeycloakConfig, email: string, password: string): Promise<KeycloakTokens> {
  const response = await post(endpoint(config, 'token'), {
    client_id: config.clientId,
    grant_type: 'password',
    username: email,
    password,
    scope: 'openid',
  })
  if (response.ok) return tokensOf(response)
  const { error, error_description: description } = await bodyOf(response)
  const code = error === 'invalid_grant' && typeof description === 'string' ? GRANT_ERRORS[description] : undefined
  if (code !== undefined) throw new AuthError(code)
  // Client của realm chưa bật đăng nhập bằng mật khẩu (Direct Access Grants): lỗi cấu hình, không phải lỗi của người dùng
  if (error === 'unauthorized_client') throw new AuthError('login-not-enabled')
  throw new Error(`Keycloak từ chối đăng nhập: HTTP ${response.status} ${typeof error === 'string' ? error : ''}`)
}

// POST /realms/{realm}/protocol/openid-connect/token (grant_type=refresh_token)
export async function requestRefreshGrant(config: KeycloakConfig, refreshToken: string): Promise<KeycloakTokens> {
  const response = await post(endpoint(config, 'token'), {
    client_id: config.clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
  if (response.ok) return tokensOf(response)
  const { error } = await bodyOf(response)
  if (error === 'invalid_grant') throw new KeycloakSessionEnded()
  throw new Error(`Keycloak từ chối làm mới phiên: HTTP ${response.status}`)
}

/** Đóng phiên ở Keycloak. Không chắc được (mạng hỏng) thì thôi: phiên tự hết hạn, app đã quên token. */
// POST /realms/{realm}/protocol/openid-connect/logout
export async function endKeycloakSession(config: KeycloakConfig, refreshToken: string): Promise<void> {
  try {
    await post(endpoint(config, 'logout'), { client_id: config.clientId, refresh_token: refreshToken })
  } catch {
    // Đăng xuất ở app vẫn tiếp tục
  }
}
