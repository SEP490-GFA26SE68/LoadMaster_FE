import { usesBackend } from '@/lib/backend-config'

/**
 * Màn Giám sát làm được gì với nguồn dữ liệu đang dùng (D-20: không có nút giả). Kho mẫu làm được hết. Backend có: chuyến đang vận
 * chuyển kèm điểm giao, vị trí GPS mới nhất và lịch sử vị trí, giờ đến và mức hạn backend tính, cảnh báo nguy cơ trễ, báo, chuyển quản lý
 * và xử lý sự cố (máy chủ cũng tự chuyển sự cố mở quá 30 phút), tuyến thay thế, và tab "Sự cố cần xử lý" của quản lý công ty (đọc sự cố
 * `ESCALATED` trong giám sát đội xe) kèm gia hạn — nhập hạn mới cho một yêu cầu giao của chuyến. Liên kết tới Chi tiết chuyến chỉ có khi
 * màn chuyến đọc cùng nguồn (nhóm `trips` cùng bật hoặc cùng tắt) — không thì mã chuyến bên này không có ở bên kia. Backend chưa có — màn
 * ẩn phần đó: đổi thứ tự điểm khi xe đang chạy, xác nhận tay chờ duyệt. Nhận hàng dọc đường đi theo nhóm `trips` (`PICKUPS_ON_BACKEND`):
 * thẻ yêu cầu nhận chỉ hiện khi hai nhóm cùng nguồn. Nằm riêng khỏi `monitoring-api.ts` để thành
 * phần đọc nó không kéo theo lớp gọi API.
 */
export type MonitoringCapabilities = {
  /** Dữ liệu từ backend: giờ đến do máy chủ tính, vị trí là điểm GPS máy chủ nhận. */
  readonly backend: boolean
  readonly openTrip: boolean
  readonly reorderStops: boolean
  /** Điều phối viên chuyển sự cố còn mở cho quản lý; tab "Sự cố cần xử lý" của quản lý công ty. */
  readonly escalation: boolean
  readonly pickups: boolean
  readonly manualConfirm: boolean
}

const ON_BACKEND = usesBackend('monitoring')

export const MONITORING_CAPABILITIES: MonitoringCapabilities = {
  backend: ON_BACKEND,
  openTrip: ON_BACKEND === usesBackend('trips'),
  reorderStops: !ON_BACKEND,
  escalation: true,
  pickups: ON_BACKEND === usesBackend('trips'),
  manualConfirm: !ON_BACKEND,
}

/** Component đọc ở đây để ẩn phần nguồn dữ liệu chưa có (kho mẫu hay backend). */
export function useMonitoringCapabilities(): MonitoringCapabilities {
  return MONITORING_CAPABILITIES
}
