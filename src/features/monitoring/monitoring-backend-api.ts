/**
 * Hàm → endpoint backend của màn Giám sát khi nhóm `monitoring` nối backend (`usesBackend('monitoring')`):
 *   fetchBoard        → GET /api/dispatcher/dashboard
 *   listFleet         → GET /api/trips/monitoring
 *   tripMonitoring    → GET /api/trips/{id}/monitoring
 *   latestLocation    → GET /api/trips/{id}/location/latest
 *   locationHistory   → GET /api/trips/{id}/location/history
 *   reportException   → POST /api/trips/{id}/exceptions
 *   listExceptions    → GET /api/trips/{id}/exceptions
 *   resolveException  → POST /api/trips/{id}/exceptions/{eid}/resolve
 *   escalateException → POST /api/trips/{id}/exceptions/{eid}/escalate
 *   reportDriverException → POST /api/driver/trips/{id}/exceptions (nhóm `driver`)
 *   proposeReroute    → POST /api/trips/{id}/reroute
 *   confirmReroute    → POST /api/trips/{id}/reroute/{routeIndex}/confirm
 *   renegotiate       → POST /api/trips/{id}/exceptions/{eid}/renegotiate
 *   renegotiableRequirements → GET /api/delivery-requirements (lọc theo mã chuyến ở FE) · GET /api/trips/{id}/detail
 *   reorderStops      → POST /api/trips/{id}/stops/reorder
 */
import { api, ApiError } from '@/lib/api-client'
import { fetchAllPages } from '@/lib/api-page'
import { backendLocalDateTime } from '@/lib/backend-time'
import { withBusinessCode } from '@/lib/billing-backend-api'
import type { DeadlineRenegotiationInput, LocationPoint, StopReorderWarning, TripException, TripExceptionInput, TripReroute } from '@/lib/mock-db'
import type { LiveRerouteProposal, RenegotiableRequirement } from './exceptions-api'
import type { LiveMonitoring, MonitoringBoard } from './monitoring-api'
import { boardOf, liveOf, locationOf, type LocationPointDto, type MonitoringBoardDto, type TripMonitoringDto } from './monitoring-dto'
import {
  exceptionOf,
  proposalOf,
  renegotiableOf,
  rerouteOf,
  type DeliveryRequirementDto,
  type RerouteProposalDto,
  type TripDetailDto,
  type TripExceptionDto,
  type TripRerouteDto,
} from './monitoring-exception-dto'

const tripPath = (tripId: string) => `/api/trips/${encodeURIComponent(tripId)}`

// GET /api/dispatcher/dashboard
export async function fetchBoard(): Promise<MonitoringBoard> {
  return boardOf(await api().get<MonitoringBoardDto | null>('/api/dispatcher/dashboard'))
}

// GET /api/trips/monitoring
export async function listFleet(): Promise<LiveMonitoring[]> {
  return ((await api().get<TripMonitoringDto[] | null>('/api/trips/monitoring')) ?? []).map(liveOf)
}

// GET /api/trips/{id}/monitoring
export async function tripMonitoring(tripId: string): Promise<LiveMonitoring> {
  return liveOf(await api().get<TripMonitoringDto>(`${tripPath(tripId)}/monitoring`))
}

// GET /api/trips/{id}/location/latest
export async function latestLocation(tripId: string): Promise<LocationPoint | null> {
  const dto = await api().get<LocationPointDto | null>(`${tripPath(tripId)}/location/latest`)
  return dto ? locationOf(dto) : null
}

// GET /api/trips/{id}/location/history
export async function locationHistory(tripId: string): Promise<LocationPoint[]> {
  return ((await api().get<LocationPointDto[] | null>(`${tripPath(tripId)}/location/history`)) ?? []).map(locationOf)
}

/** Form đã kiểm loại, mô tả và số phút như backend, nên 400 ở đây là chuyến không còn đang vận chuyển. */
// POST /api/trips/{id}/exceptions
export async function reportException(tripId: string, input: TripExceptionInput): Promise<TripException> {
  const body = { type: input.type, description: input.description, delayMinutes: input.delayMinutes }
  const request = api().post<TripExceptionDto>(`${tripPath(tripId)}/exceptions`, { body })
  return exceptionOf(await withBusinessCode(request, { BAD_REQUEST: 'GPS_TRIP_NOT_IN_TRANSIT' }))
}

// GET /api/trips/{id}/exceptions
export async function listExceptions(tripId: string): Promise<TripException[]> {
  return ((await api().get<TripExceptionDto[] | null>(`${tripPath(tripId)}/exceptions`)) ?? []).map(exceptionOf)
}

/** Chuyến có trên bảng giám sát, nên 404 ở đây là sự cố không còn. */
// POST /api/trips/{id}/exceptions/{eid}/resolve
export async function resolveException(tripId: string, exceptionId: string, note?: string): Promise<TripException> {
  const request = api().post<TripExceptionDto>(`${tripPath(tripId)}/exceptions/${encodeURIComponent(exceptionId)}/resolve`, {
    body: note === undefined ? {} : { note },
  })
  return exceptionOf(await withBusinessCode(request, { NOT_FOUND: 'TRIP_EXCEPTION_NOT_FOUND' }))
}

/**
 * Tìm tuyến khác tới điểm kế tiếp. 404 là chuyến không còn điểm chờ giao; 400 có hai nghĩa (chuyến không còn chạy, xe chưa có vị trí) nên
 * giữ câu chung.
 */
// POST /api/trips/{id}/reroute
export async function proposeReroute(tripId: string): Promise<LiveRerouteProposal> {
  const request = api().post<RerouteProposalDto>(`${tripPath(tripId)}/reroute`)
  return proposalOf(await withBusinessCode(request, { NOT_FOUND: 'NO_PENDING_DELIVERY_STOP' }))
}

/** 400 là lựa chọn không còn hợp lệ: lần tìm đã được chọn rồi, hoặc chỉ số ngoài các lựa chọn. */
// POST /api/trips/{id}/reroute/{routeIndex}/confirm
export async function confirmReroute(tripId: string, routeIndex: number): Promise<TripReroute> {
  const request = api().post<TripRerouteDto>(`${tripPath(tripId)}/reroute/${routeIndex}/confirm`)
  const reroute = rerouteOf(await withBusinessCode(request, { BAD_REQUEST: 'INVALID_REROUTE_INDEX' }))
  if (!reroute) throw new ApiError('SERVER_ERROR')
  return reroute
}

/** Điều phối viên: không có tuyến khả thi, chuyển sự cố còn mở cho quản lý. Sự cố đã chuyển hay đã xử lý: 409 `EXCEPTION_STATUS_INVALID`. */
// POST /api/trips/{id}/exceptions/{eid}/escalate
export async function escalateException(tripId: string, exceptionId: string): Promise<TripException> {
  const request = api().post<TripExceptionDto>(`${tripPath(tripId)}/exceptions/${encodeURIComponent(exceptionId)}/escalate`)
  return exceptionOf(await withBusinessCode(request, { NOT_FOUND: 'TRIP_EXCEPTION_NOT_FOUND' }))
}

/**
 * Quản lý công ty gia hạn cho một yêu cầu giao của chuyến có sự cố đã chuyển lên. Hạn mới gửi theo giờ Việt Nam, không múi giờ. Máy chủ
 * từ chối bằng mã: `CONTACT_NOTE_REQUIRED`, `REQUIREMENT_DEADLINE_PAST`, `EXCEPTION_STATUS_INVALID`, `DELIVERY_REQUIREMENT_NOT_FOUND`,
 * `DELIVERY_REQUIREMENT_NOT_IN_TRIP`.
 */
// POST /api/trips/{id}/exceptions/{eid}/renegotiate
export async function renegotiate(tripId: string, exceptionId: string, input: DeadlineRenegotiationInput): Promise<TripException> {
  const requirementId = Number(input.requirementId)
  if (!Number.isInteger(requirementId)) throw new ApiError('DELIVERY_REQUIREMENT_NOT_FOUND')
  const body = { requirementId, newDeadline: backendLocalDateTime(input.deadline), contactNote: input.contactNote }
  const request = api().post<TripExceptionDto>(`${tripPath(tripId)}/exceptions/${encodeURIComponent(exceptionId)}/renegotiate`, { body })
  return exceptionOf(await withBusinessCode(request, { NOT_FOUND: 'TRIP_EXCEPTION_NOT_FOUND' }))
}

/**
 * Yêu cầu giao của chuyến còn gia hạn được. Máy chủ chưa lọc yêu cầu giao theo chuyến: đọc đủ danh sách rồi giữ dòng của chuyến (mã
 * chuyến hoặc mã số), rồi đọc điểm giao của chuyến theo mã số để biết yêu cầu nằm ở điểm nào và điểm đó đã giao xong chưa.
 */
// GET /api/delivery-requirements · GET /api/trips/{id}/detail
export async function renegotiableRequirements(tripId: string): Promise<RenegotiableRequirement[]> {
  const rows = (await fetchAllPages<DeliveryRequirementDto>('/api/delivery-requirements', { size: 100 }))
    .filter((dto) => dto.tripCode === tripId || (dto.tripId != null && String(dto.tripId) === tripId))
  const numericId = rows.find((dto) => dto.tripId != null)?.tripId
  if (numericId == null) return []
  const detail = await api().get<TripDetailDto | null>(`/api/trips/${encodeURIComponent(String(numericId))}/detail`)
  return renegotiableOf(rows, detail ?? {})
}

/**
 * Tài xế báo sự cố trên đường của chuyến mình (nhóm `driver` nối backend; `tripId` là mã số chuyến của "Chuyến của tôi"). Cùng thân và
 * phản hồi với lối của điều phối viên; 400 là chuyến không còn đang vận chuyển.
 */
// POST /api/driver/trips/{id}/exceptions
export async function reportDriverException(tripId: string, input: TripExceptionInput): Promise<TripException> {
  const body = { type: input.type, description: input.description, delayMinutes: input.delayMinutes }
  const request = api().post<TripExceptionDto>(`/api/driver/trips/${encodeURIComponent(tripId)}/exceptions`, { body })
  return exceptionOf(await withBusinessCode(request, { BAD_REQUEST: 'GPS_TRIP_NOT_IN_TRANSIT' }))
}

type ReorderStopsDto = { readonly partial?: readonly { readonly packageCode?: string | null; readonly stopId?: number | string | null }[] | null }

/**
 * Điều phối viên đổi thứ tự các điểm chưa giao khi xe đang chạy (`tripId` là mã chuyến, `orderedStopIds` là mã số điểm của máy chủ).
 * Máy chủ kiểm lại khả năng dỡ: kiện bị che kín theo thứ tự mới là 409 `STOP_ORDER_BLOCKS_CARGO` kèm `packages` (mã in trên nhãn) và
 * `stopIds` (chuỗi mã số điểm) song song — cùng dạng với lỗi của kho mẫu; kiện bị che một phần trả ở `partial`.
 */
// POST /api/trips/{id}/stops/reorder
export async function reorderStops(tripId: string, orderedStopIds: readonly string[]): Promise<{ partial: StopReorderWarning[] }> {
  const body = { stopIds: orderedStopIds.map(Number) }
  const dto = await api().post<ReorderStopsDto>(`${tripPath(tripId)}/stops/reorder`, { body })
  return { partial: (dto.partial ?? []).map((item) => ({ packageId: item.packageCode ?? '', stopId: String(item.stopId ?? '') })) }
}
