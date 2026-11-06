import { usesBackend } from '@/lib/backend-config'

/**
 * Màn chuyến làm được gì với nguồn dữ liệu đang dùng (D-20: không có nút giả). Kho mẫu làm được hết. Backend có: danh sách chuyến (mã,
 * tên, trạng thái, giờ xuất phát, xe, tài xế, số điểm, số kiện), Chi tiết chuyến (kho xuất phát, điểm giao kèm giờ đến dự kiến và hạn,
 * tối ưu tuyến), tạo chuyến, sửa (tên, giờ xuất phát, xe, tài xế, kho xuất phát) và huỷ chuyến bằng hộp thoại của Chi tiết chuyến, gỡ yêu
 * cầu giao khỏi chuyến, và phương án xếp hàng của máy chủ ở Thiết lập tối ưu, So sánh, Planner (xem, Duyệt, chỉnh tay và "Duyệt bản
 * chỉnh", ghim, chạy lại giữ ghim, đổi xe, phương án lỗi thời) — các màn đó tự chọn bản theo
 * `backend`. Backend chưa trả — màn ẩn phần đó, không gọi kho mẫu bằng mã chuyến của máy chủ: form sửa chuyến, kiện và kiện kho kiện của
 * chuyến, phương án trên danh sách chuyến (lấp đầy, dòng phụ chờ duyệt / đã duyệt / lỗi thời); tiến độ kho, xác nhận tay, kiện báo thiếu, phân nhóm hàng, nhận hàng dọc đường, tiến trình, báo cáo chuyến. Nằm riêng
 * khỏi `trips-api.ts` để thành phần đọc nó không kéo theo lớp gọi API.
 */
export type TripsCapabilities = {
  /** Danh sách, Chi tiết chuyến, Thiết lập tối ưu, So sánh và Planner đọc backend. */
  readonly backend: boolean
  /** Lập chuyến từ danh sách và lệnh ghi của Chi tiết chuyến kho mẫu (bản máy chủ có lệnh ghi riêng, theo `trips.edit`). */
  readonly edit: boolean
  /** Phương án xếp hàng trên danh sách chuyến: lấp đầy, dòng phụ dưới chip, số "cần bạn xử lý". */
  readonly plans: boolean
  /** Dòng kiện của chuyến (bảng kiện, nhóm "kiện trong chuyến" của tìm nhanh). */
  readonly packages: boolean
  /** Tên các điểm giao trên dòng danh sách (cột Tuyến). */
  readonly routeNames: boolean
  /** Vị trí xe và giờ đến trực tiếp ở Chi tiết chuyến: giám sát phải đọc cùng nguồn với chuyến (cùng mã chuyến). */
  readonly liveMonitoring: boolean
}

const ON_BACKEND = usesBackend('trips')

export const TRIPS_CAPABILITIES: TripsCapabilities = {
  backend: ON_BACKEND,
  edit: !ON_BACKEND,
  plans: !ON_BACKEND,
  packages: !ON_BACKEND,
  routeNames: !ON_BACKEND,
  liveMonitoring: ON_BACKEND === usesBackend('monitoring'),
}

/**
 * Mã chuyến mà một màn đọc từ nguồn `sourceOnBackend` có mở được Chi tiết chuyến không. Chi tiết chuyến tìm chuyến ở nguồn của màn
 * chuyến, nên khi chuyến đọc backend, mã chuyến của kho mẫu (bảng điều khiển, yêu cầu giao, nhật ký…) không mở được chuyến nào: các màn
 * đó hiện mã dạng chữ thường, không liên kết.
 */
export function tripLinkable(sourceOnBackend: boolean): boolean {
  return TRIPS_CAPABILITIES.backend === sourceOnBackend
}

/** Component đọc ở đây để ẩn phần nguồn dữ liệu chưa có (kho mẫu hay backend). */
export function useTripsCapabilities(): TripsCapabilities {
  return TRIPS_CAPABILITIES
}
