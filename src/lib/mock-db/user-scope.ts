import { COMPANY_ROLES, isPlatformRole, PLATFORM_ROLES, type Role, type User } from '@/types/user'

/**
 * Phạm vi quản lý người dùng (D-65, FE-0-08). Hai phạm vi không giao nhau, vai trò quyết định phạm vi:
 *
 * - `platform` — quản trị hệ thống: thấy mọi tài khoản; **tạo, sửa, xoá** tài khoản nền tảng (ba vai trò nền tảng); với nhân sự của các
 *   công ty chỉ **khoá, mở khoá, đặt lại mật khẩu**.
 * - `company` — quản trị công ty: chỉ thấy và quản lý người của công ty mình, với năm vai trò công ty.
 *
 * Một tài khoản không đổi phạm vi: vai trò nền tảng không thành vai trò công ty (tài khoản sẽ không có công ty) và ngược lại (người đó
 * sẽ rời công ty). Hàm thuần — kho (`db-users.ts`) từ chối theo luật này, màn Người dùng (`account-guards.ts`) dùng cùng hàm để làm
 * mờ thao tác trước khi gửi.
 */
export type UserScope = 'platform' | 'company'

export function userScopeOf(role: Role): UserScope {
  return isPlatformRole(role) ? 'platform' : 'company'
}

/** Vai trò người quản trị của phạm vi được tạo và gán, theo thứ tự của `ROLES`. */
export function rolesInScope(scope: UserScope): readonly Role[] {
  return scope === 'platform' ? PLATFORM_ROLES : COMPANY_ROLES
}

type Account = Pick<User, 'id' | 'role' | 'status' | 'companyId'>

/**
 * `user` là người quản trị **đang hoạt động cuối cùng** của phạm vi mình: quản trị hệ thống cuối cùng của nền tảng, hoặc quản trị công ty
 * cuối cùng của công ty đó (quản trị công ty của công ty khác không tính). Khoá, xoá hay hạ vai trò người này là để phạm vi đó không còn
 * ai quản lý người dùng.
 */
export function isLastActiveAdmin(user: Account, users: Iterable<Account>): boolean {
  if (user.status !== 'active' || (user.role !== 'systemAdmin' && user.role !== 'companyAdmin')) return false
  for (const other of users) {
    if (other.id !== user.id && other.role === user.role && other.status === 'active' && other.companyId === user.companyId) return false
  }
  return true
}
