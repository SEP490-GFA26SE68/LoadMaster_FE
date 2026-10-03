/**
 * Hàm → endpoint backend (FE-0-09, issue BE S4b-06, S4b-07); nối backend chỉ thay thân hàm.
 *   optimizeTripRoute → POST /api/trips/{id}/optimize-route
 *   getTripEta        → GET /api/trips/{id}/eta
 */
import { getMockDb, type Trip, type TripEta } from '@/lib/mock-db'

/**
 * Tối ưu tuyến của chuyến (FE-4b-09, D-76). Chưa có backend: kho chạy mock `@/domain/routing` — kết quả là MOCK RESULT, không tốn
 * credit. Thứ tự điểm giao của chuyến đổi theo kết quả; giờ đến dự kiến và mức hạn đọc qua `getTripEta`.
 */

/** Xếp thứ tự điểm giao, tính giờ đến dự kiến và mức hạn; chuyến Nháp thành Đã lập kế hoạch. Thiếu toạ độ: `MISSING_STOP_COORDINATES`. */
// POST /api/trips/{id}/optimize-route
export function optimizeTripRoute(tripId: string): Promise<Trip> {
  return getMockDb().optimizeTripRoute(tripId)
}

/** Giờ đến dự kiến, hạn và mức hạn của từng điểm theo thứ tự đi; `null` khi chuyến chưa tối ưu tuyến. */
// GET /api/trips/{id}/eta
export function getTripEta(tripId: string): Promise<TripEta | null> {
  return getMockDb().getTripEta(tripId)
}
