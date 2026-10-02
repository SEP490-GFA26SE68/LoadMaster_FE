/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   searchAddress → chưa có ở BE (Q-20: đề nghị endpoint tìm địa chỉ, Goong Geocoding gọi ở server — S4b-04)
 */
import { SEED_PLACES, type Place } from '@/lib/mock-db'
import { searchPlaces } from './place-search'

/**
 * Tìm địa chỉ cho ô chọn toạ độ (FE-4b-03). Chưa có backend: tìm trong danh sách địa danh mẫu của seed. Khi có backend, thân hàm gọi
 * endpoint tìm địa chỉ của **backend** (Q-20) — trình duyệt không bao giờ gọi Goong trực tiếp: khoá REST của Goong chỉ nằm ở server.
 */
// chưa có ở BE (Q-20)
export async function searchAddress(query: string): Promise<Place[]> {
  return searchPlaces(SEED_PLACES, query)
}
