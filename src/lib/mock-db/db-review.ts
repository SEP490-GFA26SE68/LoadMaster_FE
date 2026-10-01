import { found, nextId, type DbContext, type DbState } from './db-context'
import type { Review1Db } from './db-api-review1'
import { MockDbError } from './errors'
import { isStale } from './revisions'
import type { ReviewDecision, ReviewDecisionKind, ReviewQueueItem } from './source-types'
import type { Revision } from './types'

type ReviewMethods = Pick<Review1Db, 'listReviewQueue' | 'listReviewDecisions' | 'rejectRevision' | 'requestReoptimization' | 'suggestPlanChange'>

/**
 * Bản chờ duyệt của chuyến: bản tối ưu **mới nhất** (revision cuối, chưa duyệt) của chuyến ở pha lập kế hoạch, hoàn tất, không lỗi thời
 * và chưa có quyết định nào của quản lý. Duyệt tạo revision approved mới nằm sau nên bản đã duyệt không còn là bản cuối.
 */
export function pendingRevision(state: DbState, tripId: string): Revision | undefined {
  const trip = state.trips.get(tripId)
  if (trip?.phase !== 'planning') return undefined
  const latest = [...state.revisions.values()].findLast((revision) => revision.tripId === tripId)
  if (!latest || latest.approvedAt !== undefined || latest.result.status !== 'COMPLETED' || isStale(latest, trip)) return undefined
  return state.reviews.some((decision) => decision.revisionId === latest.id) ? undefined : latest
}

/** Người chạy tối ưu tạo revision, lấy từ lịch sử lần chạy. */
function runnerOf(state: DbState, revisionId: string): string | null {
  // Bản chỉnh tay (LM-108) không có lần chạy: người gửi là người lưu bản chỉnh
  return [...state.runs.values()].find((run) => run.revisionId === revisionId)?.by ?? state.revisions.get(revisionId)?.editedBy ?? null
}

/** Quyết định của quản lý (luồng 4), LM-104. Lịch sử lần chạy tối ưu nằm ở `db-runs.ts`. */
export function reviewMethods(ctx: DbContext): ReviewMethods {
  const { state } = ctx
  const { trips, revisions, reviews } = state

  function decide(revisionId: string, kind: ReviewDecisionKind, reason: string, vehicleId?: string): ReviewDecision {
    const revision = found(revisions, 'revisions', revisionId)
    if (pendingRevision(state, revision.tripId)?.id !== revisionId) throw new MockDbError('REVISION_NOT_REVIEWABLE', { revisionId })
    const trimmed = reason.trim()
    if (trimmed === '') throw new MockDbError('REASON_REQUIRED', {})
    if (vehicleId !== undefined) found(state.vehicles, 'vehicles', vehicleId)
    const decision: ReviewDecision = {
      id: nextId('RVW', reviews.map((item) => item.id)),
      tripId: revision.tripId, revisionId, kind, reason: trimmed,
      ...(vehicleId === undefined ? {} : { vehicleId }),
      at: ctx.nowIso(), by: state.session.userId,
    }
    reviews.push(structuredClone(decision))
    const action = kind === 'rejected' ? 'review.rejected' : kind === 'reoptimize_requested' ? 'review.reoptimizeRequested' : 'review.changeSuggested'
    ctx.log(action, { type: 'trip', id: revision.tripId }, { revisionId, reason: trimmed, ...(kind.endsWith('_suggested') ? { suggestion: kind } : {}) })
    return decision
  }

  return {
    listReviewQueue: () =>
      ctx.respond(() =>
        [...trips.values()]
          .flatMap((trip): ReviewQueueItem[] => {
            const revision = pendingRevision(state, trip.id)
            if (!revision) return []
            return [{
              tripId: trip.id, tripName: trip.name, scheduledDate: trip.scheduledDate, vehicleId: trip.vehicleId,
              revisionId: revision.id, jobId: revision.jobId, submittedAt: revision.createdAt, submittedBy: runnerOf(state, revision.id),
              metrics: revision.result.metrics, isMockResult: revision.result.isMockResult, manuallyEdited: revision.manuallyEdited,
              ...(revision.run ? { run: revision.run } : {}),
            }]
          })
          .toSorted((a, b) => (a.submittedAt < b.submittedAt ? -1 : a.submittedAt > b.submittedAt ? 1 : 0)),
      ),
    listReviewDecisions: (tripId) => ctx.respond(() => reviews.filter((decision) => tripId === undefined || decision.tripId === tripId)),
    rejectRevision: (revisionId, reason) => ctx.respond(() => decide(revisionId, 'rejected', reason)),
    requestReoptimization: (revisionId, reason) => ctx.respond(() => decide(revisionId, 'reoptimize_requested', reason)),
    suggestPlanChange: (revisionId, { kind, note, vehicleId }) =>
      ctx.respond(() => decide(revisionId, kind === 'change_vehicle' ? 'change_vehicle_suggested' : 'split_trip_suggested', note, kind === 'change_vehicle' ? vehicleId : undefined)),
  }
}
