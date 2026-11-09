/**
 * Hàm → endpoint backend (FE-0-09):
 *   fetchServerNotifications → GET /api/notifications
 *   markServerNotificationsRead → POST /api/notifications/read
 *   fetchNotifications (kho mẫu) → chưa có ở BE
 * Nhóm `notifications` nối backend thì chuông đọc máy chủ (máy chủ lọc theo vai trò, công ty, người xem và giữ đã đọc). Không thì chuông
 * đọc nhật ký kho mẫu: người dùng nối backend (`users`) thì bỏ sự kiện tài khoản của kho mẫu, như Nhật ký (`AUDIT_LOG_AVAILABLE`); vai trò mà
 * nhóm dữ liệu chính của nó đã nối backend thì không có chuông (`notificationsReachable`).
 */

import { AUDIT_LOG_AVAILABLE } from '@/features/admin/audit-api'
import type { AuditDirectory } from '@/features/admin/audit-log'
import { getCachedCurrentUser } from '@/features/auth/auth-api'
import { api } from '@/lib/api-client'
import { usesBackend, type BackendFeature } from '@/lib/backend-config'
import { getMockDb, vnDate, type AuditEvent } from '@/lib/mock-db'
import type { Role } from '@/types/user'
import { notificationFeedOf, type NotificationListDto } from './notifications-dto'
import { notificationWindowStart, selectNotifications, withoutAccountEvents, type NotificationViewer } from './notifications'
import type { ServerNotificationFeed } from './server-notifications'

/**
 * Nhóm dữ liệu mà thông báo của từng vai trò nói về (`NOTIFICATION_ACTIONS`): chuyến và giám sát (điều phối viên, quản lý công ty), kho,
 * tài xế, tài khoản và credit (hai vai trò quản trị), yêu cầu hỗ trợ (mọi vai trò công ty). Chuông đọc nhật ký của kho mẫu, nên một nhóm
 * trong đó đã nối backend thì chuông nói về dữ liệu mẫu không có trên màn: bỏ chuông.
 */
const BELL_SOURCES: Readonly<Record<Role, readonly BackendFeature[]>> = {
  systemAdmin: ['users'],
  systemManager: [],
  systemSupporter: [],
  companyAdmin: ['users', 'billing', 'support'],
  companyManager: ['trips', 'monitoring', 'support'],
  dispatcher: ['trips', 'monitoring', 'packages', 'support'],
  warehouse: ['warehouse', 'packages', 'support'],
  driver: ['driver', 'support'],
}

/** Chuông đọc thông báo của máy chủ (nhóm `notifications` nối backend). */
export function serverNotifications(): boolean {
  return usesBackend('notifications')
}

/**
 * Chuông của vai trò có nguồn thật không. Máy chủ: mọi vai trò có loại thông báo (quản lý nền tảng, hỗ trợ khách hàng không có — xem
 * `hasNotifications`). Kho mẫu: mọi nhóm vai trò đó nói về vẫn là kho mẫu.
 */
export function notificationsReachable(role: Role): boolean {
  if (serverNotifications()) return BELL_SOURCES[role].length > 0
  return BELL_SOURCES[role].every((feature) => !usesBackend(feature))
}

const viewerOnServer = () => getCachedCurrentUser()?.id ?? null

/** Thông báo 7 ngày gần nhất của người đang đăng nhập (tối đa 20, mới nhất trước), kèm đã đọc. */
// GET /api/notifications
export async function fetchServerNotifications(): Promise<ServerNotificationFeed> {
  return notificationFeedOf(await api().get<NotificationListDto | null>('/api/notifications'), viewerOnServer())
}

/** Đánh dấu đã đọc theo mã dòng nhật ký; máy chủ trả lại danh sách mới. */
// POST /api/notifications/read
export async function markServerNotificationsRead(ids: readonly string[]): Promise<ServerNotificationFeed> {
  const body = { ids: ids.map(Number).filter((id) => Number.isInteger(id)) }
  return notificationFeedOf(await api().post<NotificationListDto | null>('/api/notifications/read', { body }), viewerOnServer())
}

/**
 * Lớp gọi API của chuông thông báo (LM-098) — nơi duy nhất của chuông biết về kho. Kho lọc nhật ký theo ngày, phần còn lại lọc ngay
 * sau khi nhận (`selectNotifications`). Nối backend thật chỉ thay thân hàm.
 */
export type NotificationFeed = {
  readonly events: readonly AuditEvent[]
  /** Tên hiện tại của chuyến, người dùng để đọc đối tượng của thông báo; đối tượng đã xoá không có ở đây. */
  readonly directory: AuditDirectory
}

/**
 * Tên chuyến và người dùng lấy cùng phạm vi với nhật ký (`listAuditNames`), không qua `listTrips`: chuông của quản trị hệ thống đọc
 * sự kiện tài khoản mà không cần — và không có — dữ liệu vận hành (FE-0-02).
 */
// chưa có ở BE
export async function fetchNotifications(viewer: NotificationViewer, now = new Date()): Promise<NotificationFeed> {
  const db = getMockDb()
  const [events, names] = await Promise.all([db.listEvents({ from: vnDate(notificationWindowStart(now)) }), db.listAuditNames()])
  return {
    // Lọc trước khi cắt còn 20 thông báo, để sự kiện bị bỏ không chiếm chỗ
    events: selectNotifications(AUDIT_LOG_AVAILABLE ? events : withoutAccountEvents(events), viewer, now),
    directory: {
      trips: new Map(names.trips.map((trip) => [trip.id, trip.name])),
      users: new Map(names.users.map((user) => [user.id, user.fullName])),
      // Không vai trò nào nhận thông báo về xe
      vehicles: new Map(),
    },
  }
}

/** Màn nào đọc máy chủ — thông báo của máy chủ chỉ dẫn tới màn cùng nguồn (quyền xem do nơi gọi xét). */
export function serverScreens(): { readonly warehouse: boolean; readonly driver: boolean; readonly billing: boolean } {
  return { warehouse: usesBackend('warehouse'), driver: usesBackend('driver'), billing: usesBackend('billing') }
}
