import type { Permission } from '@/features/auth/permissions'
import type { Formatter } from '@/lib/format'
import { HANDLING_CLASSES } from '@/domain/models'
import type { TFunction } from '@/lib/i18n'
import {
  DELIVERY_ISSUE_KINDS,
  OPTIMIZATION_ALGORITHMS,
  OPTIMIZATION_OBJECTIVES,
  PACKAGE_CHANGE_FIELDS,
  PACKAGE_FLAGS,
  REQUIREMENT_PRIORITIES,
  PACKAGE_STATUSES,
  RUN_FAILURE_CODES,
  type AuditAction,
  type AuditEvent,
  type AuditTargetType,
} from '@/lib/mock-db'
import { ROLES, type Role } from '@/types/user'
import { actorInitials } from './audit-look'

/** Tên hiện của đối tượng trong kho lúc đọc nhật ký: mã → tên. Đối tượng đã xoá không có ở đây. */
export type AuditDirectory = {
  readonly users: ReadonlyMap<string, string>
  readonly trips: ReadonlyMap<string, string>
  readonly vehicles: ReadonlyMap<string, string>
  /** Vai trò hiện tại theo mã người dùng — chỉ màn `/nhat-ky` cần (dòng phụ dưới tên người làm); chuông thông báo bỏ trống. */
  readonly roles?: ReadonlyMap<string, Role>
}

/** Một dòng nhật ký đã dịch cho bảng `/nhat-ky` (LM-091). */
export type AuditRow = {
  readonly id: string
  /** ISO 8601, giữ nguyên để sắp xếp; ô bảng format theo ngôn ngữ. */
  readonly at: string
  readonly actorId: string | null
  readonly actor: string
  readonly action: string
  /**
   * `label` vắng khi kho không còn tên (email lạ khi đăng nhập sai); `href` vắng khi đối tượng không còn trang để mở, hoặc người xem
   * không có quyền mở trang đó (FE-0-03: quản trị hệ thống và quản trị công ty đọc nhật ký nhưng không xem được chuyến, xe).
   */
  readonly target: { readonly id: string; readonly label: string | null; readonly href: string | null }
  readonly details: string
}

/** Dòng của bảng `/nhat-ky` (V2): thêm mã hành động (icon + tint) và ô đại diện của người làm. */
export type AuditLogRow = AuditRow & {
  readonly actionCode: AuditAction
  /** Vắng khi người làm không còn là một tài khoản trong kho (hệ thống, chưa đăng nhập, đã xoá). */
  readonly actorInitials: string | null
  /** Vai trò **hiện tại** của người làm, đã dịch; vắng khi kho không trả vai trò. */
  readonly actorRole: string | null
}

/** Tham số kho ghi (`ctx.log`) có nhãn trong từ điển `audit.log.params`. */
const PARAM_KEYS = [
  'name', 'fullName', 'role', 'email', 'fields', 'reason', 'note', 'revisionId', 'sourceRevisionId', 'placed', 'unplaced', 'edits',
  'loaded', 'missing', 'packageInstanceId', 'stopNumber', 'kind', 'stops', 'issues', 'packageId', 'field', 'before', 'after',
  // LM-104
  'count', 'packageTypeId', 'lastPackageId', 'destinationName', 'priority', 'tripId', 'objective', 'runId', 'algorithm', 'reasonCode', 'vehicleTypeId',
  'sealNumber', 'packageCode', 'flag',
  // Phân tách hàng, tối ưu tuyến (FE-4b-06, FE-4b-09)
  'handlingClass', 'conflictCount', 'totalKm', 'totalMinutes', 'lateStops',
] as const

const FIELD_NAMES = [
  'name', 'vehicleId', 'stops', 'packages', 'scheduledDate', 'departureAt', 'departureDepot', 'driverId', 'fullName', 'email', 'phone', 'role', 'depot',
  // Yêu cầu giao (FE-4b-01)
  'destinationName', 'address', 'lat', 'lng', 'deadline', 'priority', 'note', 'packageIds',
] as const

const REASONS = ['suspended'] as const

/** Quyền mở trang của từng loại đối tượng — cùng nhóm quyền với route của trang đó trong `App.tsx`; `null` khi loại đó không có trang. */
const TARGET_PERMISSION: Readonly<Record<AuditTargetType, Permission | null>> = {
  trip: 'trips.view',
  vehicle: 'fleet.view',
  user: 'users.manage',
  revision: null,
  packageType: 'packages.manage',
  package: 'packages.view',
  requirement: 'requirements.view',
  vehicleType: 'fleet.view',
}

/** `can(permission)` của người xem (`useCan`): đối tượng chỉ thành liên kết khi người xem mở được trang đích. */
export type CanOpen = (permission: Permission) => boolean

function isOneOf<const Values extends readonly string[]>(values: Values, value: string): value is Values[number] {
  return values.includes(value)
}

/**
 * Đọc một sự kiện nhật ký (D-43) bằng ngôn ngữ đang chọn: người làm, hành động (`audit.actions.*`), đối tượng (tên hiện tại, liên kết
 * nếu còn trang và người xem có quyền mở trang đó), chi tiết (tham số đã dịch và format). Hàm thuần: `directory` do `audit-api.ts`
 * đọc từ kho, `can` là quyền của người xem.
 */
export function describeEvent(event: AuditEvent, directory: AuditDirectory, t: TFunction, format: Formatter, can: CanOpen): AuditRow {
  return {
    id: event.id,
    at: event.at,
    actorId: event.actorId,
    actor: actorLabel(event, directory, t),
    action: t(`audit.actions.${event.action}`),
    target: targetOf(event, directory, can),
    details: Object.entries(event.params)
      .map(([key, value]) => t('audit.log.detail', { label: paramLabel(key, t), value: paramValue(event, key, value, t, format) }))
      .join(' · '),
  }
}

/** Một dòng của bảng `/nhat-ky`: `describeEvent` cộng những gì chỉ bảng cần. Hàm thuần như `describeEvent`. */
export function describeLogRow(event: AuditEvent, directory: AuditDirectory, t: TFunction, format: Formatter, can: CanOpen): AuditLogRow {
  const name = event.actorId === null ? undefined : directory.users.get(event.actorId)
  const role = event.actorId === null ? undefined : directory.roles?.get(event.actorId)
  return {
    ...describeEvent(event, directory, t, format, can),
    actionCode: event.action,
    actorInitials: name === undefined ? null : actorInitials(name),
    actorRole: role === undefined ? null : t(`roles.${role}`),
  }
}

function actorLabel({ actorId, action }: AuditEvent, directory: AuditDirectory, t: TFunction): string {
  if (actorId === null) return action === 'auth.signInFailed' ? t('audit.log.anonymous') : t('audit.log.system')
  return directory.users.get(actorId) ?? t('audit.log.deletedUser', { id: actorId })
}

/** Đối tượng của sự kiện; liên kết chỉ giữ khi người xem có quyền mở trang đích — không thì tên hiện dạng chữ thường. */
function targetOf(event: AuditEvent, directory: AuditDirectory, can: CanOpen): AuditRow['target'] {
  const target = linkedTarget(event, directory)
  const permission = TARGET_PERMISSION[event.target.type]
  return target.href !== null && permission !== null && can(permission) ? target : { ...target, href: null }
}

function linkedTarget({ target, params }: AuditEvent, directory: AuditDirectory): AuditRow['target'] {
  const saved = typeof params.name === 'string' ? params.name : typeof params.fullName === 'string' ? params.fullName : null
  const id = target.id
  switch (target.type) {
    case 'trip': {
      const name = directory.trips.get(id)
      return { id, label: name ?? saved, href: name === undefined ? null : `/chuyen/${encodeURIComponent(id)}` }
    }
    case 'vehicle': {
      const name = directory.vehicles.get(id)
      return { id, label: name ?? saved, href: name === undefined ? null : `/doi-xe/${encodeURIComponent(id)}` }
    }
    case 'user': {
      const name = directory.users.get(id)
      // Người dùng chưa có trang riêng: mở danh sách lọc đúng mã đó
      return { id, label: name ?? saved, href: name === undefined ? null : `/nguoi-dung?q=${encodeURIComponent(id)}` }
    }
    case 'revision':
      return { id, label: null, href: null }
    // Review 1 (LM-104): mở màn danh sách / chi tiết của đối tượng
    case 'packageType':
      return { id, label: saved, href: '/loai-kien' }
    case 'package':
      return { id, label: saved, href: `/kien-hang?q=${encodeURIComponent(id)}` }
    case 'requirement':
      // Yêu cầu đã xoá vẫn đọc được tên điểm đến từ tham số của sự kiện; liên kết mở danh sách lọc đúng mã (rỗng nếu đã xoá)
      return { id, label: typeof params.destinationName === 'string' ? params.destinationName : saved, href: `/yeu-cau-giao?q=${encodeURIComponent(id)}` }
    case 'vehicleType':
      return { id, label: saved, href: '/doi-xe/loai-xe' }
  }
}

function paramLabel(key: string, t: TFunction): string {
  return isOneOf(PARAM_KEYS, key) ? t(`audit.log.params.${key}`) : key
}

function paramValue(event: AuditEvent, key: string, value: string | number, t: TFunction, format: Formatter): string {
  // Quãng đường của tuyến giữ số lẻ; số khác là số đếm
  if (typeof value === 'number') return key === 'totalKm' ? format.decimal(value) : format.integer(value)
  switch (key) {
    case 'fields':
      return format.list(value.split(',').map((field) => (isOneOf(FIELD_NAMES, field) ? t(`audit.log.fieldNames.${field}`) : field)))
    case 'field':
      // Trường của một dòng kiện vừa sửa (V2.3, quyết định 2)
      return isOneOf(PACKAGE_CHANGE_FIELDS, value) ? t(`audit.log.packageFields.${value}`) : value
    case 'flag':
      return isOneOf(PACKAGE_FLAGS, value) ? t(`common.packageFlags.${value}`) : value
    case 'handlingClass':
      return isOneOf(HANDLING_CLASSES, value) ? t(`common.handlingClasses.${value}`) : value
    case 'priority':
      return isOneOf(REQUIREMENT_PRIORITIES, value) ? t(`requirements.priority.${value}`) : value
    case 'before':
    case 'after':
      // Trạng thái kiện là mã của kho; giá trị trước / sau của một dòng kiện vừa sửa là dữ liệu
      return event.action === 'package.statusChanged' && isOneOf(PACKAGE_STATUSES, value) ? t(`common.packageStatuses.${value}`) : value
    case 'kind':
      return isOneOf(DELIVERY_ISSUE_KINDS, value) ? t(`common.deliveryIssueKinds.${value}`) : value
    case 'role':
      return isOneOf(ROLES, value) ? t(`roles.${value}`) : value
    // LM-104: mã của kho dịch qua nhánh của màn
    case 'objective':
      return isOneOf(OPTIMIZATION_OBJECTIVES, value) ? t(`runs.objectives.${value}`) : value
    case 'algorithm':
      return isOneOf(OPTIMIZATION_ALGORITHMS, value) ? t(`runs.algorithms.${value}`) : value
    case 'reasonCode':
      return isOneOf(RUN_FAILURE_CODES, value) ? t(`runs.failures.${value}`) : value
    case 'reason':
      // Lý do huỷ chuyến là chữ người dùng nhập; lý do đăng nhập sai là mã của kho
      return event.action === 'auth.signInFailed' && isOneOf(REASONS, value) ? t(`audit.log.reasons.${value}`) : value
    default:
      return value
  }
}
