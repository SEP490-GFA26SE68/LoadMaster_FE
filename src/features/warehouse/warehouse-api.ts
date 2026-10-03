/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   startLoading         → POST /api/trips/{id}/start-loading
 *   confirmStagingByQr   → POST /api/warehouse/verify-package
 *   confirmLoadingByQr   → POST /api/warehouse/placements/{id}/confirm
 *   reportDamagedPackage → POST /api/warehouse/placements/{id}/deviation
 *   completeLoading      → POST /api/trips/{id}/complete-loading
 *   chưa có ở BE: fetchWarehouseTrips, fetchWarehouseTrip, fetchTripLabels
 *   chưa có ở BE (Q-11): confirmStagingManually, reportStagingShortage, recordSeal, confirmLoadingManually
 *   tên sẽ đổi khi nối BE: confirmStagingByQr → verifyPackage; confirmLoadingByQr → confirmPlacement; reportDamagedPackage → reportPlacementDeviation
 */

import {
  getMockDb,
  loadingRemaining,
  pendingManualConfirms,
  stagingRemaining,
  type LabelVerifyMethod,
  type ManualConfirmInput,
  type MockDb,
  type Revision,
  type ScanResult,
  type StagingScanResult,
  type Trip,
  type TripLabel,
} from '@/lib/mock-db'
import { warehouseTripRows, type WarehouseTripRow } from './warehouse-trips'

/**
 * Lớp dữ liệu của màn kho (LM-060, LM-086): nơi duy nhất trong `warehouse` biết về kho dữ liệu. Nối backend thật chỉ thay thân hàm.
 * Kho chỉ làm theo revision **đã duyệt** (D-31); tiến độ soạn, xếp, kiện thiếu và kiện hỏng ghi vào kho (D-47, D-82, D-92). Không có hàm
 * ghi "đã soạn" / "đã xếp" nào không qua đối chiếu (D-83).
 */

/** Danh sách chuyến của kho (D-46, FE-6-01): chuyến Đã lập kế hoạch và Đang xếp hàng — kể cả xếp xong chờ xe xuất phát. */
// chưa có ở BE
export async function fetchWarehouseTrips(): Promise<WarehouseTripRow[]> {
  const db = getMockDb()
  const [trips, vehicles] = await Promise.all([db.listTrips(), db.listVehicles()])
  const candidates = trips.filter((trip) => trip.phase === 'planning' || trip.phase === 'loading' || trip.phase === 'loaded')
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

/** Bắt đầu theo bản duyệt mới nhất: `planning` → `loading`, bước Soạn hàng (D-45, D-82). */
// POST /api/trips/{id}/start-loading
export function startLoading(tripId: string): Promise<Trip> {
  return getMockDb().startLoading(tripId)
}

/**
 * Chuyến sau khi ghi một kiện: kiện cuối cùng có kết quả thì hoàn tất xếp luôn (`loading` → `loaded`) — trừ khi còn xác nhận tay (lúc
 * soạn hoặc lúc xếp) chờ điều phối viên duyệt (FE-6-04): kho từ chối xong xếp, nên chuyến ở lại "đang xếp" và màn nói lý do.
 */
async function finishWhenReady(db: MockDb, trip: Trip): Promise<Trip> {
  const plan = await db.getRevision(trip.loading?.revisionId ?? '')
  const pending = pendingManualConfirms(trip, 'STAGING').length + pendingManualConfirms(trip, 'LOADING').length
  const ready = stagingRemaining(trip, plan).length === 0 && loadingRemaining(trip, plan) === 0 && pending === 0
  return ready ? db.completeLoading(trip.id) : trip
}

/**
 * Soạn một kiện vào khu chờ bằng nhãn — mức 1 và 2 (FE-6-02): không cần thứ tự. Kiện đã soạn thì kho không ghi gì, trả
 * `alreadyStaged`; mã không thuộc chuyến: `PACKAGE_NOT_IN_TRIP`.
 */
// POST /api/warehouse/verify-package
export function confirmStagingByQr(tripId: string, { method, code }: VerifyCodeInput): Promise<StagingScanResult<Trip>> {
  return getMockDb().confirmStagingByQr(tripId, code, method)
}

/** Soạn một kiện bằng xác nhận tay — mức 3: ghi "đã soạn" kèm xác nhận tay chờ điều phối viên duyệt. */
// chưa có ở BE (Q-11)
export function confirmStagingManually(tripId: string, input: ManualConfirmInput): Promise<ScanResult<Trip>> {
  return getMockDb().confirmStagingManually(tripId, input)
}

/** Báo một kiện chưa soạn là không tìm thấy: điều phối viên quyết "tìm tiếp" hoặc "bỏ kiện khỏi chuyến" (D-82). */
// chưa có ở BE (Q-11)
export function reportStagingShortage(tripId: string, packageInstanceId: string): Promise<Trip> {
  return getMockDb().reportStagingShortage(tripId, packageInstanceId)
}

/**
 * Báo kiện của bước xếp hiện tại bị hỏng (FE-6-05): không kiện nào tựa lên nó trong phương án thì kiện bị bỏ lại kho và kho xếp tiếp
 * (kiện cuối thì hoàn tất xếp luôn); có kiện tựa lên thì chuyến về Đã lập kế hoạch — `phase` của chuyến trả về nói trường hợp nào.
 */
// POST /api/warehouse/placements/{id}/deviation
export async function reportDamagedPackage(tripId: string, packageInstanceId: string): Promise<Trip> {
  const db = getMockDb()
  const trip = await db.reportDamagedPackage(tripId, packageInstanceId)
  return trip.phase === 'loading' ? finishWhenReady(db, trip) : trip
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
 * tất xếp luôn.
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
