import type { PointCm } from '@/domain/metrics'
import { PLAN_LABELS, type PlanLabel, type PlanObjective } from '@/domain/models'
import { candidateAxles, type CandidateFigures } from '@/lib/candidate-metrics'
import { isStale, type OptimizationRun, type Revision, type Trip } from '@/lib/mock-db'

export { bestCandidates, CANDIDATE_METRICS, type AxleGauge, type CandidateAxles, type CandidateMetric } from '@/lib/candidate-metrics'

/**
 * Một thẻ của màn so sánh ba phương án ứng viên (FE-5b-06, D-77). Mọi số lấy từ `result.metrics` của revision; giới hạn trục lấy từ xe
 * của chính request đã chạy (`candidateAxles`) — màn không tự tính lại phương án.
 */
export type CandidateCardModel = CandidateFigures & {
  revision: Revision
  jobId: string
  objective: PlanObjective
  label: PlanLabel
  payloadUtilizationPercent: number
  placedCount: number
  runtimeMs: number
  /** Vắng khi chưa xếp kiện nào. */
  centerOfGravityCm?: PointCm
  isMockResult: boolean
  /** Chuyến đổi xe / kiện / thứ tự điểm sau lần chạy (D-31). */
  stale: boolean
  /** Revision đã duyệt dựng từ phương án này, cũ trước. */
  approvedAs: string[]
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
      axles: candidateAxles(revision),
      isMockResult: revision.result.isMockResult,
      stale: isStale(revision, trip),
      approvedAs: revisions.filter((item) => item.sourceRevisionId === revision.id && item.approvedAt !== undefined).map((item) => item.id),
    }]
  })
}
