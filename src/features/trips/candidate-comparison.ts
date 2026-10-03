import { axleLoadsOf, type AxleLoadUnavailableReason, type PointCm } from '@/domain/metrics'
import { PLAN_LABELS, type PlanLabel, type PlanObjective } from '@/domain/models'
import { isStale, type OptimizationRun, type Revision, type Trip } from '@/lib/mock-db'

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

/**
 * Một thẻ của màn so sánh ba phương án ứng viên (FE-5b-06, D-77). Mọi số lấy từ `result.metrics` của revision; giới hạn trục lấy từ xe
 * của chính request đã chạy (`axleLoadsOf`) — màn không tự tính lại phương án.
 */
export type CandidateCardModel = {
  revision: Revision
  id: string
  jobId: string
  objective: PlanObjective
  label: PlanLabel
  volumeUtilizationPercent: number
  payloadUtilizationPercent: number
  placedCount: number
  unplacedCount: number
  runtimeMs: number
  /** Vắng khi kết quả không chia vùng. */
  rehandlingCount?: number
  /** Vắng khi chưa xếp kiện nào. */
  centerOfGravityCm?: PointCm
  axles: CandidateAxles
  isMockResult: boolean
  /** Chuyến đổi xe / kiện / thứ tự điểm sau lần chạy (D-31). */
  stale: boolean
  /** Revision đã duyệt dựng từ phương án này, cũ trước. */
  approvedAs: string[]
}

function percentOf(loadKg: number, limitKg: number | undefined): number | undefined {
  return limitKg === undefined ? undefined : (loadKg * 100) / limitKg
}

function axlesOf({ request, result }: Revision): CandidateAxles {
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

/**
 * Thẻ của các phương án ứng viên của một lần chạy, theo thứ tự A · B · C của `run.plans`. `revisions` là mọi revision của chuyến (để
 * biết phương án nào đã có bản duyệt). Phương án mà kho không còn revision thì bỏ qua.
 */
export function candidateCards(trip: Pick<Trip, 'inputVersion'>, run: Pick<OptimizationRun, 'plans'>, revisions: readonly Revision[]): CandidateCardModel[] {
  return (run.plans ?? []).flatMap((plan): CandidateCardModel[] => {
    const revision = revisions.find((item) => item.id === plan.revisionId)
    if (revision === undefined) return []
    const { metrics } = revision.result
    return [{
      revision,
      id: revision.id,
      jobId: revision.jobId,
      objective: plan.objective,
      label: PLAN_LABELS[plan.objective],
      volumeUtilizationPercent: metrics.volumeUtilizationPercent,
      payloadUtilizationPercent: metrics.payloadUtilizationPercent,
      placedCount: metrics.placedCount,
      unplacedCount: metrics.unplacedCount,
      runtimeMs: metrics.runtimeMs,
      ...(metrics.rehandlingCount === undefined ? {} : { rehandlingCount: metrics.rehandlingCount }),
      ...(metrics.centerOfGravityCm === undefined ? {} : { centerOfGravityCm: metrics.centerOfGravityCm }),
      axles: axlesOf(revision),
      isMockResult: revision.result.isMockResult,
      stale: isStale(revision, trip),
      approvedAs: revisions.filter((item) => item.sourceRevisionId === revision.id && item.approvedAt !== undefined).map((item) => item.id),
    }]
  })
}

/** Chỉ số có "tốt nhất" giữa các phương án: thể tích cao hơn, còn lại thấp hơn là tốt hơn. */
export const CANDIDATE_METRICS = ['volume', 'unplaced', 'axleGap', 'rehandling'] as const
export type CandidateMetric = (typeof CANDIDATE_METRICS)[number]

const VALUE_OF: Record<CandidateMetric, (card: CandidateCardModel) => number | undefined> = {
  volume: (card) => card.volumeUtilizationPercent,
  unplaced: (card) => card.unplacedCount,
  axleGap: (card) => (card.axles.status === 'computed' ? card.axles.gapPercent : undefined),
  rehandling: (card) => card.rehandlingCount,
}

/**
 * Mã các phương án có giá trị tốt nhất ở từng chỉ số (hoà thì đánh dấu mọi phương án hoà). Chỉ số mà mọi phương án bằng nhau, hoặc có
 * phương án không có số (xe chưa khai trục, kết quả không chia vùng), thì vắng — đánh dấu "tốt nhất" ở đó không giúp chọn gì. Số so đúng
 * như trong kết quả, không làm tròn. Thời gian chạy và trọng tâm không có "tốt nhất".
 */
export function bestCandidates(cards: readonly CandidateCardModel[]): Partial<Record<CandidateMetric, ReadonlySet<string>>> {
  const best: Partial<Record<CandidateMetric, ReadonlySet<string>>> = {}
  for (const metric of CANDIDATE_METRICS) {
    const values = cards.map(VALUE_OF[metric])
    if (!values.every((value): value is number => value !== undefined) || new Set(values).size < 2) continue
    const target = metric === 'volume' ? Math.max(...values) : Math.min(...values)
    best[metric] = new Set(cards.filter((_, index) => values[index] === target).map((card) => card.id))
  }
  return best
}
