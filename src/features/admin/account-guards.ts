import { isLastActiveAdmin, userScopeOf } from '@/lib/mock-db'
import type { User } from '@/types/user'

/**
 * Lý do một thao tác trên tài khoản bị chặn: nhãn `admin.users.blocked.<lý do>`.
 * - `self`: tài khoản đang đăng nhập.
 * - `lastSystemAdmin` / `lastCompanyAdmin`: người quản trị đang hoạt động cuối cùng của nền tảng / của công ty đó.
 * - `companyManaged`: nhân sự công ty, người xem là quản trị hệ thống — sửa và xoá là việc của quản trị công ty đó.
 */
export type AccountBlock = 'self' | 'lastSystemAdmin' | 'lastCompanyAdmin' | 'companyManaged'

export type AccountGuards = {
  /** Mở form sửa thông tin. */
  readonly edit: AccountBlock | null
  /** Khoá tài khoản (mở khoá thì chỉ chặn khi là chính mình, và người đang đăng nhập không thể đang bị khoá). */
  readonly lock: AccountBlock | null
  readonly remove: AccountBlock | null
  /** Đổi vai trò trong form sửa. */
  readonly role: AccountBlock | null
}

type Account = Pick<User, 'id' | 'role' | 'status' | 'companyId'>

/**
 * Chặn trước, kèm lý do, những thao tác kho sẽ từ chối (LM-092, FE-0-08; cùng luật `SELF_CHANGE_FORBIDDEN`, `LAST_ADMIN`,
 * `USER_MANAGED_BY_COMPANY` của `db-users.ts`): không tự khoá, xoá hay đổi vai trò của mình; quản trị hệ thống không sửa, không xoá
 * nhân sự của công ty (khoá, mở khoá, đặt lại mật khẩu thì được); mỗi phạm vi giữ một người quản trị đang hoạt động. `users` là danh
 * sách người xem thấy — kho đã lọc theo phạm vi nên đủ để đếm người quản trị của công ty đó. Đặt lại mật khẩu không bao giờ bị chặn.
 * Luật cần dữ liệu khác (tài xế còn chuyến) để kho trả lỗi.
 */
export function accountGuards(user: Account, viewer: Pick<User, 'id' | 'role'> | null, users: readonly Account[]): AccountGuards {
  if (viewer !== null && user.id === viewer.id) return { edit: null, lock: 'self', remove: 'self', role: 'self' }
  const last = !isLastActiveAdmin(user, users) ? null : user.role === 'systemAdmin' ? 'lastSystemAdmin' : 'lastCompanyAdmin'
  if (viewer !== null && userScopeOf(viewer.role) === 'platform' && userScopeOf(user.role) === 'company') {
    return { edit: 'companyManaged', lock: last, remove: 'companyManaged', role: 'companyManaged' }
  }
  return { edit: null, lock: last, remove: last, role: last }
}

/** Lý do chặn thao tác Khoá/Mở khoá theo trạng thái hiện tại: mở khoá chỉ bị chặn với chính mình, khoá theo cả luật người quản trị cuối cùng. */
export function toggleLockBlock(user: Pick<User, 'status'>, guards: AccountGuards): AccountBlock | null {
  if (user.status === 'suspended') return guards.lock === 'self' ? 'self' : null
  return guards.lock
}
