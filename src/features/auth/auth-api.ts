/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   GET /api/users/me — fetchBackendUser (chế độ `VITE_AUTH_SOURCE=keycloak`; đăng nhập và đăng xuất do Keycloak làm, `keycloak-session.ts`)
 *   chỉ kho mẫu: login, logout, restoreSession, currentSessionUser
 */

import { api } from '@/lib/api-client'
import { DEMO_ACCOUNTS, getMockDb, isMockDbError } from '@/lib/mock-db'
import type { User } from '@/types/user'
import { isActiveOnBackend, roleOfBackend, userFromBackend, type BackendUserProfile } from './backend-user'

/**
 * Lớp gọi API xác thực (D-42): đăng nhập, đăng xuất và phiên đi qua kho mock như qua server — kho giữ phiên để ghi người làm
 * vào nhật ký. Nối backend thật chỉ thay thân hàm; phần còn lại của app không đổi.
 */

/** Lỗi trả về dạng mã; màn đăng nhập dịch mã sang câu theo ngôn ngữ đang chọn. */
export type AuthErrorCode = 'invalid-credentials' | 'account-suspended' | 'role-unknown'

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
  const profile = await api().get<BackendUserProfile>('/api/users/me')
  const role = roleOfBackend(profile.userRoleType)
  if (role === null) throw new AuthError('role-unknown')
  if (!isActiveOnBackend(profile.status)) throw new AuthError('account-suspended')
  const standIn = getMockDb().restoreSession(DEMO_ACCOUNTS.find((account) => account.role === role)?.id ?? null)
  if (standIn === null) throw new AuthError('role-unknown')
  return userFromBackend(profile, role, standIn)
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
