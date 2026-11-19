import type { GeoPoint, RouteInput } from '@/domain/routing'
import { SEED_PLACES } from '@/lib/mock-db/seed-places'

/**
 * Tuyến mẫu của phần "Một chuyến, bốn màn" (`#vai-tro`): kho và bốn điểm giao lấy toạ độ từ địa danh mẫu của kho (`seed-places.ts`,
 * toạ độ gần đúng ở mức khu vực), giờ xuất phát và hạn giao cố định — nên giờ đến, mức hạn và giờ nghỉ bắt buộc do `@/domain/routing`
 * tính ra luôn như nhau. Tên địa danh chỉ dùng để tra toạ độ, **không** lọt vào DOM: điểm giao mang tên của chuyến mẫu
 * (`landing.sample.stop1` … `stop4`), vì bản tiếng Anh không được có chữ có dấu. Chặng đầu dài hơn bốn giờ lái nên tuyến có một lần nghỉ
 * bắt buộc; hạn của điểm 2 sát giờ đến và hạn của điểm 4 sớm hơn giờ đến, để ba mức hạn cùng có mặt.
 */
function place(name: string): GeoPoint {
  const found = SEED_PLACES.find((item) => item.name === name)
  if (!found) throw new Error(`Thiếu địa danh mẫu: ${name}`)
  return { lat: found.lat, lng: found.lng }
}

/** Thứ tự đi cố định — không chạy bộ sắp thứ tự, chỉ tính giờ đến trên thứ tự này. */
export const ROLES_STOP_ORDER = ['S1', 'S2', 'S3', 'S4'] as const

export const ROLES_ROUTE: RouteInput = {
  depot: place('KCN Biên Hoà 2'),
  departureTime: '2026-09-14T05:00:00+07:00',
  stops: [
    { stopId: 'S1', location: place('KCN Trà Nóc'), deadline: '2026-09-14T10:30:00+07:00' },
    { stopId: 'S2', location: place('An Giang'), deadline: '2026-09-14T11:00:00+07:00' },
    { stopId: 'S3', location: place('Kiên Giang'), deadline: '2026-09-14T13:30:00+07:00' },
    { stopId: 'S4', location: place('Cà Mau'), deadline: '2026-09-14T15:00:00+07:00' },
  ],
}

/** Lúc màn Giám sát của hình được "chụp": xe đang trên chặng đầu, chưa điểm nào giao. */
export const ROLES_VIEW_AT = '2026-09-14T07:30:00+07:00'

/** Lúc màn kho của hình được "chụp": kho xếp ngược thứ tự giao, đã xong hàng của chừng này điểm giao cuối tuyến. */
export const ROLES_LOADED_STOPS = 2
