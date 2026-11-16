/**
 * Hàm → endpoint backend (RoutePlan / RouteLeg của chuyến):
 *   getActiveRoutePlan → GET /api/trips/{id}/route-plans/active
 *
 * Chỉ chuyến **của máy chủ** đọc tuyến ở máy chủ (`onServer`; nơi gọi biết chuyến của nó đến từ đâu): chuyến của kho mẫu không bao giờ
 * gửi mã hay toạ độ đi đâu. Không có tuyến đã lưu thì đường vẽ là các đoạn nối thẳng kho → điểm giao, như kho mẫu — app không gọi dịch
 * vụ chỉ đường công khai nào (toạ độ của khách chỉ đi tới máy chủ của mình, qua `api-client`).
 */
import { encodePolyline, pathFromEncodedPolylines } from '@/components/map/polyline'
import type { GeoPoint } from '@/domain/routing'
import { api, ApiError } from '@/lib/api-client'

export type RouteGuidanceStepDto = {
  readonly instruction?: string | null
  readonly maneuver?: string | null
  readonly distanceMeters?: number | null
  readonly durationSeconds?: number | null
  readonly lat?: number | null
  readonly lng?: number | null
}

export type RouteLegDto = {
  readonly id: number
  readonly routePlanId?: number
  readonly legSequence: number
  readonly startStopId?: number | null
  readonly endStopId: number
  readonly distanceMeters: number
  readonly durationSeconds: number
  readonly polyline?: string | null
  readonly steps?: readonly RouteGuidanceStepDto[] | null
}

export type RoutePlanDetailDto = {
  readonly id: number
  readonly tripId: number
  readonly planVersion: number
  readonly totalDistanceMeters?: number | null
  readonly totalDurationSeconds?: number | null
  readonly isActive: boolean
  readonly legs: readonly RouteLegDto[]
}

/**
 * Tuyến đang dùng của chuyến máy chủ (máy chủ nhận mã số hoặc mã chuyến). `null` khi chuyến không phải của máy chủ hoặc chưa có tuyến
 * (`ROUTE_PLAN_NOT_FOUND`); lỗi khác để lộ ra cho màn.
 */
// GET /api/trips/{id}/route-plans/active
export async function getActiveRoutePlan(tripId: string, onServer: boolean): Promise<RoutePlanDetailDto | null> {
  if (!onServer) return null
  try {
    return await api().get<RoutePlanDetailDto>(`/api/trips/${encodeURIComponent(tripId)}/route-plans/active`)
  } catch (error) {
    if (error instanceof ApiError && error.code === 'ROUTE_PLAN_NOT_FOUND') return null
    throw error
  }
}

/** Đường vẽ bản đồ từ các chặng của tuyến (polyline của máy chủ). */
export function pathFromRoutePlan(plan: RoutePlanDetailDto | null | undefined): GeoPoint[] | undefined {
  if (!plan?.legs?.length) return undefined
  const ordered = [...plan.legs].sort((a, b) => a.legSequence - b.legSequence)
  const path = pathFromEncodedPolylines(ordered.map((leg) => leg.polyline))
  return path.length > 1 ? path : undefined
}

/**
 * Đường cho `RouteMap`: tuyến đã lưu ở máy chủ khi chuyến là của máy chủ và có tuyến; không thì các đoạn nối thẳng kho → điểm giao
 * theo thứ tự (`fallback`). Dưới hai điểm thì không có đường.
 */
export async function getTripRoutePath(
  tripId: string,
  fallback: { depot?: GeoPoint; stops: readonly GeoPoint[] },
  onServer: boolean,
): Promise<GeoPoint[] | undefined> {
  const fromPlan = pathFromRoutePlan(await getActiveRoutePlan(tripId, onServer))
  if (fromPlan) return fromPlan
  return straightPath(fallback.depot ? [fallback.depot, ...fallback.stops] : [...fallback.stops])
}

function straightPath(points: readonly GeoPoint[]): GeoPoint[] | undefined {
  if (points.length < 2) return undefined
  const legs = points.slice(0, -1).map((from, index) => encodePolyline([from, points[index + 1]!]))
  const path = pathFromEncodedPolylines(legs)
  return path.length > 1 ? path : undefined
}
