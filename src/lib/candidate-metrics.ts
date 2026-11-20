import { axleLoadsOf, type AxleLoadUnavailableReason } from '@/domain/metrics'
import type { OptimizationRequest, OptimizationResult } from '@/domain/models'

/**
 * Chỉ số dùng để so các phương án ứng viên của một lần chạy (FE-5b-06, D-77): màn So sánh phương án của ứng dụng và bộ chọn A · B · C
 * của khung 3D trang giới thiệu đọc cùng các hàm này. Thuần — mọi số lấy từ `result.metrics` của chính lần chạy, giới hạn trục lấy từ xe
 * của chính request đã chạy (`axleLoadsOf`); không tính lại phương án.
 */

/** Tải của một nhóm trục so với giới hạn của nó; `limitKg` và `percent` vắng khi nhóm chưa có giới hạn. */
export type AxleGauge = { loadKg: number; limitKg?: number; percent?: number }

export type CandidateAxles =
  | {
      status: 'computed'
      front: AxleGauge
      rear: AxleGauge
      /** Chênh lệch mức dùng giữa hai nhóm trục, điểm phần trăm; vắng khi một nhóm chưa có giới hạn. */
      gapPercent?: number
    }
  | { status: 'unavailable'; reason: AxleLoadUnavailableReason }

function percentOf(loadKg: number, limitKg: number | undefined): number | undefined {
  return limitKg === undefined ? undefined : (loadKg * 100) / limitKg
}

/** Tải hai nhóm trục của một phương án so với giới hạn của xe đã chạy; xe không đủ dữ liệu trục thì nói vì sao. */
export function candidateAxles({ request, result }: { request: Pick<OptimizationRequest, 'vehicle'>; result: Pick<OptimizationResult, 'metrics'> }): CandidateAxles {
  const empty = axleLoadsOf(request.vehicle, { totalKg: 0 })
  const { frontAxleLoadKg, rearAxleLoadKg } = result.metrics
  if (empty.status !== 'computed') return empty
  // Xe đủ dữ liệu trục thì kết quả luôn mang hai số này (`computeMetrics`); thiếu là kết quả dựng tay không tính tải trục
  if (frontAxleLoadKg === undefined || rearAxleLoadKg === undefined) return { status: 'unavailable', reason: 'NO_AXLES' }
  const gauge = (loadKg: number, limitKg: number | undefined): AxleGauge => {
    const percent = percentOf(loadKg, limitKg)
    return { loadKg, ...(limitKg === undefined || percent === undefined ? {} : { limitKg, percent }) }
  }
  const front = gauge(frontAxleLoadKg, empty.front.limitKg)
  const rear = gauge(rearAxleLoadKg, empty.rear.limitKg)
  return {
    status: 'computed', front, rear,
    ...(front.percent === undefined || rear.percent === undefined ? {} : { gapPercent: Math.abs(front.percent - rear.percent) }),
  }
}

/** Phần một phương án mà `bestCandidates` đọc. */
export type CandidateFigures = {
  id: string
  volumeUtilizationPercent: number
  unplacedCount: number
  /** Vắng khi kết quả không chia vùng. */
  rehandlingCount?: number
  axles: CandidateAxles
}

/** Chỉ số có "tốt nhất" giữa các phương án: thể tích cao hơn, còn lại thấp hơn là tốt hơn. */
export const CANDIDATE_METRICS = ['volume', 'unplaced', 'axleGap', 'rehandling'] as const
export type CandidateMetric = (typeof CANDIDATE_METRICS)[number]

const VALUE_OF: Record<CandidateMetric, (card: CandidateFigures) => number | undefined> = {
  volume: (card) => card.volumeUtilizationPercent,
  unplaced: (card) => card.unplacedCount,
  axleGap: (card) => (card.axles.status === 'computed' ? card.axles.gapPercent : undefined),
  rehandling: (card) => card.rehandlingCount,
}

/** Giá trị của một chỉ số ở một phương án; `undefined` khi phương án không có số đó. */
export function candidateValue(card: CandidateFigures, metric: CandidateMetric): number | undefined {
  return VALUE_OF[metric](card)
}

/**
 * Mã các phương án có giá trị tốt nhất ở từng chỉ số (hoà thì đánh dấu mọi phương án hoà). Chỉ số mà mọi phương án bằng nhau, hoặc có
 * phương án không có số (xe chưa khai trục, kết quả không chia vùng), thì vắng — đánh dấu "tốt nhất" ở đó không giúp chọn gì. Số so đúng
 * như trong kết quả, không làm tròn. Thời gian chạy và trọng tâm không có "tốt nhất".
 */
export function bestCandidates(cards: readonly CandidateFigures[]): Partial<Record<CandidateMetric, ReadonlySet<string>>> {
  const best: Partial<Record<CandidateMetric, ReadonlySet<string>>> = {}
  for (const metric of CANDIDATE_METRICS) {
    const values = cards.map(VALUE_OF[metric])
    if (!values.every((value): value is number => value !== undefined) || new Set(values).size < 2) continue
    const target = metric === 'volume' ? Math.max(...values) : Math.min(...values)
    best[metric] = new Set(cards.filter((_, index) => values[index] === target).map((card) => card.id))
  }
  return best
}
