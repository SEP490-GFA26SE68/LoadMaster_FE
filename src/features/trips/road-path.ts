import type { GeoPoint } from '@/domain/routing'

type OsrmRouteResponse = {
  readonly code?: string
  readonly routes?: readonly {
    readonly geometry?: {
      readonly coordinates?: readonly (readonly [number, number])[]
    }
  }[]
}

/**
 * Path theo đường đi (OSRM demo) cho mock / khi chưa có polyline Goong từ BE.
 * Chỉ dùng để xem map nhanh — production nên lấy `RouteLeg.polyline` từ BE.
 */
export async function fetchRoadPath(points: readonly GeoPoint[]): Promise<GeoPoint[] | undefined> {
  if (points.length < 2) return undefined
  const coords = points.map((point) => `${point.lng},${point.lat}`).join(';')
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
  try {
    const response = await fetch(url)
    if (!response.ok) return undefined
    const body = (await response.json()) as OsrmRouteResponse
    if (body.code !== 'Ok') return undefined
    const coordinates = body.routes?.[0]?.geometry?.coordinates
    if (!coordinates || coordinates.length < 2) return undefined
    return coordinates.map(([lng, lat]) => ({ lat, lng }))
  } catch {
    return undefined
  }
}
