import { Boxes, ClipboardList, MapPin, Package, Pin, PinOff, QrCode, Route, ScrollText, TriangleAlert, type LucideIcon } from 'lucide-react'
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
  'TRIP_UPDATED', 'TRIP_STATUS_TRANSITION', 'TRIP_CANCELLED', 'TRIP_REQUIREMENT_REMOVED', 'ROUTE_OPTIMIZED', 'RERUN_OPTIMIZATION',
  'PIN_PLACEMENT', 'UNPIN_PLACEMENT', 'WAREHOUSE_CONFIRM', 'DEVIATION_RECORDED', 'LOADING_COMPLETED', 'DRIVER_UNLOAD', 'STOP_COMPLETED',
  'TRIP_COMPLETED', 'PACKAGE_IMPORT_CONFIRMED', 'DELIVERY_DEADLINE_EXTENDED',
] as const
export type ServerAuditAction = (typeof SERVER_AUDIT_ACTIONS)[number]

const ENTITIES = [
  'Trip', 'DeliveryStop', 'UnloadConfirmation', 'PACKAGE', 'LoadPlan', 'PackagePlacement', 'DeliveryRequirement', 'PlacementConfirmation',
  'Deviation', 'LoadingExecution',
] as const
type ServerAuditEntity = (typeof ENTITIES)[number]

const TRIP_FIELDS = ['tripName', 'departureTime', 'originWarehouseId', 'vehicleId', 'driverId'] as const
type TripField = (typeof TRIP_FIELDS)[number]

const isOneOf = <T extends string>(list: readonly T[], value: string): value is T => (list as readonly string[]).includes(value)

/** Icon theo việc, tint theo nghĩa cố định (AGENTS mục 4): xanh dương vận hành, xanh lá xong, hổ phách cần xem lại, xanh lam phân tích. */
const LOOK: Readonly<Record<ServerAuditAction, { icon: LucideIcon; tone: KpiTone }>> = {
  TRIP_UPDATED: { icon: Route, tone: 'blue' },
  TRIP_STATUS_TRANSITION: { icon: Route, tone: 'blue' },
  TRIP_CANCELLED: { icon: Route, tone: 'amber' },
  TRIP_REQUIREMENT_REMOVED: { icon: ClipboardList, tone: 'blue' },
  ROUTE_OPTIMIZED: { icon: Route, tone: 'azure' },
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
}

/** Dòng của bảng nhật ký máy chủ, chữ đã dịch. Đối tượng không có liên kết: máy chủ chỉ trả mã số, không phải mã trên URL. */
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
  /** `#42` khi máy chủ trả mã số; vắng với mã không đọc được (`batch`). */
  readonly targetRef: string | null
  readonly company: string
  readonly details: string
  readonly change: AuditChange | null
}

export function serverActionLabel(code: string, t: TFunction): string {
  return isOneOf(SERVER_AUDIT_ACTIONS, code) ? t(`serverAudit.actions.${code}`) : code
}

function statusLabel(value: string | number | boolean | undefined, t: TFunction): string {
  if (typeof value !== 'string') return ''
  return isOneOf(TRIP_STATUSES, value) ? t(`status.${value}`) : value
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

/**
 * Cột Chi tiết: tóm tắt ngắn từ giá trị trước / sau — trạng thái và hạn giao thành chip "trước → sau", sửa chuyến chỉ nêu tên trường
 * đã đổi (giá trị là mã số), lý do người dùng nhập giữ nguyên; phần còn lại (cả phương án tuyến của `ROUTE_OPTIMIZED`) không hiện.
 */
function summarize(entry: ServerAuditEntry, t: TFunction, format: Formatter): { details: string; change: AuditChange | null } {
  const { before, after } = entry
  const parts: string[] = []
  if (entry.actionType === 'TRIP_UPDATED') {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => before[key] !== after[key])
    const fields = keys.map((key) => (isOneOf<TripField>(TRIP_FIELDS, key) ? t(`serverAudit.fields.${key}`) : key))
    if (fields.length > 0) parts.push(t('serverAudit.details.changed', { fields: format.list(fields) }))
  }
  if (typeof after.version === 'number') parts.push(t('serverAudit.details.version', { version: format.integer(after.version) }))
  if (typeof after.pinnedCount === 'number') parts.push(t('serverAudit.details.pinned', { count: after.pinnedCount }))
  if (typeof after.totalImported === 'number') parts.push(t('serverAudit.details.imported', { count: after.totalImported }))
  if (typeof after.loadedPackages === 'number' && after.loadedPackages > 0) {
    parts.push(t('serverAudit.details.loaded', { count: after.loadedPackages }))
  }
  if (typeof after.reason === 'string' && after.reason.trim() !== '') parts.push(t('serverAudit.details.reason', { reason: after.reason.trim() }))
  const rest = parts.join(' · ')

  let change: AuditChange | null = null
  if (before.status !== undefined || after.status !== undefined) {
    change = { rest, field: t('serverAudit.details.status'), before: statusLabel(before.status, t), after: statusLabel(after.status, t) }
  } else if (entry.actionType === 'DELIVERY_DEADLINE_EXTENDED') {
    change = { rest, field: t('serverAudit.details.deadline'), before: deadlineLabel(before.deadline, format), after: deadlineLabel(after.deadline, format) }
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
    targetRef: entry.entityId !== null && /^\d+$/.test(entry.entityId) ? `#${entry.entityId}` : null,
    company: entry.companyName ?? t('audit.log.platform'),
    ...summarize(entry, t, format),
  }
}
