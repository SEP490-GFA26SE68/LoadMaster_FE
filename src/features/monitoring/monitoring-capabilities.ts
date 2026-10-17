import { usesBackend } from '@/lib/backend-config'

/**
 * Màn Giám sát làm được gì với nguồn dữ liệu đang dùng (D-20: không có nút giả). Kho mẫu làm được hết. Backend có: chuyến đang vận
 * chuyển kèm điểm giao, vị trí GPS mới nhất và lịch sử vị trí, giờ đến và mức hạn backend tính, cảnh báo nguy cơ trễ, báo và xử lý sự
 * cố, tuyến thay thế. Backend chưa có — màn ẩn phần đó: liên kết tới Chi tiết chuyến (màn chuyến còn là kho mẫu, không có chuyến của
 * backend), đổi thứ tự điểm khi xe đang chạy, chuyển sự cố cho quản lý cùng tab "Sự cố cần xử lý" và gia hạn, nhận hàng dọc đường, xác
 * nhận tay chờ duyệt. Nằm riêng khỏi `monitoring-api.ts` để thành phần đọc nó không kéo theo lớp gọi API.
 */
export type MonitoringCapabilities = {
  /** Dữ liệu từ backend: giờ đến do máy chủ tính, vị trí là điểm GPS máy chủ nhận. */
  readonly backend: boolean
  readonly openTrip: boolean
  readonly reorderStops: boolean
  /** Chuyển sự cố cho quản lý, tab "Sự cố cần xử lý" và gia hạn của quản lý công ty. */
  readonly escalation: boolean
  readonly pickups: boolean
  readonly manualConfirm: boolean
}

const ON_BACKEND = usesBackend('monitoring')

export const MONITORING_CAPABILITIES: MonitoringCapabilities = {
  backend: ON_BACKEND,
  openTrip: !ON_BACKEND,
  reorderStops: !ON_BACKEND,
  escalation: !ON_BACKEND,
  pickups: !ON_BACKEND,
  manualConfirm: !ON_BACKEND,
}

/** Component đọc ở đây để ẩn phần nguồn dữ liệu chưa có (kho mẫu hay backend). */
export function useMonitoringCapabilities(): MonitoringCapabilities {
  return MONITORING_CAPABILITIES
}
