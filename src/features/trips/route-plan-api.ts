/**
 * Hàm → endpoint backend (canonical RoutePlan / RouteLeg).
 *   getActiveRoutePlan → GET /api/trips/{id}/route-plans/active
 *
 * Bật BE thật: `VITE_USE_REAL_MONITORING=true` (cùng cờ giám sát — route plan nằm trên cùng service).
 * Mock / id kiểu TRIP-012: lấy path theo đường chạy qua OSRM demo; lỗi mạng thì nối thẳng điểm.
 */
import { encodePolyline, pathFromEncodedPolylines } from '@/components/map/polyline'
import type { GeoPoint } from '@/domain/routing'
import { api } from '@/lib/api-client'
import { getMockDb } from '@/lib/mock-db'
import { fetchRoadPath } from './road-path'

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

function useRealRoutes(): boolean {
  return import.meta.env.VITE_USE_REAL_MONITORING === 'true'
}

/** BE nhận id số hoặc tripCode (TripLookupHelper). */

/** Plan active của chuyến; `null` khi chưa có (chưa optimize / 404) hoặc id mock. */
export async function getActiveRoutePlan(tripId: string): Promise<RoutePlanDetailDto | null> {
  if (!useRealRoutes()) return null
  try {
    return await api().get<RoutePlanDetailDto>(`/api/trips/${encodeURIComponent(tripId)}/route-plans/active`)
  } catch {
    return null
  }
}

/** Path vẽ map từ legs của plan (polyline Goong). */
export function pathFromRoutePlan(plan: RoutePlanDetailDto | null | undefined): GeoPoint[] | undefined {
  if (!plan?.legs?.length) return undefined
  const ordered = [...plan.legs].sort((a, b) => a.legSequence - b.legSequence)
  const path = pathFromEncodedPolylines(ordered.map((leg) => leg.polyline))
  return path.length > 1 ? path : undefined
}

/**
 * Path cho `RouteMap`: ưu tiên plan BE (Goong polyline);
 * không có thì OSRM theo kho → stops; cuối cùng mới nối thẳng.
 */
export async function getTripRoutePath(
  tripId: string,
  fallback?: { depot?: GeoPoint; stops: readonly GeoPoint[] },
): Promise<GeoPoint[] | undefined> {
  const fromPlan = pathFromRoutePlan(await getActiveRoutePlan(tripId))
  if (fromPlan) return fromPlan

  const points = await resolveWaypoints(tripId, fallback)
  if (!points || points.length < 2) return undefined

  const alongRoads = await fetchRoadPath(points)
  if (alongRoads && alongRoads.length > 1) return alongRoads

  return straightPath(points)
}

async function resolveWaypoints(
  tripId: string,
  fallback?: { depot?: GeoPoint; stops: readonly GeoPoint[] },
): Promise<GeoPoint[] | undefined> {
  if (fallback) {
    const points = fallback.depot ? [fallback.depot, ...fallback.stops] : [...fallback.stops]
    return points.length >= 2 ? points : undefined
  }
  try {
    const trip = await getMockDb().getTrip(tripId)
    const depot = { lat: trip.depot.lat, lng: trip.depot.lng }
    const stops = trip.stops.flatMap((stop) =>
      stop.lat === undefined || stop.lng === undefined ? [] : [{ lat: stop.lat, lng: stop.lng }],
    )
    const points = [depot, ...stops]
    return points.length >= 2 ? points : undefined
  } catch {
    return undefined
  }
}

function straightPath(points: readonly GeoPoint[]): GeoPoint[] | undefined {
  if (points.length < 2) return undefined
  const legs = points.slice(0, -1).map((from, index) => encodePolyline([from, points[index + 1]!]))
  const path = pathFromEncodedPolylines(legs)
  return path.length > 1 ? path : undefined
}
