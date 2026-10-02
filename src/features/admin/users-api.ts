/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   chưa có ở BE: fetchUsers, fetchCompanies, createUser, updateUser, setUserStatus, deleteUser, resetPassword
 */

import { getMockDb, type Company, type NewUser, type TemporaryPassword, type UserChanges } from '@/lib/mock-db'
import type { User, UserStatus } from '@/types/user'

/**
 * Lớp gọi API của màn Người dùng (LM-092, D-42) — nơi duy nhất trong màn biết về kho. Kho kiểm luật (email trùng, tự khoá/xoá mình,
 * người quản trị cuối cùng, tài xế còn chuyến, phạm vi theo vai trò — FE-0-08) và từ chối bằng `MockDbError`; màn hiện lỗi qua
 * `dataErrorMessage`. Mọi hàm ghi thêm một sự kiện nhật ký. Nối backend thật chỉ thay thân hàm.
 */

/** Người dùng trong phạm vi của người đang đăng nhập: quản trị hệ thống nhận mọi tài khoản, quản trị công ty chỉ người của công ty mình. */
// chưa có ở BE
export function fetchUsers(): Promise<User[]> {
  return getMockDb().listUsers()
}

/** Công ty trong phạm vi của người đang đăng nhập — tên công ty cho cột và bộ lọc công ty của quản trị hệ thống (màn Người dùng, Nhật ký). */
// chưa có ở BE
export function fetchCompanies(): Promise<Company[]> {
  return getMockDb().listCompanies()
}

/** Kho cấp mã, trạng thái hoạt động và mật khẩu tạm — mật khẩu chỉ có trong kết quả này. */
// chưa có ở BE
export function createUser(input: NewUser): Promise<TemporaryPassword> {
  return getMockDb().createUser(input)
}

// chưa có ở BE
export function updateUser(id: string, changes: UserChanges): Promise<User> {
  return getMockDb().updateUser(id, changes)
}

// chưa có ở BE
export function setUserStatus(id: string, status: UserStatus): Promise<User> {
  return getMockDb().setUserStatus(id, status)
}

// chưa có ở BE
export function deleteUser(id: string): Promise<void> {
  return getMockDb().deleteUser(id)
}

/** Mật khẩu cũ hết hiệu lực ngay; mật khẩu tạm mới chỉ trả về một lần. */
// chưa có ở BE
export function resetPassword(id: string): Promise<TemporaryPassword> {
  return getMockDb().resetPassword(id)
}
