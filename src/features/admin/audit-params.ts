import { HANDLING_CLASSES } from '@/domain/models'
import { REROUTE_ROUTES, type DeadlineStatus } from '@/domain/routing'
import type { Formatter } from '@/lib/format'
import type { TFunction } from '@/lib/i18n'
import {
  CONTACT_REQUEST_TYPES,
  CONTACT_STATUSES,
  DELIVERY_ISSUE_KINDS,
  EXCEPTION_ESCALATIONS,
  MANUAL_CONFIRM_REASONS,
  OPTIMIZATION_ALGORITHMS,
  OPTIMIZATION_OBJECTIVES,
  PACKAGE_CHANGE_FIELDS,
  PACKAGE_FLAGS,
  REQUIREMENT_PRIORITIES,
  PACKAGE_STATUSES,
  REPLAN_REASONS,
  RUN_FAILURE_CODES,
  TICKET_KINDS,
  TICKET_STATUSES,
  TRIP_EXCEPTION_TYPES,
  VERIFY_CONTEXTS,
  type AuditEvent,
} from '@/lib/mock-db'
import { ROLES } from '@/types/user'
import type { AuditDirectory } from './audit-log'

/**
 * Tham số của một sự kiện nhật ký (LM-091): nhãn (`audit.log.params`) và giá trị đã dịch, format theo ngôn ngữ. Kho chỉ ghi mã và số;
 * chữ người dùng nhập (lý do huỷ, ghi chú) giữ nguyên. Tách khỏi `audit-log.ts` để mỗi file một việc: file đó dựng dòng nhật ký, file này
 * đọc từng tham số. Thêm tham số mới vào `ctx.log` của kho thì thêm khoá vào `PARAM_KEYS` và nhãn vào từ điển.
 */

/** Tham số kho ghi (`ctx.log`) có nhãn trong từ điển `audit.log.params`. */
const PARAM_KEYS = [
  'name', 'fullName', 'role', 'email', 'fields', 'reason', 'note', 'revisionId', 'sourceRevisionId', 'placed', 'unplaced', 'edits',
  'loaded', 'returned', 'damaged', 'supporting', 'requirementId', 'packageInstanceId', 'stopNumber', 'kind', 'stops', 'issues', 'packageId', 'field', 'before', 'after',
  // LM-104
  'count', 'packageTypeId', 'lastPackageId', 'destinationName', 'priority', 'tripId', 'objective', 'runId', 'algorithm', 'reasonCode', 'vehicleTypeId',
  'sealNumber', 'packageCode', 'flag',
  // Phân tách hàng, tối ưu tuyến (FE-4b-06, FE-4b-09)
  'handlingClass', 'conflictCount', 'totalKm', 'totalMinutes', 'lateStops',
  // Xác nhận tay (FE-6-03, FE-6-04)
  'verifyContext', 'manualReason', 'requestedBy',
  // Nguy cơ trễ hạn theo vị trí xe (FE-6-09)
  'deadlineStatus', 'eta', 'deadline',
  // Sự cố cấp chuyến, tuyến thay thế, gia hạn (FE-6-11, FE-6-12)
  'exceptionId', 'exceptionType', 'delayMinutes', 'escalation', 'route', 'requirementId',
  // Nhận hàng dọc đường (FE-7-03 → FE-7-05); tài xế của chuyến và tài xế vừa bị thay — người chuông của tài xế báo
  'pickupId', 'failedRules', 'driverId', 'previousDriverId',
  // Kho soạn lại hàng sau khi chuyến quay về Đã lập kế hoạch (FE-6-02, FE-6-05): lý do lần quay về
  'replanReason',
  // Gói cước và credit (FE-8-01, FE-8-05)
  'plan', 'credits', 'balance',
  // Yêu cầu hỗ trợ (FE-8-07)
  'ticketKind', 'ticketStatus',
  // Yêu cầu liên hệ của khách
  'contactType', 'contactStatus', 'assignedTo',
] as const

const FIELD_NAMES = [
  'name', 'vehicleId', 'stops', 'packages', 'scheduledDate', 'departureAt', 'departureDepot', 'driverId', 'fullName', 'email', 'phone', 'role', 'depot',
  // Yêu cầu giao (FE-4b-01)
  'destinationName', 'address', 'lat', 'lng', 'deadline', 'priority', 'note', 'packageIds',
  // Công ty (FE-8-06)
  'companyName',
  // Yêu cầu liên hệ của khách
  'status', 'assignedToId',
] as const

const REASONS = ['suspended'] as const

const DEADLINE_STATUSES = ['OK', 'AT_RISK', 'MISSED'] as const satisfies readonly DeadlineStatus[]

function isOneOf<const Values extends readonly string[]>(values: Values, value: string): value is Values[number] {
  return values.includes(value)
}

export function paramLabel(key: string, t: TFunction): string {
  return isOneOf(PARAM_KEYS, key) ? t(`audit.log.params.${key}`) : key
}

export function paramValue(event: AuditEvent, key: string, value: string | number, directory: AuditDirectory, t: TFunction, format: Formatter): string {
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
    case 'deadlineStatus':
      return isOneOf(DEADLINE_STATUSES, value) ? t(`common.deadlineStatuses.${value}`) : value
    case 'eta':
    case 'deadline':
      // Mốc giờ kho ghi dạng ISO: hiện theo ngôn ngữ đang chọn
      return t('audit.log.dateTime', { time: format.time(value), date: format.dayMonth(value) })
    case 'role':
      return isOneOf(ROLES, value) ? t(`roles.${value}`) : value
    // LM-104: mã của kho dịch qua nhánh của màn
    case 'objective':
      return isOneOf(OPTIMIZATION_OBJECTIVES, value) ? t(`runs.objectives.${value}`) : value
    case 'algorithm':
      return isOneOf(OPTIMIZATION_ALGORITHMS, value) ? t(`runs.algorithms.${value}`) : value
    case 'reasonCode':
      return isOneOf(RUN_FAILURE_CODES, value) ? t(`runs.failures.${value}`) : value
    // Xác nhận tay (FE-6-03, FE-6-04): bước và lý do là mã của kho; người gửi là mã người dùng
    case 'verifyContext':
      return isOneOf(VERIFY_CONTEXTS, value) ? t(`common.verifyContexts.${value}`) : value
    case 'manualReason':
      return isOneOf(MANUAL_CONFIRM_REASONS, value) ? t(`common.manualConfirmReasons.${value}`) : value
    // Sự cố cấp chuyến (FE-6-11): loại, lý do chuyển quản lý và tuyến thay thế là mã của kho
    case 'exceptionType':
      return isOneOf(TRIP_EXCEPTION_TYPES, value) ? t(`common.tripExceptionTypes.${value}`) : value
    case 'replanReason':
      return isOneOf(REPLAN_REASONS, value) ? t(`audit.log.replanReasons.${value}`) : value
    case 'escalation':
      return isOneOf(EXCEPTION_ESCALATIONS, value) ? t(`audit.log.escalations.${value}`) : value
    case 'route':
      return isOneOf(REROUTE_ROUTES, value) ? t(`monitoring.reroute.routes.${value}`) : value
    case 'ticketKind':
      return isOneOf(TICKET_KINDS, value) ? t(`support.kinds.${value}`) : value
    case 'ticketStatus':
      return isOneOf(TICKET_STATUSES, value) ? t(`support.statuses.${value}`) : value
    case 'contactType':
      return isOneOf(CONTACT_REQUEST_TYPES, value) ? t(`contacts.types.${value}`) : value
    case 'contactStatus':
      return isOneOf(CONTACT_STATUSES, value) ? t(`contacts.statuses.${value}`) : value
    case 'assignedTo':
    case 'requestedBy':
    case 'driverId':
    case 'previousDriverId':
      return directory.users.get(value) ?? t('audit.log.deletedUser', { id: value })
    case 'reason':
      // Lý do huỷ chuyến là chữ người dùng nhập; lý do đăng nhập sai là mã của kho
      return event.action === 'auth.signInFailed' && isOneOf(REASONS, value) ? t(`audit.log.reasons.${value}`) : value
    default:
      return value
  }
}
