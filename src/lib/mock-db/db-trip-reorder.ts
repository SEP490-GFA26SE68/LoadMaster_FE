import { checkStopReorder, type ReorderCargo } from '@/domain/constraints'
import type { PackagePlacement } from '@/domain/models'
import { checkProposedOrder } from '@/domain/routing'
import type { ReorderDb } from './db-api-reorder'
import { put, type DbContext } from './db-context'
import { advanceTracking, refreshLiveEta } from './db-tracking'
import { MockDbError } from './errors'
import { leftOutIds, plannedStops } from './operations'
import { planNumberOf } from './plan-stops'
import { assertRole } from './session-role'
import { routePlanOf, stopsWithoutCoordinates } from './trip-route'
import { renumberTripStops } from './trip-stop-renumber'
import { simulatedSnapshot } from './trip-tracking'
import type { Trip } from './types'

/** Kiện còn phải dỡ với điểm giao (mã điểm) của nó; `label` là mã hiện cho người đọc. */
type OnboardCargo = { placement: PackagePlacement; stopId: string; label: string }

/**
 * Kiện còn trên xe (hoặc sắp lên xe, với yêu cầu nhận chưa tới điểm nhận) mà việc đổi thứ tự điểm ảnh hưởng: kiện của phương án đã xếp
 * chưa dỡ và không bị bỏ lại kho, cộng kiện nhận dọc đường đã có chỗ (`PickupRequest.layout`) chưa giao. Kiện thuộc điểm đã hoàn tất
 * (khách từ chối, ở lại xe) không có mặt: chúng không còn được dỡ ở điểm nào, và điểm của chúng đứng trước mọi điểm còn lại.
 */
function onboardCargo(ctx: DbContext, trip: Trip): OnboardCargo[] {
  const { revisions, pickups, packages } = ctx.state
  const done = new Set(trip.delivery?.stops.filter((stop) => stop.completedAt !== undefined).map((stop) => trip.stops[stop.number - 1]?.id))
  const gone = new Set([...(trip.delivery?.stops.flatMap((stop) => stop.unloadedIds) ?? []), ...leftOutIds(trip)])
  const cargo: OnboardCargo[] = []

  const plan = revisions.get(trip.loading?.revisionId ?? '')
  if (plan) {
    const stopNumbers = plannedStops(plan, trip.stops)
    for (const placement of plan.result.placements) {
      const stopId = trip.stops[(stopNumbers.get(placement.packageInstanceId) ?? 0) - 1]?.id
      if (stopId !== undefined && !gone.has(placement.packageInstanceId) && !done.has(stopId)) cargo.push({ placement, stopId, label: placement.packageInstanceId })
    }
  }

  for (const request of pickups.values()) {
    if (request.tripId !== trip.id || (request.status !== 'APPROVED' && request.status !== 'LOADED') || request.deliveryStopId === undefined || done.has(request.deliveryStopId)) continue
    for (const spot of request.layout?.placements ?? []) {
      const pkg = packages.get(request.packageIds?.[spot.packageIndex] ?? '')
      if (pkg === undefined || pkg.status === 'DELIVERED' || pkg.status === 'RETURNED') continue
      cargo.push({
        stopId: request.deliveryStopId, label: pkg.packageCode,
        placement: {
          packageInstanceId: `${pkg.id}-01`, orientation: spot.orientation, xCm: spot.xCm, yCm: spot.yCm, zCm: spot.zCm,
          placedLengthCm: spot.placedLengthCm, placedWidthCm: spot.placedWidthCm, placedHeightCm: spot.placedHeightCm,
          loadingOrder: 1, unloadingOrder: 1, supportRatio: 1, constraintWarnings: [],
        },
      })
    }
  }
  return cargo
}

/**
 * Đổi thứ tự các điểm chưa giao của chuyến **đang vận chuyển** (FE-BL-03, D-87). Đây là **ngoại lệ thứ hai** của `TRIP_LOCKED` khi chuyến
 * đã rời kho, hẹp như ngoại lệ nhận hàng dọc đường (`db-pickup-stops.ts`): một hàm, điều phối viên, chuyến Đang vận chuyển — `updateTrip`,
 * `changeTripVehicle`, tối ưu tuyến… vẫn từ chối. Luật thứ tự ở `checkProposedOrder`, khả năng dỡ ở `checkStopReorder` (domain); số điểm
 * đổi theo `renumberTripStops` và `DeliveryStop.planNumber` như khi chèn điểm nhận, nên phương án đã duyệt không đổi và **không** lỗi
 * thời (`inputVersion` giữ nguyên); `routePlan` giữ lại và tính lại giờ đến, mức hạn. Xe mô phỏng đi tiếp từ điểm vị trí gần nhất tới điểm
 * kế tiếp mới (`DeliveryProgress.redirect`): các điểm vị trí đã ghi theo thứ tự cũ được ghi bù trước khi đổi.
 */
export function reorderMethods(ctx: DbContext): ReorderDb {
  return {
    reorderRunningStops: (tripId, orderedStopIds) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertRole(ctx, 'dispatcher')
        const { delivery } = trip
        if (trip.phase !== 'delivering' || !delivery) throw new MockDbError('TRIP_PHASE_INVALID', { tripId, phase: trip.phase })
        const missing = stopsWithoutCoordinates(trip.stops)
        if (missing.length > 0) throw new MockDbError('MISSING_STOP_COORDINATES', { tripId, stopIds: missing.map((stop) => stop.stopId), stopNumbers: missing.map((stop) => stop.number) })

        const current = trip.stops.map((stop) => stop.id)
        const fixedCount = Math.max(0, ...delivery.stops.filter((stop) => stop.completedAt !== undefined || stop.arrivedAt !== undefined).map((stop) => stop.number))
        const pickups = [...ctx.state.pickups.values()].flatMap((request) => (
          request.tripId === tripId && request.status === 'APPROVED' && request.pickupStopId !== undefined && request.deliveryStopId !== undefined
            ? [{ pickupStopId: request.pickupStopId, deliveryStopId: request.deliveryStopId }] : []
        ))
        const violation = checkProposedOrder({ current, proposed: orderedStopIds, fixedCount, pickups })
        if (violation?.code === 'STOP_ORDER_INVALID') throw new MockDbError('STOP_ORDER_INVALID', { tripId })
        if (violation?.code === 'STOP_NOT_MOVABLE') throw new MockDbError('STOP_NOT_MOVABLE', { tripId, stopIds: [...violation.stopIds] })
        if (violation?.code === 'PICKUP_AFTER_DELIVERY') throw new MockDbError('PICKUP_AFTER_DELIVERY', { tripId, pickupStopId: violation.pickupStopId, deliveryStopId: violation.deliveryStopId })

        // Điểm vị trí tới giờ hiện tại ghi theo thứ tự cũ, trước khi thứ tự đổi
        const last = advanceTracking(ctx, trip)?.points.at(-1)

        // Khả năng dỡ: kiện nào bị che kín theo thứ tự mới mà trước đó chưa bị thì từ chối
        const cargo = onboardCargo(ctx, trip)
        const check = (order: readonly string[]) => checkStopReorder(cargo.map((item): ReorderCargo => ({ placement: item.placement, rank: order.indexOf(item.stopId) + 1 })))
        const before = check(current)
        const after = check(orderedStopIds)
        const wasBlocked = new Set(before.blocked.map((item) => item.packageInstanceId))
        const known = new Set([...wasBlocked, ...before.partial.map((item) => item.packageInstanceId)])
        const labelOf = new Map(cargo.map((item) => [item.placement.packageInstanceId, item]))
        const newlyBlocked = after.blocked.filter((item) => !wasBlocked.has(item.packageInstanceId))
        if (newlyBlocked.length > 0) {
          const blockedCargo = newlyBlocked.map((item) => labelOf.get(item.packageInstanceId))
          throw new MockDbError('STOP_ORDER_BLOCKS_CARGO', { tripId, packages: blockedCargo.map((item) => item?.label ?? ''), stopIds: blockedCargo.map((item) => item?.stopId ?? '') })
        }
        const partial = after.partial.filter((item) => !known.has(item.packageInstanceId)).map((item) => ({ packageId: labelOf.get(item.packageInstanceId)?.label ?? '', stopId: labelOf.get(item.packageInstanceId)?.stopId ?? '' }))

        // Xe đi tiếp từ chỗ nó đang đứng tới điểm kế tiếp mới (điểm đầu tiên sau các điểm cố định)
        const nextStopId = orderedStopIds[fixedCount] as string
        const vehicle = last?.source === 'SIMULATED' ? simulatedSnapshot(trip, last.recordedAt, ctx.state.exceptions.get(tripId)?.holds ?? [])?.vehicle : undefined
        const redirect = last === undefined ? undefined : {
          stopId: nextStopId, lat: last.lat, lng: last.lng,
          at: vehicle?.restEndsAt ?? last.recordedAt, drivenMs: vehicle?.restEndsAt === undefined ? (vehicle?.drivenMs ?? 0) : 0,
        }

        const own = new Map(trip.stops.map((stop, index) => [stop.id, { ...stop, planNumber: planNumberOf(trip.stops, index) }]))
        const stops = orderedStopIds.map((id) => own.get(id) as NonNullable<ReturnType<typeof own.get>>)
        const { routePlan } = trip
        const renumbered = renumberTripStops(ctx, trip, stops)
        const next = renumbered.delivery === undefined || redirect === undefined ? renumbered : { ...renumbered, delivery: { ...renumbered.delivery, redirect } }
        const stored: Trip = put(ctx.state.trips, routePlan === undefined ? next : { ...next, routePlan: routePlanOf(next, routePlan) })
        refreshLiveEta(ctx, stored)

        ctx.log('trip.stopsReordered', { type: 'trip', id: tripId }, {
          count: orderedStopIds.filter((id, index) => id !== current[index]).length,
          ...(stored.routePlan === undefined ? {} : { lateStops: stored.routePlan.missedStopIds.length }),
          ...(trip.driverId === null ? {} : { driverId: trip.driverId }),
        })
        return { trip: stored, partial }
      }),
  }
}
