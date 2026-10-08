import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { isStale, stagingRemaining, type LoadingProgress, type Revision, type Trip } from '@/lib/mock-db'
import { warehousePlan } from './warehouse-trips'

/**
 * Việc màn kho làm với chuyến `/kho?chuyen=` (LM-086), suy từ pha và revision của chuyến (D-45):
 * - `start`: đã duyệt, chưa bắt đầu — vào màn là bắt đầu theo bản duyệt mới nhất, bước Soạn hàng;
 * - `stale`: bản duyệt mới nhất lỗi thời — không bắt đầu, chờ điều phối viên tối ưu lại và duyệt;
 * - `loading`: đang soạn rồi xếp theo bản đã chốt lúc bắt đầu (`loadingStep`); `finished`: kho đã xếp xong (kể cả khi xe đã đi giao);
 * - `no-plan`: chưa có bản duyệt; `cancelled`: chuyến đã huỷ.
 */
export type WarehouseSession<R> =
  | { readonly kind: 'no-plan' }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'stale' | 'start' | 'loading' | 'finished'; readonly plan: R }

export function warehouseSession<R extends Pick<Revision, 'id' | 'approvedAt' | 'inputVersion'>>(
  trip: Pick<Trip, 'phase' | 'inputVersion' | 'loading'>,
  revisions: readonly R[],
): WarehouseSession<R> {
  if (trip.phase === 'cancelled') return { kind: 'cancelled' }
  const plan = warehousePlan(trip, revisions)
  if (!plan) return { kind: 'no-plan' }
  switch (trip.phase) {
    case 'planning':
      return { kind: isStale(plan, trip) ? 'stale' : 'start', plan }
    case 'loading':
      return { kind: 'loading', plan }
    default:
      return { kind: 'finished', plan }
  }
}

/**
 * Bước của chuyến đang ở kho (FE-6-02, D-82): còn kiện của phương án chưa soạn vào khu chờ thì là Soạn hàng; soạn đủ mới sang Xếp.
 * Xác nhận tay lúc soạn bị điều phối viên từ chối đưa chuyến quay lại bước soạn cho kiện đó.
 */
export function loadingStep(trip: Pick<Trip, 'loading'>, plan: Pick<Revision, 'request' | 'result'>): 'staging' | 'loading' {
  return stagingRemaining(trip, plan).length > 0 ? 'staging' : 'loading'
}

export type StagingProgressView = {
  readonly total: number
  readonly staged: number
  /** Kiện chưa soạn, theo thứ tự xếp của phương án — soạn thì không cần theo thứ tự. */
  readonly pending: readonly ScenePlacement[]
  /** Kiện kho đã báo thiếu, chờ điều phối viên quyết. */
  readonly shortageIds: ReadonlySet<string>
}

/** Tiến độ soạn đọc từ kho: kiện của phương án đối chiếu với danh sách đã soạn và báo thiếu đang mở. */
export function stagingProgress(placements: readonly ScenePlacement[], loading: Pick<LoadingProgress, 'stagedIds' | 'shortages'> | undefined): StagingProgressView {
  const staged = new Set(loading?.stagedIds)
  const pending = placements.filter((placement) => !staged.has(placement.id)).toSorted((a, b) => a.step - b.step)
  return {
    total: placements.length,
    staged: placements.length - pending.length,
    pending,
    shortageIds: new Set(loading?.shortages?.map((item) => item.packageInstanceId)),
  }
}

export type LoadingProgressView = {
  /** Kiện chưa có kết quả đầu tiên theo `loadingOrder`: mở lại màn thì tiếp tục ở đây (D-47). `undefined` khi đã ghi đủ. */
  readonly current: ScenePlacement | undefined
  /** Kiện chưa có kết quả kế tiếp sau `current`; `undefined` khi `current` là kiện cuối cần ghi. */
  readonly next: ScenePlacement | undefined
  readonly total: number
  /** Kiện đã có kết quả: đã xếp, hoặc hỏng nên bị bỏ lại kho. */
  readonly recorded: number
  readonly loaded: number
  /** Kiện hỏng lúc xếp, bị bỏ lại kho (FE-6-05), theo thứ tự xếp. */
  readonly damaged: readonly ScenePlacement[]
  /** Kiện chưa có kết quả theo thứ tự xếp, bắt đầu từ `current`. */
  readonly pending: readonly ScenePlacement[]
}

/** Tiến độ xếp đọc từ kho: kiện của phương án theo thứ tự xếp, đối chiếu với các bước kho đã ghi. */
export function loadingProgress(
  placements: readonly ScenePlacement[],
  loading: Pick<LoadingProgress, 'steps'> | undefined,
): LoadingProgressView {
  const outcome = new Map(loading?.steps.map((step) => [step.packageInstanceId, step.outcome]))
  const sequence = placements.toSorted((a, b) => a.step - b.step)
  const damaged = sequence.filter((p) => outcome.get(p.id) === 'damaged')
  const recorded = sequence.filter((p) => outcome.has(p.id)).length
  const pending = sequence.filter((p) => !outcome.has(p.id))
  const [current, next] = pending
  return {
    current,
    next,
    total: sequence.length,
    recorded,
    loaded: recorded - damaged.length,
    damaged,
    pending,
  }
}

/** Một điểm giao ở màn Xếp xong: tổng kiện của điểm và số kiện bị bỏ lại kho (hỏng lúc xếp). */
export type StopTally = { readonly stop: number; readonly name: string; readonly total: number; readonly left: number }

/**
 * Kiện của phương án theo điểm giao, kèm số kiện hỏng bị bỏ lại kho — mọi số đọc từ phương án và bước xếp đã ghi (không bịa). Điểm
 * không có kiện nào của phương án (điểm thêm tay chưa có hàng) bỏ qua; theo thứ tự số điểm.
 */
export function stopTallies(
  stops: readonly { readonly number: number; readonly name: string }[],
  placements: readonly Pick<ScenePlacement, 'id' | 'stop'>[],
  damaged: readonly Pick<ScenePlacement, 'id'>[],
): StopTally[] {
  const leftOut = new Set(damaged.map((placement) => placement.id))
  return stops
    .map((stop) => {
      const own = placements.filter((placement) => placement.stop === stop.number)
      return { stop: stop.number, name: stop.name, total: own.length, left: own.filter((placement) => leftOut.has(placement.id)).length }
    })
    .filter((tally) => tally.total > 0)
    .toSorted((a, b) => a.stop - b.stop)
}
