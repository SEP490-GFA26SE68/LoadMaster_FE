import type { HandlingClass } from '@/domain/models'
import type { PickupRuleResult } from '@/domain/pickup'

/**
 * Yêu cầu nhận hàng dọc đường (FE-7-01, D-88, PRD v2 mục 7.4, 8.7): điều phối viên hoặc tài xế đề nghị nhận thêm hàng ở một điểm trên
 * tuyến khi chuyến Đang vận chuyển. Trạng thái do kho ghi, đi theo bảng `PICKUP_TRANSITIONS`; mười luật kiểm ở `@/domain/pickup`,
 * kết quả lưu ở `validationResults`. Đơn vị cm / kg (D-03).
 */

/**
 * `PENDING` chờ kiểm luật → `VALIDATED` (mọi luật đạt) / `REJECTED` (có luật không đạt) → `APPROVED` (điều phối viên duyệt) → `LOADED`
 * (tài xế đã xếp kiện lên xe) → `DELIVERED` (đã giao ở điểm giao).
 */
export const PICKUP_STATUSES = ['PENDING', 'VALIDATED', 'REJECTED', 'APPROVED', 'LOADED', 'DELIVERED'] as const
export type PickupStatus = (typeof PICKUP_STATUSES)[number]

/**
 * Bảng chuyển trạng thái (sơ đồ BE 3.3). Duyệt được cả yêu cầu `REJECTED`: điều phối viên ghi lý do để vượt luật (`overrideReason`);
 * `REJECTED` không quay về `PENDING` hay `VALIDATED`. `DELIVERED` là trạng thái cuối.
 */
export const PICKUP_TRANSITIONS: Readonly<Record<PickupStatus, readonly PickupStatus[]>> = {
  PENDING: ['VALIDATED', 'REJECTED'],
  VALIDATED: ['APPROVED', 'REJECTED'],
  REJECTED: ['APPROVED'],
  APPROVED: ['LOADED'],
  LOADED: ['DELIVERED'],
  DELIVERED: [],
}

export function canTransitionPickup(from: PickupStatus, to: PickupStatus): boolean {
  return PICKUP_TRANSITIONS[from].includes(to)
}

/** Điểm nhận hoặc điểm giao của yêu cầu: tên, địa chỉ và toạ độ WGS84 (độ thập phân). */
export type PickupPoint = { name: string; address: string; lat: number; lng: number }

/** Một kiện của yêu cầu: mã của bên gửi, kích thước (cm), khối lượng (kg), loại hàng. Kiện vào kho kiện khi yêu cầu được duyệt. */
export type PickupPackage = {
  packageCode: string
  lengthCm: number
  widthCm: number
  heightCm: number
  weightKg: number
  handlingClass: HandlingClass
}

/** Yêu cầu nhận dọc đường (`PKR-NNN`, Phương Nam `PKR-PN-NNN`). */
export type PickupRequest = {
  id: string
  /** Công ty của chuyến (D-64). */
  companyId: string
  tripId: string
  pickup: PickupPoint
  delivery: PickupPoint
  /** Hạn giao, ISO 8601; vắng là không có hạn. */
  deadline?: string
  packages: PickupPackage[]
  status: PickupStatus
  /** Kết quả mười luật ở lần kiểm gần nhất, theo thứ tự luật; rỗng khi chưa kiểm. */
  validationResults: PickupRuleResult[]
  /** Lý do vượt luật khi duyệt yêu cầu có luật không đạt. */
  overrideReason?: string
  /** ISO 8601 */
  createdAt: string
  createdBy: string | null
  /** Từ lúc `APPROVED`; `approvedBy` là `null` khi kho chạy không có phiên. */
  approvedAt?: string
  approvedBy?: string | null
}

/** Đầu vào tạo yêu cầu. Mã, công ty, trạng thái, người tạo do kho đặt. */
export type PickupRequestInput = {
  pickup: PickupPoint
  delivery: PickupPoint
  deadline?: string
  packages: PickupPackage[]
}

/** Dữ liệu đi kèm một lần đổi trạng thái; trường vắng giữ nguyên giá trị đang có. */
export type PickupStatusDetails = {
  validationResults?: PickupRuleResult[]
  overrideReason?: string
}
