import type { PickupRequest, PickupRequestInput, PickupStatus, PickupStatusDetails } from './pickup-model'

/**
 * Phần kho của yêu cầu nhận hàng dọc đường (FE-7-01, D-88). Cùng quy ước với `MockDb`: bất đồng bộ, trả bản sao, từ chối bằng
 * `MockDbError`, lọc theo công ty của phiên (D-64) — qua chuyến, như các endpoint `/api/trips/{id}/pickup-requests` của backend.
 * Vai trò xét ở kho như các hàm sự cố cấp chuyến (kho không có phiên thì không xét): tạo và kiểm luật là việc của điều phối viên, hoặc
 * tài xế của chính chuyến; duyệt, từ chối là việc của điều phối viên. Tạo xong kho tự kiểm mười luật (FE-7-03).
 */
export type PickupsDb = {
  /** Yêu cầu của một chuyến, cũ trước. Chuyến của công ty khác: `NOT_FOUND`. */
  listPickupRequests(tripId: string): Promise<PickupRequest[]>
  /** Không có yêu cầu đó trong chuyến, hoặc chuyến của công ty khác: `NOT_FOUND`. */
  getPickupRequest(tripId: string, pickupId: string): Promise<PickupRequest>
  /**
   * Tạo yêu cầu (`PKR-NNN`) cho chuyến Đang vận chuyển; chuyến ở trạng thái khác: `INVALID_TRIP_STATUS_TRANSITION`; vai trò khác điều
   * phối viên, hoặc tài xế không phải của chuyến: `ROLE_NOT_ALLOWED`. Không kiện nào: `PACKAGES_REQUIRED`; tên, địa chỉ hoặc toạ độ của
   * hai điểm, hạn, kích thước, khối lượng, loại hàng sai: `PICKUP_INVALID` kèm tên trường đầu tiên sai. Kích thước làm tròn 0,1 cm,
   * khối lượng 0,01 kg. Kho kiểm mười luật ngay: đạt cả mười thì `VALIDATED`, không thì `PENDING`; kết quả lưu ở `validationResults`.
   * Chuyến còn điểm chưa có toạ độ: `PICKUP_ROUTE_UNAVAILABLE`, không ghi gì. Ghi sự kiện `pickup.requested`.
   */
  createPickupRequest(tripId: string, input: PickupRequestInput): Promise<PickupRequest>
  /**
   * Kiểm lại mười luật theo trạng thái của chuyến lúc này (xe đã đi tiếp, kho đã giao thêm điểm): kết quả mới thay `validationResults`;
   * đạt cả mười thì `VALIDATED`, không thì `PENDING`. Chỉ yêu cầu `PENDING` hoặc `VALIDATED`, khác là `INVALID_PICKUP_STATUS_TRANSITION`.
   */
  validatePickupRequest(tripId: string, pickupId: string): Promise<PickupRequest>
  /**
   * Chuyển trạng thái theo bảng `PICKUP_TRANSITIONS`; sai bảng: `INVALID_PICKUP_STATUS_TRANSITION`. `details` ghi kết quả kiểm luật
   * và lý do vượt luật; sang `APPROVED` kho ghi người và thời điểm duyệt.
   */
  updatePickupStatus(tripId: string, pickupId: string, status: PickupStatus, details?: PickupStatusDetails): Promise<PickupRequest>
}
