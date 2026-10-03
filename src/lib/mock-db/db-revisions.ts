import { deadlineReview } from '@/domain/constraints'
import { found, nextId, put, type DbContext } from './db-context'
import { MockDbError } from './errors'
import { approvalIssues, approvedResult, isStale } from './revisions'
import { DEFAULT_RUN_SETTINGS } from './source-types'
import type { MockDb, Trip } from './types'

type RevisionMethods = Pick<MockDb, 'listRevisions' | 'getRevision' | 'addRevision' | 'approveRevision'>

/** Tối ưu và Duyệt chỉ ở pha lập kế hoạch: kho đã bắt đầu xếp thì phương án đã chốt (D-45). */
function assertPlanning(trip: Trip) {
  if (trip.phase !== 'planning') throw new MockDbError('TRIP_LOCKED', { tripId: trip.id, phase: trip.phase })
}

/** Revision thuộc công ty của chuyến (D-64): đọc và ghi theo phạm vi của chuyến đó. */
export function revisionMethods(ctx: DbContext): RevisionMethods {
  const { trips, revisions } = ctx.state
  return {
    listRevisions: (tripId) =>
      ctx.respond(() => {
        ctx.scope.trips.read(tripId)
        return [...revisions.values()].filter((revision) => revision.tripId === tripId)
      }),
    getRevision: (id) => ctx.respond(() => ctx.scope.revisions.read(id)),
    addRevision: ({ tripId, request, result, run = DEFAULT_RUN_SETTINGS }) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
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
    approveRevision: (revisionId, patches, { force = false } = {}) =>
      ctx.respond(() => {
        const source = ctx.scope.revisions.own(revisionId)
        const trip = found(trips, 'trips', source.tripId)
        assertPlanning(trip)
        if (isStale(source, trip)) throw new MockDbError('REVISION_STALE', { revisionId })
        if (source.result.status !== 'COMPLETED') throw new MockDbError('REVISION_NOT_COMPLETED', { revisionId })
        const result = approvedResult(source.request, source.result, patches)
        // Kho kiểm lại lý do chặn trên chính bản sẽ duyệt (D-80): `force` không gỡ được lý do nào ở đây
        const blocking = approvalIssues(source.request, result)
        if (blocking.length > 0) {
          throw new MockDbError('APPROVAL_BLOCKED', { revisionId, count: blocking.length, codes: [...new Set(blocking.map(({ code }) => code))] })
        }
        // Điểm trễ hạn dự kiến không chặn, nhưng người duyệt phải xác nhận (`force`); điểm sát hạn không hỏi
        const late = deadlineReview(trip.routePlan?.stops ?? []).missed.map(({ stopId }) => stopId)
        if (late.length > 0 && !force) {
          const stopNumbers = late.map((stopId) => trip.stops.findIndex((stop) => stop.id === stopId) + 1)
          throw new MockDbError('LATE_STOPS_UNCONFIRMED', { tripId: trip.id, stopIds: late, stopNumbers })
        }
        const approvedAt = ctx.nowIso()
        const approved = put(revisions, {
          ...source,
          id: nextId('REV', revisions.keys()),
          result,
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
          // Chỉ ghi khi người duyệt đã xác nhận duyệt dù có điểm trễ hạn dự kiến
          ...(late.length > 0 ? { lateStops: late.length } : {}),
        })
        return approved
      }),
  }
}
