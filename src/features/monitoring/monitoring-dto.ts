import type { DeadlineStatus } from '@/domain/routing'
import { isoFromBackend } from '@/lib/backend-time'
import { LOCATION_SOURCES, type EtaRiskAlert, type LocationPoint, type TripLiveStop } from '@/lib/mock-db'
import type { LiveMonitoring, MonitoringBoard, MonitoringStop, MonitoringTrip } from './monitoring-api'
import { exceptionOf, pick, rerouteOf, type TripExceptionDto, type TripRerouteDto } from './monitoring-exception-dto'

/**
 * DTO của `MonitoringController` backend và hàm đổi sang kiểu của màn Giám sát; chỉ `monitoring-backend-api.ts` import file này (sự cố
 * và tuyến thay thế ở `monitoring-exception-dto.ts`). Mã chuyến của backend (`tripCode`) là `tripId` ở mọi chỗ — endpoint nhận cả mã số
 * lẫn mã chuyến. Mốc giờ qua `isoFromBackend`.
 */

export type LocationPointDto = {
  readonly lat: number
  readonly lng: number
  readonly speedKmh?: number | null
  readonly heading?: number | null
  readonly recordedAt: string
  readonly source?: string | null
}

type BoardStopDto = {
  readonly id: string | number
  readonly number: number
  readonly name?: string | null
  readonly lat?: number | null
  readonly lng?: number | null
  readonly arrivedAt?: string | null
  readonly completedAt?: string | null
}

type BoardTripDto = {
  readonly tripId: string
  readonly name?: string | null
  readonly vehicleName?: string | null
  readonly driverName?: string | null
  readonly depot?: { readonly name?: string | null; readonly lat?: number | null; readonly lng?: number | null } | null
  readonly stops?: readonly BoardStopDto[] | null
}

export type MonitoringBoardDto = {
  readonly trips?: readonly BoardTripDto[] | null
  readonly userNames?: Readonly<Record<string, string>> | null
}

type LiveStopDto = {
  readonly stopId: string | number
  readonly number: number
  readonly eta: string
  readonly deadline?: string | null
  readonly deadlineStatus?: string | null
  readonly arrived?: boolean | null
}

type EtaRiskAlertDto = {
  readonly eventId: string
  readonly at: string
  readonly tripId: string
  readonly stopId?: string | number | null
  readonly stopNumber?: number | null
  readonly status?: string | null
  readonly eta: string
  readonly deadline: string
}

export type TripMonitoringDto = {
  readonly tripId: string
  readonly location: LocationPointDto | null
  readonly stops?: readonly LiveStopDto[] | null
  readonly alerts?: readonly EtaRiskAlertDto[] | null
  readonly exceptions?: readonly TripExceptionDto[] | null
  readonly reroute?: TripRerouteDto | null
  readonly refreshMs: number | null
  readonly isMockResult?: boolean | null
}

const DEADLINE_STATUSES: readonly DeadlineStatus[] = ['OK', 'AT_RISK', 'MISSED']

const coordinates = (lat: number | null | undefined, lng: number | null | undefined) =>
  typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : {}

/** Điểm vị trí: tốc độ km/h nguyên, hướng độ nguyên 0–359; backend chỉ có hai nguồn `GPS` và `SIMULATED`. */
export function locationOf(dto: LocationPointDto): LocationPoint {
  const heading = Math.round(dto.heading ?? 0) % 360
  return {
    lat: dto.lat,
    lng: dto.lng,
    speedKmh: Math.max(0, Math.round(dto.speedKmh ?? 0)),
    heading: heading < 0 ? heading + 360 : heading,
    recordedAt: isoFromBackend(dto.recordedAt),
    source: pick(LOCATION_SOURCES, dto.source) ?? 'GPS',
  }
}

function stopOf(dto: BoardStopDto): MonitoringStop {
  return {
    id: String(dto.id),
    number: dto.number,
    name: dto.name ?? '',
    ...coordinates(dto.lat, dto.lng),
    ...(dto.arrivedAt ? { arrivedAt: isoFromBackend(dto.arrivedAt) } : {}),
    ...(dto.completedAt ? { completedAt: isoFromBackend(dto.completedAt) } : {}),
  }
}

/**
 * Kho xuất phát. Thiếu toạ độ trong tuyến, backend lấy điểm giao đầu tiên làm kho, rồi rơi về toạ độ 0, 0: cả hai trường hợp đều coi như
 * không có kho, để bản đồ không vẽ kho ngoài biển hay chồng lên điểm 1.
 */
function depotOf(dto: BoardTripDto, stops: readonly MonitoringStop[]): MonitoringTrip['depot'] {
  const depot = dto.depot
  if (!depot || typeof depot.lat !== 'number' || typeof depot.lng !== 'number' || (depot.lat === 0 && depot.lng === 0)) return undefined
  const [first] = stops
  if (first && first.lat === depot.lat && first.lng === depot.lng) return undefined
  return { name: depot.name ?? '', lat: depot.lat, lng: depot.lng }
}

function tripOf(dto: BoardTripDto): MonitoringTrip {
  const stops = (dto.stops ?? []).map(stopOf)
  const depot = depotOf(dto, stops)
  return {
    tripId: dto.tripId,
    // Backend chưa có tên tuyến: `name` là chính mã chuyến, màn không nhắc lại mã
    name: dto.name && dto.name !== dto.tripId ? dto.name : '',
    vehicleName: dto.vehicleName ?? '',
    driverName: dto.driverName ?? null,
    ...(depot ? { depot } : {}),
    stops,
  }
}

export function boardOf(dto: MonitoringBoardDto | null): MonitoringBoard {
  return { trips: (dto?.trips ?? []).map(tripOf), userNames: { ...dto?.userNames } }
}

/**
 * Giờ đến của một điểm chưa hoàn tất. Cờ `arrived` của backend không có nghĩa "xe đã tới": backend đặt điểm kế tiếp thành ARRIVED ngay
 * khi tài xế hoàn tất điểm trước, và `eta` của điểm đó vẫn tính từ vị trí xe — nên mọi điểm đọc là giờ đến dự kiến.
 */
function liveStopOf(dto: LiveStopDto): TripLiveStop {
  const deadlineStatus = pick(DEADLINE_STATUSES, dto.deadlineStatus)
  return {
    stopId: String(dto.stopId),
    number: dto.number,
    eta: isoFromBackend(dto.eta),
    ...(dto.deadline ? { deadline: isoFromBackend(dto.deadline) } : {}),
    ...(deadlineStatus ? { deadlineStatus } : {}),
  }
}

function alertsOf(dto: EtaRiskAlertDto): EtaRiskAlert[] {
  const status = dto.status === 'AT_RISK' || dto.status === 'MISSED' ? dto.status : undefined
  if (!status || dto.stopId === null || dto.stopId === undefined || typeof dto.stopNumber !== 'number') return []
  return [{
    eventId: dto.eventId, at: isoFromBackend(dto.at), tripId: dto.tripId, stopId: String(dto.stopId), stopNumber: dto.stopNumber, status,
    eta: isoFromBackend(dto.eta), deadline: isoFromBackend(dto.deadline),
  }]
}

/** Nhịp đọc lại: backend trả 30 giây khi chuyến đang chạy, `null` khi không; màn đọc lại nhiều nhất mỗi giây. */
export function liveOf(dto: TripMonitoringDto): LiveMonitoring {
  const reroute = dto.reroute ? rerouteOf(dto.reroute) : undefined
  return {
    tripId: dto.tripId,
    location: dto.location ? locationOf(dto.location) : null,
    stops: (dto.stops ?? []).map(liveStopOf),
    alerts: (dto.alerts ?? []).flatMap(alertsOf),
    exceptions: (dto.exceptions ?? []).map(exceptionOf),
    ...(reroute ? { reroute } : {}),
    refreshMs: typeof dto.refreshMs === 'number' && dto.refreshMs > 0 ? Math.max(1000, dto.refreshMs) : null,
    isMockResult: dto.isMockResult === true,
  }
}
