import { PLAN_LABELS, type PlanLabel } from '@/domain/models'
import { isStale, type OptimizationRun, type Revision, type RunPlan, type Trip } from '@/lib/mock-db'

/**
 * Lịch sử lần chạy tối ưu của chuyến (LM-104) ghép từ kho: lần chạy, các phương án ứng viên nó tạo (FE-5b-05) và việc duyệt chúng.
 * Mọi ô đều truy được về kho — lần chạy hỏng không có revision nên không có giới hạn thời gian, seed hay phương án.
 */

/** Phương án của một lần chạy: đã có bản được duyệt, hoặc lần chạy đang là bản chờ duyệt của chuyến. */
export type RunApproval = 'approved' | 'pending'

/** Một phương án ứng viên của lần chạy: nhãn A · B · C theo mục tiêu, và đã có bản duyệt dựng từ nó chưa. */
export type RunPlanRow = RunPlan & { readonly label: PlanLabel; readonly approved: boolean }

export type RunHistoryRow = Omit<OptimizationRun, 'plans'> & {
  readonly runnerName: string | null
  /** Từ `request.settings` của revision đầu tiên của lần chạy; `null` với lần chạy hỏng (kho không lưu request của lần hỏng). */
  readonly timeLimitSeconds: number | null
  readonly randomSeed: number | null
  /** Theo thứ tự A · B · C; rỗng với lần chạy hỏng. */
  readonly plans: readonly RunPlanRow[]
  /**
   * `approved`: một phương án của lần chạy đã được duyệt. `pending`: lần chạy mới nhất của chuyến còn lập kế hoạch, chưa phương án nào
   * được duyệt, không lỗi thời. `null`: lần chạy hỏng, hoặc lần chạy chưa từng duyệt mà không còn là bản chờ (đã có lần chạy mới hơn,
   * lỗi thời, chuyến đã chốt).
   */
  readonly approval: RunApproval | null
}

type Source = {
  readonly trip: Pick<Trip, 'phase' | 'inputVersion'>
  /** Theo thứ tự kho trả (cũ trước). */
  readonly runs: readonly OptimizationRun[]
  /** Cũ trước. */
  readonly revisions: readonly Pick<Revision, 'id' | 'request' | 'result' | 'inputVersion' | 'approvedAt' | 'sourceRevisionId'>[]
  readonly userNames: ReadonlyMap<string, string>
}

/**
 * Bản đang chờ duyệt của chuyến: revision mới nhất, khi chuyến còn lập kế hoạch và bản đó chưa duyệt, đã hoàn tất, không lỗi thời.
 * Duyệt tạo revision đã duyệt mới nằm sau, nên chuyến vừa duyệt không còn bản chờ. Ba phương án của một lần chạy được ghi liền nhau,
 * nên bản mới nhất là một phương án của lần chạy mới nhất.
 */
function pendingRevisionId({ trip, revisions }: Source): string | undefined {
  const latest = revisions.at(-1)
  if (trip.phase !== 'planning' || !latest || latest.approvedAt !== undefined) return undefined
  return latest.result.status === 'COMPLETED' && !isStale(latest, trip) ? latest.id : undefined
}

/** Lần chạy của chuyến, mới nhất trước. */
export function buildRunHistory(source: Source): RunHistoryRow[] {
  const { runs, revisions, userNames } = source
  const pendingId = pendingRevisionId(source)
  const approvedSources = new Set(revisions.flatMap((revision) => (revision.approvedAt !== undefined && revision.sourceRevisionId ? [revision.sourceRevisionId] : [])))
  return runs
    .map(({ plans = [], ...run }): RunHistoryRow => {
      const first = revisions.find((item) => item.id === plans[0]?.revisionId)
      const rows = plans.map((plan): RunPlanRow => ({ ...plan, label: PLAN_LABELS[plan.objective], approved: approvedSources.has(plan.revisionId) }))
      return {
        ...run,
        runnerName: run.by === null ? null : (userNames.get(run.by) ?? null),
        timeLimitSeconds: first?.request.settings.timeLimitSeconds ?? null,
        randomSeed: first?.request.settings.randomSeed ?? null,
        plans: rows,
        approval: rows.some(({ approved }) => approved) ? 'approved' : rows.some(({ revisionId }) => revisionId === pendingId) ? 'pending' : null,
      }
    })
    .toReversed()
}
