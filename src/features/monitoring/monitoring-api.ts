/**
 * Hàm → endpoint backend (FE-0-09, issue BE S6-04 → S6-06); nối backend chỉ thay thân hàm.
 *   postDriverLocation → POST /api/driver/location
 *   getLatestLocation  → GET /api/trips/{id}/location/latest
 *   getLocationHistory → GET /api/trips/{id}/location/history
 *   getTripMonitoring  → GET /api/trips/{id}/monitoring
 *   chưa có ở BE: listTripMonitoring (kênh cập nhật của BE là WebSocket, Q-08)
 */
import { getMockDb, type DriverLocationInput, type LocationPoint, type TripMonitoring } from '@/lib/mock-db'

/**
 * Lớp gọi API của giám sát (FE-6-08, FE-6-09): vị trí xe và ETA trực tiếp của chuyến Đang vận chuyển. Chưa có backend: vị trí là xe
 * mô phỏng của kho (nguồn `SIMULATED`), ETA là kết quả mock — và chỉ nằm trong kho của tab đang mở.
 */

/** Điện thoại tài xế gửi vị trí GPS thật của chuyến đang chạy. */
// POST /api/driver/location
export function postDriverLocation(tripId: string, location: DriverLocationInput): Promise<LocationPoint> {
  return getMockDb().postDriverLocation(tripId, location)
}

/** Vị trí mới nhất của xe; `null` khi xe chưa xuất phát hoặc chưa có vị trí. */
// GET /api/trips/{id}/location/latest
export function getLatestLocation(tripId: string): Promise<LocationPoint | null> {
  return getMockDb().getLatestLocation(tripId)
}

/** Lịch sử vị trí của chuyến, cũ trước. */
// GET /api/trips/{id}/location/history
export function getLocationHistory(tripId: string): Promise<LocationPoint[]> {
  return getMockDb().getLocationHistory(tripId)
}

/** Vị trí mới nhất, ETA trực tiếp từng điểm chưa hoàn tất và cảnh báo nguy cơ trễ của một chuyến. */
// GET /api/trips/{id}/monitoring
export function getTripMonitoring(tripId: string): Promise<TripMonitoring> {
  return getMockDb().getTripMonitoring(tripId)
}

/** Giám sát mọi chuyến Đang vận chuyển của công ty — màn đang mở gọi lại theo `refreshMs` thay cho kênh đẩy của backend. */
// chưa có ở BE (Q-08)
export function listTripMonitoring(): Promise<TripMonitoring[]> {
  return getMockDb().listTripMonitoring()
}
