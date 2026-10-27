/**
 * Hàm → endpoint backend (FE-0-09, issue BE S6-04 → S6-07, S6-10); nối backend chỉ thay thân hàm.
 *   postDriverLocation   → POST /api/driver/location
 *   getLatestLocation    → GET /api/trips/{id}/location/latest
 *   getLocationHistory   → GET /api/trips/{id}/location/history
 *   getTripMonitoring    → GET /api/trips/{id}/monitoring
 *   listTripMonitoring   → GET /api/trips/monitoring
 *   fetchMonitoringBoard → GET /api/dispatcher/dashboard
 *   subscribeTrip        → WebSocket /ws/trips/{tripId}/monitoring (Q-08) — tạm thời in-memory sau mỗi lần poll
 *   chưa có ở BE: reorderRunningStops, setDriverGps (đồng hồ mô phỏng chỉ có ở FE)
 *
 * Bật BE thật: `VITE_USE_REAL_MONITORING=true` trong `.env` (cần Keycloak + LoadMasterService).
 * Mặc định / CI / DOM test: vẫn dùng mock-db (seed TRIP-009).
 */
import { apiFetch } from '@/lib/api-client'
import { getMockDb, type DriverLocationInput, type LocationPoint, type StopKind, type StopReorder, type TripMonitoring } from '@/lib/mock-db'
import { publish, publishFleet, subscribe, type TripMonitoringEvent } from './monitoring-events'

type ApiEnvelope<T> = {
  success: boolean
  message?: string
  data: T
}

function useRealMonitoring(): boolean {
  return import.meta.env.VITE_USE_REAL_MONITORING === 'true'
}

async function unwrap<T>(path: string, init?: RequestInit): Promise<T> {
  const body = await apiFetch<ApiEnvelope<T>>(path, init)
  return body.data
}

/** Điện thoại tài xế gửi vị trí GPS thật của chuyến đang chạy. */
// POST /api/driver/location
export async function postDriverLocation(tripId: string, location: DriverLocationInput): Promise<LocationPoint> {
  if (!useRealMonitoring()) {
    return getMockDb().postDriverLocation(tripId, location)
  }
  return unwrap<LocationPoint>('/api/driver/location', {
    method: 'POST',
    body: JSON.stringify({
      tripId,
      lat: location.lat,
      lng: location.lng,
      speedKmh: location.speedKmh ?? 0,
      heading: location.heading ?? 0,
    }),
  })
}

/**
 * Tài xế bật / tắt "Dùng GPS thật" (FE-6-13): chỉ có nghĩa khi chưa có máy chủ — backend nhận thẳng điểm GPS.
 */
// chưa có ở BE
export function setDriverGps(tripId: string, enabled: boolean): Promise<boolean> {
  return getMockDb().setDriverGps(tripId, enabled)
}

/** Vị trí mới nhất của xe; `null` khi xe chưa xuất phát hoặc chưa có vị trí. */
// GET /api/trips/{id}/location/latest
export async function getLatestLocation(tripId: string): Promise<LocationPoint | null> {
  if (!useRealMonitoring()) {
    return getMockDb().getLatestLocation(tripId)
  }
  return unwrap<LocationPoint | null>(`/api/trips/${encodeURIComponent(tripId)}/location/latest`)
}

/** Lịch sử vị trí của chuyến, cũ trước. */
// GET /api/trips/{id}/location/history
export async function getLocationHistory(tripId: string): Promise<LocationPoint[]> {
  if (!useRealMonitoring()) {
    return getMockDb().getLocationHistory(tripId)
  }
  return unwrap<LocationPoint[]>(`/api/trips/${encodeURIComponent(tripId)}/location/history`)
}

/** Vị trí mới nhất, ETA trực tiếp từng điểm chưa hoàn tất, cảnh báo nguy cơ trễ và sự cố của một chuyến. */
// GET /api/trips/{id}/monitoring
export async function getTripMonitoring(tripId: string): Promise<TripMonitoring> {
  const monitoring = useRealMonitoring()
    ? await unwrap<TripMonitoring>(`/api/trips/${encodeURIComponent(tripId)}/monitoring`)
    : await getMockDb().getTripMonitoring(tripId)
  publish(monitoring)
  return monitoring
}

/** Giám sát mọi chuyến Đang vận chuyển của công ty — màn đang mở gọi lại theo `refreshMs` thay cho kênh đẩy của backend. */
// GET /api/trips/monitoring
export async function listTripMonitoring(): Promise<TripMonitoring[]> {
  const fleet = useRealMonitoring()
    ? await unwrap<TripMonitoring[]>('/api/trips/monitoring')
    : await getMockDb().listTripMonitoring()
  publishFleet(fleet)
  return fleet
}

/**
 * Nghe sự kiện giám sát của một chuyến; trả hàm thôi nghe.
 * BE chưa có WebSocket: sự kiện in-memory sau mỗi lần poll monitoring.
 */
// WebSocket /ws/trips/{tripId}/monitoring (Q-08) — chưa implement; poll refreshMs
export function subscribeTrip(tripId: string, onEvent: (event: TripMonitoringEvent) => void): () => void {
  return subscribe(tripId, onEvent)
}

/**
 * Điều phối viên đổi thứ tự các điểm chưa giao khi xe đang chạy (FE-BL-03, D-87).
 */
// chưa có ở BE
export function reorderRunningStops(tripId: string, orderedStopIds: string[]): Promise<StopReorder> {
  return getMockDb().reorderRunningStops(tripId, orderedStopIds)
}

/** Điểm giao của một chuyến trên màn Giám sát; `completedAt` có khi tài xế đã hoàn tất điểm, `arrivedAt` khi xe đã tới. */
export type MonitoringStop = {
  readonly id: string
  readonly number: number
  readonly name: string
  /** Điểm nhận hàng dọc đường (FE-7-04); vắng là điểm giao. */
  readonly kind?: StopKind
  readonly lat?: number
  readonly lng?: number
  readonly arrivedAt?: string
  readonly completedAt?: string
}

/** Phần ít đổi của một chuyến Đang vận chuyển: tên, xe, tài xế, kho xuất phát và các điểm giao theo thứ tự đi. */
export type MonitoringTrip = {
  readonly tripId: string
  readonly name: string
  readonly vehicleName: string
  /** `null` khi chuyến chưa gán tài xế, hoặc kho không còn tài khoản đó. */
  readonly driverName: string | null
  readonly depot: { readonly name: string; readonly lat: number; readonly lng: number }
  readonly stops: readonly MonitoringStop[]
}

export type MonitoringBoard = {
  /** Chuyến Đang vận chuyển của công ty, theo thứ tự tạo chuyến — cùng thứ tự với `listTripMonitoring`. */
  readonly trips: readonly MonitoringTrip[]
  /** Họ tên theo mã người dùng, để đọc người báo và người xử lý sự cố. */
  readonly userNames: Readonly<Record<string, string>>
}

/** Bảng giám sát: các chuyến Đang vận chuyển kèm tên xe, tài xế và điểm giao. Vị trí và ETA đọc riêng (`listTripMonitoring`). */
// GET /api/dispatcher/dashboard
export async function fetchMonitoringBoard(): Promise<MonitoringBoard> {
  if (useRealMonitoring()) {
    return unwrap<MonitoringBoard>('/api/dispatcher/dashboard')
  }
  const db = getMockDb()
  const [trips, vehicles, names] = await Promise.all([db.listTrips(), db.listVehicles(), db.listAuditNames()])
  const vehicleNames = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.name]))
  const userNames = Object.fromEntries(names.users.map((user) => [user.id, user.fullName]))
  return {
    userNames,
    trips: trips.filter((trip) => trip.phase === 'delivering').map((trip) => ({
      tripId: trip.id,
      name: trip.name,
      vehicleName: vehicleNames.get(trip.vehicleId) ?? trip.vehicleId,
      driverName: trip.driverId === null || trip.driverId === undefined ? null : (userNames[trip.driverId] ?? null),
      depot: { name: trip.depot.name, lat: trip.depot.lat, lng: trip.depot.lng },
      stops: trip.stops.map((stop, index) => {
        const progress = trip.delivery?.stops.find((item) => item.number === index + 1)
        return {
          id: stop.id, number: index + 1, name: stop.name,
          ...(stop.kind === undefined ? {} : { kind: stop.kind }),
          ...(stop.lat === undefined || stop.lng === undefined ? {} : { lat: stop.lat, lng: stop.lng }),
          ...(progress?.arrivedAt === undefined ? {} : { arrivedAt: progress.arrivedAt }),
          ...(progress?.completedAt === undefined ? {} : { completedAt: progress.completedAt }),
        }
      }),
    })),
  }
}
