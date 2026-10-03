import type { DeadlineRenegotiationInput, RerouteProposal, TripException, TripExceptionInput, TripReroute } from './exception-model'

/**
 * Phần kho của sự cố cấp chuyến, tuyến thay thế và gia hạn (FE-6-11, FE-6-12, D-87). Cùng quy ước với `MockDb`: bất đồng bộ, trả bản
 * sao, từ chối bằng `MockDbError`, lọc theo công ty của phiên (D-64). Kho xét **vai trò của phiên** cho các hàm ghi (kho không có
 * phiên — test logic — thì không xét): sai vai trò là `ROLE_NOT_ALLOWED`.
 */
export type ExceptionsDb = {
  /**
   * Điều phối viên, hoặc tài xế của chính chuyến, báo một sự cố của chuyến Đang vận chuyển (pha khác: `TRIP_PHASE_INVALID`). Xe mô
   * phỏng đứng thêm đúng `delayMinutes` phút kể từ lúc báo; ETA tự dời theo vị trí. Loại lạ, thiếu mô tả hoặc số phút ngoài khoảng:
   * `EXCEPTION_INVALID`.
   */
  reportTripException(tripId: string, input: TripExceptionInput): Promise<TripException>
  /** Sự cố của một chuyến, cũ trước. Sự cố chưa xử lý quá 30 phút theo đồng hồ của kho được chuyển quản lý ở lần đọc này. */
  listTripExceptions(tripId: string): Promise<TripException[]>
  /** Điều phối viên: "Không có tuyến khả thi — chuyển quản lý". Sự cố không còn `OPEN`: `EXCEPTION_STATUS_INVALID`. */
  escalateTripException(tripId: string, exceptionId: string): Promise<TripException>
  /** Điều phối viên: "Đã xử lý", kèm ghi chú tuỳ chọn. Sự cố đã xử lý rồi: `EXCEPTION_STATUS_INVALID`. */
  resolveTripException(tripId: string, exceptionId: string, note?: string): Promise<TripException>
  /**
   * Điều phối viên tìm tuyến khác tới **điểm kế tiếp** từ vị trí xe: 2–3 lựa chọn mock. Thứ tự điểm giao không đổi. Xe chưa có vị
   * trí, hoặc không còn điểm nào xe chưa tới: `REROUTE_UNAVAILABLE`.
   */
  requestReroute(tripId: string): Promise<RerouteProposal>
  /**
   * Chọn lựa chọn `routeIndex` của lần tìm gần nhất: sự cố đang giữ xe mô phỏng thôi giữ, xe đứng thêm phần đường vòng chậm hơn đường
   * nối thẳng rồi đi tiếp — ETA tự dời theo vị trí. Chưa tìm tuyến, hoặc không có lựa chọn đó: `REROUTE_UNAVAILABLE`.
   */
  confirmReroute(tripId: string, routeIndex: number): Promise<TripReroute>
  /**
   * Quản lý công ty ghi đã liên hệ khách và nhập hạn mới cho một yêu cầu giao của chuyến, trên sự cố đã chuyển lên (trạng thái khác:
   * `EXCEPTION_STATUS_INVALID`). Thiếu ghi chú: `REASON_REQUIRED`; yêu cầu không thuộc chuyến: `EXCEPTION_INVALID`; hạn không ở tương
   * lai theo đồng hồ của kho: `REQUIREMENT_DEADLINE_PAST`. Hạn của điểm giao và mức hạn tính lại ngay.
   */
  renegotiateDeadline(tripId: string, exceptionId: string, input: DeadlineRenegotiationInput): Promise<TripException>
}
