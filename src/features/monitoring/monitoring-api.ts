/**
 * Hàm → endpoint backend (FE-0-09, issue BE S6-04 → S6-07, S6-10); nối backend chỉ thay thân hàm.
 *   postDriverLocation   → POST /api/driver/location
 *   getLatestLocation    → GET /api/trips/{id}/location/latest
 *   getLocationHistory   → GET /api/trips/{id}/location/history
 *   getTripMonitoring    → GET /api/trips/{id}/monitoring
 *   fetchMonitoringBoard → GET /api/dispatcher/dashboard
 *   subscribeTrip        → WebSocket /ws/trips/{tripId}/monitoring (Q-08)
 *   chưa có ở BE: reorderRunningStops (Luồng BE mục 13 "Dynamic stop reordering" chưa có endpoint), listTripMonitoring (kênh cập nhật của BE là WebSocket, Q-08), setDriverGps (đồng hồ mô phỏng chỉ có ở FE)
 */
import { getMockDb, type DriverLocationInput, type LocationPoint, type StopKind, type StopReorder, type TripMonitoring } from '@/lib/mock-db'
import { publish, publishFleet, subscribe, type TripMonitoringEvent } from './monitoring-events'

/**
 * Lớp gọi API của giám sát (FE-6-08 → FE-6-10): vị trí xe và ETA trực tiếp của chuyến Đang vận chuyển. Chưa có backend: vị trí là xe
 * mô phỏng của kho (nguồn `SIMULATED`), ETA là kết quả mock — và chỉ nằm trong kho của tab đang mở.
 */

/** Điện thoại tài xế gửi vị trí GPS thật của chuyến đang chạy. */
// POST /api/driver/location
export function postDriverLocation(tripId: string, location: DriverLocationInput): Promise<LocationPoint> {
  return getMockDb().postDriverLocation(tripId, location)
}

/**
 * Tài xế bật / tắt "Dùng GPS thật" (FE-6-13): bật thì đồng hồ mô phỏng của tab chạy theo giờ thật, tắt thì xe mô phỏng ghi tiếp. Chỉ
 * có nghĩa khi chưa có máy chủ — backend nhận thẳng điểm GPS, không có đồng hồ mô phỏng.
 */
// chưa có ở BE
export function setDriverGps(tripId: string, enabled: boolean): Promise<boolean> {
  return getMockDb().setDriverGps(tripId, enabled)
}

/** Vị trí mới nhất của xe; `null` khi xe chưa xuất phát hoặc chưa có vị trí. */
// GET /api/trips/{id}/location/latest
export function getLatestLocation(tripId: string): Promise<LocationPoint | null> {
  return getMockDb().getLatestLocation(tripId)
}

/** Lịch sử vị trí của chuyến, cũ trước. */
// GET /api/trips/{id}/location/history
export function getLocationHistory(tripId: string): Promise<LocationPoint[]> {
  return getMockDb().getLocationHistory(tripId)
}

/** Vị trí mới nhất, ETA trực tiếp từng điểm chưa hoàn tất, cảnh báo nguy cơ trễ và sự cố của một chuyến. */
// GET /api/trips/{id}/monitoring
export async function getTripMonitoring(tripId: string): Promise<TripMonitoring> {
  const monitoring = await getMockDb().getTripMonitoring(tripId)
  publish(monitoring)
  return monitoring
}

/** Giám sát mọi chuyến Đang vận chuyển của công ty — màn đang mở gọi lại theo `refreshMs` thay cho kênh đẩy của backend. */
// chưa có ở BE (Q-08)
export async function listTripMonitoring(): Promise<TripMonitoring[]> {
  const fleet = await getMockDb().listTripMonitoring()
  publishFleet(fleet)
  return fleet
}

/**
 * Nghe sự kiện giám sát của một chuyến (vị trí mới, ETA mới, cảnh báo nguy cơ trễ, sự cố, chuyến kết thúc); trả hàm thôi nghe. Chưa
 * có backend: sự kiện trong bộ nhớ, phát sau mỗi lần đọc giám sát ở trên trả về điều gì mới.
 */
// WebSocket /ws/trips/{tripId}/monitoring (Q-08)
export function subscribeTrip(tripId: string, onEvent: (event: TripMonitoringEvent) => void): () => void {
  return subscribe(tripId, onEvent)
}

/**
 * Điều phối viên đổi thứ tự các điểm chưa giao khi xe đang chạy (FE-BL-03, D-87). Kho kiểm lại khả năng dỡ của phương án như đã xếp; không đạt
 * thì từ chối `STOP_ORDER_BLOCKS_CARGO` kèm kiện bị chắn và không đổi gì. Đạt thì áp dụng: giờ đến, mức hạn tính lại, xe đi tiếp từ chỗ
 * đang đứng tới điểm kế tiếp mới, tài xế nhận thông báo.
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
