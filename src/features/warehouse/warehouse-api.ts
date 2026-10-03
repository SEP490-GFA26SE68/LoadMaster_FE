/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   startLoading       → POST /api/trips/{id}/start-loading
 *   recordLoadingStep  → POST /api/warehouse/placements/{id}/confirm (đã xếp) · POST /api/warehouse/placements/{id}/deviation (thiếu)
 *   confirmLoadingByQr → POST /api/warehouse/placements/{id}/confirm
 *   completeLoading    → POST /api/trips/{id}/complete-loading
 *   chưa có ở BE: fetchWarehouseTrips, fetchWarehouseTrip, fetchTripLabels
 *   chưa có ở BE (Q-11): recordSeal, confirmLoadingManually
 *   tên sẽ đổi khi nối BE: recordLoadingStep, confirmLoadingByQr → confirmPlacement, reportPlacementDeviation
 */

import {
  getMockDb,
  loadingRemaining,
  pendingManualConfirms,
  type LabelVerifyMethod,
  type LoadingStepInput,
  type ManualConfirmInput,
  type MockDb,
  type Revision,
  type ScanResult,
  type Trip,
  type TripLabel,
} from '@/lib/mock-db'
import { warehouseTripRows, type WarehouseTripRow } from './warehouse-trips'

/**
 * Lớp dữ liệu của màn kho (LM-060, LM-086): nơi duy nhất trong `warehouse` biết về kho dữ liệu. Nối backend thật chỉ thay thân hàm.
 * Kho chỉ xếp theo revision **đã duyệt** (D-31); tiến độ xếp và kiện thiếu ghi vào kho (D-47).
 */

/** Danh sách chuyến của kho (D-46): chỉ chuyến chưa qua pha xếp mới có thể cần kho. */
// chưa có ở BE
export async function fetchWarehouseTrips(): Promise<WarehouseTripRow[]> {
  const db = getMockDb()
  const [trips, vehicles] = await Promise.all([db.listTrips(), db.listVehicles()])
  const candidates = trips.filter((trip) => trip.phase === 'planning' || trip.phase === 'loading')
  const entries = await Promise.all(candidates.map(async (trip) => ({ trip, revisions: await db.listRevisions(trip.id) })))
  return warehouseTripRows(entries, new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.name])))
}

export type WarehouseTrip = { readonly trip: Trip; readonly revisions: readonly Revision[] }

/** Chuyến `/kho?chuyen=` và các revision của nó; chuyến không có thì lỗi `NOT_FOUND` của kho. */
// chưa có ở BE
export async function fetchWarehouseTrip(tripId: string): Promise<WarehouseTrip> {
  const db = getMockDb()
  const [trip, revisions] = await Promise.all([db.getTrip(tripId), db.listRevisions(tripId)])
  return { trip, revisions }
}

/** Bắt đầu xếp theo bản duyệt mới nhất: `planning` → `loading` (D-45). */
// POST /api/trips/{id}/start-loading
export function startLoading(tripId: string): Promise<Trip> {
  return getMockDb().startLoading(tripId)
}

/**
 * Chuyến sau khi ghi một kiện: kiện cuối cùng có kết quả thì hoàn tất xếp luôn (`loading` → `loaded`) — trừ khi còn xác nhận tay chờ
 * điều phối viên duyệt (FE-6-04): kho từ chối xong xếp, nên chuyến ở lại "đang xếp" và màn nói lý do.
 */
async function finishWhenReady(db: MockDb, trip: Trip): Promise<Trip> {
  const plan = await db.getRevision(trip.loading?.revisionId ?? '')
  const ready = loadingRemaining(trip, plan) === 0 && pendingManualConfirms(trip, 'LOADING').length === 0
  return ready ? db.completeLoading(trip.id) : trip
}

/** Ghi một kiện đã xếp hoặc thiếu ở kho. Kiện cuối cùng có kết quả thì hoàn tất luôn (`finishWhenReady`). */
// POST /api/warehouse/placements/{id}/confirm (đã xếp) · POST /api/warehouse/placements/{id}/deviation (thiếu)
export async function recordLoadingStep(tripId: string, step: LoadingStepInput): Promise<Trip> {
  const db = getMockDb()
  return finishWhenReady(db, await db.recordLoadingStep(tripId, step))
}

/** Hoàn tất xếp khi mọi kiện đã có kết quả — dùng lại khi lần hoàn tất tự động ở bước cuối không thành. */
// POST /api/trips/{id}/complete-loading
export function completeLoading(tripId: string): Promise<Trip> {
  return getMockDb().completeLoading(tripId)
}

// Review 1 (LM-104): quét QR khi xếp, số seal khi xếp xong, nhãn QR của chuyến

/** Nhãn QR mọi kiện của chuyến: tên kiện cho câu báo sai kiện, và kiện kho kiện để in lại nhãn ở mức xác nhận tay. */
// chưa có ở BE
export function fetchTripLabels(tripId: string): Promise<TripLabel[]> {
  return getMockDb().listTripLabels(tripId)
}

/** Mã đối chiếu bằng nhãn (FE-6-03): quét (`QR`) hoặc gõ (`CODE` — mã QR in dưới hình, hoặc mã của bên gửi duy nhất trong chuyến). */
export type VerifyCodeInput = { readonly method: LabelVerifyMethod; readonly code: string }

/**
 * Đối chiếu kiện của bước hiện tại bằng nhãn — mức 1 và 2: kho ghi "đã xếp" (`via: 'qr'`) và cách đối chiếu. Kiện khác của chuyến:
 * `WRONG_PACKAGE_SCANNED` (kèm mã kiện cần xếp); mã của bên gửi trùng nhiều kiện: `PACKAGE_CODE_AMBIGUOUS`. Kiện cuối cùng thì hoàn
 * tất xếp luôn, như `recordLoadingStep`.
 */
// POST /api/warehouse/placements/{id}/confirm
export async function confirmLoadingByQr(tripId: string, { method, code }: VerifyCodeInput): Promise<ScanResult<Trip>> {
  const db = getMockDb()
  const result = await db.confirmLoadingByQr(tripId, code, method)
  return { ...result, trip: await finishWhenReady(db, result.trip) }
}

/**
 * Xác nhận tay kiện của bước hiện tại — mức 3 (D-83): ghi "đã xếp" kèm xác nhận tay chờ điều phối viên duyệt. Không tự hoàn tất xếp:
 * còn xác nhận tay chờ thì kho từ chối xong xếp.
 */
// chưa có ở BE (Q-11)
export function confirmLoadingManually(tripId: string, input: ManualConfirmInput): Promise<ScanResult<Trip>> {
  return getMockDb().confirmLoadingManually(tripId, input)
}

/** Ghi số seal niêm phong khi đã xếp xong (`loaded`), trước khi xe chạy. */
// chưa có ở BE (Q-11)
export function recordSeal(tripId: string, sealNumber: string): Promise<Trip> {
  return getMockDb().recordSeal(tripId, sealNumber)
}
