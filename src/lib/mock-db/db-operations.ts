import { found, nextId, put, type DbContext } from './db-context'
import { departTripPackages, settleLoadedPackages, settleStopPackages } from './db-package-progress'
import { departTripRequirements } from './db-requirement-trips'
import { labelsOf } from './db-scans'
import { MockDbError } from './errors'
import { latestApproved, leftOutIds, loadingRemaining, plannedStops, stagingRemaining, stopItemIds } from './operations'
import { isStale } from './revisions'
import type { DeliveryProgress, LoadingProgress, MockDb, Revision, StopProgress, Trip, TripPhase } from './types'
import { pendingManualConfirms, withoutPendingConfirm, type VerifyContext } from './verify-model'

type OperationMethods = Pick<
  MockDb,
  'startLoading' | 'completeLoading' | 'startDelivery' | 'arriveAtStop' | 'reportDeliveryIssue' | 'completeStop'
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

/** Điểm giao hiện tại mà tài xế đã bấm "Đã đến" (FE-6-06): chưa đến thì chưa báo sự cố theo kiện, chưa hoàn tất điểm được. */
function arrivedStop(trip: Trip, stopNumber: number): StopProgress {
  const stop = currentStop(trip, stopNumber)
  if (stop.arrivedAt === undefined) throw new MockDbError('STOP_NOT_ARRIVED', { tripId: trip.id, stopNumber })
  return stop
}

/** Còn xác nhận tay chờ điều phối viên duyệt thì chưa xong xếp, chưa hoàn tất điểm giao được (FE-6-04, D-83). */
function assertNoPendingConfirm(trip: Trip, contexts: readonly VerifyContext[], stopNumber?: number) {
  const count = contexts.reduce((sum, context) => sum + pendingManualConfirms(trip, context, stopNumber).length, 0)
  if (count > 0) throw new MockDbError('MANUAL_CONFIRM_PENDING', { tripId: trip.id, count })
}

/**
 * Tiến độ ở kho và giao hàng: mọi hàm ghi vào một chuyến của công ty của phiên (D-64). Không còn lối ghi không đối chiếu (D-83): kiện
 * chỉ được ghi "đã soạn" / "đã xếp" / "đã dỡ" qua hàm đối chiếu (`db-staging.ts`, `db-scans.ts`, `db-manual-confirm.ts`).
 */
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
        // Kiện đã soạn ở phiên trước (chuyến từng quay về Đã lập kế hoạch) giữ `STAGED`: vẫn tính là đã soạn (FE-6-02)
        const planned = plannedStops(approved)
        const stagedIds = labelsOf(ctx, trip)
          .filter((label) => planned.has(label.packageInstanceId) && ctx.state.packages.get(label.poolPackageId)?.status === 'STAGED')
          .map((label) => label.packageInstanceId)
        const loading: LoadingProgress = { revisionId: approved.id, startedAt: ctx.nowIso(), startedBy: ctx.state.session.userId, stagedIds, steps: [] }
        ctx.log('loading.started', { type: 'trip', id: tripId }, { revisionId: approved.id })
        const { replan: _replan, ...rest } = trip
        return put(trips, { ...rest, phase: 'loading', loading })
      }),
    completeLoading: (tripId) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertPhase(trip, 'loading')
        const plan = planOf(trip)
        // Xong xếp khi mọi kiện đã soạn và đã có kết quả xếp (FE-6-05)
        const remaining = Math.max(stagingRemaining(trip, plan).length, loadingRemaining(trip, plan))
        if (remaining > 0) throw new MockDbError('LOADING_INCOMPLETE', { tripId, remaining })
        assertNoPendingConfirm(trip, ['STAGING', 'LOADING'])
        const loading = loadingOf(trip)
        const damaged = leftOutIds(trip).size
        ctx.log('loading.completed', { type: 'trip', id: tripId }, { loaded: loading.steps.length - damaged, damaged })
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
    arriveAtStop: (tripId, stopNumber) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertPhase(trip, 'delivering')
        // Bấm lại ở điểm đã đến: giữ giờ đến đầu tiên
        if (currentStop(trip, stopNumber).arrivedAt !== undefined) return trip
        const at = ctx.nowIso()
        ctx.log('delivery.arrived', { type: 'trip', id: tripId }, { stopNumber })
        return withDelivery(trip, (delivery) => ({
          ...delivery,
          stops: delivery.stops.map((stop) => (stop.number === stopNumber ? { ...stop, arrivedAt: at } : stop)),
        }))
      }),
    reportDeliveryIssue: (tripId, { stopNumber, packageInstanceId, kind, note }) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertPhase(trip, 'delivering')
        currentStop(trip, stopNumber)
        if (packageInstanceId !== undefined) {
          // Sự cố theo kiện xảy ra ở điểm giao: tài xế phải đã đến (FE-6-06)
          arrivedStop(trip, stopNumber)
          if (plannedStops(planOf(trip)).get(packageInstanceId) !== stopNumber) throw new MockDbError('INSTANCE_NOT_IN_PLAN', { tripId, packageInstanceId })
          if (leftOutIds(trip).has(packageInstanceId)) throw new MockDbError('INSTANCE_NOT_LOADED', { tripId, packageInstanceId })
        }
        const trimmed = note.trim()
        // "Khác" không tự nói lên chuyện gì: phải có ghi chú
        if (kind === 'other' && trimmed === '') throw new MockDbError('REASON_REQUIRED', {})
        // Khách từ chối: kiện ở lại xe (D-84) — bỏ dấu đã dỡ và xác nhận tay còn chờ của nó, hoàn tất điểm thì kiện thành Hoàn trả
        const refused = kind === 'refused' && packageInstanceId !== undefined ? packageInstanceId : undefined
        const base = refused === undefined || trip.verifications === undefined
          ? trip
          : { ...trip, verifications: withoutPendingConfirm(trip.verifications, 'UNLOADING', refused) }
        return withDelivery(base, (delivery) => {
          const id = nextId('ISS', delivery.issues.map((issue) => issue.id))
          const issue = { id, stopNumber, kind, note: trimmed, at: ctx.nowIso(), reportedBy: ctx.state.session.userId, ...(packageInstanceId === undefined ? {} : { packageInstanceId }) }
          ctx.log('delivery.issue', { type: 'trip', id: tripId }, { kind, stopNumber, ...(packageInstanceId === undefined ? {} : { packageInstanceId }) })
          const stops = refused === undefined ? delivery.stops : delivery.stops.map((stop) => stop.number !== stopNumber ? stop : {
            ...stop,
            unloadedIds: stop.unloadedIds.filter((item) => item !== refused),
            ...(stop.qrConfirmedIds === undefined ? {} : { qrConfirmedIds: stop.qrConfirmedIds.filter((item) => item !== refused) }),
          })
          return { ...delivery, stops, issues: [...delivery.issues, issue] }
        })
      }),
    completeStop: (tripId, stopNumber) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertPhase(trip, 'delivering')
        const stop = arrivedStop(trip, stopNumber)
        const delivery = deliveryOf(trip)
        const withIssue = new Set(delivery.issues.filter((issue) => issue.stopNumber === stopNumber).map((issue) => issue.packageInstanceId))
        const remaining = stopItemIds(trip, planOf(trip), stopNumber).filter((id) => !stop.unloadedIds.includes(id) && !withIssue.has(id)).length
        if (remaining > 0) throw new MockDbError('STOP_INCOMPLETE', { tripId, stopNumber, remaining })
        assertNoPendingConfirm(trip, ['UNLOADING'], stopNumber)
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
