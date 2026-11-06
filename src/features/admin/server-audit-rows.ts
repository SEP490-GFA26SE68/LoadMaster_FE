import {
  Boxes, ClipboardList, Coins, KeyRound, LifeBuoy, Lock, LockOpen, MapPin, Package, Pin, PinOff, QrCode, Route, ScrollText, Timer, TriangleAlert,
  UserCog, UserMinus, UserPen, UserPlus, type LucideIcon,
} from 'lucide-react'
import { roleOfBackend } from '@/features/auth/backend-user'
import type { KpiTone } from '@/components/KpiTile'
import { isoFromBackend } from '@/lib/backend-time'
import type { Formatter } from '@/lib/format'
import type { TFunction } from '@/lib/i18n'
import { TRIP_STATUSES } from '@/types/trip'
import type { Role } from '@/types/user'
import type { ServerAuditEntry } from './audit-backend-api'
import type { AuditChange } from './audit-change'
import { actorInitials } from './audit-look'

/** Mã hành động máy chủ đang ghi (`actionType`), theo thứ tự của ô lọc "Hành động". */
export const SERVER_AUDIT_ACTIONS = [
  'TRIP_UPDATED', 'TRIP_STATUS_TRANSITION', 'TRIP_CANCELLED', 'TRIP_REQUIREMENT_REMOVED', 'ROUTE_OPTIMIZED', 'PLAN_APPROVED', 'RERUN_OPTIMIZATION',
  'PIN_PLACEMENT', 'UNPIN_PLACEMENT', 'WAREHOUSE_CONFIRM', 'DEVIATION_RECORDED', 'LOADING_COMPLETED', 'DRIVER_UNLOAD', 'STOP_COMPLETED',
  'TRIP_COMPLETED', 'PACKAGE_IMPORT_CONFIRMED', 'DELIVERY_DEADLINE_EXTENDED', 'STOP_ARRIVED', 'USER_CREATED', 'USER_UPDATED', 'USER_LOCKED',
  'USER_UNLOCKED', 'USER_STATUS_CHANGED', 'USER_PASSWORD_RESET', 'USER_DELETED', 'DELIVERY_ISSUE_REPORTED', 'MANUAL_CONFIRM_REQUESTED',
  'MANUAL_CONFIRM_APPROVED', 'MANUAL_CONFIRM_REJECTED', 'TRIP_EXCEPTION_REPORTED', 'TRIP_EXCEPTION_ESCALATED', 'DEADLINE_RENEGOTIATED',
  'DELIVERY_ETA_RISK', 'CREDIT_LOW_BALANCE', 'SUPPORT_TICKET_UPDATED',
] as const
export type ServerAuditAction = (typeof SERVER_AUDIT_ACTIONS)[number]

const ENTITIES = [
  'Trip', 'DeliveryStop', 'UnloadConfirmation', 'PACKAGE', 'LoadPlan', 'PackagePlacement', 'DeliveryRequirement', 'PlacementConfirmation',
  'Deviation', 'LoadingExecution', 'LOAD_PLAN', 'User', 'DeliveryIssue', 'ManualUnloadConfirmation', 'TripException', 'Company', 'SupportTicket',
] as const
type ServerAuditEntity = (typeof ENTITIES)[number]

const TRIP_FIELDS = ['tripName', 'departureTime', 'originWarehouseId', 'vehicleId', 'driverId'] as const
type TripField = (typeof TRIP_FIELDS)[number]
/** Trường của bản ghi tài khoản (`entityName` `User`); máy chủ không bao giờ ghi mật khẩu. */
const USER_FIELDS = ['email', 'fullName', 'phoneNumber', 'role', 'status', 'companyId'] as const
type UserField = (typeof USER_FIELDS)[number]
const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'LOCKED'] as const
const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const
const ESCALATION_REASONS = ['NO_ROUTE', 'TIMEOUT'] as const
const EXCEPTION_TYPES = ['TRAFFIC', 'ACCIDENT', 'ROAD_CONSTRUCTION', 'VEHICLE_BREAKDOWN', 'OTHER'] as const
const DEADLINE_STATUSES = ['OK', 'AT_RISK', 'MISSED'] as const

const isOneOf = <T extends string>(list: readonly T[], value: string): value is T => (list as readonly string[]).includes(value)

/** Icon theo việc, tint theo nghĩa cố định (AGENTS mục 4): xanh dương vận hành, xanh lá xong, hổ phách cần xem lại, xanh lam phân tích. */
const LOOK: Readonly<Record<ServerAuditAction, { icon: LucideIcon; tone: KpiTone }>> = {
  TRIP_UPDATED: { icon: Route, tone: 'blue' },
  TRIP_STATUS_TRANSITION: { icon: Route, tone: 'blue' },
  TRIP_CANCELLED: { icon: Route, tone: 'amber' },
  TRIP_REQUIREMENT_REMOVED: { icon: ClipboardList, tone: 'blue' },
  ROUTE_OPTIMIZED: { icon: Route, tone: 'azure' },
  PLAN_APPROVED: { icon: Boxes, tone: 'green' },
  RERUN_OPTIMIZATION: { icon: Boxes, tone: 'azure' },
  PIN_PLACEMENT: { icon: Pin, tone: 'blue' },
  UNPIN_PLACEMENT: { icon: PinOff, tone: 'blue' },
  WAREHOUSE_CONFIRM: { icon: Package, tone: 'blue' },
  DEVIATION_RECORDED: { icon: TriangleAlert, tone: 'amber' },
  LOADING_COMPLETED: { icon: Package, tone: 'green' },
  DRIVER_UNLOAD: { icon: MapPin, tone: 'blue' },
  STOP_COMPLETED: { icon: MapPin, tone: 'green' },
  TRIP_COMPLETED: { icon: MapPin, tone: 'green' },
  PACKAGE_IMPORT_CONFIRMED: { icon: QrCode, tone: 'blue' },
  DELIVERY_DEADLINE_EXTENDED: { icon: ClipboardList, tone: 'amber' },
  STOP_ARRIVED: { icon: MapPin, tone: 'blue' },
  USER_CREATED: { icon: UserPlus, tone: 'blue' },
  USER_UPDATED: { icon: UserPen, tone: 'blue' },
  USER_LOCKED: { icon: Lock, tone: 'amber' },
  USER_UNLOCKED: { icon: LockOpen, tone: 'green' },
  USER_STATUS_CHANGED: { icon: UserCog, tone: 'blue' },
  USER_PASSWORD_RESET: { icon: KeyRound, tone: 'blue' },
  USER_DELETED: { icon: UserMinus, tone: 'amber' },
  DELIVERY_ISSUE_REPORTED: { icon: TriangleAlert, tone: 'amber' },
  MANUAL_CONFIRM_REQUESTED: { icon: QrCode, tone: 'amber' },
  MANUAL_CONFIRM_APPROVED: { icon: QrCode, tone: 'green' },
  MANUAL_CONFIRM_REJECTED: { icon: QrCode, tone: 'amber' },
  TRIP_EXCEPTION_REPORTED: { icon: TriangleAlert, tone: 'amber' },
  TRIP_EXCEPTION_ESCALATED: { icon: TriangleAlert, tone: 'amber' },
  DEADLINE_RENEGOTIATED: { icon: ClipboardList, tone: 'amber' },
  DELIVERY_ETA_RISK: { icon: Timer, tone: 'amber' },
  CREDIT_LOW_BALANCE: { icon: Coins, tone: 'amber' },
  SUPPORT_TICKET_UPDATED: { icon: LifeBuoy, tone: 'blue' },
}

/** Dòng của bảng nhật ký máy chủ, chữ đã dịch. Đối tượng không có liên kết: máy chủ chỉ trả mã số và mã chuyến, màn chỉ ghi chữ. */
export type ServerAuditRow = {
  readonly id: string
  readonly at: string
  /** Tên người làm; "Hệ thống" khi máy chủ tự ghi. */
  readonly actor: string
  readonly actorInitials: string | null
  readonly actorRole: Role | null
  readonly action: string
  readonly icon: LucideIcon
  readonly tone: KpiTone
  readonly target: string
  /** Mã chuyến (`TRIP-…`) khi máy chủ trả; không thì `#42` theo mã số; vắng với mã không đọc được (`batch`). */
  readonly targetRef: string | null
  readonly company: string
  readonly details: string
  readonly change: AuditChange | null
}

export function serverActionLabel(code: string, t: TFunction): string {
  return isOneOf(SERVER_AUDIT_ACTIONS, code) ? t(`serverAudit.actions.${code}`) : code
}

function statusLabel(value: string | number | boolean | undefined, t: TFunction, account: boolean): string {
  if (typeof value !== 'string') return ''
  if (account) return isOneOf(USER_STATUSES, value) ? t(`serverAudit.userStatuses.${value}`) : value
  return isOneOf(TRIP_STATUSES, value) ? t(`status.${value}`) : value
}

function changedKeys(before: ServerAuditEntry['before'], after: ServerAuditEntry['after']): string[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => before[key] !== after[key])
}

function roleLabel(value: string | number | boolean | undefined, t: TFunction): string | null {
  if (typeof value !== 'string') return null
  const role = roleOfBackend(value)
  return role === null ? value : t(`roles.${role}`)
}

function deadlineLabel(value: string | number | boolean | undefined, format: Formatter): string {
  if (typeof value !== 'string' || value.trim() === '') return ''
  try {
    const iso = isoFromBackend(value)
    return `${format.time(iso)} ${format.date(iso)}`
  } catch {
    return value
  }
}

/** Tài khoản mới: trạng thái ban đầu không phải một lần đổi; yêu cầu hỗ trợ nêu trạng thái bằng chữ (`notificationParts`). */
const NO_STATUS_CHIP: ReadonlySet<string> = new Set(['USER_CREATED', 'SUPPORT_TICKET_UPDATED'])

/**
 * Chi tiết của các việc mà chuông thông báo báo (sự cố trên đường, nguy cơ trễ hạn, sắp hết credit, yêu cầu hỗ trợ): loại sự cố, số
 * phút chậm, điểm giao, mức hạn, số dư, mã và trạng thái yêu cầu — mã dịch qua từ điển, mã lạ bỏ qua.
 */
function notificationParts({ actionType, after }: ServerAuditEntry, t: TFunction, format: Formatter): string[] {
  const parts: string[] = []
  if (actionType === 'TRIP_EXCEPTION_REPORTED' && typeof after.type === 'string' && isOneOf(EXCEPTION_TYPES, after.type)) {
    parts.push(t(`common.tripExceptionTypes.${after.type}`))
  }
  if (typeof after.stopNumber === 'number' && after.stopNumber > 0) parts.push(t('serverAudit.details.stop', { number: format.integer(after.stopNumber) }))
  if (typeof after.delayMinutes === 'number' && after.delayMinutes > 0) {
    parts.push(t('serverAudit.details.delay', { minutes: format.integer(after.delayMinutes) }))
  }
  if (actionType === 'DELIVERY_ETA_RISK' && typeof after.deadlineStatus === 'string' && isOneOf(DEADLINE_STATUSES, after.deadlineStatus)) {
    parts.push(t(`common.deadlineStatuses.${after.deadlineStatus}`))
  }
  if (actionType === 'CREDIT_LOW_BALANCE' && typeof after.balance === 'number') parts.push(t('serverAudit.details.balance', { count: after.balance }))
  if (actionType === 'SUPPORT_TICKET_UPDATED') {
    if (typeof after.ticketCode === 'string') parts.push(t('serverAudit.details.ticket', { code: after.ticketCode }))
    if (after.replied === true) parts.push(t('serverAudit.details.replied'))
    if (typeof after.status === 'string' && isOneOf(TICKET_STATUSES, after.status)) parts.push(t(`serverAudit.ticketStatuses.${after.status}`))
  }
  return parts
}

/**
 * Cột Chi tiết: tóm tắt ngắn từ giá trị trước / sau — trạng thái và hạn giao thành chip "trước → sau", sửa chuyến chỉ nêu tên trường
 * đã đổi (giá trị là mã số), lý do người dùng nhập giữ nguyên. Tối ưu tuyến nêu số điểm, km, phút, số điểm trễ hạn; tài khoản nêu tên và
 * vai trò khi tạo, tên trường khi sửa, trạng thái "trước → sau" khi khoá, mở khoá, xoá.
 */
function summarize(entry: ServerAuditEntry, t: TFunction, format: Formatter): { details: string; change: AuditChange | null } {
  const { before, after } = entry
  const account = entry.entityName === 'User'
  const parts: string[] = []
  if (entry.actionType === 'TRIP_UPDATED') {
    const fields = changedKeys(before, after).map((key) => (isOneOf<TripField>(TRIP_FIELDS, key) ? t(`serverAudit.fields.${key}`) : key))
    if (fields.length > 0) parts.push(t('serverAudit.details.changed', { fields: format.list(fields) }))
  }
  if (entry.actionType === 'USER_CREATED') {
    const name = typeof after.fullName === 'string' && after.fullName.trim() !== '' ? after.fullName.trim() : after.email
    if (typeof name === 'string') parts.push(t('serverAudit.details.account', { name }))
    const role = roleLabel(after.role, t)
    if (role !== null) parts.push(role)
  } else if (entry.actionType === 'USER_UPDATED') {
    const fields = changedKeys(before, after).filter((key) => key !== 'status')
      .map((key) => (isOneOf<UserField>(USER_FIELDS, key) ? t(`serverAudit.userFields.${key}`) : key))
    if (fields.length > 0) parts.push(t('serverAudit.details.changed', { fields: format.list(fields) }))
  }
  if (entry.actionType === 'ROUTE_OPTIMIZED') {
    if (typeof after.stopCount === 'number') parts.push(t('serverAudit.details.stops', { count: after.stopCount }))
    if (typeof after.distanceKm === 'number') parts.push(t('serverAudit.details.distance', { km: format.decimal(after.distanceKm) }))
    if (typeof after.durationMinutes === 'number') parts.push(t('serverAudit.details.duration', { minutes: format.integer(after.durationMinutes) }))
    if (typeof after.deadlineMissedCount === 'number' && after.deadlineMissedCount > 0) {
      parts.push(t('serverAudit.details.lateStops', { count: after.deadlineMissedCount }))
    }
  }
  if (typeof after.stopSequence === 'number' && after.stopSequence > 0) {
    parts.push(t('serverAudit.details.stop', { number: format.integer(after.stopSequence) }))
  }
  if (typeof after.version === 'number') parts.push(t('serverAudit.details.version', { version: format.integer(after.version) }))
  if (typeof after.pinnedCount === 'number') parts.push(t('serverAudit.details.pinned', { count: after.pinnedCount }))
  if (typeof after.totalImported === 'number') parts.push(t('serverAudit.details.imported', { count: after.totalImported }))
  if (typeof after.loadedPackages === 'number' && after.loadedPackages > 0) {
    parts.push(t('serverAudit.details.loaded', { count: after.loadedPackages }))
  }
  parts.push(...notificationParts(entry, t, format))
  const escalation = entry.actionType === 'TRIP_EXCEPTION_ESCALATED' && typeof after.reason === 'string' && isOneOf(ESCALATION_REASONS, after.reason)
  if (escalation) parts.push(t(`serverAudit.escalationReasons.${after.reason as (typeof ESCALATION_REASONS)[number]}`))
  else if (typeof after.reason === 'string' && after.reason.trim() !== '') parts.push(t('serverAudit.details.reason', { reason: after.reason.trim() }))
  const rest = parts.join(' · ')

  let change: AuditChange | null = null
  if (!NO_STATUS_CHIP.has(entry.actionType) && (before.status !== undefined || after.status !== undefined)) {
    change = {
      rest, field: t('serverAudit.details.status'), before: statusLabel(before.status, t, account), after: statusLabel(after.status, t, account),
    }
  } else if (entry.actionType === 'DELIVERY_DEADLINE_EXTENDED') {
    change = { rest, field: t('serverAudit.details.deadline'), before: deadlineLabel(before.deadline, format), after: deadlineLabel(after.deadline, format) }
  } else if (entry.actionType === 'DEADLINE_RENEGOTIATED') {
    change = { rest, field: t('serverAudit.details.deadline'), before: deadlineLabel(before.deadline, format), after: deadlineLabel(after.newDeadline, format) }
  }
  const details = change === null ? rest : [rest, `${change.field ?? ''} ${change.before || '—'} → ${change.after || '—'}`].filter(Boolean).join(' · ')
  return { details, change }
}

export function serverAuditRow(entry: ServerAuditEntry, t: TFunction, format: Formatter): ServerAuditRow {
  const look = isOneOf(SERVER_AUDIT_ACTIONS, entry.actionType) ? LOOK[entry.actionType] : { icon: ScrollText, tone: 'slate' as const }
  const entity = entry.entityName ?? ''
  return {
    id: entry.id,
    at: entry.at,
    actor: entry.actorName ?? t('audit.log.system'),
    actorInitials: entry.actorName === null ? null : actorInitials(entry.actorName),
    actorRole: entry.actorRole,
    action: serverActionLabel(entry.actionType, t),
    icon: look.icon,
    tone: look.tone,
    target: isOneOf<ServerAuditEntity>(ENTITIES, entity) ? t(`serverAudit.entities.${entity}`) : entity,
    targetRef: entry.entityCode ?? (entry.entityId !== null && /^\d+$/.test(entry.entityId) ? `#${entry.entityId}` : null),
    company: entry.companyName ?? t('audit.log.platform'),
    ...summarize(entry, t, format),
  }
}
