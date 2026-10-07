import type { PickupRequest, PickupRequestInput, PickupStatus, PickupStatusDetails } from './pickup-model'

/**
 * Phần kho của yêu cầu nhận hàng dọc đường (FE-7-01, D-88). Cùng quy ước với `MockDb`: bất đồng bộ, trả bản sao, từ chối bằng
 * `MockDbError`, lọc theo công ty của phiên (D-64) — qua chuyến, như các endpoint `/api/trips/{id}/pickup-requests` của backend.
 * Kho chưa kiểm luật, chưa tạo kiện hay điểm giao khi duyệt (FE-7-03, FE-7-04) và chưa xét vai trò.
 */
export type PickupsDb = {
  /** Yêu cầu của một chuyến, cũ trước. Chuyến của công ty khác: `NOT_FOUND`. */
  listPickupRequests(tripId: string): Promise<PickupRequest[]>
  /** Không có yêu cầu đó trong chuyến, hoặc chuyến của công ty khác: `NOT_FOUND`. */
  getPickupRequest(tripId: string, pickupId: string): Promise<PickupRequest>
  /**
   * Tạo yêu cầu `PENDING` (`PKR-NNN`) cho chuyến Đang vận chuyển; chuyến ở trạng thái khác: `INVALID_TRIP_STATUS_TRANSITION`. Không
   * kiện nào: `PACKAGES_REQUIRED`; tên, địa chỉ hoặc toạ độ của hai điểm, hạn, kích thước, khối lượng, loại hàng sai: `PICKUP_INVALID`
   * kèm tên trường đầu tiên sai. Kích thước làm tròn 0,1 cm, khối lượng 0,01 kg.
   */
  createPickupRequest(tripId: string, input: PickupRequestInput): Promise<PickupRequest>
  /**
   * Chuyển trạng thái theo bảng `PICKUP_TRANSITIONS`; sai bảng: `INVALID_PICKUP_STATUS_TRANSITION`. `details` ghi kết quả kiểm luật
   * và lý do vượt luật; sang `APPROVED` kho ghi người và thời điểm duyệt.
   */
  updatePickupStatus(tripId: string, pickupId: string, status: PickupStatus, details?: PickupStatusDetails): Promise<PickupRequest>
}
