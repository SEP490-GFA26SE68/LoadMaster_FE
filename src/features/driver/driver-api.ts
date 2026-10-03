/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   chưa có ở BE: fetchMyTrips, fetchDriverTrip, reportDeliveryIssue, fetchDriverTripLabels
 *   chưa có ở BE (Q-11): startDelivery, recordUnload, completeStop, confirmUnloadByQr, confirmUnloadManually
 */

import {
  getMockDb,
  MockDbError,
  type DeliveryIssueInput,
  type LabelVerifyMethod,
  type ManualConfirmInput,
  type MockDb,
  type Revision,
  type ScanResult,
  type Trip,
  type TripLabel,
} from '@/lib/mock-db'
import type { User } from '@/types/user'
import { driverPlan, isVisibleTo, myTrips, type MyTrips } from './my-trips'

/**
 * Lớp dữ liệu của màn tài xế (LM-061, LM-087): nơi duy nhất trong `features/driver` biết về kho. Nối backend thật chỉ thay thân hàm.
 * Như server, kho biết người đang đăng nhập (phiên, D-42): tài xế chỉ đọc được chuyến gán cho mình (D-46); chuyến của người khác trả
 * `NOT_FOUND` như chuyến không tồn tại. Tiến độ giao ghi vào kho (D-47).
 */

function sessionUser(db: MockDb): User {
  const user = db.sessionUser()
  if (!user) throw new MockDbError('NOT_SIGNED_IN', {})
  return user
}

// chưa có ở BE
export async function fetchMyTrips(): Promise<MyTrips> {
  const db = getMockDb()
  const viewer = sessionUser(db)
  const [trips, vehicles] = await Promise.all([db.listTrips(), db.listVehicles()])
  // Chuyến còn lập kế hoạch và chuyến đã huỷ không hiện ở "Chuyến của tôi" (FE-6-01): không cần đọc revision của chúng
  const visible = trips.filter((trip) => isVisibleTo(trip, viewer) && trip.phase !== 'planning' && trip.phase !== 'cancelled')
  const entries = await Promise.all(visible.map(async (trip) => ({ trip, revisions: await db.listRevisions(trip.id) })))
  return myTrips(entries, new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.name])), viewer)
}

/** Chuyến và phương án tài xế làm theo (bản kho đã xếp, chưa xếp thì bản duyệt mới nhất); `plan` là `null` khi chưa có bản duyệt. */
export type DriverTrip = { readonly trip: Trip; readonly plan: Revision | null }

// chưa có ở BE
export async function fetchDriverTrip(tripId: string): Promise<DriverTrip> {
  const db = getMockDb()
  const viewer = sessionUser(db)
  const [trip, revisions] = await Promise.all([db.getTrip(tripId), db.listRevisions(tripId)])
  if (!isVisibleTo(trip, viewer)) throw new MockDbError('NOT_FOUND', { collection: 'trips', id: tripId })
  return { trip, plan: driverPlan(trip, revisions) ?? null }
}

/** Xe rời kho: `loaded` → `delivering` (D-45). */
// chưa có ở BE (Q-11)
export function startDelivery(tripId: string): Promise<Trip> {
  return getMockDb().startDelivery(tripId)
}

export type UnloadInput = { readonly stopNumber: number; readonly packageInstanceId: string; readonly unloaded: boolean }

// chưa có ở BE (Q-11)
export function recordUnload(tripId: string, { stopNumber, packageInstanceId, unloaded }: UnloadInput): Promise<Trip> {
  return getMockDb().recordUnload(tripId, stopNumber, packageInstanceId, unloaded)
}

// chưa có ở BE
export function reportDeliveryIssue(tripId: string, issue: DeliveryIssueInput): Promise<Trip> {
  return getMockDb().reportDeliveryIssue(tripId, issue)
}

/** Hoàn tất điểm giao; điểm cuối chuyển chuyến sang `completed`. */
// chưa có ở BE (Q-11)
export function completeStop(tripId: string, stopNumber: number): Promise<Trip> {
  return getMockDb().completeStop(tripId, stopNumber)
}

// Review 1 (LM-104): quét QR khi dỡ

/** Nhãn QR các kiện của chuyến (tên kiện cho câu báo sai điểm); chuyến của tài xế khác trả `NOT_FOUND`. */
// chưa có ở BE
export async function fetchDriverTripLabels(tripId: string): Promise<TripLabel[]> {
  const db = getMockDb()
  const viewer = sessionUser(db)
  if (!isVisibleTo(await db.getTrip(tripId), viewer)) throw new MockDbError('NOT_FOUND', { collection: 'trips', id: tripId })
  return db.listTripLabels(tripId)
}

/** Mã đối chiếu bằng nhãn ở điểm `stopNumber` (FE-6-03): quét (`QR`) hoặc gõ (`CODE` — mã QR in dưới hình, hoặc mã của bên gửi duy nhất trong chuyến). */
export type UnloadVerifyInput = { readonly stopNumber: number; readonly method: LabelVerifyMethod; readonly code: string }

/**
 * Đối chiếu kiện ở điểm giao hiện tại bằng nhãn — mức 1 và 2: ghi "đã dỡ" và cách đối chiếu. Kiện của điểm khác: `QR_WRONG_STOP` (kèm
 * số điểm của kiện); mã của bên gửi trùng nhiều kiện: `PACKAGE_CODE_AMBIGUOUS`.
 */
// chưa có ở BE (Q-11)
export function confirmUnloadByQr(tripId: string, { stopNumber, method, code }: UnloadVerifyInput): Promise<ScanResult<Trip>> {
  return getMockDb().confirmUnloadByQr(tripId, stopNumber, code, method)
}

/** Xác nhận tay một kiện ở điểm giao hiện tại — mức 3 (D-83): ghi "đã dỡ" kèm xác nhận tay chờ điều phối viên duyệt. */
// chưa có ở BE (Q-11)
export function confirmUnloadManually(tripId: string, stopNumber: number, input: ManualConfirmInput): Promise<ScanResult<Trip>> {
  return getMockDb().confirmUnloadManually(tripId, stopNumber, input)
}
