import { tripLinkable } from '@/features/trips/trips-capabilities'
import { usesBackend } from '@/lib/backend-config'

/**
 * Bảng điều khiển làm được gì với nguồn dữ liệu đang dùng (D-20, không bịa số). Kho mẫu có hết. Máy chủ (`GET /api/manager/dashboard`,
 * nhóm `monitoring`) trả số tổng hợp của kỳ, đội xe (kèm Ngừng sử dụng), lấp đầy theo ngày, khối lượng theo xe và **10** chuyến gần nhất
 * — mỗi chuyến chỉ mã, tên, giờ xuất phát, trạng thái, xe, tài xế, lấp đầy. Phần máy chủ không trả thì màn và báo cáo bỏ hẳn, không vẽ 0.
 * Nằm riêng khỏi `dashboard-api.ts` để component đọc nó không kéo theo lớp gọi API.
 */
export type DashboardCapabilities = {
  /** Số liệu đọc `GET /api/manager/dashboard`; số do máy chủ tính, không mang MOCK RESULT. */
  readonly backend: boolean
  /** Số kiện, khối lượng hàng, khối lượng đã giao, số sự cố và dòng phụ của trạng thái trên từng chuyến. */
  readonly tripDetails: boolean
  /** Nút "Mở phương án" (Planner) của từng chuyến. */
  readonly plannerLinks: boolean
  /** Mã chuyến mở được Chi tiết chuyến: bảng đọc chuyến cùng nguồn với màn chuyến (`tripLinkable`). */
  readonly tripLinks: boolean
  /** Bảng và sheet "Chuyến" có mọi chuyến của kỳ; máy chủ chỉ trả các chuyến gần nhất. */
  readonly allTrips: boolean
}

const ON_BACKEND = usesBackend('monitoring')

export const DASHBOARD_CAPABILITIES: DashboardCapabilities = {
  backend: ON_BACKEND,
  tripDetails: !ON_BACKEND,
  plannerLinks: !ON_BACKEND && tripLinkable(false),
  tripLinks: tripLinkable(ON_BACKEND),
  allTrips: !ON_BACKEND,
}

export function useDashboardCapabilities(): DashboardCapabilities {
  return DASHBOARD_CAPABILITIES
}
