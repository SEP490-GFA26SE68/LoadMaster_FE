import { parseTime, roadKm, ROUTING_CONSTANTS, travelMs } from './eta'
import type { GeoPoint } from './haversine'

/**
 * Mock "tìm tuyến khác" khi có sự cố cấp chuyến (FE-6-11, D-87) — hàm thuần, kết quả là **mock**: các lựa chọn chỉ khác nhau ở con số,
 * đường vẽ vẫn nối thẳng. Mỗi lựa chọn là một đường vòng từ vị trí xe tới **điểm kế tiếp**: dài hơn đường nối thẳng theo
 * `distancePercent`, chạy với `speedKmh`. Thứ tự điểm giao không đổi — xe đang chạy chỉ đổi đường.
 * **Đề xuất FE — chờ nghiệp vụ xác nhận**, như `ROUTING_CONSTANTS`.
 */
export const REROUTE_ROUTES = ['BYPASS', 'RING_ROAD', 'HIGHWAY'] as const
export type RerouteRoute = (typeof REROUTE_ROUTES)[number]

export const REROUTE_CONSTANTS = {
  /** Đường tránh gần: dài hơn 15 %, cùng tốc độ trung bình. */
  BYPASS: { distancePercent: 115, speedKmh: ROUTING_CONSTANTS.AVERAGE_SPEED_KMH },
  /** Đường vành đai: dài hơn 30 %, cùng tốc độ trung bình. */
  RING_ROAD: { distancePercent: 130, speedKmh: ROUTING_CONSTANTS.AVERAGE_SPEED_KMH },
  /** Cao tốc: dài hơn 50 % nhưng chạy 70 km/h; chỉ có khi chặng còn lại đủ dài. */
  HIGHWAY: { distancePercent: 150, speedKmh: 70 },
  /** Chặng còn lại (quãng đường ước lượng) từ chừng này km mới có lựa chọn cao tốc. */
  HIGHWAY_MIN_KM: 15,
} as const

export type RerouteOption = {
  readonly route: RerouteRoute
  /** Quãng đường tới điểm kế tiếp theo tuyến này, làm tròn 0,1 km. */
  readonly distanceKm: number
  /** Thời gian chạy tới điểm kế tiếp, phút nguyên. */
  readonly durationMinutes: number
  /** Chậm hơn đường nối thẳng chừng này ms (số nguyên) — xe mô phỏng đứng thêm đúng khoảng đó rồi đi đường nối thẳng. */
  readonly extraMs: number
  /** Giờ đến điểm kế tiếp nếu đi tuyến này từ lúc `at`, ISO 8601. */
  readonly eta: string
}

/** Hai hoặc ba tuyến thay thế từ `position` tới `target` lúc `at`, theo thứ tự của `REROUTE_ROUTES`. */
export function rerouteOptions(position: GeoPoint, target: GeoPoint, at: string): RerouteOption[] {
  const atMs = parseTime(at)
  const directKm = roadKm(position, target)
  const directMs = travelMs(position, target)
  return REROUTE_ROUTES.filter((route) => route !== 'HIGHWAY' || directKm >= REROUTE_CONSTANTS.HIGHWAY_MIN_KM).map((route) => {
    const { distancePercent, speedKmh } = REROUTE_CONSTANTS[route]
    const durationMs = Math.round((directMs * distancePercent * ROUTING_CONSTANTS.AVERAGE_SPEED_KMH) / (100 * speedKmh))
    return {
      route,
      distanceKm: Math.round(directKm * distancePercent / 10) / 10,
      durationMinutes: Math.round(durationMs / 60_000),
      extraMs: durationMs - directMs,
      eta: new Date(atMs + durationMs).toISOString(),
    }
  })
}
