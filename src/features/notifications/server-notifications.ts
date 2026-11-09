import type { ServerAuditEntry } from '@/features/admin/audit-backend-api'
import { serverAuditRow } from '@/features/admin/server-audit-rows'
import type { Formatter } from '@/lib/format'
import type { TFunction } from '@/lib/i18n'
import type { Role } from '@/types/user'
import { SERVER_OPERATION_LOOK, type BellRow } from './bell-row'

/**
 * Chuông khi thông báo đọc từ máy chủ (`GET /api/notifications`): máy chủ chọn dòng nhật ký theo vai trò, công ty và người xem, giữ
 * trạng thái đã đọc; đây chỉ dịch mã + tham số thành câu và quyết liên kết. Hàm thuần.
 */
export type ServerNotification = ServerAuditEntry & {
  /** Mã số chuyến của máy chủ mà sự kiện nói tới (`null` khi không gắn chuyến) — mã trên URL của màn kho và tài xế bản máy chủ. */
  readonly tripId: string | null
  readonly read: boolean
}

export type ServerNotificationFeed = {
  readonly items: readonly ServerNotification[]
  readonly windowDays: number
  /** Mã người xem ở máy chủ; `null` khi không đọc được. */
  readonly viewerId: string | null
}

/**
 * Trang nào đọc cùng nguồn với thông báo (máy chủ) và người xem mở được: Chi tiết chuyến (`trips` nối máy chủ, `trips.view`), phiên kho
 * (`warehouse`), màn điểm giao của tài xế (`driver`), gói cước (`billing`, `billing.manage`). Thiếu thì thông báo không có liên kết.
 */
export type ServerLinkTargets = {
  readonly trips: boolean
  readonly warehouse: boolean
  readonly driver: boolean
  readonly billing: boolean
}

type DriverNotice = 'loadingStarted' | 'loadingCompleted' | 'cancelled' | 'assigned' | 'unassigned' | 'pickupApproved' | 'pickupRejected'

/** Chi tiết tài xế cần ở từng câu của mình (như `DRIVER_NOTICE_PARAMS` của kho mẫu). */
const DRIVER_NOTICE_KEYS: Readonly<Record<DriverNotice, readonly string[]>> = {
  loadingStarted: [],
  loadingCompleted: ['loadedPackages'],
  cancelled: ['reason', 'loadedPackages'],
  assigned: [],
  unassigned: [],
  // Số kiện phải nhận (đã có chỗ + chưa có chỗ trên xe); lý do điều phối viên nhập
  pickupApproved: ['placed', 'unplaced'],
  pickupRejected: ['reason'],
}

const same = (value: string | number | boolean | undefined, id: string | null) => id !== null && value !== undefined && String(value) === id

/** Việc của chuyến mình nói bằng câu của tài xế; máy chủ đã chỉ trả việc nêu đúng người này. */
function driverNotice(item: ServerNotification, viewerId: string | null): DriverNotice | null {
  switch (item.actionType) {
    case 'TRIP_STATUS_TRANSITION':
      return item.after.status === 'LOADING' ? 'loadingStarted' : null
    case 'LOADING_COMPLETED':
      return 'loadingCompleted'
    case 'TRIP_CANCELLED':
      return 'cancelled'
    case 'TRIP_UPDATED':
      if (same(item.after.driverId, viewerId)) return 'assigned'
      return same(item.before.driverId, viewerId) ? 'unassigned' : null
    case 'PICKUP_APPROVED':
      return 'pickupApproved'
    case 'PICKUP_REJECTED':
      return 'pickupRejected'
    default:
      return null
  }
}

/** Chuyến tài xế đã thôi chạy: lần đổi tài xế mới nhất của chuyến (danh sách mới nhất trước) đưa người khác vào. */
function releasedTrips(items: readonly ServerNotification[], viewerId: string | null): Set<string> {
  const decided = new Set<string>()
  const released = new Set<string>()
  for (const item of items) {
    if (item.actionType !== 'TRIP_UPDATED' || item.tripId === null || decided.has(item.tripId) || !('driverId' in item.after)) continue
    decided.add(item.tripId)
    if (!same(item.after.driverId, viewerId)) released.add(item.tripId)
  }
  return released
}

function hrefOf(item: ServerNotification, role: Role, links: ServerLinkTargets, released: ReadonlySet<string>): string | null {
  if (item.actionType === 'CREDIT_LOW_BALANCE') return links.billing ? '/goi-cuoc' : null
  if (item.tripId === null) return null
  const tripId = encodeURIComponent(item.tripId)
  if (role === 'warehouse') return links.warehouse ? `/kho?chuyen=${tripId}` : null
  if (role === 'driver') return links.driver && !released.has(item.tripId) ? `/tai-xe/diem-giao?chuyen=${tripId}` : null
  return links.trips && item.entityCode !== null ? `/chuyen/${encodeURIComponent(item.entityCode)}` : null
}

export function serverBellRows(feed: ServerNotificationFeed, role: Role, links: ServerLinkTargets, t: TFunction, format: Formatter): BellRow[] {
  const released = role === 'driver' ? releasedTrips(feed.items, feed.viewerId) : new Set<string>()
  return feed.items.map((item) => {
    const notice = role === 'driver' ? driverNotice(item, feed.viewerId) : null
    const kept = notice === null ? null : DRIVER_NOTICE_KEYS[notice]
    const entry = kept === null ? item : { ...item, before: {}, after: Object.fromEntries(Object.entries(item.after).filter(([key]) => kept.includes(key))) }
    const row = serverAuditRow(entry, t, format)
    const look = SERVER_OPERATION_LOOK[item.actionType] ?? { icon: row.icon, tone: row.tone }
    return {
      id: item.id,
      at: item.at,
      action: notice === null ? row.action : t(`notifications.driver.${notice}`),
      icon: look.icon,
      tone: look.tone,
      target: { id: item.entityCode ?? row.targetRef ?? '', label: row.target || null, href: hrefOf(item, role, links, released) },
      actor: row.actor,
      details: row.details,
    }
  })
}
