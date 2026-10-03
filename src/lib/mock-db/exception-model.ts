import type { RerouteOption, SimulationDelay } from '@/domain/routing'

/**
 * Sự cố cấp chuyến của chuyến Đang vận chuyển (FE-6-11, FE-6-12, D-87). Khác sự cố giao của từng kiện (`DeliveryIssue`): đây là việc
 * xảy ra với **cả xe** trên đường — tắc đường, tai nạn, hỏng xe — kèm số phút dự kiến chậm; xe mô phỏng đứng thêm đúng số phút đó.
 * Khi chưa có backend mọi thứ ở đây nằm trong kho của tab đang mở (D-95).
 */
export const TRIP_EXCEPTION_TYPES = ['TRAFFIC', 'ACCIDENT', 'ROAD_CONSTRUCTION', 'VEHICLE_BREAKDOWN', 'OTHER'] as const
export type TripExceptionType = (typeof TRIP_EXCEPTION_TYPES)[number]

/** `OPEN` điều phối viên chưa xử lý · `ESCALATED` đã chuyển quản lý công ty · `RESOLVED` đã xử lý. */
export const TRIP_EXCEPTION_STATUSES = ['OPEN', 'ESCALATED', 'RESOLVED'] as const
export type TripExceptionStatus = (typeof TRIP_EXCEPTION_STATUSES)[number]

/** Vì sao sự cố lên quản lý: điều phối viên không tìm được tuyến khả thi, hoặc quá `ESCALATE_AFTER_MINUTES` phút chưa ai xử lý. */
export const EXCEPTION_ESCALATIONS = ['NO_ROUTE', 'TIMEOUT'] as const
export type ExceptionEscalation = (typeof EXCEPTION_ESCALATIONS)[number]

/** Sự cố chưa xử lý quá chừng này phút theo đồng hồ của kho thì tự chuyển quản lý. */
export const ESCALATE_AFTER_MINUTES = 30
export const MAX_EXCEPTION_DELAY_MINUTES = 480
export const MAX_EXCEPTION_NOTE_LENGTH = 300

export type TripExceptionInput = {
  type: TripExceptionType
  description: string
  /** Số phút dự kiến chậm, số nguyên 0 → `MAX_EXCEPTION_DELAY_MINUTES`. */
  delayMinutes: number
}

/** Quản lý công ty đã liên hệ khách và nhập hạn mới cho một yêu cầu giao của chuyến (FE-6-12). */
export type DeadlineRenegotiation = {
  requirementId: string
  previousDeadline: string
  deadline: string
  /** Ghi chú "Đã liên hệ khách". */
  contactNote: string
  at: string
  by: string | null
}

export type DeadlineRenegotiationInput = { requirementId: string; deadline: string; contactNote: string }

export type TripException = {
  /** `EXC-NNN` */
  id: string
  tripId: string
  type: TripExceptionType
  description: string
  delayMinutes: number
  status: TripExceptionStatus
  /** Điểm giao xe đang tới (hoặc đang đứng) lúc báo, 1-based; vắng khi chuyến không còn điểm nào chưa hoàn tất. */
  stopNumber?: number
  /** ISO 8601 theo đồng hồ của kho. */
  reportedAt: string
  reportedBy: string | null
  /** `by` là `null` khi hệ thống tự chuyển (`TIMEOUT`). */
  escalation?: { reason: ExceptionEscalation; at: string; by: string | null }
  renegotiation?: DeadlineRenegotiation
  resolution?: { at: string; by: string | null; note?: string }
}

/** Một tuyến thay thế mock đưa ra; `index` là `routeIndex` của `POST /api/trips/{id}/reroute/{routeIndex}/confirm`. */
export type RerouteChoice = RerouteOption & { index: number }

/** Kết quả "Tìm tuyến khác": 2–3 tuyến tới điểm kế tiếp, tính từ vị trí xe lúc `requestedAt`. Kho giữ lần hỏi gần nhất để xác nhận. */
export type RerouteProposal = {
  tripId: string
  requestedAt: string
  /** Điểm kế tiếp xe chưa tới. */
  stopId: string
  stopNumber: number
  options: RerouteChoice[]
  isMockResult: true
}

/** Tuyến điều phối viên đã chọn. */
export type TripReroute = RerouteChoice & { stopNumber: number; confirmedAt: string; confirmedBy: string | null }

/** Phần kho giữ cho mỗi chuyến có sự cố. */
export type TripIncidents = {
  /** Cũ trước. */
  exceptions: TripException[]
  /** Các khoảng xe mô phỏng bị giữ lại: một khoảng cho mỗi sự cố, cắt lại khi điều phối viên chọn tuyến khác. */
  holds: SimulationDelay[]
  proposal?: RerouteProposal
  /** Cũ trước. */
  reroutes: TripReroute[]
}

/** Sự cố còn việc phải làm: chưa xử lý, hoặc đã chuyển quản lý. */
export function isActiveException(exception: Pick<TripException, 'status'>): boolean {
  return exception.status !== 'RESOLVED'
}
