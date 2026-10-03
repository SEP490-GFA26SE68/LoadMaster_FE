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
 * - Điều phối viên: kết quả phương án (đồng nghiệp duyệt), tiến độ kho (thiếu kiện, xếp xong), kho quét thấy lại kiện mang cờ "Không
 *   tìm thấy" (FE-3b-06, D-92), sự cố giao, nguy cơ trễ hạn giao theo vị trí xe (FE-6-09 — sự kiện của hệ thống, kèm toast:
 *   `EtaRiskWatcher`), chuyến hoàn thành, chuyến bị huỷ.
 * - Quản lý công ty (chỉ đọc, lo hạn giao và báo cáo): chuyến hoàn thành, chuyến bị huỷ, sự cố giao.
 * - Quản trị hệ thống, quản trị công ty: việc trên tài khoản. Phạm vi do kho lọc, không lọc ở đây (FE-0-08): quản trị hệ thống nhận sự
 *   kiện tài khoản của toàn hệ thống; quản trị công ty chỉ nhận sự kiện về tài khoản của công ty mình — kể cả việc quản trị hệ thống làm
 *   trên người của công ty (khoá, đặt lại mật khẩu) — không nhận gì về tài khoản nền tảng hay của công ty khác.
 * - Điều phối viên còn được báo khi kho hoặc tài xế gửi một **xác nhận tay** chờ duyệt (FE-6-04, D-83).
 * - Sự cố cấp chuyến (FE-6-11, FE-6-12): điều phối viên được báo khi tài xế báo sự cố, khi kho tự chuyển sự cố cho quản lý sau 30
 *   phút, và khi quản lý đã liên hệ khách, nhập hạn mới (để xử lý tiếp); quản lý công ty được báo khi sự cố chuyển lên mình.
 * - Nhân viên kho, tài xế: chỉ một loại — xác nhận tay **của chính mình** bị điều phối viên từ chối (`PERSONAL_ACTIONS`), để biết
 *   kiện nào phải kiểm lại.
 * - Quản lý nền tảng, hỗ trợ khách hàng chưa có loại thông báo nào (gói cước, ticket tới Sprint 8). Vai trò không có nguồn nào thì
 *   không có chuông (`hasNotifications`).
 * Sự kiện của luồng mới (nguy cơ trễ, yêu cầu nhận…) thêm vào đây trong issue của luồng đó.
 */
export const NOTIFICATION_ACTIONS: Readonly<Record<Role, readonly AuditAction[]>> = {
  systemAdmin: ACCOUNT_ACTIONS,
  systemManager: [],
  systemSupporter: [],
  companyAdmin: ACCOUNT_ACTIONS,
  manager: ['delivery.completed', 'delivery.issue', 'trip.cancelled', 'exception.escalated'],
  dispatcher: [
    'revision.approved', 'loading.completed', 'loading.missing', 'package.found', 'delivery.issue', 'delivery.etaRisk', 'delivery.completed',
    'trip.cancelled', 'manualConfirm.requested', 'exception.reported', 'exception.escalated', 'exception.deadlineRenegotiated',
  ],
  warehouse: ['manualConfirm.rejected'],
  driver: ['manualConfirm.rejected'],
}

/**
 * Sự kiện chỉ báo cho **người gửi** việc bị quyết định (tham số `requestedBy` của sự kiện), không báo cho cả vai trò: xác nhận tay bị
 * từ chối là việc của đúng người đã gửi nó.
 */
const PERSONAL_ACTIONS: readonly AuditAction[] = ['manualConfirm.rejected']

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
    .filter((event) => !PERSONAL_ACTIONS.includes(event.action) || event.params.requestedBy === viewer.id)
    .slice(0, NOTIFICATION_LIMIT)
}

/**
 * Nơi kho và tài xế mở chuyến của một thông báo: họ không mở được Chi tiết chuyến (`trips.view`), nên thông báo về một chuyến dẫn về
 * màn của chính vai trò đó. Vai trò khác, hoặc đối tượng không phải chuyến: `null` — liên kết theo quyền của nhật ký (`describeEvent`).
 */
export function operationHref(event: Pick<AuditEvent, 'target'>, role: Role): string | null {
  if (event.target.type !== 'trip') return null
  const tripId = encodeURIComponent(event.target.id)
  if (role === 'warehouse') return `/kho?chuyen=${tripId}`
  return role === 'driver' ? `/tai-xe/diem-giao?chuyen=${tripId}` : null
}
