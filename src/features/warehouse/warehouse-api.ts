import { getMockDb, loadingRemaining, type LoadingStepInput, type Revision, type ScanResult, type Trip, type TripLabel } from '@/lib/mock-db'
import { warehouseTripRows, type WarehouseTripRow } from './warehouse-trips'

/**
 * Lớp dữ liệu của màn kho (LM-060, LM-086): nơi duy nhất trong `warehouse` biết về kho dữ liệu. Nối backend thật chỉ thay thân hàm.
 * Kho chỉ xếp theo revision **đã duyệt** (D-31); tiến độ xếp và kiện thiếu ghi vào kho (D-47).
 */

/** Danh sách chuyến của kho (D-46): chỉ chuyến chưa qua pha xếp mới có thể cần kho. */
export async function fetchWarehouseTrips(): Promise<WarehouseTripRow[]> {
  const db = getMockDb()
  const [trips, vehicles] = await Promise.all([db.listTrips(), db.listVehicles()])
  const candidates = trips.filter((trip) => trip.phase === 'planning' || trip.phase === 'loading')
  const entries = await Promise.all(candidates.map(async (trip) => ({ trip, revisions: await db.listRevisions(trip.id) })))
  return warehouseTripRows(entries, new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.name])))
}

export type WarehouseTrip = { readonly trip: Trip; readonly revisions: readonly Revision[] }

/** Chuyến `/kho?chuyen=` và các revision của nó; chuyến không có thì lỗi `NOT_FOUND` của kho. */
export async function fetchWarehouseTrip(tripId: string): Promise<WarehouseTrip> {
  const db = getMockDb()
  const [trip, revisions] = await Promise.all([db.getTrip(tripId), db.listRevisions(tripId)])
  return { trip, revisions }
}

/** Bắt đầu xếp theo bản duyệt mới nhất: `planning` → `loading` (D-45). */
export function startLoading(tripId: string): Promise<Trip> {
  return getMockDb().startLoading(tripId)
}

/** Ghi một kiện đã xếp hoặc thiếu ở kho. Kiện cuối cùng có kết quả thì hoàn tất luôn: `loading` → `loaded`. */
export async function recordLoadingStep(tripId: string, step: LoadingStepInput): Promise<Trip> {
  const db = getMockDb()
  const trip = await db.recordLoadingStep(tripId, step)
  const plan = await db.getRevision(trip.loading?.revisionId ?? '')
  return loadingRemaining(trip, plan) === 0 ? db.completeLoading(tripId) : trip
}

/** Hoàn tất xếp khi mọi kiện đã có kết quả — dùng lại khi lần hoàn tất tự động ở bước cuối không thành. */
export function completeLoading(tripId: string): Promise<Trip> {
  return getMockDb().completeLoading(tripId)
}

// Review 1 (LM-104): quét QR khi xếp, số seal khi xếp xong, nhãn QR của chuyến

/** Nhãn QR mọi kiện của chuyến: hộp thoại quét dùng làm danh sách chọn tay khi không quét được. */
export function fetchTripLabels(tripId: string): Promise<TripLabel[]> {
  return getMockDb().listTripLabels(tripId)
}

/**
 * Quét QR kiện của bước hiện tại: kho ghi "đã xếp" (`via: 'qr'`). Kiện khác của chuyến: `QR_WRONG_PACKAGE` (kèm mã kiện cần xếp).
 * Kiện cuối cùng thì hoàn tất xếp luôn, như `recordLoadingStep`.
 */
export async function confirmLoadingByQr(tripId: string, token: string): Promise<ScanResult<Trip>> {
  const db = getMockDb()
  const result = await db.confirmLoadingByQr(tripId, token)
  const plan = await db.getRevision(result.trip.loading?.revisionId ?? '')
  return loadingRemaining(result.trip, plan) === 0 ? { ...result, trip: await db.completeLoading(tripId) } : result
}

/** Ghi số seal niêm phong khi đã xếp xong (`loaded`), trước khi xe chạy. */
export function recordSeal(tripId: string, sealNumber: string): Promise<Trip> {
  return getMockDb().recordSeal(tripId, sealNumber)
}
