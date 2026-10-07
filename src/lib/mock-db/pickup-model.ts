import type { HandlingClass } from '@/domain/models'
import type { PickupRuleResult } from '@/domain/pickup'

/**
 * Yêu cầu nhận hàng dọc đường (FE-7-01, D-88, PRD v2 mục 7.4, 8.7): điều phối viên hoặc tài xế đề nghị nhận thêm hàng ở một điểm trên
 * tuyến khi chuyến Đang vận chuyển. Trạng thái do kho ghi, đi theo bảng `PICKUP_TRANSITIONS`; mười luật kiểm ở `@/domain/pickup`,
 * kết quả lưu ở `validationResults`. Đơn vị cm / kg (D-03).
 */

/**
 * `PENDING` chờ duyệt (mười luật chưa đạt hết, hoặc chưa kiểm) → `VALIDATED` (mười luật đạt) → `APPROVED` (điều phối viên duyệt) →
 * `LOADED` (tài xế đã nhận kiện lên xe) → `DELIVERED` (đã giao ở điểm giao). `REJECTED`: điều phối viên từ chối kèm lý do.
 */
export const PICKUP_STATUSES = ['PENDING', 'VALIDATED', 'REJECTED', 'APPROVED', 'LOADED', 'DELIVERED'] as const
export type PickupStatus = (typeof PICKUP_STATUSES)[number]

/**
 * Bảng chuyển trạng thái (sơ đồ BE 3.3). Duyệt được cả yêu cầu `PENDING` còn luật không đạt: điều phối viên ghi lý do để vượt luật
 * (`overrideReason`, FE-7-04). `REJECTED` và `DELIVERED` là trạng thái cuối.
 */
export const PICKUP_TRANSITIONS: Readonly<Record<PickupStatus, readonly PickupStatus[]>> = {
  PENDING: ['VALIDATED', 'REJECTED', 'APPROVED'],
  VALIDATED: ['APPROVED', 'REJECTED'],
  REJECTED: [],
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
  /** Lý do điều phối viên từ chối; từ lúc `REJECTED`. */
  rejectReason?: string
  rejectedAt?: string
  rejectedBy?: string | null
  /** ISO 8601 */
  createdAt: string
  createdBy: string | null
  /** Từ lúc `APPROVED`; `approvedBy` là `null` khi kho chạy không có phiên. */
  approvedAt?: string
  approvedBy?: string | null
  /**
   * Từ lúc `APPROVED` (FE-7-04): kiện kho kiện của yêu cầu — kiện thứ i ứng với `packages[i]` —, điểm nhận và điểm giao trong
   * `Trip.stops` (điểm giao có thể là điểm có sẵn dùng lại).
   */
  packageIds?: string[]
  pickupStopId?: string
  deliveryStopId?: string
  /** Tài xế hoàn tất điểm nhận (`LOADED`, FE-7-05) và kiện giao xong ở điểm giao (`DELIVERED`). */
  loadedAt?: string
  deliveredAt?: string
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

/** Lý do từ chối và lý do vượt luật dài tối đa (ký tự). */
export const MAX_PICKUP_REASON_LENGTH = 300
