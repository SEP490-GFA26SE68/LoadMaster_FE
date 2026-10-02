/** Toạ độ địa lý WGS84, độ thập phân. */
export type GeoPoint = { readonly lat: number; readonly lng: number }

/** Bán kính trung bình của Trái Đất (IUGG), km. */
export const EARTH_RADIUS_KM = 6371

const toRadians = (degrees: number) => (degrees * Math.PI) / 180

/** Khoảng cách đường chim bay giữa hai điểm trên mặt cầu (công thức haversine), km. Không làm tròn. */
export function haversineKm(from: GeoPoint, to: GeoPoint): number {
  const dLat = toRadians(to.lat - from.lat)
  const dLng = toRadians(to.lng - from.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}
