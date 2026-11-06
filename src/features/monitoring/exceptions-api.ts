/**
 * Hàm → endpoint backend (FE-0-09, issue BE S6-03, S6-08, S6-09, S4b-02). Nhóm `monitoring` nối backend thì hàm đánh dấu (BE) gọi
 * `monitoring-backend-api.ts`; hàm khác vẫn là kho mẫu.
 *   reportTripException  → POST /api/trips/{id}/exceptions (BE khi báo từ màn Giám sát) · POST /api/driver/trips/{id}/exceptions
 *                          (BE khi tài xế báo và nhóm `driver` nối backend)
 *   listTripExceptions   → GET /api/trips/{id}/exceptions (BE)
 *   resolveTripException → POST /api/trips/{id}/exceptions/{eid}/resolve (BE)
 *   requestReroute       → POST /api/trips/{id}/reroute (BE)
 *   confirmReroute       → POST /api/trips/{id}/reroute/{routeIndex}/confirm (BE)
 *   renegotiateDeadline  → POST /api/trips/{id}/exceptions/{eid}/renegotiate (BE)
 *   listRenegotiableRequirements → GET /api/delivery-requirements · GET /api/trips/{id}/detail (BE)
 *   escalateTripException → POST /api/trips/{id}/exceptions/{eid}/escalate (BE)
 */
import { fetchTripRequirements } from '@/features/trips/trip-extras-api'
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
const DRIVER_ON_BACKEND = usesBackend('driver')

/**
 * Lớp gọi API của sự cố cấp chuyến, tuyến thay thế và gia hạn (FE-6-11, FE-6-12). Kho mẫu: sự cố nằm trong kho của tab đang mở, tuyến
 * thay thế là kết quả mock.
 */

/** Lần tìm tuyến khác như màn đọc: kho mẫu luôn là kết quả mock; backend tự báo qua `isMockResult`. */
export type LiveRerouteProposal = Omit<RerouteProposal, 'isMockResult'> & { readonly isMockResult: boolean }

/**
 * Ai báo sự cố: màn Giám sát (`board`) đọc chuyến từ nguồn của nhóm `monitoring`; màn điểm giao của tài xế (`driver`) đọc chuyến từ
 * nguồn của nhóm `driver` (mã số chuyến của máy chủ khi nhóm đó nối backend).
 */
export type ExceptionReporter = 'board' | 'driver'

/** Điều phối viên hoặc tài xế báo sự cố của chuyến Đang vận chuyển, kèm số phút dự kiến chậm. */
// POST /api/trips/{id}/exceptions · POST /api/driver/trips/{id}/exceptions
export function reportTripException(tripId: string, input: TripExceptionInput, from: ExceptionReporter = 'board'): Promise<TripException> {
  if (from === 'driver' ? DRIVER_ON_BACKEND : ON_BACKEND) {
    return from === 'driver' ? backend.reportDriverException(tripId, input) : backend.reportException(tripId, input)
  }
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
// POST /api/trips/{id}/exceptions/{eid}/escalate
export function escalateTripException(tripId: string, exceptionId: string): Promise<TripException> {
  if (ON_BACKEND) return backend.escalateException(tripId, exceptionId)
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
// POST /api/trips/{id}/exceptions/{eid}/renegotiate
export function renegotiateDeadline(tripId: string, exceptionId: string, input: DeadlineRenegotiationInput): Promise<TripException> {
  if (ON_BACKEND) return backend.renegotiate(tripId, exceptionId, input)
  return getMockDb().renegotiateDeadline(tripId, exceptionId, input)
}

/** Yêu cầu giao gia hạn được: còn đang giao, có hạn, và còn một điểm giao chưa hoàn tất của chuyến (`stopNumber`, từ 1). */
export type RenegotiableRequirement = {
  readonly id: string
  readonly destinationName: string
  /** ISO 8601 */
  readonly deadline: string
  readonly stopNumber: number
}

/** Yêu cầu giao của chuyến mà quản lý gia hạn được, theo thứ tự điểm giao rồi hạn. */
// GET /api/delivery-requirements · GET /api/trips/{id}/detail
export async function listRenegotiableRequirements(tripId: string): Promise<RenegotiableRequirement[]> {
  if (ON_BACKEND) return backend.renegotiableRequirements(tripId)
  return (await fetchTripRequirements(tripId)).flatMap(({ requirement, status, stopNumber }) =>
    status === 'IN_TRIP' && stopNumber !== undefined
      ? [{ id: requirement.id, destinationName: requirement.destinationName, deadline: requirement.deadline, stopNumber }]
      : [])
}
