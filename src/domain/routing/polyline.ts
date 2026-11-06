import type { GeoPoint } from './haversine'

/**
 * Giải mã Google / Goong encoded polyline (precision 5) thành dãy toạ độ WGS84.
 * @see https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodePolyline(encoded: string): GeoPoint[] {
  if (!encoded) return []
  const points: GeoPoint[] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let shift = 0
    let result = 0
    let byte: number
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1

    shift = 0
    result = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1

    points.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }
  return points
}

/** Mã hoá dãy điểm thành encoded polyline (precision 5) — dùng cho mock / test. */
export function encodePolyline(points: readonly GeoPoint[]): string {
  let lastLat = 0
  let lastLng = 0
  let result = ''

  for (const point of points) {
    const lat = Math.round(point.lat * 1e5)
    const lng = Math.round(point.lng * 1e5)
    result += encodeSigned(lat - lastLat)
    result += encodeSigned(lng - lastLng)
    lastLat = lat
    lastLng = lng
  }
  return result
}

function encodeSigned(value: number): string {
  let rem = value < 0 ? ~(value << 1) : value << 1
  let out = ''
  while (rem >= 0x20) {
    out += String.fromCharCode((0x20 | (rem & 0x1f)) + 63)
    rem >>= 5
  }
  out += String.fromCharCode(rem + 63)
  return out
}

/**
 * Ghép nhiều encoded polyline (từng RouteLeg) thành một `path` liên tục.
 * Bỏ điểm trùng với điểm cuối của đoạn trước để không gãy nét.
 */
export function pathFromEncodedPolylines(polylines: readonly (string | null | undefined)[]): GeoPoint[] {
  const path: GeoPoint[] = []
  for (const encoded of polylines) {
    if (!encoded) continue
    const segment = decodePolyline(encoded)
    if (segment.length === 0) continue
    if (path.length === 0) {
      path.push(...segment)
      continue
    }
    const last = path[path.length - 1]
    const first = segment[0]
    const same =
      last !== undefined
      && first !== undefined
      && Math.abs(last.lat - first.lat) < 1e-6
      && Math.abs(last.lng - first.lng) < 1e-6
    path.push(...(same ? segment.slice(1) : segment))
  }
  return path
}
