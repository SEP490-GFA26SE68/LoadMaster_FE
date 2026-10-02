/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   chưa có ở BE: saveProfile, changePassword
 *   isIncorrectPassword → không gọi BE (đọc mã lỗi)
 */

import { getMockDb, isMockDbError, type ProfileChanges } from '@/lib/mock-db'
import type { User } from '@/types/user'

/**
 * Lớp gọi API của màn Hồ sơ (LM-096, D-42) — nơi duy nhất của màn biết về kho. Kho sửa đúng người của phiên đang đăng nhập,
 * không nhận mã người dùng từ màn. Nối backend thật chỉ thay thân hàm.
 */

// chưa có ở BE
export function saveProfile(changes: ProfileChanges): Promise<User> {
  return getMockDb().updateProfile(changes)
}

export type PasswordChange = { currentPassword: string; nextPassword: string }

// chưa có ở BE
export function changePassword({ currentPassword, nextPassword }: PasswordChange): Promise<void> {
  return getMockDb().changePassword(currentPassword, nextPassword)
}

/** Kho từ chối vì mật khẩu hiện tại sai: màn báo lỗi tại ô "Mật khẩu hiện tại", không báo chung. */
// không gọi BE (đọc mã lỗi)
export function isIncorrectPassword(error: unknown): boolean {
  return isMockDbError(error) && error.code === 'PASSWORD_INCORRECT'
}
