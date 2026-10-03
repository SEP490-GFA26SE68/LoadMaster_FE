import { PLAN_LABELS, type OptimizationRequest, type PlanLabel } from '@/domain/models'
import { isStale, type Revision, type Trip } from '@/lib/mock-db'

/**
 * Một thẻ của màn So sánh phương án (LM-051, D-37). Mọi số lấy thẳng từ `request.settings` và `result.metrics` của
 * revision — màn không tự tính hay làm đẹp số nào.
 */
export type RevisionCardModel = {
  revision: Revision
  id: string
  jobId: string
  method: OptimizationRequest['settings']['method']
  randomSeed?: number
  enforceLifo: boolean
  prioritizeLowCenterOfGravity: boolean
  timeLimitSeconds: number
  volumeUtilizationPercent: number
  payloadUtilizationPercent: number
  placedCount: number
  unplacedCount: number
  runtimeMs: number
  isMockResult: boolean
  createdAt: string
  /** Revision tạo sau cùng của chuyến. */
  latest: boolean
  approved: boolean
  /** Chuyến đổi xe/kiện sau khi tạo revision này (D-31). */
  stale: boolean
  /** Chỉ ở revision đã duyệt: revision nguồn. */
  sourceRevisionId?: string
  /** Revision đã duyệt dựng từ revision này, cũ trước. Bản duyệt dùng chung `jobId` nên cần mã riêng để phân biệt. */
  approvedAs: string[]
  /**
   * Nhãn ứng viên A · B · C (FE-5b-05): revision do một lần chạy ba phương án tạo ra, hoặc bản duyệt dựng từ nó. Vắng với kết quả lưu
   * lẻ — lần chạy chỉ có một phương án.
   */
  candidate?: PlanLabel
}

/** Thẻ theo thứ tự tạo, cũ trước — cùng thứ tự `listRevisions`, để đọc từ trái sang phải như dòng thời gian. */
export function revisionCards(trip: Pick<Trip, 'inputVersion'>, revisions: readonly Revision[]): RevisionCardModel[] {
  const lastId = revisions.at(-1)?.id
  const plansOf = (runId: string) => revisions.filter((item) => item.runId === runId && item.approvedAt === undefined).length
  return revisions.map((revision) => {
    const { settings } = revision.request
    const { metrics } = revision.result
    return {
      revision,
      id: revision.id,
      jobId: revision.jobId,
      method: settings.method,
      randomSeed: settings.randomSeed,
      enforceLifo: settings.enforceLifo,
      prioritizeLowCenterOfGravity: settings.prioritizeLowCenterOfGravity,
      timeLimitSeconds: settings.timeLimitSeconds,
      volumeUtilizationPercent: metrics.volumeUtilizationPercent,
      payloadUtilizationPercent: metrics.payloadUtilizationPercent,
      placedCount: metrics.placedCount,
      unplacedCount: metrics.unplacedCount,
      runtimeMs: metrics.runtimeMs,
      isMockResult: revision.result.isMockResult,
      createdAt: revision.createdAt,
      latest: revision.id === lastId,
      approved: revision.approvedAt !== undefined,
      stale: isStale(revision, trip),
      sourceRevisionId: revision.sourceRevisionId,
      approvedAs: revisions.filter((item) => item.sourceRevisionId === revision.id).map((item) => item.id),
      ...(revision.run && revision.runId !== undefined && plansOf(revision.runId) > 1 ? { candidate: PLAN_LABELS[revision.run.objective] } : {}),
    }
  })
}

/**
 * Revision chọn sẵn khi mở màn, cùng quy tắc Planner dùng khi không có `?revision=`: bản đã duyệt mới nhất, rồi tới bản
 * mới nhất.
 */
export function defaultRevisionId(cards: readonly RevisionCardModel[]): string | undefined {
  return cards.findLast((card) => card.approved)?.id ?? cards.at(-1)?.id
}

export type ComparedMetric = 'volumeUtilizationPercent' | 'placedCount' | 'unplacedCount' | 'runtimeMs'

const HIGHER_IS_BETTER: Record<ComparedMetric, boolean> = {
  volumeUtilizationPercent: true,
  placedCount: true,
  unplacedCount: false,
  runtimeMs: false,
}

/**
 * Giá trị tốt nhất của từng chỉ số so sánh được. Chỉ số mà mọi thẻ bằng nhau thì vắng — đánh dấu "tốt nhất" lên mọi
 * thẻ không giúp chọn gì. Số so đúng như trong kết quả, không làm tròn.
 */
export function bestValues(cards: readonly RevisionCardModel[]): Partial<Record<ComparedMetric, number>> {
  const best: Partial<Record<ComparedMetric, number>> = {}
  for (const metric of Object.keys(HIGHER_IS_BETTER) as ComparedMetric[]) {
    const values = cards.map((card) => card[metric])
    if (new Set(values).size < 2) continue
    best[metric] = HIGHER_IS_BETTER[metric] ? Math.max(...values) : Math.min(...values)
  }
  return best
}
