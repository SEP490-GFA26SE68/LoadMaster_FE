import { expandPackages } from '@/domain/cargo'
import type { TripStatus, TripSubStatus } from '@/types/trip'
import { isStale } from './revisions'
import type { Revision, Trip, TripPhase } from './types'

/** Pha xe đang bận (D-53): kho đang xếp, đã xếp xong chờ chạy, đang giao. */
const ACTIVE_PHASES: readonly TripPhase[] = ['loading', 'loaded', 'delivering']

export function isActivePhase(phase: TripPhase): boolean {
  return ACTIVE_PHASES.includes(phase)
}

/** Từ khi kho bắt đầu xếp, xe, điểm giao và kiện của chuyến bị khoá (D-45). */
export function isLockedPhase(phase: TripPhase): boolean {
  return phase !== 'planning'
}

/** Huỷ được trước khi xe rời kho (D-45). */
export function isCancellablePhase(phase: TripPhase): boolean {
  return phase === 'planning' || phase === 'loading' || phase === 'loaded'
}

/** Bản đã duyệt mới nhất; `revisions` theo thứ tự kho trả (cũ trước). */
export function latestApproved<R extends Pick<Revision, 'approvedAt'>>(revisions: readonly R[]): R | undefined {
  return revisions.findLast((revision) => revision.approvedAt !== undefined)
}

/**
 * Trạng thái hiển thị của chuyến (D-81, FE-0-05): sáu trạng thái của backend, suy từ pha kho lưu. `loading` và `loaded` là Đang xếp
 * hàng, `delivering` là Đang vận chuyển, `completed` là Đã giao, `cancelled` là Đã huỷ.
 *
 * Pha `planning` theo luật TẠM, bỏ khi FE-4b-09 có tối ưu tuyến (backend chỉ sang `PLANNED` khi tối ưu tuyến xong): chuyến đã có
 * revision là Đã lập kế hoạch, chưa có là Nháp. Phương án chờ duyệt, đã duyệt hay lỗi thời nằm ở dòng phụ (`tripSubStatus`).
 */
export function tripStatus(trip: Pick<Trip, 'phase'>, revisions: readonly Pick<Revision, 'id'>[]): TripStatus {
  switch (trip.phase) {
    case 'cancelled': return 'CANCELLED'
    case 'completed': return 'DELIVERED'
    case 'delivering': return 'IN_TRANSIT'
    case 'loaded':
    case 'loading': return 'LOADING'
    case 'planning': return revisions.length > 0 ? 'PLANNED' : 'DRAFT'
  }
}

/**
 * Dòng phụ dưới chip trạng thái (FE-0-05), mọi màn hiện giống nhau. Không có thì `null`.
 * - Đang xếp hàng: kho đang xếp (kiện đã có kết quả / kiện của phương án kho xếp theo — bản ghi lúc bắt đầu xếp), hoặc đã xếp xong.
 * - Đã lập kế hoạch: theo revision hiển thị (bản duyệt mới nhất, không có thì bản mới nhất) — lỗi thời khi xe/kiện đổi sau lần tối
 *   ưu (D-31; bản duyệt lỗi thời hết hiệu lực, kho không xếp theo nó), đã duyệt, còn lại là chờ duyệt.
 */
export function tripSubStatus(
  trip: Pick<Trip, 'phase' | 'inputVersion' | 'loading'>,
  revisions: readonly Pick<Revision, 'id' | 'approvedAt' | 'inputVersion' | 'request' | 'result'>[],
): TripSubStatus | null {
  if (trip.phase === 'loaded') return { kind: 'loaded' }
  if (trip.phase === 'loading') {
    const startedWith = trip.loading?.revisionId
    const plan = revisions.find((revision) => revision.id === startedWith) ?? latestApproved(revisions)
    return { kind: 'loading', recorded: trip.loading?.steps.length ?? 0, total: plan ? plannedStops(plan).size : 0 }
  }
  if (trip.phase !== 'planning') return null
  const shown = latestApproved(revisions) ?? revisions.at(-1)
  if (!shown) return null
  if (isStale(shown, trip)) return { kind: 'stale' }
  return { kind: shown.approvedAt === undefined ? 'awaitingApproval' : 'approved' }
}

/** Kiện đã xếp trong phương án: mã instance → số điểm giao. */
export function plannedStops(revision: Pick<Revision, 'request' | 'result'>): Map<string, number> {
  const stopById = new Map(expandPackages(revision.request.packages).instances.map((i) => [i.packageInstanceId, i.deliveryStop]))
  const planned = new Map<string, number>()
  for (const { packageInstanceId } of revision.result.placements) {
    const stop = stopById.get(packageInstanceId)
    if (stop !== undefined) planned.set(packageInstanceId, stop)
  }
  return planned
}

/** Kiện kho báo thiếu (không có trên xe). */
export function missingIds(trip: Pick<Trip, 'loading'>): Set<string> {
  return new Set(trip.loading?.steps.filter((step) => step.outcome === 'missing').map((step) => step.packageInstanceId))
}

/** Số kiện của phương án chưa có kết quả xếp ở kho. */
export function loadingRemaining(trip: Pick<Trip, 'loading'>, revision: Pick<Revision, 'request' | 'result'>): number {
  const recorded = new Set(trip.loading?.steps.map((step) => step.packageInstanceId))
  return [...plannedStops(revision).keys()].filter((id) => !recorded.has(id)).length
}

/** Kiện phải dỡ ở điểm `stopNumber`: kiện đã xếp của phương án thuộc điểm đó, trừ kiện kho báo thiếu. */
export function stopItemIds(trip: Pick<Trip, 'loading'>, revision: Pick<Revision, 'request' | 'result'>, stopNumber: number): string[] {
  const missing = missingIds(trip)
  return [...plannedStops(revision)].filter(([id, stop]) => stop === stopNumber && !missing.has(id)).map(([id]) => id)
}
