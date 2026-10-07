import { deadlineReview } from '@/domain/constraints'
import type { OptimizationRequest, OptimizationResult, PlanObjective } from '@/domain/models'
import { claimReservedCredit } from './db-billing'
import { found, nextId, put, type DbContext } from './db-context'
import { MockDbError } from './errors'
import { tripStatus } from './operations'
import { approvalIssues, approvedResult, isStale } from './revisions'
import { DEFAULT_RUN_ALGORITHM, DEFAULT_RUN_SETTINGS, type OptimizationAlgorithm, type OptimizationRun } from './source-types'
import type { MockDb, Revision, Trip } from './types'

type RevisionMethods = Pick<MockDb, 'listRevisions' | 'getRevision' | 'addRevision' | 'saveOptimizationRun' | 'approveRevision'>

/** Tối ưu và Duyệt chỉ ở pha lập kế hoạch: kho đã bắt đầu xếp thì phương án đã chốt (D-45). */
function assertPlanning(trip: Trip) {
  if (trip.phase !== 'planning') throw new MockDbError('TRIP_LOCKED', { tripId: trip.id, phase: trip.phase })
}

type RunInput = {
  trip: Trip
  request: OptimizationRequest
  jobId: string
  algorithm: OptimizationAlgorithm
  plans: readonly { objective: PlanObjective; result: OptimizationResult }[]
}

/**
 * Ghi một lần chạy xong: mỗi phương án một revision bất biến mang `inputVersion` hiện tại của chuyến và mã lần chạy, rồi lần chạy
 * và một sự kiện `optimization.saved` (lần chạy một phương án ghi thêm số kiện đã xếp / chưa xếp của phương án đó).
 */
function storeRun(ctx: DbContext, { trip, request, jobId, algorithm, plans }: RunInput): { run: OptimizationRun; revisions: Revision[] } {
  const { revisions, runs } = ctx.state
  const runId = nextId('RUN', runs.keys())
  const at = ctx.nowIso()
  const saved = plans.map(({ objective, result }) => put(revisions, {
    run: { objective, algorithm },
    runId,
    id: nextId('REV', revisions.keys()),
    jobId: result.jobId,
    tripId: trip.id,
    request,
    result,
    inputVersion: trip.inputVersion,
    createdAt: at,
    manuallyEdited: false,
    ordersRecomputed: false,
  }))
  const run: OptimizationRun = {
    id: runId, tripId: trip.id, algorithm, status: 'COMPLETED', at, by: ctx.state.session.userId, jobId,
    plans: saved.map((revision, index) => ({
      objective: (plans[index] as RunInput['plans'][number]).objective, revisionId: revision.id, jobId: revision.jobId,
      placedCount: revision.result.metrics.placedCount, unplacedCount: revision.result.metrics.unplacedCount,
      volumeUtilizationPercent: revision.result.metrics.volumeUtilizationPercent,
    })),
  }
  runs.set(runId, structuredClone(run))
  const [only] = saved.length === 1 ? saved : []
  ctx.log('optimization.saved', { type: 'trip', id: trip.id }, {
    runId,
    revisionId: saved.map(({ id }) => id).join(', '),
    ...(only ? { placed: only.result.metrics.placedCount, unplaced: only.result.metrics.unplacedCount } : {}),
  })
  return { run, revisions: saved }
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
        // Lịch sử lần chạy (LM-104): kết quả lưu lẻ là một lần chạy một phương án
        const stored = storeRun(ctx, { trip, request, jobId: result.jobId, algorithm: run.algorithm, plans: [{ objective: run.objective, result }] })
        return stored.revisions[0] as Revision
      }),
    saveOptimizationRun: ({ tripId, request, jobId, plans, algorithm = DEFAULT_RUN_ALGORITHM, creditReference }) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertPlanning(trip)
        // Xếp 3D theo tuyến (PRD v2 mục 8.3): thứ tự điểm giao phải đã chốt bằng tối ưu tuyến
        if (tripStatus(trip) !== 'PLANNED') throw new MockDbError('ROUTE_NOT_PLANNED', { tripId })
        if (plans.length === 0) throw new Error(`Lần chạy của chuyến ${tripId} không có phương án nào`)
        // Credit đã giữ phải còn giữ trước khi ghi gì; lưu xong thì trừ hẳn (FE-8-05, D-89)
        const deduct = creditReference === undefined ? undefined : claimReservedCredit(ctx, creditReference, trip.companyId)
        const saved = storeRun(ctx, { trip, request, jobId, algorithm, plans })
        deduct?.()
        return saved
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
