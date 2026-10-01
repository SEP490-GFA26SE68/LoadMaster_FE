import type { AuditAction, AuditEvent } from '@/lib/mock-db'
import type { Role } from '@/types/user'

/**
 * Chuông thông báo (LM-098, D-55) lọc sự kiện nhật ký theo vai trò — không có bảng thông báo riêng: thông báo là sự kiện kho đã
 * ghi. Hàm thuần; `notifications-api.ts` đọc kho rồi gọi vào đây.
 */

/** Việc trên tài khoản và lần đăng nhập sai: thông báo của người quản lý người dùng (`users.manage`). */
const ACCOUNT_ACTIONS: readonly AuditAction[] = [
  'user.created', 'user.updated', 'user.locked', 'user.unlocked', 'user.deleted', 'user.passwordReset', 'user.passwordChanged',
  'user.profileUpdated', 'auth.signInFailed',
]

/**
 * Sự kiện đáng báo cho từng vai trò. Kho và tài xế làm việc trên màn của mình nên không có chuông. Vai trò nền tảng không nhận sự kiện
 * vận hành nào (FE-0-01): quản trị hệ thống chỉ có việc trên tài khoản; quản lý nền tảng và hỗ trợ khách hàng chưa có loại thông báo
 * nào (gói cước, ticket tới Sprint 8). Quản trị công ty nhận cùng loại với quản trị hệ thống — phạm vi theo công ty do FE-0-08 thêm.
 */
export const NOTIFICATION_ACTIONS: Readonly<Record<Role, readonly AuditAction[]>> = {
  systemAdmin: ACCOUNT_ACTIONS,
  systemManager: [],
  systemSupporter: [],
  companyAdmin: ACCOUNT_ACTIONS,
  manager: ['delivery.completed', 'trip.cancelled'],
  dispatcher: ['loading.completed', 'loading.missing', 'delivery.issue', 'delivery.completed', 'trip.cancelled'],
  warehouse: [],
  driver: [],
  // LM-104: chuông chưa lọc theo công ty (nhà sản xuất / logistics khác nhau thấy chung sự kiện), nên tạm không có
  manufacturer: [],
  logistics: [],
}

/** Chỉ sự kiện trong chừng ấy ngày gần nhất, tối đa chừng ấy dòng. */
export const NOTIFICATION_WINDOW_DAYS = 7
export const NOTIFICATION_LIMIT = 20

const DAY_MS = 24 * 60 * 60 * 1000

export type NotificationViewer = { readonly id: string; readonly role: Role }

export function hasNotifications(role: Role): boolean {
  return NOTIFICATION_ACTIONS[role].length > 0
}

/** Mốc bắt đầu của cửa sổ thông báo tính từ `now`. */
export function notificationWindowStart(now: Date): Date {
  return new Date(now.getTime() - NOTIFICATION_WINDOW_DAYS * DAY_MS)
}

/**
 * Thông báo của `viewer` từ nhật ký (mới nhất trước, như kho trả): đúng loại sự kiện của vai trò, không phải việc chính người đó làm,
 * từ `NOTIFICATION_WINDOW_DAYS` ngày trước `now`, tối đa `NOTIFICATION_LIMIT` dòng. Giữ thứ tự của kho.
 */
export function selectNotifications(events: readonly AuditEvent[], viewer: NotificationViewer, now: Date): AuditEvent[] {
  const actions = NOTIFICATION_ACTIONS[viewer.role]
  const since = notificationWindowStart(now).getTime()
  return events
    .filter((event) => actions.includes(event.action) && event.actorId !== viewer.id && Date.parse(event.at) >= since)
    .slice(0, NOTIFICATION_LIMIT)
}
