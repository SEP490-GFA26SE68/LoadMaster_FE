import { expandPackages } from '@/domain/cargo'
import { isStale, latestApproved, plannedStops, type AuditAction, type AuditEvent, type Revision, type Trip } from '@/lib/mock-db'

/**
 * Tiến trình của chuyến ở Chi tiết chuyến (LM-088, D-45, D-47): tạo → tối ưu → duyệt → xếp → xếp xong → giao → hoàn thành, hoặc
 * dừng ở "đã huỷ". Mọi mốc lấy từ kho — thời điểm và người làm từ tiến độ vận hành của chuyến và từ nhật ký — không mốc nào bịa ra.
 */
export const PROGRESS_STEPS = ['created', 'optimized', 'approved', 'loading', 'loaded', 'delivering', 'completed'] as const

export type ProgressStepKind = (typeof PROGRESS_STEPS)[number] | 'cancelled'

/** `current`: bước đang diễn ra (kho đang xếp, tài xế đang giao). */
export type ProgressState = 'done' | 'current' | 'pending'

export type ProgressStep = {
  readonly kind: ProgressStepKind
  readonly state: ProgressState
  /** ISO 8601, khi bước đã bắt đầu. */
  readonly at?: string
  /** Người làm; `null` khi kho không ghi người (seed, không có phiên). */
  readonly actorId?: string | null
  /** Bước xếp hàng: kiện đã xếp, kiện kho báo thiếu, tổng kiện của phương án kho làm theo. */
  readonly loading?: { readonly loaded: number; readonly missing: number; readonly total: number }
  /** Bước giao hàng: số điểm đã hoàn tất trên tổng số điểm. */
  readonly delivery?: { readonly done: number; readonly total: number }
  /** Bước huỷ: lý do người huỷ nhập. */
  readonly reason?: string
  /** Bước duyệt: bản đã duyệt lỗi thời vì xe hoặc kiện đổi sau lần tối ưu (D-31) — kho chỉ xếp được sau khi duyệt lại. */
  readonly stale?: boolean
  /**
   * Bước chờ tới đầu tiên khi không có bước nào đang diễn ra: `next` là việc tiếp theo, `waitApproval` khi bản duyệt lỗi thời nên
   * kho phải chờ duyệt lại. Chuyến đã hoàn thành hoặc đã huỷ không có.
   */
  readonly note?: 'next' | 'waitApproval'
}

type ProgressTrip = Pick<Trip, 'phase' | 'createdAt' | 'loading' | 'delivery' | 'cancellation' | 'inputVersion'>

/**
 * `revisions` theo thứ tự kho trả (cũ trước); `events` là nhật ký của chuyến, mới nhất trước (`listEvents`). Chuyến đã huỷ chỉ giữ
 * các bước đã xong rồi tới bước "đã huỷ"; chuyến khác hiện đủ bảy bước, bước chưa tới là `pending`.
 */
export function tripProgress(trip: ProgressTrip, revisions: readonly Revision[], events: readonly AuditEvent[]): ProgressStep[] {
  const actorOf = (action: AuditAction, revisionId?: string) =>
    events.find((event) => event.action === action && (revisionId === undefined || event.params.revisionId === revisionId))?.actorId ?? null
  const optimized = revisions.findLast((revision) => revision.approvedAt === undefined)
  const approved = latestApproved(revisions)
  const { loading, delivery } = trip
  // Chỉ pha lập kế hoạch mới "lỗi thời": từ lúc kho xếp, xe và kiện đã khoá theo bản duyệt kho làm theo
  const stale = trip.phase === 'planning' && approved !== undefined && isStale(approved, trip)

  const steps: ProgressStep[] = [
    { kind: 'created', state: 'done', at: trip.createdAt, actorId: actorOf('trip.created') },
    optimized
      ? { kind: 'optimized', state: 'done', at: optimized.createdAt, actorId: actorOf('optimization.saved', optimized.id) }
      : { kind: 'optimized', state: 'pending' },
    approved?.approvedAt
      ? { kind: 'approved', state: 'done', at: approved.approvedAt, actorId: actorOf('revision.approved', approved.id), ...(stale ? { stale } : {}) }
      : { kind: 'approved', state: 'pending' },
    loading
      ? {
          kind: 'loading',
          state: trip.phase === 'loading' ? 'current' : 'done',
          at: loading.startedAt,
          actorId: loading.startedBy,
          loading: loadingCounts(loading, revisions),
        }
      : { kind: 'loading', state: 'pending' },
    loading?.completedAt
      ? { kind: 'loaded', state: 'done', at: loading.completedAt, actorId: actorOf('loading.completed') }
      : { kind: 'loaded', state: 'pending' },
    delivery
      ? {
          kind: 'delivering',
          state: trip.phase === 'delivering' ? 'current' : 'done',
          at: delivery.startedAt,
          actorId: delivery.startedBy,
          delivery: { done: delivery.stops.filter((stop) => stop.completedAt !== undefined).length, total: delivery.stops.length },
        }
      : { kind: 'delivering', state: 'pending' },
    delivery?.completedAt
      ? { kind: 'completed', state: 'done', at: delivery.completedAt, actorId: actorOf('delivery.completed') }
      : { kind: 'completed', state: 'pending' },
  ]

  const { cancellation } = trip
  if (trip.phase !== 'cancelled' || !cancellation) {
    if (steps.some((item) => item.state === 'current')) return steps
    const next = steps.findIndex((item) => item.state === 'pending')
    return steps.map((item, index) => (index === next ? { ...item, note: stale ? 'waitApproval' : 'next' } : item))
  }
  return [
    ...steps.filter((step) => step.state !== 'pending'),
    { kind: 'cancelled', state: 'done', at: cancellation.at, actorId: cancellation.by, reason: cancellation.reason },
  ]
}

function loadingCounts(loading: NonNullable<Trip['loading']>, revisions: readonly Revision[]) {
  const plan = revisions.find((revision) => revision.id === loading.revisionId)
  const missing = loading.steps.filter((step) => step.outcome === 'missing').length
  return {
    loaded: loading.steps.length - missing,
    missing,
    total: plan ? plannedStops(plan).size : loading.steps.length,
  }
}

/** Một kiện kho báo thiếu (D-47): không có trên xe. */
export type MissingPackage = {
  readonly packageInstanceId: string
  readonly name: string
  readonly deliveryStop: number
  /** ISO 8601, lúc kho báo thiếu. */
  readonly at: string
}

/** Kiện kho báo thiếu, theo thứ tự kho ghi. Tên và điểm giao lấy từ kiện gốc của chuyến (kiện đã khoá từ lúc kho bắt đầu xếp). */
export function missingPackages(trip: Pick<Trip, 'loading' | 'packages'>): MissingPackage[] {
  const { instances, packageIdByInstanceId } = expandPackages(trip.packages)
  const stopByInstance = new Map(instances.map((instance) => [instance.packageInstanceId, instance.deliveryStop]))
  const nameById = new Map(trip.packages.map((pkg) => [pkg.id, pkg.name]))
  return (trip.loading?.steps ?? [])
    .filter((step) => step.outcome === 'missing')
    .map(({ packageInstanceId, at }) => ({
      packageInstanceId,
      name: nameById.get(packageIdByInstanceId.get(packageInstanceId) ?? '') ?? '',
      deliveryStop: stopByInstance.get(packageInstanceId) ?? 0,
      at,
    }))
}
