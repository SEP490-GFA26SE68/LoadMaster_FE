/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   GET /api/users/me — fetchBackendUser (chế độ `VITE_AUTH_SOURCE=keycloak`; token lấy ở Keycloak bằng form của app, `keycloak-session.ts`)
 *   chỉ kho mẫu: login, logout, restoreSession, currentSessionUser
 */

import { api, isApiError } from '@/lib/api-client'
import { backendConfig } from '@/lib/backend-config'
import { DEMO_ACCOUNTS, getMockDb, isMockDbError } from '@/lib/mock-db'
import type { User } from '@/types/user'
import { isActiveOnBackend, roleOfBackend, userFromBackend, type BackendUserProfile } from './backend-user'

/**
 * Lớp gọi API xác thực (D-42): đăng nhập, đăng xuất và phiên đi qua kho mock như qua server — kho giữ phiên để ghi người làm
 * vào nhật ký. Nối backend thật chỉ thay thân hàm; phần còn lại của app không đổi.
 */

/**
 * Lỗi trả về dạng mã; màn đăng nhập dịch mã sang câu theo ngôn ngữ đang chọn. Bốn mã cuối chỉ có ở chế độ Keycloak:
 * `password-change-required` mật khẩu đúng nhưng là mật khẩu tạm · `login-not-enabled` client của realm chưa bật đăng nhập bằng mật
 * khẩu · `account-not-linked` Keycloak nhận tài khoản nhưng máy chủ không có người dùng nào gắn với nó · `session-rejected` máy chủ
 * không nhận token (máy chủ và app không dùng cùng một Keycloak).
 */
export type AuthErrorCode =
  | 'invalid-credentials'
  | 'account-suspended'
  | 'role-unknown'
  | 'password-change-required'
  | 'login-not-enabled'
  | 'account-not-linked'
  | 'session-rejected'

export class AuthError extends Error {
  readonly code: AuthErrorCode

  constructor(code: AuthErrorCode) {
    super(code)
    this.name = 'AuthError'
    this.code = code
  }
}

// chưa có ở BE
export async function login(email: string, password: string): Promise<User> {
  try {
    return await getMockDb().authenticate(email, password)
  } catch (error) {
    // Một mã chung cho sai email và sai mật khẩu, không tiết lộ email nào có thật
    if (isMockDbError(error) && error.code === 'INVALID_CREDENTIALS') throw new AuthError('invalid-credentials')
    if (isMockDbError(error) && error.code === 'ACCOUNT_SUSPENDED') throw new AuthError('account-suspended')
    throw error
  }
}

// chưa có ở BE
export async function logout(): Promise<void> {
  await getMockDb().signOut()
}

/**
 * Người đang đăng nhập ở backend, sau khi Keycloak đã cấp phiên. Dữ liệu vận hành của app còn là kho mẫu, nên kho mẫu được đặt phiên
 * của tài khoản mẫu cùng vai trò — danh tính hiện trên màn là của backend (`userFromBackend`).
 */
// GET /api/users/me
export async function fetchBackendUser(): Promise<User> {
  const profile = await readBackendProfile()
  const role = roleOfBackend(profile.userRoleType)
  if (role === null) throw new AuthError('role-unknown')
  if (!isActiveOnBackend(profile.status)) throw new AuthError('account-suspended')
  const standIn = getMockDb().restoreSession(DEMO_ACCOUNTS.find((account) => account.role === role)?.id ?? null)
  if (standIn === null) throw new AuthError('role-unknown')
  const user = userFromBackend(profile, role, standIn)
  backendIdentity = { ...user, id: String(profile.id), companyId: profile.companyId === null ? undefined : String(profile.companyId) }
  return user
}

/**
 * Người đăng nhập theo **mã của backend** (mã người dùng, mã công ty) cho các `-api.ts` cần biết "tôi là ai" ở máy chủ — khác người dùng
 * của `fetchBackendUser`, vốn mang mã của tài khoản mẫu để kho mẫu chạy được. `null` khi chưa đăng nhập bằng backend.
 */
let backendIdentity: User | null = null

export function getCachedCurrentUser(): User | null {
  return backendIdentity
}

/** Đang đăng nhập bằng backend (`VITE_AUTH_SOURCE=keycloak` và `GET /api/users/me` đã trả người dùng). Kho mẫu luôn là `false`. */
export function isAuthenticated(): boolean {
  return backendConfig.authSource === 'keycloak' && backendIdentity !== null
}

/** Phiên backend đã đóng (đăng xuất, hết phiên): các `-api.ts` thôi gọi máy chủ. */
export function forgetBackendUser(): void {
  backendIdentity = null
}

async function readBackendProfile(): Promise<BackendUserProfile> {
  try {
    return await api().get<BackendUserProfile>('/api/users/me')
  } catch (error) {
    // Backend tìm người dùng theo `sub` của token (`users.keycloak_id`): không có là tài khoản Keycloak chưa gắn với ai
    // Theo mã HTTP: backend `develop` chưa trả `code` thống nhất cho hai lỗi này
    if (isApiError(error) && (error.status === 404 || error.code === 'USER_PROFILE_NOT_FOUND')) throw new AuthError('account-not-linked')
    if (isApiError(error) && error.status === 401) throw new AuthError('session-rejected')
    throw error
  }
}

/**
 * Phiên có sẵn khi mở trang (như cookie): trả người dùng hiện tại của kho, `null` khi tài khoản không còn hoặc đã bị khoá.
 * Đồng bộ vì chạy lúc khởi tạo `AuthProvider`.
 */
// chưa có ở BE
export function restoreSession(userId: string | null): User | null {
  return getMockDb().restoreSession(userId)
}

/** Người dùng của phiên, đọc lại sau khi sửa hồ sơ. */
// chưa có ở BE
export function currentSessionUser(): User | null {
  return getMockDb().sessionUser()
}
