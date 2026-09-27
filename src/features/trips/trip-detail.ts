import {
  isStale,
  latestApproved,
  PACKAGE_CHANGE_FIELDS,
  type AuditEvent,
  type DeliveryProgress,
  type PackageChangeField,
  type Revision,
  type Trip,
} from '@/lib/mock-db'
import type { StopRow } from './trip-summary'

/** Lần sửa làm bản duyệt lỗi thời, đọc từ nhật ký (V2.3, quyết định 2). */
export type StaleEdit = {
  /** ISO 8601 */
  readonly at: string
  readonly actorId: string | null
  /** Trường của chuyến đã sửa (`vehicleId`, `packages`…), theo thứ tự kho ghi. */
  readonly fields: readonly string[]
  /** Có khi lần sửa đổi đúng một giá trị của một dòng kiện. */
  readonly packageId?: string
  readonly field?: PackageChangeField
  readonly before?: string | number
  readonly after?: string | number
}

export type StaleReason = {
  /** Bản đã duyệt lỗi thời — bản kho sẽ làm theo nếu không duyệt lại. */
  readonly revisionId: string
  /** Lần sửa xe hoặc kiện mới nhất sau lúc duyệt; vắng khi nhật ký không còn sự kiện đó. */
  readonly edit: StaleEdit | null
}

/** Sửa những trường này làm tăng `inputVersion` và làm bản duyệt lỗi thời (D-31). */
const INPUT_FIELDS = new Set(['vehicleId', 'packages'])

/**
 * Vì sao chuyến "Cần xem lại": bản duyệt mới nhất lỗi thời trong pha lập kế hoạch, kèm lần sửa xe/kiện mới nhất sau lúc duyệt.
 * `events` là nhật ký của chuyến, mới nhất trước (`listEvents`). Không lỗi thời thì `null`.
 */
export function staleReason(
  trip: Pick<Trip, 'phase' | 'inputVersion'>,
  revisions: readonly Revision[],
  events: readonly AuditEvent[],
): StaleReason | null {
  const approved = latestApproved(revisions)
  if (trip.phase !== 'planning' || approved?.approvedAt === undefined || !isStale(approved, trip)) return null
  const since = approved.approvedAt
  const event = events.find(
    (item) => item.action === 'trip.updated' && item.at >= since && fieldsOf(item).some((field) => INPUT_FIELDS.has(field)),
  )
  return { revisionId: approved.id, edit: event ? editOf(event) : null }
}

function fieldsOf(event: AuditEvent): string[] {
  const { fields } = event.params
  return typeof fields === 'string' && fields !== '' ? fields.split(',') : []
}

function editOf(event: AuditEvent): StaleEdit {
  const { packageId, field, before, after } = event.params
  const known = typeof field === 'string' && PACKAGE_CHANGE_FIELDS.some((name) => name === field)
  return {
    at: event.at,
    actorId: event.actorId,
    fields: fieldsOf(event),
    ...(typeof packageId === 'string' ? { packageId } : {}),
    ...(known && before !== undefined && after !== undefined ? { field: field as PackageChangeField, before, after } : {}),
  }
}

/** Số tổng hợp của sơ đồ tuyến khi chuyến đang giao hoặc đã hoàn thành (V2.3). */
export type RouteProgress = {
  readonly stops: { readonly done: number; readonly total: number }
  /** Kiện tài xế đã dỡ trên tổng kiện của các điểm giao. */
  readonly packages: { readonly done: number; readonly total: number }
  readonly issues: number
  readonly departedAt: string
  readonly completedAt?: string
  /** Theo số điểm giao: kiện đã dỡ và số sự cố tại điểm. */
  readonly byStop: ReadonlyMap<number, { readonly unloaded: number; readonly issues: number }>
}

export function routeProgress(stops: readonly StopRow[], delivery: DeliveryProgress): RouteProgress {
  const byStop = new Map(stops.map((stop) => {
    const progress = delivery.stops.find((item) => item.number === stop.number)
    const issues = delivery.issues.filter((issue) => issue.stopNumber === stop.number).length
    return [stop.number, { unloaded: progress?.unloadedIds.length ?? 0, issues }]
  }))
  return {
    stops: { done: delivery.stops.filter((stop) => stop.completedAt !== undefined).length, total: stops.length },
    packages: {
      done: [...byStop.values()].reduce((sum, stop) => sum + stop.unloaded, 0),
      total: stops.reduce((sum, stop) => sum + stop.packageCount, 0),
    },
    issues: delivery.issues.length,
    departedAt: delivery.startedAt,
    ...(delivery.completedAt === undefined ? {} : { completedAt: delivery.completedAt }),
    byStop,
  }
}
