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
 * - Điều phối viên: kết quả phương án (đồng nghiệp duyệt), tiến độ kho (kho báo thiếu kiện lúc soạn — chờ điều phối viên quyết, kiện
 *   hỏng lúc xếp, xếp xong — FE-6-02, FE-6-05), kho quét thấy lại kiện mang cờ "Không tìm thấy" (FE-3b-06, D-92), sự cố giao, nguy cơ
 *   trễ hạn giao theo vị trí xe (FE-6-09 — sự kiện của hệ thống, kèm toast: `EtaRiskWatcher`), chuyến hoàn thành, chuyến bị huỷ.
 * - Quản lý công ty (chỉ đọc, lo hạn giao và báo cáo): chuyến hoàn thành, chuyến bị huỷ, sự cố giao; và kiện **của một yêu cầu giao**
 *   bị bỏ khỏi chuyến vì thiếu hoặc hỏng — yêu cầu đó thành "giao thiếu" (D-92).
 * - Quản trị hệ thống, quản trị công ty: việc trên tài khoản. Phạm vi do kho lọc, không lọc ở đây (FE-0-08): quản trị hệ thống nhận sự
 *   kiện tài khoản của toàn hệ thống; quản trị công ty chỉ nhận sự kiện về tài khoản của công ty mình — kể cả việc quản trị hệ thống làm
 *   trên người của công ty (khoá, đặt lại mật khẩu) — không nhận gì về tài khoản nền tảng hay của công ty khác.
 * - Điều phối viên còn được báo khi kho hoặc tài xế gửi một **xác nhận tay** chờ duyệt (FE-6-04, D-83).
 * - Sự cố cấp chuyến (FE-6-11, FE-6-12): điều phối viên được báo khi tài xế báo sự cố, khi kho tự chuyển sự cố cho quản lý sau 30
 *   phút, và khi quản lý đã liên hệ khách, nhập hạn mới (để xử lý tiếp); quản lý công ty được báo khi sự cố chuyển lên mình.
 * - Nhân viên kho, tài xế: xác nhận tay **của chính mình** bị điều phối viên từ chối (`PERSONAL_ACTIONS`), để biết kiện nào phải kiểm
 *   lại. Nhân viên kho còn được báo quyết định của điều phối viên với kiện **mình báo thiếu** (tìm tiếp, hoặc bỏ kiện — chuyến chờ tối
 *   ưu lại), và chuyến bị huỷ **lúc đang xếp** để dỡ phần đã xếp (FE-6-07, D-91). Tài xế còn được báo việc của **chuyến mình**
 *   (`DRIVER_TRIP_ACTIONS`): chuyến mới, xếp xong, chuyến bị huỷ, đổi tài xế.
 * - Quản trị công ty còn được báo "Sắp hết credit" (`credit.lowBalance`, FE-8-05): sự kiện của hệ thống khi số dư sau một lần chạy tối ưu
 *   xuống tới ngưỡng `BILLING_CONSTANTS.lowCreditThreshold` (đề xuất). Bấm mở màn gói cước `/goi-cuoc` (FE-8-03) để nạp thêm.
 * - Nhận hàng dọc đường (FE-7-03, FE-7-04): điều phối viên được báo khi có yêu cầu nhận mới (chính tài xế gửi); tài xế được báo quyết định
 *   duyệt / từ chối yêu cầu của **chuyến mình** (`DRIVER_TRIP_ACTIONS`, tham số `driverId` của sự kiện).
 * - Mọi vai trò công ty được báo khi Hỗ trợ khách hàng **trả lời yêu cầu hỗ trợ của chính mình** (`ticket.replied`, FE-8-07): lọc theo người gửi
 *   (tham số `requestedBy`), không báo cho đồng nghiệp. Sự kiện thuộc công ty của yêu cầu nên người gửi đọc được dù người làm là tài khoản nền tảng.
 * - Quản lý nền tảng, hỗ trợ khách hàng không có loại thông báo nào. Vai trò không có nguồn nào thì không có chuông (`hasNotifications`).
 * Sự kiện của luồng mới (nguy cơ trễ, yêu cầu nhận…) thêm vào đây trong issue của luồng đó.
 */
/**
 * Sự kiện về chuyến của một tài xế: chỉ báo cho đúng tài xế kho nêu ở tham số `driverId` — kho chỉ nêu khi chuyến đang hiện ở "Chuyến của
 * tôi" của người đó (từ lúc kho bắt đầu soạn hàng, FE-6-01), nên chuyến huỷ hay đổi tài xế lúc còn lập kế hoạch không tới tài xế nào. Kho bắt
 * đầu soạn hàng là lúc tài xế có chuyến mới; xếp xong là chuyến chờ xuất phát; quyết định với yêu cầu nhận hàng dọc đường (FE-7-04) và đổi
 * thứ tự điểm giao khi xe đang chạy (FE-BL-03). Đổi tài xế (`trip.updated`) báo người mới (`driverId`) và người vừa bị thay
 * (`previousDriverId`).
 */
const DRIVER_TRIP_ACTIONS: readonly AuditAction[] = [
  'loading.started', 'loading.completed', 'trip.updated', 'trip.cancelled', 'pickup.approved', 'pickup.rejected', 'trip.stopsReordered',
]

export const NOTIFICATION_ACTIONS: Readonly<Record<Role, readonly AuditAction[]>> = {
  systemAdmin: ACCOUNT_ACTIONS,
  systemManager: [],
  systemSupporter: [],
  companyAdmin: [...ACCOUNT_ACTIONS, 'credit.lowBalance', 'ticket.replied'],
  manager: ['delivery.completed', 'delivery.issue', 'trip.cancelled', 'loading.shortageDropped', 'loading.damaged', 'exception.escalated', 'ticket.replied'],
  dispatcher: [
    'revision.approved', 'loading.completed', 'loading.shortageReported', 'loading.damaged', 'package.found', 'delivery.issue', 'delivery.etaRisk',
    'delivery.completed', 'trip.cancelled', 'manualConfirm.requested', 'exception.reported', 'exception.escalated',
    'exception.deadlineRenegotiated', 'pickup.requested', 'ticket.replied',
  ],
  warehouse: ['manualConfirm.rejected', 'loading.shortageKept', 'loading.shortageDropped', 'trip.cancelled', 'ticket.replied'],
  driver: ['manualConfirm.rejected', ...DRIVER_TRIP_ACTIONS, 'ticket.replied'],
}

/**
 * Sự kiện chỉ báo cho **người gửi** việc bị quyết định (tham số `requestedBy` của sự kiện), không báo cho cả vai trò kho / tài xế: xác
 * nhận tay bị từ chối, báo thiếu được quyết là việc của đúng người đã gửi nó.
 */
const PERSONAL_ACTIONS: readonly AuditAction[] = ['manualConfirm.rejected', 'loading.shortageKept', 'loading.shortageDropped']

/** Sự kiện có đáng báo cho `viewer` không, ngoài việc đúng loại của vai trò: luật theo người gửi và theo tham số của sự kiện. */
function concerns(event: AuditEvent, viewer: NotificationViewer): boolean {
  // Trả lời yêu cầu hỗ trợ chỉ đáng báo cho người đã gửi yêu cầu (FE-8-07)
  if (event.action === 'ticket.replied') return event.params.requestedBy === viewer.id
  if (PERSONAL_ACTIONS.includes(event.action) && (viewer.role === 'warehouse' || viewer.role === 'driver')) {
    return event.params.requestedBy === viewer.id
  }
  // Việc của chuyến chỉ báo cho đúng tài xế kho nêu trong sự kiện; đổi tài xế còn báo người vừa bị thay
  if (viewer.role === 'driver') return event.params.driverId === viewer.id || event.params.previousDriverId === viewer.id
  // Kho chỉ cần biết chuyến bị huỷ lúc đang xếp (sự kiện mang số kiện đã lên xe): dỡ phần đã xếp
  if (viewer.role === 'warehouse') return event.action !== 'trip.cancelled' || event.params.loaded !== undefined
  // Quản lý công ty lo yêu cầu giao: kiện bị bỏ chỉ đáng báo khi nó thuộc một yêu cầu
  if (viewer.role === 'manager' && (event.action === 'loading.shortageDropped' || event.action === 'loading.damaged')) {
    return event.params.requirementId !== undefined
  }
  return true
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
    .filter((event) => concerns(event, viewer))
    .slice(0, NOTIFICATION_LIMIT)
}

/**
 * Thông báo về chuyến của tài xế nói bằng câu của tài xế (`notifications.driver.*`) thay nhãn hành động của nhật ký: "Sửa chuyến" không
 * cho tài xế biết mình vừa có chuyến mới hay vừa thôi chạy một chuyến.
 */
export type DriverNotice = 'loadingStarted' | 'loadingCompleted' | 'cancelled' | 'assigned' | 'unassigned'

const DRIVER_NOTICES: Partial<Record<AuditAction, DriverNotice>> = {
  'loading.started': 'loadingStarted',
  'loading.completed': 'loadingCompleted',
  'trip.cancelled': 'cancelled',
}

/**
 * Câu của tài xế `driverId` cho một sự kiện về chuyến của họ; `null` khi sự kiện không có câu riêng (nhãn của nhật ký đã đủ rõ: yêu cầu nhận
 * hàng được duyệt…) hoặc không nêu tài xế đó.
 */
export function driverNotice(event: Pick<AuditEvent, 'action' | 'params'>, driverId: string): DriverNotice | null {
  if (event.action === 'trip.updated') {
    if (event.params.driverId === driverId) return 'assigned'
    return event.params.previousDriverId === driverId ? 'unassigned' : null
  }
  return event.params.driverId === driverId ? (DRIVER_NOTICES[event.action] ?? null) : null
}

/**
 * Chi tiết tài xế cần đọc ở thông báo chuyến của mình: lý do huỷ và số kiện. Tên chính họ, mã phương án, trường đã sửa và mã người dùng
 * trước → sau không nói gì thêm với họ.
 */
const DRIVER_NOTICE_PARAMS: readonly string[] = ['reason', 'loaded', 'returned']

/** Sự kiện như tài xế đọc ở chuông: chỉ còn tham số trong `DRIVER_NOTICE_PARAMS`. */
export function driverNoticeEvent(event: AuditEvent): AuditEvent {
  return { ...event, params: Object.fromEntries(Object.entries(event.params).filter(([key]) => DRIVER_NOTICE_PARAMS.includes(key))) }
}

/**
 * Chuyến tài xế `driverId` đã thôi chạy: lần đổi tài xế mới nhất của chuyến trong `events` (mới nhất trước, như chuông nhận) thay họ bằng
 * người khác. Danh sách của chuông là các sự kiện mới nhất, nên một thông báo cũ hơn của chuyến có mặt thì lần đổi đó cũng có mặt.
 */
function releasedTrips(events: readonly AuditEvent[], driverId: string): Set<string> {
  const latest = new Map<string, DriverNotice>()
  for (const event of events) {
    const notice = driverNotice(event, driverId)
    if ((notice === 'assigned' || notice === 'unassigned') && !latest.has(event.target.id)) latest.set(event.target.id, notice)
  }
  return new Set([...latest].filter(([, notice]) => notice === 'unassigned').map(([tripId]) => tripId))
}

/**
 * Nơi kho và tài xế mở chuyến của từng thông báo trong `events` (cùng thứ tự): họ không mở được Chi tiết chuyến (`trips.view`), nên
 * thông báo về một chuyến dẫn về màn của chính vai trò đó. Tài xế đã thôi chạy một chuyến (`releasedTrips`) không mở được chuyến đó nữa:
 * thông báo của nó không có liên kết. Vai trò khác, hoặc đối tượng không phải chuyến: `null` — liên kết theo quyền của nhật ký
 * (`describeEvent`).
 */
export function operationHrefs(events: readonly AuditEvent[], viewer: NotificationViewer): (string | null)[] {
  const released = viewer.role === 'driver' ? releasedTrips(events, viewer.id) : new Set<string>()
  return events.map((event) => {
    if (event.target.type !== 'trip' || released.has(event.target.id)) return null
    const tripId = encodeURIComponent(event.target.id)
    if (viewer.role === 'warehouse') return `/kho?chuyen=${tripId}`
    return viewer.role === 'driver' ? `/tai-xe/diem-giao?chuyen=${tripId}` : null
  })
}
