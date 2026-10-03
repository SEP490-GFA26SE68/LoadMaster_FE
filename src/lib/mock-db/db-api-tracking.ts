import type { DriverLocationInput, LocationPoint, TripMonitoring } from './tracking-model'

/**
 * Phần kho của vị trí xe và ETA trực tiếp (FE-6-08, FE-6-09). Cùng quy ước với `MockDb`: bất đồng bộ, trả bản sao, từ chối bằng
 * `MockDbError`, lọc theo công ty của phiên (D-64). Vị trí và ETA chỉ nằm trong kho của tab đang mở (D-95).
 */
export type TrackingDb = {
  /**
   * Điện thoại tài xế gửi vị trí GPS thật của chuyến đang vận chuyển (FE-6-13): kho ghi điểm vị trí nguồn `GPS` theo đồng hồ của mình
   * rồi tính lại ETA từ đó. Trong lúc còn nhận GPS thật xe mô phỏng không ghi điểm nào; ngừng gửi quá ba nhịp (90 giây) thì xe mô phỏng
   * ghi tiếp. Chuyến không ở pha đang giao: `TRIP_PHASE_INVALID`; toạ độ, tốc độ hoặc hướng sai: `LOCATION_INVALID`.
   */
  postDriverLocation(tripId: string, input: DriverLocationInput): Promise<LocationPoint>
  /** Vị trí mới nhất của xe; `null` khi xe chưa xuất phát, hoặc tuyến còn điểm chưa có toạ độ và chưa có điểm GPS nào. */
  getLatestLocation(tripId: string): Promise<LocationPoint | null>
  /** Lịch sử vị trí của chuyến, cũ trước, tối đa 2.000 điểm gần nhất. Chuyến đã giao xong giữ lịch sử tới lúc hoàn thành. */
  getLocationHistory(tripId: string): Promise<LocationPoint[]>
  /** Vị trí mới nhất, ETA trực tiếp của các điểm chưa hoàn tất và cảnh báo nguy cơ trễ của một chuyến. */
  getTripMonitoring(tripId: string): Promise<TripMonitoring>
  /** Như `getTripMonitoring`, cho mọi chuyến Đang vận chuyển của công ty, theo thứ tự tạo chuyến. */
  listTripMonitoring(): Promise<TripMonitoring[]>
}
