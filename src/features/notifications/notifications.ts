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
 * Sự kiện đáng báo cho từng vai trò (FE-0-04) — ai cần biết việc gì:
 * - Điều phối viên: kết quả phương án (đồng nghiệp duyệt), tiến độ kho (thiếu kiện, xếp xong), sự cố giao, chuyến hoàn thành, chuyến
 *   bị huỷ.
 * - Quản lý công ty (chỉ đọc, lo hạn giao và báo cáo): chuyến hoàn thành, chuyến bị huỷ, sự cố giao.
 * - Quản trị hệ thống, quản trị công ty: việc trên tài khoản — phạm vi theo công ty do FE-0-08 thêm.
 * - Quản lý nền tảng, hỗ trợ khách hàng chưa có loại thông báo nào (gói cước, ticket tới Sprint 8); kho và tài xế làm việc trên màn
 *   của mình. Vai trò không có nguồn nào thì không có chuông (`hasNotifications`).
 * Sự kiện của luồng mới (nguy cơ trễ, xác nhận tay chờ duyệt, yêu cầu nhận…) thêm vào đây trong issue của luồng đó.
 */
export const NOTIFICATION_ACTIONS: Readonly<Record<Role, readonly AuditAction[]>> = {
  systemAdmin: ACCOUNT_ACTIONS,
  systemManager: [],
  systemSupporter: [],
  companyAdmin: ACCOUNT_ACTIONS,
  manager: ['delivery.completed', 'delivery.issue', 'trip.cancelled'],
  dispatcher: ['revision.approved', 'loading.completed', 'loading.missing', 'delivery.issue', 'delivery.completed', 'trip.cancelled'],
  warehouse: [],
  driver: [],
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
