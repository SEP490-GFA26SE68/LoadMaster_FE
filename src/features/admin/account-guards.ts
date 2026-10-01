import type { User } from '@/types/user'

/** Lý do một thao tác trên tài khoản bị chặn: nhãn `admin.users.blocked.<lý do>`. */
export type AccountBlock = 'self' | 'lastAdmin'

export type AccountGuards = {
  /** Khoá tài khoản (mở khoá thì chỉ chặn khi là chính mình, và người đang đăng nhập không thể đang bị khoá). */
  readonly lock: AccountBlock | null
  readonly remove: AccountBlock | null
  /** Đổi vai trò trong form sửa. */
  readonly role: AccountBlock | null
}

type Account = Pick<User, 'id' | 'role' | 'status'>

/**
 * Chặn trước, kèm lý do, những thao tác kho sẽ từ chối (LM-092, cùng luật `SELF_CHANGE_FORBIDDEN`, `LAST_ADMIN` của kho): không tự
 * khoá, xoá hay đổi vai trò của mình; không để hệ thống mất quản trị hệ thống đang hoạt động cuối cùng (FE-0-01: vai trò `systemAdmin`;
 * quản trị công ty chưa có luật riêng — FE-0-08). Luật cần dữ liệu khác (tài xế còn chuyến) để kho trả lỗi.
 */
export function accountGuards(user: Account, currentUserId: string | null, users: readonly Pick<User, 'role' | 'status'>[]): AccountGuards {
  if (user.id === currentUserId) return { lock: 'self', remove: 'self', role: 'self' }
  const activeAdmins = users.filter((item) => item.role === 'systemAdmin' && item.status === 'active').length
  const block = user.role === 'systemAdmin' && user.status === 'active' && activeAdmins <= 1 ? 'lastAdmin' : null
  return { lock: block, remove: block, role: block }
}

/** Lý do chặn thao tác Khoá/Mở khoá theo trạng thái hiện tại: mở khoá chỉ bị chặn với chính mình, khoá theo cả luật quản trị viên cuối. */
export function toggleLockBlock(user: Pick<User, 'status'>, guards: AccountGuards): AccountBlock | null {
  if (user.status === 'suspended') return guards.lock === 'self' ? 'self' : null
  return guards.lock
}
