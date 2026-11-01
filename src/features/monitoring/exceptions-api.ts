/**
 * Hàm → endpoint backend (FE-0-09, issue BE S6-03, S6-08, S6-09, S4b-02); nối backend chỉ thay thân hàm.
 *   reportTripException  → POST /api/trips/{id}/exceptions
 *   listTripExceptions   → GET /api/trips/{id}/exceptions
 *   resolveTripException → POST /api/trips/{id}/exceptions/{eid}/resolve
 *   requestReroute       → POST /api/trips/{id}/reroute
 *   confirmReroute       → POST /api/trips/{id}/reroute/{routeIndex}/confirm
 *   renegotiateDeadline  → PATCH /api/delivery-requirements/{id} (hạn mới; ghi "đã liên hệ khách": chưa có ở BE, Q-23)
 *   escalateTripException → POST /api/trips/{id}/exceptions/{eid}/escalate
 *
 * Cùng cờ `VITE_USE_REAL_MONITORING=true` với `monitoring-api.ts`.
 */
import { api } from '@/lib/api-client'
import {
  getMockDb,
  type DeadlineRenegotiationInput,
  type RerouteProposal,
  type TripException,
  type TripExceptionInput,
  type TripReroute,
} from '@/lib/mock-db'

function useRealMonitoring(): boolean {
  return import.meta.env.VITE_USE_REAL_MONITORING === 'true'
}

/** Điều phối viên hoặc tài xế báo sự cố của chuyến Đang vận chuyển, kèm số phút dự kiến chậm. */
// POST /api/trips/{id}/exceptions
export async function reportTripException(tripId: string, input: TripExceptionInput): Promise<TripException> {
  if (!useRealMonitoring()) {
    return getMockDb().reportTripException(tripId, input)
  }
  return api().post<TripException>(`/api/trips/${encodeURIComponent(tripId)}/exceptions`, {
    body: input,
  })
}

/** Sự cố của một chuyến, cũ trước. */
// GET /api/trips/{id}/exceptions
export async function listTripExceptions(tripId: string): Promise<TripException[]> {
  if (!useRealMonitoring()) {
    return getMockDb().listTripExceptions(tripId)
  }
  return api().get<TripException[]>(`/api/trips/${encodeURIComponent(tripId)}/exceptions`)
}

/** Điều phối viên đánh dấu sự cố đã xử lý. */
// POST /api/trips/{id}/exceptions/{eid}/resolve
export async function resolveTripException(tripId: string, exceptionId: string, note?: string): Promise<TripException> {
  if (!useRealMonitoring()) {
    return getMockDb().resolveTripException(tripId, exceptionId, note)
  }
  return api().post<TripException>(
    `/api/trips/${encodeURIComponent(tripId)}/exceptions/${encodeURIComponent(exceptionId)}/resolve`,
    {
      body: note === undefined ? {} : { note },
    },
  )
}

/** Điều phối viên: không có tuyến khả thi, chuyển sự cố cho quản lý công ty. */
// POST /api/trips/{id}/exceptions/{eid}/escalate
export async function escalateTripException(tripId: string, exceptionId: string): Promise<TripException> {
  if (!useRealMonitoring()) {
    return getMockDb().escalateTripException(tripId, exceptionId)
  }
  return api().post<TripException>(
    `/api/trips/${encodeURIComponent(tripId)}/exceptions/${encodeURIComponent(exceptionId)}/escalate`,
  )
}

/** Tìm tuyến khác tới điểm kế tiếp từ vị trí xe: 2–3 lựa chọn. */
// POST /api/trips/{id}/reroute
export async function requestReroute(tripId: string): Promise<RerouteProposal> {
  if (!useRealMonitoring()) {
    return getMockDb().requestReroute(tripId)
  }
  return api().post<RerouteProposal>(`/api/trips/${encodeURIComponent(tripId)}/reroute`)
}

/** Chọn một lựa chọn của lần tìm gần nhất. */
// POST /api/trips/{id}/reroute/{routeIndex}/confirm
export async function confirmReroute(tripId: string, routeIndex: number): Promise<TripReroute> {
  if (!useRealMonitoring()) {
    return getMockDb().confirmReroute(tripId, routeIndex)
  }
  return api().post<TripReroute>(`/api/trips/${encodeURIComponent(tripId)}/reroute/${routeIndex}/confirm`)
}

/** Quản lý công ty ghi đã liên hệ khách và nhập hạn mới cho một yêu cầu giao của chuyến có sự cố đã chuyển lên. */
// PATCH /api/delivery-requirements/{id} (ghi "đã liên hệ khách": chưa có ở BE, Q-23)
export function renegotiateDeadline(tripId: string, exceptionId: string, input: DeadlineRenegotiationInput): Promise<TripException> {
  return getMockDb().renegotiateDeadline(tripId, exceptionId, input)
}
