/**
 * Hàm → endpoint backend của màn Giám sát khi nhóm `monitoring` nối backend (`usesBackend('monitoring')`):
 *   fetchBoard        → GET /api/dispatcher/dashboard
 *   listFleet         → GET /api/trips/monitoring
 *   latestLocation    → GET /api/trips/{id}/location/latest
 *   locationHistory   → GET /api/trips/{id}/location/history
 *   reportException   → POST /api/trips/{id}/exceptions
 *   listExceptions    → GET /api/trips/{id}/exceptions
 *   resolveException  → POST /api/trips/{id}/exceptions/{eid}/resolve
 *   proposeReroute    → POST /api/trips/{id}/reroute
 *   confirmReroute    → POST /api/trips/{id}/reroute/{routeIndex}/confirm
 */
import { api, ApiError } from '@/lib/api-client'
import { withBusinessCode } from '@/lib/billing-backend-api'
import type { LocationPoint, TripException, TripExceptionInput, TripReroute } from '@/lib/mock-db'
import type { LiveRerouteProposal } from './exceptions-api'
import type { LiveMonitoring, MonitoringBoard } from './monitoring-api'
import { boardOf, liveOf, locationOf, type LocationPointDto, type MonitoringBoardDto, type TripMonitoringDto } from './monitoring-dto'
import {
  exceptionOf,
  proposalOf,
  rerouteOf,
  type RerouteProposalDto,
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
