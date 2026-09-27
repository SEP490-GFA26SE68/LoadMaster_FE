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
 * Trạng thái hiển thị của chuyến (D-45, LM-104): năm trạng thái của backend cộng Đã huỷ. Pha kho (`loading`, `loaded`) vẫn là Đã
 * duyệt — tiến độ kho là dòng phụ (`tripSubStatus`); `delivering` là Đang vận chuyển. Pha `planning` suy từ revision hiển thị (bản
 * duyệt mới nhất, không có thì bản mới nhất): chưa có là Nháp; lỗi thời là Đã tối ưu (bản duyệt lỗi thời hết hiệu lực, kho không
 * xếp theo nó) kèm dòng phụ "lỗi thời"; đã duyệt là Đã duyệt; còn lại Đã tối ưu.
 */
export function tripStatus(
  trip: Pick<Trip, 'phase' | 'inputVersion'>,
  revisions: readonly Pick<Revision, 'approvedAt' | 'inputVersion'>[],
): TripStatus {
  switch (trip.phase) {
    case 'cancelled': return 'da_huy'
    case 'completed': return 'hoan_thanh'
    case 'delivering': return 'dang_van_chuyen'
    case 'loaded':
    case 'loading': return 'da_duyet'
    case 'planning': break
  }
  const shown = latestApproved(revisions) ?? revisions.at(-1)
  if (!shown) return 'nhap'
  if (isStale(shown, trip)) return 'da_toi_uu'
  return shown.approvedAt !== undefined ? 'da_duyet' : 'da_toi_uu'
}

/** Pha lập kế hoạch và revision hiển thị lỗi thời: dữ liệu xe/kiện đổi sau lần tối ưu, cần tối ưu lại (D-31). */
export function isStaleTrip(
  trip: Pick<Trip, 'phase' | 'inputVersion'>,
  revisions: readonly Pick<Revision, 'approvedAt' | 'inputVersion'>[],
): boolean {
  const shown = latestApproved(revisions) ?? revisions.at(-1)
  return trip.phase === 'planning' && shown !== undefined && isStale(shown, trip)
}

/**
 * Dòng phụ dưới chip trạng thái (LM-104), mọi màn hiện giống nhau: phương án hiển thị lỗi thời trong pha lập kế hoạch; kho đang xếp
 * (kiện đã có kết quả / kiện của phương án kho xếp theo — bản ghi lúc bắt đầu xếp); kho đã xếp xong. Không có thì `null`.
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
  return isStaleTrip(trip, revisions) ? { kind: 'stale' } : null
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
