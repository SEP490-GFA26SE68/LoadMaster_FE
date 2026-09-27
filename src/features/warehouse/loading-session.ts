import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { isStale, type LoadingProgress, type Revision, type Trip } from '@/lib/mock-db'
import { warehousePlan } from './warehouse-trips'

/**
 * Việc màn kho làm với chuyến `/kho?chuyen=` (LM-086), suy từ pha và revision của chuyến (D-45):
 * - `start`: đã duyệt, chưa xếp — vào màn là bắt đầu xếp theo bản duyệt mới nhất;
 * - `stale`: bản duyệt mới nhất lỗi thời — không bắt đầu, chờ tối ưu lại và quản lý công ty duyệt;
 * - `loading`: đang xếp theo bản đã chốt lúc bắt đầu; `finished`: kho đã xếp xong (kể cả khi xe đã đi giao);
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

export type LoadingProgressView = {
  /** Kiện chưa có kết quả đầu tiên theo `loadingOrder`: mở lại màn thì tiếp tục ở đây (D-47). `undefined` khi đã ghi đủ. */
  readonly current: ScenePlacement | undefined
  /** Kiện chưa có kết quả kế tiếp sau `current`; `undefined` khi `current` là kiện cuối cần ghi. */
  readonly next: ScenePlacement | undefined
  readonly total: number
  /** Kiện đã có kết quả: đã xếp hoặc báo thiếu. */
  readonly recorded: number
  readonly loaded: number
  /** Kiện kho báo thiếu, theo thứ tự xếp. */
  readonly missing: readonly ScenePlacement[]
}

/** Tiến độ xếp đọc từ kho: kiện của phương án theo thứ tự xếp, đối chiếu với các bước kho đã ghi. */
export function loadingProgress(
  placements: readonly ScenePlacement[],
  loading: Pick<LoadingProgress, 'steps'> | undefined,
): LoadingProgressView {
  const outcome = new Map(loading?.steps.map((step) => [step.packageInstanceId, step.outcome]))
  const sequence = placements.toSorted((a, b) => a.step - b.step)
  const missing = sequence.filter((p) => outcome.get(p.id) === 'missing')
  const recorded = sequence.filter((p) => outcome.has(p.id)).length
  const [current, next] = sequence.filter((p) => !outcome.has(p.id))
  return {
    current,
    next,
    total: sequence.length,
    recorded,
    loaded: recorded - missing.length,
    missing,
  }
}
