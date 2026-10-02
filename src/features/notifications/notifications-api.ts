import type { AuditDirectory } from '@/features/admin/audit-log'
import { getMockDb, vnDate, type AuditEvent } from '@/lib/mock-db'
import { notificationWindowStart, selectNotifications, type NotificationViewer } from './notifications'

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
export async function fetchNotifications(viewer: NotificationViewer, now = new Date()): Promise<NotificationFeed> {
  const db = getMockDb()
  const [events, names] = await Promise.all([db.listEvents({ from: vnDate(notificationWindowStart(now)) }), db.listAuditNames()])
  return {
    events: selectNotifications(events, viewer, now),
    directory: {
      trips: new Map(names.trips.map((trip) => [trip.id, trip.name])),
      users: new Map(names.users.map((user) => [user.id, user.fullName])),
      // Không vai trò nào nhận thông báo về xe
      vehicles: new Map(),
    },
  }
}
