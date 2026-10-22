
import type { GeoPoint } from '@/domain/routing'

/**
 * Giải mã Google Encoded Polyline (precision 5),
 * cũng là định dạng polyline Goong Directions sử dụng.
 */
export function decodeGoongPolyline(
  encoded: string,
): GeoPoint[] {
  const points: GeoPoint[] = []

  let index = 0
  let lat = 0
  let lng = 0

  function readValue(): number {
    let result = 0
    let shift = 0

    while (index < encoded.length) {
      const byte = encoded.charCodeAt(index++) - 63

      if (byte < 0 || byte > 63) {
        throw new Error('Invalid polyline character')
      }

      result += (byte & 0x1f) * 2 ** shift

      if (byte < 0x20) {
        return result & 1
          ? -(Math.floor(result / 2) + 1)
          : Math.floor(result / 2)
      }

      shift += 5

      if (shift > 35) {
        throw new Error('Invalid polyline encoding')
      }
    }

    throw new Error('Incomplete polyline encoding')
  }

  while (index < encoded.length) {
    lat += readValue()
    lng += readValue()

    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    })
  }

  return points
}
