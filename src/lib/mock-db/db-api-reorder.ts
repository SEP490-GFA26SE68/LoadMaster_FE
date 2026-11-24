import type { Trip } from './types'

/** Kiện bị che một phần lối dỡ theo thứ tự mới: chỉ là cảnh báo, thứ tự vẫn áp dụng. `packageId` là mã instance (kiện của phương án). */
export type StopReorderWarning = { packageId: string; stopId: string }

export type StopReorder = { trip: Trip; partial: StopReorderWarning[] }

/**
 * Phần kho của việc đổi thứ tự điểm giao khi xe đang chạy (FE-BL-03, D-87). Cùng quy ước với `MockDb`: bất đồng bộ, trả bản sao, từ chối
 * bằng `MockDbError`, lọc theo công ty của phiên (D-64).
 */
export type ReorderDb = {
  /**
   * Điều phối viên đổi thứ tự các điểm chưa giao của chuyến Đang vận chuyển — **ngoại lệ duy nhất** của `TRIP_LOCKED` khi chuyến đã rời
   * kho, và chỉ ở hàm này. `orderedStopIds` là hoán vị của mọi mã điểm của chuyến, **khác** thứ tự hiện tại; các
   * điểm đầu danh sách đã hoàn tất hoặc xe đã tới phải đứng nguyên chỗ. Kho kiểm lại
   * khả năng dỡ của phương án như đã xếp (LIFO của domain): theo thứ tự mới
   * có kiện còn trên xe bị che kín mà trước đó chưa bị là từ chối — không đổi gì. Che một phần chỉ trả ở `partial`. Đạt thì áp dụng:
   * số điểm, tiến độ, sự cố, dòng kiện… theo điểm sang số mới, `routePlan` tính lại (giờ đến, mức hạn), xe mô phỏng đi tiếp từ chỗ nó
   * đang đứng tới điểm kế tiếp mới, nhật ký `trip.stopsReordered` và chuông của tài xế. Phương án đã duyệt không đổi, không lỗi thời.
   *
   * Lỗi: vai trò khác điều phối viên `ROLE_NOT_ALLOWED`; chuyến không Đang vận chuyển `TRIP_NOT_IN_TRANSIT` (như máy chủ); điểm chưa có toạ độ
   * `MISSING_STOP_COORDINATES`; `STOP_ORDER_INVALID`, `STOP_NOT_MOVABLE`; `STOP_ORDER_BLOCKS_CARGO`.
   */
  reorderRunningStops(tripId: string, orderedStopIds: string[]): Promise<StopReorder>
}
