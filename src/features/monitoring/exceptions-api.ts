/**
 * Hàm → endpoint backend (FE-0-09, issue BE S6-03, S6-08, S6-09, S4b-02); nối backend chỉ thay thân hàm.
 *   reportTripException  → POST /api/trips/{id}/exceptions
 *   listTripExceptions   → GET /api/trips/{id}/exceptions
 *   resolveTripException → POST /api/trips/{id}/exceptions/{eid}/resolve
 *   requestReroute       → POST /api/trips/{id}/reroute
 *   confirmReroute       → POST /api/trips/{id}/reroute/{routeIndex}/confirm
 *   renegotiateDeadline  → PATCH /api/delivery-requirements/{id} (hạn mới; ghi "đã liên hệ khách": chưa có ở BE, Q-23)
 *   chưa có ở BE: escalateTripException
 */
import {
  getMockDb,
  type DeadlineRenegotiationInput,
  type RerouteProposal,
  type TripException,
  type TripExceptionInput,
  type TripReroute,
} from '@/lib/mock-db'

/**
 * Lớp gọi API của sự cố cấp chuyến, tuyến thay thế và gia hạn (FE-6-11, FE-6-12). Chưa có backend: sự cố nằm trong kho của tab đang
 * mở, tuyến thay thế là kết quả mock.
 */

/** Điều phối viên hoặc tài xế báo sự cố của chuyến Đang vận chuyển, kèm số phút dự kiến chậm. */
// POST /api/trips/{id}/exceptions
export function reportTripException(tripId: string, input: TripExceptionInput): Promise<TripException> {
  return getMockDb().reportTripException(tripId, input)
}

/** Sự cố của một chuyến, cũ trước. */
// GET /api/trips/{id}/exceptions
export function listTripExceptions(tripId: string): Promise<TripException[]> {
  return getMockDb().listTripExceptions(tripId)
}

/** Điều phối viên đánh dấu sự cố đã xử lý. */
// POST /api/trips/{id}/exceptions/{eid}/resolve
export function resolveTripException(tripId: string, exceptionId: string, note?: string): Promise<TripException> {
  return getMockDb().resolveTripException(tripId, exceptionId, note)
}

/** Điều phối viên: không có tuyến khả thi, chuyển sự cố cho quản lý công ty. */
// chưa có ở BE
export function escalateTripException(tripId: string, exceptionId: string): Promise<TripException> {
  return getMockDb().escalateTripException(tripId, exceptionId)
}

/** Tìm tuyến khác tới điểm kế tiếp từ vị trí xe: 2–3 lựa chọn. */
// POST /api/trips/{id}/reroute
export function requestReroute(tripId: string): Promise<RerouteProposal> {
  return getMockDb().requestReroute(tripId)
}

/** Chọn một lựa chọn của lần tìm gần nhất. */
// POST /api/trips/{id}/reroute/{routeIndex}/confirm
export function confirmReroute(tripId: string, routeIndex: number): Promise<TripReroute> {
  return getMockDb().confirmReroute(tripId, routeIndex)
}

/** Quản lý công ty ghi đã liên hệ khách và nhập hạn mới cho một yêu cầu giao của chuyến có sự cố đã chuyển lên. */
// PATCH /api/delivery-requirements/{id} (ghi "đã liên hệ khách": chưa có ở BE, Q-23)
export function renegotiateDeadline(tripId: string, exceptionId: string, input: DeadlineRenegotiationInput): Promise<TripException> {
  return getMockDb().renegotiateDeadline(tripId, exceptionId, input)
}
