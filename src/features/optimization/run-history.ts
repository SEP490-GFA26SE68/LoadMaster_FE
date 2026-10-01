import { isStale, type OptimizationRun, type Revision, type Trip } from '@/lib/mock-db'

/**
 * Lịch sử lần chạy tối ưu của chuyến (LM-104) ghép từ kho: lần chạy, revision nó tạo và việc duyệt revision đó. Mọi ô đều truy được
 * về kho — lần chạy hỏng không có revision nên không có giới hạn thời gian, seed hay tải trọng.
 */

/** Phương án một lần chạy tạo ra: đã được duyệt, hoặc đang là bản chờ duyệt của chuyến. */
export type RunApproval = 'approved' | 'pending'

export type RunHistoryRow = OptimizationRun & {
  readonly runnerName: string | null
  /** Từ `request.settings` của revision; `null` với lần chạy hỏng (kho không lưu request của lần hỏng). */
  readonly timeLimitSeconds: number | null
  readonly randomSeed: number | null
  readonly payloadUtilizationPercent: number | null
  /** `null`: lần chạy hỏng, hoặc phương án chưa từng duyệt mà không còn là bản chờ duyệt (đã có bản mới hơn, lỗi thời, chuyến đã chốt). */
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
 * Duyệt tạo revision đã duyệt mới nằm sau, nên chuyến vừa duyệt không còn bản chờ.
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
  const approvalOf = (revisionId: string | undefined): RunApproval | null => {
    if (revisionId === undefined) return null
    if (revisions.some((revision) => revision.sourceRevisionId === revisionId && revision.approvedAt !== undefined)) return 'approved'
    return revisionId === pendingId ? 'pending' : null
  }
  return runs
    .map((run): RunHistoryRow => {
      const revision = run.revisionId === undefined ? undefined : revisions.find((item) => item.id === run.revisionId)
      return {
        ...run,
        runnerName: run.by === null ? null : (userNames.get(run.by) ?? null),
        timeLimitSeconds: revision?.request.settings.timeLimitSeconds ?? null,
        randomSeed: revision?.request.settings.randomSeed ?? null,
        payloadUtilizationPercent: revision?.result.metrics.payloadUtilizationPercent ?? null,
        approval: approvalOf(run.revisionId),
      }
    })
    .toReversed()
}
