/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   chưa có ở BE: fetchNotifications
 * Người dùng nối backend (`users`) thì chuông bỏ sự kiện tài khoản của kho mẫu, như Nhật ký (`AUDIT_LOG_AVAILABLE`).
 * Backend chưa có thông báo: vai trò mà nhóm dữ liệu chính của nó đã nối backend thì không có chuông (`notificationsReachable`).
 */

import { AUDIT_LOG_AVAILABLE } from '@/features/admin/audit-api'
import type { AuditDirectory } from '@/features/admin/audit-log'
import { usesBackend, type BackendFeature } from '@/lib/backend-config'
import { getMockDb, vnDate, type AuditEvent } from '@/lib/mock-db'
import type { Role } from '@/types/user'
import { notificationWindowStart, selectNotifications, withoutAccountEvents, type NotificationViewer } from './notifications'

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

/** Chuông của vai trò còn nguồn thật không: mọi nhóm nó nói về vẫn là kho mẫu (backend chưa có thông báo). */
export function notificationsReachable(role: Role): boolean {
  return BELL_SOURCES[role].every((feature) => !usesBackend(feature))
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
