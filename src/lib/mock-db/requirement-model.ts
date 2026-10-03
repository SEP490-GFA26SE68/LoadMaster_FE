import type { Package } from './package-model'

/**
 * Yêu cầu giao (FE-4b-01, D-72, PRD v2 mục 7.3) — thay đơn hàng `ORD` của Review 1: quản lý công ty đặt điểm đến, hạn, ưu tiên và chọn
 * kiện từ kho kiện; điều phối viên đưa yêu cầu vào chuyến. Kho ghi ba trạng thái của backend; "Đã giao" và "Giao thiếu" suy lúc đọc từ
 * trạng thái và cờ của kiện (`requirementStatus`).
 */

export const REQUIREMENT_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const
export type RequirementPriority = (typeof REQUIREMENT_PRIORITIES)[number]

/** Trạng thái kho ghi (issue BE S4b-02): chờ xếp chuyến → đã vào chuyến → đang giao. */
export const REQUIREMENT_STORED_STATUSES = ['PENDING', 'ASSIGNED', 'IN_TRIP'] as const
export type RequirementStoredStatus = (typeof REQUIREMENT_STORED_STATUSES)[number]

/** Trạng thái hiển thị: ba trạng thái kho ghi, cộng hai trạng thái suy từ kiện. */
export const REQUIREMENT_STATUSES = [...REQUIREMENT_STORED_STATUSES, 'DELIVERED', 'PARTIAL'] as const
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number]

/** Yêu cầu giao (`REQ-NNN`). */
export type DeliveryRequirement = {
  id: string
  /** Công ty lập yêu cầu — cũng là công ty của mọi kiện trong yêu cầu (D-64). */
  companyId: string
  destinationName: string
  address: string
  /** Toạ độ WGS84, độ thập phân; vắng cả hai khi chưa chọn toạ độ. */
  lat?: number
  lng?: number
  /** Hạn giao, ISO 8601. */
  deadline: string
  priority: RequirementPriority
  packageIds: string[]
  note?: string
  status: RequirementStoredStatus
  /**
   * Chuyến đang chở yêu cầu, từ lúc `ASSIGNED`. Dòng kiện và điểm giao của yêu cầu trong chuyến đó nằm ở liên kết dòng kiện của chuyến
   * (`TripPackageLink.requirementId`, FE-4b-04).
   */
  tripId?: string
  /** ISO 8601 */
  createdAt: string
  createdBy: string | null
}

export type RequirementInput = Pick<DeliveryRequirement, 'destinationName' | 'address' | 'deadline' | 'priority' | 'packageIds'> & {
  lat?: number
  lng?: number
  note?: string
}

/** Trường sửa được; `lat` / `lng` `null` là bỏ toạ độ. */
export type RequirementChanges = Partial<Omit<RequirementInput, 'lat' | 'lng'>> & { lat?: number | null; lng?: number | null }

/**
 * Ưu tiên của yêu cầu → `priority` / `mustLoad` của dòng kiện khi tối ưu 3D (D-93, người dùng xác nhận 04/10/2026): Khẩn 4, Cao 3,
 * Bình thường 2, Thấp 1; chỉ kiện của yêu cầu Khẩn bắt buộc xếp. Nơi duy nhất giữ bảng này.
 */
export const REQUIREMENT_CARGO_PRIORITY: Readonly<Record<RequirementPriority, { readonly priority: number; readonly mustLoad: boolean }>> = {
  LOW: { priority: 1, mustLoad: false },
  NORMAL: { priority: 2, mustLoad: false },
  HIGH: { priority: 3, mustLoad: false },
  URGENT: { priority: 4, mustLoad: true },
}

type Member = Pick<Package, 'status' | 'flags'>

const SETTLED: ReadonlySet<Package['status']> = new Set(['DELIVERED', 'RETURNED'])

/** Kiện không còn đi tiếp trong chuyến: đã giao, hoàn trả, hoặc đã về kho kiện kèm cờ (không tìm thấy, hư hỏng — D-92). */
const isSettled = (pkg: Member) => SETTLED.has(pkg.status) || (pkg.status === 'IMPORTED' && pkg.flags.length > 0)

/**
 * Trạng thái hiển thị của yêu cầu (mục 7.3), `members` là các kiện của nó:
 *
 * - `PARTIAL` Giao thiếu: có kiện mang cờ (D-92) hoặc bị hoàn trả (D-91) — ở bất kỳ trạng thái kho ghi nào;
 * - `DELIVERED` Đã giao: yêu cầu đang giao mà mọi kiện đã giao;
 * - còn lại: trạng thái kho ghi.
 */
export function requirementStatus(requirement: Pick<DeliveryRequirement, 'status'>, members: readonly Member[]): RequirementStatus {
  if (members.some((pkg) => pkg.flags.length > 0 || pkg.status === 'RETURNED')) return 'PARTIAL'
  if (requirement.status === 'IN_TRIP' && members.length > 0 && members.every((pkg) => pkg.status === 'DELIVERED')) return 'DELIVERED'
  return requirement.status
}

/** Yêu cầu đã giao xong: đang giao và không kiện nào còn đi tiếp. Từ lúc này hạn và ưu tiên không sửa được nữa. */
export function isRequirementClosed(requirement: Pick<DeliveryRequirement, 'status'>, members: readonly Member[]): boolean {
  return requirement.status === 'IN_TRIP' && members.length > 0 && members.every(isSettled)
}

/** Trường còn sửa được sau khi yêu cầu đã vào chuyến (mục 7.3): hạn và ưu tiên. */
export const REQUIREMENT_FIELDS_AFTER_PENDING = ['deadline', 'priority'] as const satisfies readonly (keyof RequirementInput)[]

/** Vĩ độ, kinh độ hợp lệ. */
export function isValidCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}
