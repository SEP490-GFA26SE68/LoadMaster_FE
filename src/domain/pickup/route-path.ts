import { EARTH_RADIUS_KM, type GeoPoint } from '@/domain/routing'
import type { PickupRouteStop } from './types'

const KM_PER_DEGREE = (EARTH_RADIUS_KM * Math.PI) / 180

/** Đoạn ngắn hơn chừng này (km) coi là một điểm: hai đỉnh trùng nhau (xe đang đứng ở điểm hiện tại) không có hướng để chiếu lên. */
const DEGENERATE_KM = 1e-9

/** Điểm hiện tại: điểm đầu tiên chưa hoàn tất (điểm xe đang tới hoặc đang đứng). `-1` khi không còn điểm nào. */
export function currentStopIndex(stops: readonly Pick<PickupRouteStop, 'completed'>[]): number {
  return stops.findIndex((stop) => !stop.completed)
}

/** Điểm được bảo vệ: điểm đầu tiên **sau** điểm hiện tại còn kiện trên xe. `-1` khi không có (không điểm nào chặn điểm giao). */
export function protectedStopIndex(stops: readonly Pick<PickupRouteStop, 'onboardCount'>[], currentIndex: number): number {
  return stops.findIndex((stop, index) => index > currentIndex && stop.onboardCount > 0)
}

export type PathLocation = {
  /** Khoảng cách từ điểm tới đường gấp khúc, km. */
  distanceKm: number
  /**
   * Quãng đường dọc đường gấp khúc từ đỉnh đầu tới chân đường vuông góc của điểm, km. Hai đoạn đầu cuối được kéo dài: điểm nằm trước
   * đỉnh đầu có tiến độ âm, điểm nằm sau đỉnh cuối có tiến độ lớn hơn chiều dài đường.
   */
  progressKm: number
  /** Tiến độ của từng đỉnh trong cùng phép chiếu — so với `progressKm` mà không lệch giữa hai phép chiếu khác nhau. */
  vertexKm: number[]
}

/**
 * Vị trí của `point` so với đường gấp khúc `path` (khoảng cách, tiến độ dọc đường). Chiếu phẳng quanh `point` (độ dài kinh độ nhân
 * cos vĩ độ): sai số không đáng kể ở cỡ vài chục km của một tuyến nội vùng. `path` có ít nhất một đỉnh.
 */
export function locateOnPath(path: readonly GeoPoint[], point: GeoPoint): PathLocation {
  const cosLat = Math.cos((point.lat * Math.PI) / 180)
  const plane = path.map((vertex) => ({ x: (vertex.lng - point.lng) * cosLat * KM_PER_DEGREE, y: (vertex.lat - point.lat) * KM_PER_DEGREE }))
  const segments = plane.slice(1).map((end, index) => {
    const start = plane[index] as (typeof plane)[number]
    const dx = end.x - start.x
    const dy = end.y - start.y
    return { start, dx, dy, lengthKm: Math.hypot(dx, dy) }
  })
  const vertexKm = segments.reduce<number[]>((sum, segment) => [...sum, (sum.at(-1) ?? 0) + segment.lengthKm], [0])
  const usable = segments.flatMap((segment, index) => (segment.lengthKm > DEGENERATE_KM ? [index] : []))
  const first = usable[0]
  const last = usable.at(-1)

  let best: { distanceKm: number; progressKm: number } | undefined
  for (const index of usable) {
    const { start, dx, dy, lengthKm } = segments[index] as (typeof segments)[number]
    // Điểm là gốc toạ độ: t là vị trí chân đường vuông góc trên đoạn, 0 ở đỉnh đầu, 1 ở đỉnh cuối
    const t = (-start.x * dx - start.y * dy) / lengthKm ** 2
    const clamped = Math.min(1, Math.max(0, t))
    const distanceKm = Math.hypot(start.x + clamped * dx, start.y + clamped * dy)
    const along = index === first && index === last ? t : index === first ? Math.min(t, 1) : index === last ? Math.max(t, 0) : clamped
    if (best === undefined || distanceKm < best.distanceKm) best = { distanceKm, progressKm: (vertexKm[index] as number) + along * lengthKm }
  }
  const origin = plane[0] as (typeof plane)[number]
  return { ...(best ?? { distanceKm: Math.hypot(origin.x, origin.y), progressKm: 0 }), vertexKm }
}
