import { matchesQuery, startsWithQuery } from '@/lib/list-filter'
import type { Place } from '@/lib/mock-db'

/** Số địa danh tối đa của một lần tìm: danh sách dưới ô tìm không cuộn. */
export const PLACE_SEARCH_LIMIT = 8

/**
 * Tìm địa danh (FE-4b-03): bỏ dấu, không kể hoa thường, mọi từ của từ khoá phải có trong tên hoặc vùng. Địa danh có **tên bắt đầu
 * bằng** từ khoá đứng trước; trong mỗi nhóm giữ thứ tự của danh sách (tỉnh, quận, khu công nghiệp). Từ khoá rỗng không trả gì — người
 * dùng phải gõ mới có gợi ý.
 */
export function searchPlaces(places: readonly Place[], query: string, limit = PLACE_SEARCH_LIMIT): Place[] {
  if (query.trim() === '') return []
  const matched = places.filter((place) => matchesQuery([place.name, place.region], query))
  const leading = matched.filter((place) => startsWithQuery(place.name, query))
  return [...leading, ...matched.filter((place) => !leading.includes(place))].slice(0, limit)
}

/** Địa chỉ điền sẵn khi chọn một địa danh: tên rồi vùng. */
export function placeAddress(place: Pick<Place, 'name' | 'region'>): string {
  return `${place.name}, ${place.region}`
}
