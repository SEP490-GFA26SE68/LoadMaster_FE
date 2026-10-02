/**
 * Toạ độ gõ tay ở ô chọn toạ độ (FE-4b-03): hai ô chữ vĩ độ / kinh độ → số hợp lệ, hoặc **mã** lỗi kèm ô sai (component dịch). WGS84,
 * độ thập phân; nhận dấu chấm lẫn dấu phẩy thập phân vì giao diện tiếng Việt viết "10,9294".
 */

export type Coordinates = { readonly lat: number; readonly lng: number }

export type CoordinateError = 'incomplete' | 'invalid'

export type ParsedCoordinates =
  | { readonly kind: 'empty' }
  | ({ readonly kind: 'ok' } & Coordinates)
  | { readonly kind: 'error'; readonly field: 'lat' | 'lng'; readonly code: CoordinateError }

/** Số thập phân thường: dấu âm, phần nguyên, phần lẻ tuỳ chọn — không nhận `1e1`, `Infinity`. */
const DECIMAL = /^-?\d+([.,]\d+)?$/

function toNumber(text: string, limit: number): number | null {
  if (!DECIMAL.test(text)) return null
  const value = Number(text.replace(',', '.'))
  return Number.isFinite(value) && Math.abs(value) <= limit ? value : null
}

/**
 * Cả hai ô trống là chưa chọn toạ độ. Chỉ một ô có chữ: `incomplete` ở ô còn trống. Chữ không phải số, hoặc ngoài khoảng (vĩ độ ±90,
 * kinh độ ±180): `invalid` ở ô đó — vĩ độ xét trước.
 */
export function parseCoordinates(latText: string, lngText: string): ParsedCoordinates {
  const lat = latText.trim()
  const lng = lngText.trim()
  if (lat === '' && lng === '') return { kind: 'empty' }
  if (lat === '') return { kind: 'error', field: 'lat', code: 'incomplete' }
  if (lng === '') return { kind: 'error', field: 'lng', code: 'incomplete' }
  const latitude = toNumber(lat, 90)
  if (latitude === null) return { kind: 'error', field: 'lat', code: 'invalid' }
  const longitude = toNumber(lng, 180)
  if (longitude === null) return { kind: 'error', field: 'lng', code: 'invalid' }
  return { kind: 'ok', lat: latitude, lng: longitude }
}

/** Chữ của một toạ độ đưa vào ô: tối đa năm chữ số lẻ (khoảng 1 m), bỏ số 0 thừa. Luôn dấu chấm — đây là mã, không phải số đo. */
export function formatCoordinate(value: number): string {
  return String(Number(value.toFixed(5)))
}

/** Giá trị của ô chọn toạ độ: chữ đang gõ ở hai ô; cả hai rỗng là chưa chọn. Đổi thành số bằng `parseCoordinates`. */
export type CoordinateText = { lat: string; lng: string }

export const EMPTY_COORDINATES: CoordinateText = { lat: '', lng: '' }

/** Chữ của hai ô từ toạ độ đã lưu; vắng một trong hai là chưa chọn. */
export function coordinateText(lat: number | undefined, lng: number | undefined): CoordinateText {
  return lat === undefined || lng === undefined ? EMPTY_COORDINATES : { lat: formatCoordinate(lat), lng: formatCoordinate(lng) }
}
