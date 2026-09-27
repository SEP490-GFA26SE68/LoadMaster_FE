import { found, nextId, put, type DbContext } from './db-context'
import { MockDbError } from './errors'
import { approvedResult, isStale } from './revisions'
import { DEFAULT_RUN_SETTINGS } from './source-types'
import type { MockDb, Trip } from './types'

type RevisionMethods = Pick<MockDb, 'listRevisions' | 'getRevision' | 'addRevision' | 'approveRevision' | 'saveEditedRevision'>

/** Tối ưu và Duyệt chỉ ở pha lập kế hoạch: kho đã bắt đầu xếp thì phương án đã chốt (D-45). */
function assertPlanning(trip: Trip) {
  if (trip.phase !== 'planning') throw new MockDbError('TRIP_LOCKED', { tripId: trip.id, phase: trip.phase })
}

export function revisionMethods(ctx: DbContext): RevisionMethods {
  const { trips, revisions } = ctx.state
  return {
    listRevisions: (tripId) =>
      ctx.respond(() => {
        found(trips, 'trips', tripId)
        return [...revisions.values()].filter((revision) => revision.tripId === tripId)
      }),
    getRevision: (id) => ctx.respond(() => found(revisions, 'revisions', id)),
    addRevision: ({ tripId, request, result, run = DEFAULT_RUN_SETTINGS }) =>
      ctx.respond(() => {
        const trip = found(trips, 'trips', tripId)
        assertPlanning(trip)
        const revision = put(revisions, {
          run: { objective: run.objective, algorithm: run.algorithm },
          id: nextId('REV', revisions.keys()),
          jobId: result.jobId,
          tripId,
          request,
          result,
          inputVersion: trip.inputVersion,
          createdAt: ctx.nowIso(),
          manuallyEdited: false,
          ordersRecomputed: false,
        })
        // Lịch sử lần chạy (LM-104): mỗi revision tối ưu là một lần chạy xong
        const runId = nextId('RUN', ctx.state.runs.keys())
        ctx.state.runs.set(runId, {
          id: runId, tripId, objective: run.objective, algorithm: run.algorithm, status: 'COMPLETED', at: revision.createdAt,
          by: ctx.state.session.userId, revisionId: revision.id, jobId: revision.jobId, placedCount: result.metrics.placedCount,
          unplacedCount: result.metrics.unplacedCount, volumeUtilizationPercent: result.metrics.volumeUtilizationPercent,
        })
        ctx.log('optimization.saved', { type: 'trip', id: tripId }, {
          revisionId: revision.id,
          placed: result.metrics.placedCount,
          unplaced: result.metrics.unplacedCount,
        })
        return revision
      }),
    approveRevision: (revisionId, patches) =>
      ctx.respond(() => {
        const source = found(revisions, 'revisions', revisionId)
        const trip = found(trips, 'trips', source.tripId)
        assertPlanning(trip)
        if (isStale(source, trip)) throw new MockDbError('REVISION_STALE', { revisionId })
        if (source.result.status !== 'COMPLETED') throw new MockDbError('REVISION_NOT_COMPLETED', { revisionId })
        const approvedAt = ctx.nowIso()
        const approved = put(revisions, {
          ...source,
          id: nextId('REV', revisions.keys()),
          result: approvedResult(source.request, source.result, patches),
          createdAt: approvedAt,
          draftPatches: [...patches],
          approvedAt,
          approvedBy: ctx.state.session.userId,
          sourceRevisionId: source.id,
          // Duyệt lại một bản đã chỉnh tay mà không có draft mới vẫn là kết quả đã chỉnh tay
          manuallyEdited: source.manuallyEdited || patches.length > 0,
          ordersRecomputed: true,
        })
        ctx.log('revision.approved', { type: 'trip', id: trip.id }, {
          revisionId: approved.id,
          sourceRevisionId: source.id,
          edits: patches.length,
        })
        return approved
      }),
    saveEditedRevision: (revisionId, patches) =>
      ctx.respond(() => {
        const source = found(revisions, 'revisions', revisionId)
        const trip = found(trips, 'trips', source.tripId)
        assertPlanning(trip)
        if (isStale(source, trip)) throw new MockDbError('REVISION_STALE', { revisionId })
        if (source.result.status !== 'COMPLETED') throw new MockDbError('REVISION_NOT_COMPLETED', { revisionId })
        if (patches.length === 0) throw new MockDbError('NO_EDITS', { revisionId })
        // Bản nguồn có thể là bản đã duyệt: bản chỉnh không mang dấu duyệt của nó
        const { approvedAt: _approvedAt, approvedBy: _approvedBy, ...base } = source
        const edited = put(revisions, {
          ...base,
          id: nextId('REV', revisions.keys()),
          result: approvedResult(source.request, source.result, patches),
          createdAt: ctx.nowIso(),
          draftPatches: [...patches],
          sourceRevisionId: source.id,
          manuallyEdited: true,
          ordersRecomputed: true,
          editedBy: ctx.state.session.userId,
        })
        ctx.log('revision.edited', { type: 'trip', id: trip.id }, {
          revisionId: edited.id,
          sourceRevisionId: source.id,
          edits: patches.length,
        })
        return edited
      }),
  }
}
