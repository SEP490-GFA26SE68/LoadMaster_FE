import type { OptimizationRun, ReviewDecision, ReviewDecisionKind, Revision } from '@/lib/mock-db'

/**
 * Lịch sử lần chạy tối ưu của chuyến (luồng 3 Review 1, LM-104) ghép từ kho: lần chạy, revision nó tạo, quyết định của quản lý công ty
 * và hàng đợi chờ duyệt. Mọi ô đều truy được về kho — lần chạy hỏng không có revision nên không có giới hạn thời gian, seed hay tải trọng.
 */

/** Số phận của phương án một lần chạy tạo ra: đã duyệt, đang chờ duyệt, hoặc quản lý đã trả lại (từ chối, yêu cầu tối ưu lại, đề xuất). */
export type RunReview =
  | { readonly kind: 'approved' }
  | { readonly kind: 'pending' }
  | { readonly kind: 'decided'; readonly decision: ReviewDecisionKind }

export type RunHistoryRow = OptimizationRun & {
  readonly runnerName: string | null
  /** Từ `request.settings` của revision; `null` với lần chạy hỏng (kho không lưu request của lần hỏng). */
  readonly timeLimitSeconds: number | null
  readonly randomSeed: number | null
  readonly payloadUtilizationPercent: number | null
  readonly review: RunReview | null
}

/** Quyết định của quản lý chưa có lần chạy nào sau nó — việc điều phối còn phải làm. */
export type OpenDecision = ReviewDecision & { readonly byName: string | null; readonly vehicleName: string | null }

export type RunHistory = {
  /** Mới nhất trước. */
  readonly rows: readonly RunHistoryRow[]
  readonly openDecision: OpenDecision | null
}

type Source = {
  /** Theo thứ tự kho trả (cũ trước). */
  readonly runs: readonly OptimizationRun[]
  readonly revisions: readonly Pick<Revision, 'id' | 'request' | 'result' | 'approvedAt' | 'sourceRevisionId'>[]
  /** Cũ trước. */
  readonly decisions: readonly ReviewDecision[]
  /** Revision đang nằm trong hàng đợi chờ duyệt. */
  readonly pendingRevisionIds: ReadonlySet<string>
  readonly userNames: ReadonlyMap<string, string>
  readonly vehicleNames: ReadonlyMap<string, string>
}

function reviewOf(revisionId: string | undefined, { revisions, decisions, pendingRevisionIds }: Source): RunReview | null {
  if (revisionId === undefined) return null
  if (revisions.some((revision) => revision.sourceRevisionId === revisionId && revision.approvedAt !== undefined)) return { kind: 'approved' }
  const decision = decisions.findLast((item) => item.revisionId === revisionId)
  if (decision) return { kind: 'decided', decision: decision.kind }
  return pendingRevisionIds.has(revisionId) ? { kind: 'pending' } : null
}

export function buildRunHistory(source: Source): RunHistory {
  const { runs, revisions, decisions, userNames, vehicleNames } = source
  const nameOf = (id: string | null) => (id === null ? null : (userNames.get(id) ?? null))
  const rows = runs.map((run): RunHistoryRow => {
    const revision = run.revisionId === undefined ? undefined : revisions.find((item) => item.id === run.revisionId)
    return {
      ...run,
      runnerName: nameOf(run.by),
      timeLimitSeconds: revision?.request.settings.timeLimitSeconds ?? null,
      randomSeed: revision?.request.settings.randomSeed ?? null,
      payloadUtilizationPercent: revision?.result.metrics.payloadUtilizationPercent ?? null,
      review: reviewOf(run.revisionId, source),
    }
  })
  // Mốc ISO của seed mang múi giờ +07:00, mốc mới là UTC: so theo thời điểm, không so chuỗi
  const lastRunAt = Math.max(-Infinity, ...runs.map((run) => Date.parse(run.at)))
  const last = decisions.at(-1)
  const openDecision = last && Date.parse(last.at) > lastRunAt
    ? { ...last, byName: nameOf(last.by), vehicleName: last.vehicleId === undefined ? null : (vehicleNames.get(last.vehicleId) ?? null) }
    : null
  return { rows: rows.toReversed(), openDecision }
}
