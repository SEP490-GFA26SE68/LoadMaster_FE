import type { Formatter } from '@/lib/format'
import type { TFunction } from '@/lib/i18n'
import type { ServerAuditEntry } from './audit-backend-api'

/**
 * Phần chi tiết của dòng nhật ký máy chủ mà chuông thông báo cũng hiện: sự cố, nguy cơ trễ hạn, credit, yêu cầu hỗ trợ, nhận hàng dọc
 * đường, báo thiếu / kiện hỏng của kho, kiện tìm thấy lại, lý do. Mã dịch qua từ điển; mã không có nhãn thì bỏ, không hiện mã thô. Hàm thuần, chỉ `server-audit-rows.ts` dùng.
 */

const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const
const ESCALATION_REASONS = ['NO_ROUTE', 'TIMEOUT'] as const
const EXCEPTION_TYPES = ['TRAFFIC', 'ACCIDENT', 'ROAD_CONSTRUCTION', 'VEHICLE_BREAKDOWN', 'OTHER'] as const
const DEADLINE_STATUSES = ['OK', 'AT_RISK', 'MISSED'] as const
const DELIVERY_ISSUE_KINDS = ['damaged', 'missing', 'refused', 'other'] as const
/** Lý do xác nhận tay (`MANUAL_CONFIRM_REASONS` của kho mẫu, `ManualConfirmReason` của máy chủ). */
const MANUAL_CONFIRM_REASONS = ['LABEL_DAMAGED', 'QR_UNREADABLE', 'OTHER'] as const
/** Kết quả mười luật lúc gửi yêu cầu nhận dọc đường (`PICKUP_REQUESTED`): đạt cả mười, hoặc còn luật không đạt. */
const PICKUP_CHECKS = ['VALIDATED', 'PENDING'] as const
/** Quyết định của điều phối viên với kiện kho báo thiếu (`STAGING_SHORTAGE_RESOLVED`). */
const SHORTAGE_DECISIONS = ['KEEP_SEARCHING', 'DROP'] as const
/** Kiện hỏng lúc xếp (`LOADING_DAMAGE_REPORTED`): bỏ lại kho rồi xếp tiếp, hoặc chuyến quay về lập kế hoạch. */
const DAMAGE_OUTCOMES = ['LEFT_OUT', 'REPLANNED'] as const
/** Giá trị trông như mã máy (`LABEL_DAMAGED`): không có nhãn thì bỏ, không hiện mã cho người dùng. */
const CODE_LIKE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/

const isOneOf = <T extends string>(list: readonly T[], value: string): value is T => (list as readonly string[]).includes(value)

export const positive = (value: string | number | boolean | undefined): value is number => typeof value === 'number' && value > 0

/** Lý do của dòng: mã đã biết thì dịch, mã lạ thì bỏ, chữ người dùng nhập thì giữ nguyên. */
export function reasonPart({ actionType, after }: ServerAuditEntry, t: TFunction): string | null {
  if (typeof after.reason !== 'string' || after.reason.trim() === '') return null
  const reason = after.reason.trim()
  if (actionType === 'TRIP_EXCEPTION_ESCALATED' && isOneOf(ESCALATION_REASONS, reason)) return t(`serverAudit.escalationReasons.${reason}`)
  if (actionType.startsWith('MANUAL_CONFIRM_') && isOneOf(MANUAL_CONFIRM_REASONS, reason)) {
    return t('serverAudit.details.reason', { reason: t(`common.manualConfirmReasons.${reason}`) })
  }
  return CODE_LIKE.test(reason) ? null : t('serverAudit.details.reason', { reason })
}

/** Yêu cầu nhận hàng dọc đường: số kiện, kết quả mười luật khi gửi, số kiện chưa có chỗ và duyệt vượt luật khi duyệt. */
export function pickupParts({ actionType, after }: ServerAuditEntry, t: TFunction): string[] {
  const parts: string[] = []
  if ((actionType === 'PICKUP_REQUESTED' || actionType === 'PICKUP_LOADED') && positive(after.packages)) {
    parts.push(t('serverAudit.details.pickupPackages', { count: after.packages }))
  }
  if ((actionType === 'PICKUP_PACKAGES_DROPPED' || actionType === 'PICKUP_REJECTED') && positive(after.droppedPackages)) {
    parts.push(t('serverAudit.details.pickupPackages', { count: after.droppedPackages }))
  }
  if (actionType === 'PICKUP_REQUESTED' && typeof after.status === 'string' && isOneOf(PICKUP_CHECKS, after.status)) {
    parts.push(t(`serverAudit.pickupChecks.${after.status}`))
  }
  if (actionType === 'PICKUP_APPROVED') {
    const placed = typeof after.placed === 'number' ? after.placed : 0
    const unplaced = typeof after.unplaced === 'number' ? after.unplaced : 0
    if (placed + unplaced > 0) parts.push(t('serverAudit.details.pickupPackages', { count: placed + unplaced }))
    if (unplaced > 0) parts.push(t('serverAudit.details.pickupUnplaced', { count: unplaced }))
    if (after.overridden === true) parts.push(t('serverAudit.details.pickupOverridden'))
  }
  return parts
}

/**
 * Chi tiết của các việc mà chuông thông báo báo (sự cố trên đường, nguy cơ trễ hạn, sắp hết credit, yêu cầu hỗ trợ): loại sự cố, số
 * phút chậm, điểm giao, mức hạn, số dư, mã và trạng thái yêu cầu — mã dịch qua từ điển, mã lạ bỏ qua.
 */
export function notificationParts({ actionType, after }: ServerAuditEntry, t: TFunction, format: Formatter): string[] {
  const parts: string[] = []
  if (actionType === 'TRIP_EXCEPTION_REPORTED' && typeof after.type === 'string' && isOneOf(EXCEPTION_TYPES, after.type)) {
    parts.push(t(`common.tripExceptionTypes.${after.type}`))
  }
  if (actionType === 'DELIVERY_ISSUE_REPORTED' && typeof after.kind === 'string') {
    const kind = after.kind.toLowerCase()
    if (isOneOf(DELIVERY_ISSUE_KINDS, kind)) parts.push(t(`common.deliveryIssueKinds.${kind}`))
  }
  if (typeof after.stopNumber === 'number' && after.stopNumber > 0) parts.push(t('serverAudit.details.stop', { number: format.integer(after.stopNumber) }))
  if (typeof after.delayMinutes === 'number' && after.delayMinutes > 0) {
    parts.push(t('serverAudit.details.delay', { minutes: format.integer(after.delayMinutes) }))
  }
  if (actionType === 'DELIVERY_ETA_RISK' && typeof after.deadlineStatus === 'string' && isOneOf(DEADLINE_STATUSES, after.deadlineStatus)) {
    parts.push(t(`common.deadlineStatuses.${after.deadlineStatus}`))
  }
  if (actionType === 'CREDIT_LOW_BALANCE' && typeof after.balance === 'number') parts.push(t('serverAudit.details.balance', { count: after.balance }))
  if (actionType === 'STAGING_SHORTAGE_RESOLVED' && typeof after.decision === 'string' && isOneOf(SHORTAGE_DECISIONS, after.decision)) {
    parts.push(t(`serverAudit.shortageDecisions.${after.decision}`))
  }
  if (actionType === 'LOADING_DAMAGE_REPORTED' && typeof after.outcome === 'string' && isOneOf(DAMAGE_OUTCOMES, after.outcome)) {
    parts.push(t(`serverAudit.damageOutcomes.${after.outcome}`))
  }
  if (actionType === 'PACKAGE_FOUND' && typeof after.packageCode === 'string' && after.packageCode.trim() !== '') {
    parts.push(t('serverAudit.details.package', { code: after.packageCode.trim() }))
  }
  if (actionType === 'SUPPORT_TICKET_UPDATED') {
    if (typeof after.ticketCode === 'string') parts.push(t('serverAudit.details.ticket', { code: after.ticketCode }))
    if (after.replied === true) parts.push(t('serverAudit.details.replied'))
    if (typeof after.status === 'string' && isOneOf(TICKET_STATUSES, after.status)) parts.push(t(`serverAudit.ticketStatuses.${after.status}`))
  }
  return parts
}
