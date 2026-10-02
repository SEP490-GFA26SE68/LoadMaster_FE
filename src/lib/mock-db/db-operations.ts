import { found, nextId, put, type DbContext } from './db-context'
import { departTripPackages, settleLoadedPackages, settleStopPackages, stageTripPackages } from './db-package-progress'
import { departTripRequirements } from './db-requirement-trips'
import { MockDbError } from './errors'
import { latestApproved, loadingRemaining, missingIds, plannedStops, stopItemIds } from './operations'
import { isStale } from './revisions'
import type { DeliveryProgress, LoadingProgress, MockDb, Revision, StopProgress, Trip, TripPhase } from './types'

type OperationMethods = Pick<
  MockDb,
  'startLoading' | 'recordLoadingStep' | 'completeLoading' | 'startDelivery' | 'recordUnload' | 'reportDeliveryIssue' | 'completeStop'
>

function assertPhase(trip: Trip, phase: TripPhase) {
  if (trip.phase !== phase) throw new MockDbError('TRIP_PHASE_INVALID', { tripId: trip.id, phase: trip.phase })
}

/** Tiến độ xếp của chuyến ở pha `loading` trở đi — luôn có vì chỉ `startLoading` đưa chuyến ra khỏi `planning`. */
function loadingOf(trip: Trip): LoadingProgress {
  if (!trip.loading) throw new Error(`Chuyến ${trip.id} ở pha ${trip.phase} nhưng không có tiến độ xếp`)
  return trip.loading
}

function deliveryOf(trip: Trip): DeliveryProgress {
  if (!trip.delivery) throw new Error(`Chuyến ${trip.id} ở pha ${trip.phase} nhưng không có tiến độ giao`)
  return trip.delivery
}

/** Điểm giao hiện tại: điểm chưa hoàn tất đầu tiên; thao tác trên điểm khác bị từ chối. */
function currentStop(trip: Trip, stopNumber: number): StopProgress {
  const current = deliveryOf(trip).stops.find((stop) => stop.completedAt === undefined)
  if (current?.number !== stopNumber) throw new MockDbError('STOP_NOT_CURRENT', { tripId: trip.id, stopNumber })
  return current
}

/** Tiến độ xếp ở kho và giao hàng: mọi hàm ghi vào một chuyến của công ty của phiên (D-64). */
export function operationMethods(ctx: DbContext): OperationMethods {
  const { trips, revisions } = ctx.state

  /** Phương án kho đang làm theo (bản duyệt lúc bắt đầu xếp). */
  function planOf(trip: Trip): Revision {
    return found(revisions, 'revisions', loadingOf(trip).revisionId)
  }

  function withDelivery(trip: Trip, update: (delivery: DeliveryProgress) => DeliveryProgress): Trip {
    return put(trips, { ...trip, delivery: update(deliveryOf(trip)) })
  }

  return {
    startLoading: (tripId) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertPhase(trip, 'planning')
        const approved = latestApproved([...revisions.values()].filter((revision) => revision.tripId === tripId))
        if (!approved) throw new MockDbError('NO_APPROVED_REVISION', { tripId })
        if (isStale(approved, trip)) throw new MockDbError('REVISION_STALE', { revisionId: approved.id })
        const loading: LoadingProgress = { revisionId: approved.id, startedAt: ctx.nowIso(), startedBy: ctx.state.session.userId, steps: [] }
        ctx.log('loading.started', { type: 'trip', id: tripId }, { revisionId: approved.id })
        stageTripPackages(ctx, trip)
        return put(trips, { ...trip, phase: 'loading', loading })
      }),
    recordLoadingStep: (tripId, { packageInstanceId, outcome }) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertPhase(trip, 'loading')
        if (!plannedStops(planOf(trip)).has(packageInstanceId)) throw new MockDbError('INSTANCE_NOT_IN_PLAN', { tripId, packageInstanceId })
        const loading = loadingOf(trip)
        const steps = [...loading.steps.filter((step) => step.packageInstanceId !== packageInstanceId), { packageInstanceId, outcome, at: ctx.nowIso() }]
        if (outcome === 'missing') ctx.log('loading.missing', { type: 'trip', id: tripId }, { packageInstanceId })
        return put(trips, { ...trip, loading: { ...loading, steps } })
      }),
    completeLoading: (tripId) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertPhase(trip, 'loading')
        const remaining = loadingRemaining(trip, planOf(trip))
        if (remaining > 0) throw new MockDbError('LOADING_INCOMPLETE', { tripId, remaining })
        const loading = loadingOf(trip)
        const missing = missingIds(trip).size
        ctx.log('loading.completed', { type: 'trip', id: tripId }, { loaded: loading.steps.length - missing, missing })
        settleLoadedPackages(ctx, trip)
        return put(trips, { ...trip, phase: 'loaded', loading: { ...loading, completedAt: ctx.nowIso() } })
      }),
    startDelivery: (tripId) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertPhase(trip, 'loaded')
        const delivery: DeliveryProgress = {
          startedAt: ctx.nowIso(),
          startedBy: ctx.state.session.userId,
          stops: trip.stops.map((_, index) => ({ number: index + 1, unloadedIds: [] })),
          issues: [],
        }
        ctx.log('delivery.started', { type: 'trip', id: tripId })
        departTripPackages(ctx, trip)
        departTripRequirements(ctx, trip)
        return put(trips, { ...trip, phase: 'delivering', delivery })
      }),
    recordUnload: (tripId, stopNumber, packageInstanceId, unloaded) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertPhase(trip, 'delivering')
        currentStop(trip, stopNumber)
        if (plannedStops(planOf(trip)).get(packageInstanceId) !== stopNumber) throw new MockDbError('INSTANCE_NOT_IN_PLAN', { tripId, packageInstanceId })
        if (missingIds(trip).has(packageInstanceId)) throw new MockDbError('INSTANCE_NOT_LOADED', { tripId, packageInstanceId })
        return withDelivery(trip, (delivery) => ({
          ...delivery,
          stops: delivery.stops.map((stop) => {
            if (stop.number !== stopNumber) return stop
            const others = stop.unloadedIds.filter((id) => id !== packageInstanceId)
            return { ...stop, unloadedIds: unloaded ? [...others, packageInstanceId] : others }
          }),
        }))
      }),
    reportDeliveryIssue: (tripId, { stopNumber, packageInstanceId, kind, note }) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertPhase(trip, 'delivering')
        currentStop(trip, stopNumber)
        if (packageInstanceId !== undefined) {
          if (plannedStops(planOf(trip)).get(packageInstanceId) !== stopNumber) throw new MockDbError('INSTANCE_NOT_IN_PLAN', { tripId, packageInstanceId })
          if (missingIds(trip).has(packageInstanceId)) throw new MockDbError('INSTANCE_NOT_LOADED', { tripId, packageInstanceId })
        }
        const trimmed = note.trim()
        // "Khác" không tự nói lên chuyện gì: phải có ghi chú
        if (kind === 'other' && trimmed === '') throw new MockDbError('REASON_REQUIRED', {})
        return withDelivery(trip, (delivery) => {
          const id = nextId('ISS', delivery.issues.map((issue) => issue.id))
          const issue = { id, stopNumber, kind, note: trimmed, at: ctx.nowIso(), reportedBy: ctx.state.session.userId, ...(packageInstanceId === undefined ? {} : { packageInstanceId }) }
          ctx.log('delivery.issue', { type: 'trip', id: tripId }, { kind, stopNumber, ...(packageInstanceId === undefined ? {} : { packageInstanceId }) })
          return { ...delivery, issues: [...delivery.issues, issue] }
        })
      }),
    completeStop: (tripId, stopNumber) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertPhase(trip, 'delivering')
        const stop = currentStop(trip, stopNumber)
        const delivery = deliveryOf(trip)
        const withIssue = new Set(delivery.issues.filter((issue) => issue.stopNumber === stopNumber).map((issue) => issue.packageInstanceId))
        const remaining = stopItemIds(trip, planOf(trip), stopNumber).filter((id) => !stop.unloadedIds.includes(id) && !withIssue.has(id)).length
        if (remaining > 0) throw new MockDbError('STOP_INCOMPLETE', { tripId, stopNumber, remaining })
        const at = ctx.nowIso()
        const stops = delivery.stops.map((item) => (item.number === stopNumber ? { ...item, completedAt: at } : item))
        ctx.log('delivery.stopCompleted', { type: 'trip', id: tripId }, { stopNumber })
        settleStopPackages(ctx, trip, stopNumber)
        const done = stops.every((item) => item.completedAt !== undefined)
        if (!done) return put(trips, { ...trip, delivery: { ...delivery, stops } })
        ctx.log('delivery.completed', { type: 'trip', id: tripId }, { stops: stops.length, issues: delivery.issues.length })
        return put(trips, { ...trip, phase: 'completed', delivery: { ...delivery, stops, completedAt: at } })
      }),
  }
}
