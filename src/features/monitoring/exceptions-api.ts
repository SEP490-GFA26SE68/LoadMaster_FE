/**
 * Hàm → endpoint backend (FE-0-09, issue BE S6-03, S6-08, S6-09, S4b-02). Nhóm `monitoring` nối backend thì hàm đánh dấu (BE) gọi
 * `monitoring-backend-api.ts`; hàm khác vẫn là kho mẫu.
 *   reportTripException  → POST /api/trips/{id}/exceptions (BE khi báo từ màn Giám sát; màn tài xế của kho mẫu vẫn là kho mẫu)
 *   listTripExceptions   → GET /api/trips/{id}/exceptions (BE)
 *   resolveTripException → POST /api/trips/{id}/exceptions/{eid}/resolve (BE)
 *   requestReroute       → POST /api/trips/{id}/reroute (BE)
 *   confirmReroute       → POST /api/trips/{id}/reroute/{routeIndex}/confirm (BE)
 *   renegotiateDeadline  → PATCH /api/delivery-requirements/{id} (hạn mới; ghi "đã liên hệ khách": chưa có ở BE, Q-23)
 *   chưa có ở BE: escalateTripException
 */
import { ApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import {
  getMockDb,
  type DeadlineRenegotiationInput,
  type RerouteProposal,
  type TripException,
  type TripExceptionInput,
  type TripReroute,
} from '@/lib/mock-db'
import * as backend from './monitoring-backend-api'

const ON_BACKEND = usesBackend('monitoring')

/** Việc backend chưa có: màn Giám sát đã ẩn nút, lỡ gọi tới thì từ chối — không ghi vào kho mẫu thay cho chuyến của backend. */
const unsupported = (): Promise<never> => Promise.reject(new ApiError('NOT_SUPPORTED'))

/**
 * Lớp gọi API của sự cố cấp chuyến, tuyến thay thế và gia hạn (FE-6-11, FE-6-12). Kho mẫu: sự cố nằm trong kho của tab đang mở, tuyến
 * thay thế là kết quả mock.
 */

/** Lần tìm tuyến khác như màn đọc: kho mẫu luôn là kết quả mock; backend tự báo qua `isMockResult`. */
export type LiveRerouteProposal = Omit<RerouteProposal, 'isMockResult'> & { readonly isMockResult: boolean }

/**
 * Ai báo sự cố: màn Giám sát (`board`) đọc chuyến từ nguồn của nhóm `monitoring`; màn điểm giao của tài xế (`driver`) chỉ mở hộp báo
 * sự cố khi chạy trên kho mẫu, nên luôn ghi vào kho mẫu.
 */
export type ExceptionReporter = 'board' | 'driver'

/** Điều phối viên hoặc tài xế báo sự cố của chuyến Đang vận chuyển, kèm số phút dự kiến chậm. */
// POST /api/trips/{id}/exceptions
export function reportTripException(tripId: string, input: TripExceptionInput, from: ExceptionReporter = 'board'): Promise<TripException> {
  if (ON_BACKEND && from === 'board') return backend.reportException(tripId, input)
  return getMockDb().reportTripException(tripId, input)
}

/** Sự cố của một chuyến, cũ trước. */
// GET /api/trips/{id}/exceptions
export function listTripExceptions(tripId: string): Promise<TripException[]> {
  if (ON_BACKEND) return backend.listExceptions(tripId)
  return getMockDb().listTripExceptions(tripId)
}

/** Điều phối viên đánh dấu sự cố đã xử lý. */
// POST /api/trips/{id}/exceptions/{eid}/resolve
export function resolveTripException(tripId: string, exceptionId: string, note?: string): Promise<TripException> {
  if (ON_BACKEND) return backend.resolveException(tripId, exceptionId, note)
  return getMockDb().resolveTripException(tripId, exceptionId, note)
}

/** Điều phối viên: không có tuyến khả thi, chuyển sự cố cho quản lý công ty. */
// chưa có ở BE
export function escalateTripException(tripId: string, exceptionId: string): Promise<TripException> {
  if (ON_BACKEND) return unsupported()
  return getMockDb().escalateTripException(tripId, exceptionId)
}

/** Tìm tuyến khác tới điểm kế tiếp từ vị trí xe: 2–3 lựa chọn. */
// POST /api/trips/{id}/reroute
export function requestReroute(tripId: string): Promise<LiveRerouteProposal> {
  if (ON_BACKEND) return backend.proposeReroute(tripId)
  return getMockDb().requestReroute(tripId)
}

/** Chọn một lựa chọn của lần tìm gần nhất. */
// POST /api/trips/{id}/reroute/{routeIndex}/confirm
export function confirmReroute(tripId: string, routeIndex: number): Promise<TripReroute> {
  if (ON_BACKEND) return backend.confirmReroute(tripId, routeIndex)
  return getMockDb().confirmReroute(tripId, routeIndex)
}

/** Quản lý công ty ghi đã liên hệ khách và nhập hạn mới cho một yêu cầu giao của chuyến có sự cố đã chuyển lên. */
// PATCH /api/delivery-requirements/{id} (ghi "đã liên hệ khách": chưa có ở BE, Q-23)
export function renegotiateDeadline(tripId: string, exceptionId: string, input: DeadlineRenegotiationInput): Promise<TripException> {
  if (ON_BACKEND) return unsupported()
  return getMockDb().renegotiateDeadline(tripId, exceptionId, input)
}
