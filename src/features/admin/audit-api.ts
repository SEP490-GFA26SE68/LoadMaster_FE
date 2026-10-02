import type { VehicleConfig } from '@/domain/models'
import { auditGroup, getMockDb, type AuditEvent, type AuditFilter, type AuditGroup, type Trip } from '@/lib/mock-db'
import type { User } from '@/types/user'

/**
 * Lớp gọi API của màn Nhật ký (LM-091, D-43) — nơi duy nhất trong màn biết về kho. Nối backend thật chỉ thay thân hàm.
 * Khoảng ngày, người làm và mã đối tượng lọc ở "server" (`listEvents`), nhóm hành động lọc ngay sau khi nhận.
 */
export type AuditLogFilter = AuditFilter & { group?: AuditGroup }

/** Sự kiện khớp bộ lọc, mới nhất trước. */
export async function fetchAuditEvents({ group, ...filter }: AuditLogFilter): Promise<AuditEvent[]> {
  const events = await getMockDb().listEvents(filter)
  return group === undefined ? events : events.filter((event) => auditGroup(event.action) === group)
}

export type AuditDirectoryData = {
  readonly users: readonly Pick<User, 'id' | 'fullName' | 'role'>[]
  readonly trips: readonly Pick<Trip, 'id' | 'name'>[]
  readonly vehicles: readonly Pick<VehicleConfig, 'id' | 'name'>[]
}

/**
 * Tên hiện tại của người dùng (kèm vai trò), chuyến, xe để đọc người làm và đối tượng; cũng là danh sách chọn "Người làm". Kho trả
 * tên trong phạm vi nhật ký của người xem (`listAuditNames`), không qua `listTrips` / `listVehicles`: quản trị hệ thống đọc nhật ký
 * nhưng không có dữ liệu vận hành (FE-0-02).
 */
export function fetchAuditDirectory(): Promise<AuditDirectoryData> {
  return getMockDb().listAuditNames()
}
