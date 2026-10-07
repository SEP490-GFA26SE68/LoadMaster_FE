import { expandPackages } from '@/domain/cargo'
import type { TripStatus, TripSubStatus } from '@/types/trip'
import { isActiveException, type TripException } from './exception-model'
import { currentNumbersOfPlan, hasInsertedStops } from './plan-stops'
import { isStale } from './revisions'
import type { DeliveryStop, Revision, Trip, TripPhase } from './types'
import { pendingManualConfirms } from './verify-model'

/** Pha xe đang bận (D-53): kho đang xếp, đã xếp xong chờ chạy, đang giao. */
const ACTIVE_PHASES: readonly TripPhase[] = ['loading', 'loaded', 'delivering']

export function isActivePhase(phase: TripPhase): boolean {
  return ACTIVE_PHASES.includes(phase)
}

/**
 * Từ khi kho bắt đầu xếp, xe, điểm giao và kiện của chuyến bị khoá (D-45). Ngoại lệ duy nhất, ở **một** chỗ: duyệt yêu cầu nhận hàng dọc
 * đường chèn điểm nhận và điểm giao vào chuyến đang vận chuyển (`insertPickupIntoTrip`, FE-7-04, PRD v2 mục 7.1); mọi hàm sửa chuyến
 * khác vẫn chặn `TRIP_LOCKED`.
 */
export function isLockedPhase(phase: TripPhase): boolean {
  return phase !== 'planning'
}

/**
 * Huỷ được trước khi xe rời kho (D-91): Nháp, Đã lập kế hoạch, Đang xếp hàng. Chuyến Đang vận chuyển còn tuỳ sự cố (`canCancelTrip`).
 */
export function isCancellablePhase(phase: TripPhase): boolean {
  return phase === 'planning' || phase === 'loading' || phase === 'loaded'
}

/**
 * Chuyến huỷ được (FE-6-07, D-91): trước khi xe rời kho, hoặc Đang vận chuyển mà có sự cố cấp chuyến chưa xử lý (`exceptions` của
 * chuyến, FE-6-11). Đã giao, Đã huỷ thì không.
 */
export function canCancelTrip(phase: TripPhase, exceptions: readonly Pick<TripException, 'status'>[]): boolean {
  return isCancellablePhase(phase) || (phase === 'delivering' && exceptions.some(isActiveException))
}

/** Kiện đã lên xe mà chưa giao: huỷ chuyến Đang vận chuyển thì chúng thành Hoàn trả. Kiện đã dỡ ở điểm chưa hoàn tất vẫn là chưa giao. */
export function undeliveredCount(trip: Pick<Trip, 'loading' | 'delivery'>): number {
  const loaded = trip.loading?.steps.filter((step) => step.outcome === 'loaded').length ?? 0
  const delivered = trip.delivery?.stops.reduce((sum, stop) => sum + (stop.completedAt === undefined ? 0 : stop.unloadedIds.length), 0) ?? 0
  return loaded - delivered
}

/** Bản đã duyệt mới nhất; `revisions` theo thứ tự kho trả (cũ trước). */
export function latestApproved<R extends Pick<Revision, 'approvedAt'>>(revisions: readonly R[]): R | undefined {
  return revisions.findLast((revision) => revision.approvedAt !== undefined)
}

/**
 * Trạng thái hiển thị của chuyến (D-81, FE-0-05): sáu trạng thái của backend, suy từ pha kho lưu. `loading` và `loaded` là Đang xếp
 * hàng, `delivering` là Đang vận chuyển, `completed` là Đã giao, `cancelled` là Đã huỷ.
 *
 * Pha `planning` (FE-4b-09, PRD v2 mục 7.1): chuyến **đã tối ưu tuyến** (`routePlan`) là Đã lập kế hoạch, chưa thì Nháp — thêm hoặc
 * bớt điểm giao sau khi tối ưu làm kho bỏ `routePlan`, chuyến về Nháp. Phương án 3D chờ duyệt, đã duyệt hay lỗi thời nằm ở dòng phụ
 * (`tripSubStatus`), không quyết định trạng thái.
 */
export function tripStatus(trip: Pick<Trip, 'phase' | 'routePlan'>): TripStatus {
  switch (trip.phase) {
    case 'cancelled': return 'CANCELLED'
    case 'completed': return 'DELIVERED'
    case 'delivering': return 'IN_TRANSIT'
    case 'loaded':
    case 'loading': return 'LOADING'
    case 'planning': return trip.routePlan ? 'PLANNED' : 'DRAFT'
  }
}

/**
 * Dòng phụ dưới chip trạng thái (FE-0-05), mọi màn hiện giống nhau. Không có thì `null`.
 * - Đang xếp hàng (FE-6-02, FE-6-05): còn kiện kho báo thiếu chờ điều phối viên quyết; không thì đang soạn (kiện đã soạn / kiện của
 *   phương án kho làm theo — bản ghi lúc bắt đầu), soạn đủ thì đang xếp (kiện đã có kết quả / tổng), hoặc đã xếp xong.
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
    const total = plan ? plannedStops(plan).size : 0
    const shortages = trip.loading?.shortages?.length ?? 0
    if (shortages > 0) return { kind: 'shortage', count: shortages }
    const staged = trip.loading?.stagedIds.length ?? 0
    if (staged < total) return { kind: 'staging', recorded: staged, total }
    return { kind: 'loading', recorded: trip.loading?.steps.length ?? 0, total }
  }
  if (trip.phase !== 'planning') return null
  const shown = latestApproved(revisions) ?? revisions.at(-1)
  if (!shown) return null
  if (isStale(shown, trip)) return { kind: 'stale' }
  return { kind: shown.approvedAt === undefined ? 'awaitingApproval' : 'approved' }
}

/**
 * Dòng phụ về tuyến (FE-4b-09): chuyến Đã lập kế hoạch có điểm tới nơi sau hạn — "Có điểm trễ hạn dự kiến". Đứng cạnh dòng phụ của
 * phương án, không thay nó. Không có điểm trễ, hoặc chuyến ở pha khác, thì `null`.
 */
export function tripRouteSubStatus(trip: Pick<Trip, 'phase' | 'routePlan'>): TripSubStatus | null {
  const late = trip.phase === 'planning' ? (trip.routePlan?.missedStopIds.length ?? 0) : 0
  return late > 0 ? { kind: 'lateStops', count: late } : null
}

/**
 * Dòng phụ "Chờ duyệt xác nhận tay (n)" (FE-6-04, PRD v2 mục 7.1): chuyến đang xếp còn xác nhận tay của bước soạn hoặc bước xếp chờ điều
 * phối viên duyệt, hoặc chuyến đang giao còn xác nhận tay của bước dỡ. Đứng cạnh dòng phụ tiến độ, không thay nó. Không còn gì chờ, hoặc chuyến ở
 * pha khác (đã huỷ giữa chừng), thì `null`.
 */
export function tripManualSubStatus(trip: Pick<Trip, 'phase' | 'verifications'>): TripSubStatus | null {
  const count = trip.phase === 'loading'
    ? pendingManualConfirms(trip, 'STAGING').length + pendingManualConfirms(trip, 'LOADING').length
    : trip.phase === 'delivering' ? pendingManualConfirms(trip, 'UNLOADING').length + pendingManualConfirms(trip, 'PICKUP').length : 0
  return count > 0 ? { kind: 'manualPending', count } : null
}

/**
 * Kiện đã xếp trong phương án: mã instance → số điểm giao. Phương án đánh số điểm theo lúc duyệt; chuyến đã chèn điểm nhận dọc đường
 * (FE-7-04) thì truyền `stops` để đổi sang số điểm **hiện tại** (`plan-stops.ts`) — không truyền thì giữ số của phương án.
 */
export function plannedStops(revision: Pick<Revision, 'request' | 'result'>, stops?: readonly Pick<DeliveryStop, 'planNumber'>[]): Map<string, number> {
  const stopById = new Map(expandPackages(revision.request.packages).instances.map((i) => [i.packageInstanceId, i.deliveryStop]))
  const current = stops !== undefined && hasInsertedStops(stops) ? currentNumbersOfPlan(stops) : undefined
  const planned = new Map<string, number>()
  for (const { packageInstanceId } of revision.result.placements) {
    const stop = stopById.get(packageInstanceId)
    if (stop !== undefined) planned.set(packageInstanceId, current?.get(stop) ?? stop)
  }
  return planned
}

/** Kiện của phương án không lên xe: hỏng lúc xếp nên bị bỏ lại kho (FE-6-05). */
export function leftOutIds(trip: Pick<Trip, 'loading'>): Set<string> {
  return new Set(trip.loading?.steps.filter((step) => step.outcome === 'damaged').map((step) => step.packageInstanceId))
}

/** Kiện của phương án chưa soạn vào khu chờ, theo thứ tự của phương án (FE-6-02). Còn kiện như vậy thì chuyến ở bước soạn. */
export function stagingRemaining(trip: Pick<Trip, 'loading'>, revision: Pick<Revision, 'request' | 'result'>): string[] {
  const staged = new Set(trip.loading?.stagedIds)
  return [...plannedStops(revision).keys()].filter((id) => !staged.has(id))
}

/** Số kiện của phương án chưa có kết quả xếp ở kho. */
export function loadingRemaining(trip: Pick<Trip, 'loading'>, revision: Pick<Revision, 'request' | 'result'>): number {
  const recorded = new Set(trip.loading?.steps.map((step) => step.packageInstanceId))
  return [...plannedStops(revision).keys()].filter((id) => !recorded.has(id)).length
}

/** Kiện phải dỡ ở điểm `stopNumber`: kiện đã xếp của phương án thuộc điểm đó, trừ kiện hỏng bị bỏ lại kho. */
export function stopItemIds(trip: Pick<Trip, 'loading' | 'stops'>, revision: Pick<Revision, 'request' | 'result'>, stopNumber: number): string[] {
  const leftOut = leftOutIds(trip)
  return [...plannedStops(revision, trip.stops)].filter(([id, stop]) => stop === stopNumber && !leftOut.has(id)).map(([id]) => id)
}
