/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   chưa có ở BE: fetchDashboardData
 */

import { getMockDb, vnDate } from '@/lib/mock-db'
import type { DashboardData } from './dashboard-summary'

/**
 * Lớp dữ liệu của bảng điều khiển (mục 9): nơi duy nhất trong `manager` biết về kho. Nối backend thật chỉ thay thân hàm —
 * hook và component giữ nguyên.
 *
 * Đọc một lần mọi chuyến kèm revision, xe, trạng thái xe và người dùng; kỳ được lọc lại trên máy (`summarizeDashboard`) nên đổi
 * kỳ không đọc lại kho. Kho chưa có hàm liệt kê revision toàn hệ thống nên đọc theo từng chuyến; backend thật sẽ trả sẵn tổng hợp.
 */
// chưa có ở BE
export async function fetchDashboardData(): Promise<DashboardData> {
  const db = getMockDb()
  const today = vnDate(new Date())
  const [trips, vehicles, vehicleStates, users] = await Promise.all([
    db.listTrips(),
    db.listVehicles(),
    db.listVehicleStates(),
    db.listUsers(),
  ])
  const revisions = await Promise.all(trips.map((trip) => db.listRevisions(trip.id)))
  return {
    today,
    trips: trips.map((trip, index) => ({ trip, revisions: revisions[index] ?? [] })),
    vehicles,
    vehicleStates,
    users,
  }
}
