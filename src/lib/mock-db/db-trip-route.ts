import { put, type DbContext } from './db-context'
import type { Review1Db } from './db-api-review1'
import { syncTripPool } from './db-trip-packages'
import { MockDbError } from './errors'
import { optimizedStopOrder, reorderStops, routePlanOf, stopsWithoutCoordinates } from './trip-route'
import type { RouteStopEta, TripRoutePlan } from './source-types'
import type { Trip } from './types'

type RouteMethods = Pick<Review1Db, 'optimizeTripRoute' | 'getTripEta'>

/** Một điểm của tuyến đã tối ưu: số điểm (1-based), giờ đến dự kiến, hạn và mức hạn (`GET /api/trips/{id}/eta`). */
export type TripEtaStop = RouteStopEta & { number: number; deadline?: string }

export type TripEta = Omit<TripRoutePlan, 'stops'> & { stops: TripEtaStop[] }

/**
 * Tối ưu tuyến của chuyến (FE-4b-09, D-76) bằng mock `@/domain/routing` — không tốn credit. Chuyến còn lập kế hoạch, có ít nhất một
 * điểm giao (`ROUTE_STOPS_REQUIRED`) và mọi điểm có toạ độ (`MISSING_STOP_COORDINATES` chỉ đúng điểm thiếu). Điểm giao được xếp lại
 * theo thứ tự đi, dòng kiện đánh số lại — thứ tự đổi thì `inputVersion` tăng, phương án 3D đang có thành lỗi thời (D-31). Chuyến ghi
 * `routePlan` và thành Đã lập kế hoạch (PRD v2 mục 7.1).
 */
export function routeMethods(ctx: DbContext): RouteMethods {
  const { trips } = ctx.state
  return {
    optimizeTripRoute: (tripId) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        if (trip.phase !== 'planning') throw new MockDbError('TRIP_LOCKED', { tripId, phase: trip.phase })
        if (trip.stops.length === 0) throw new MockDbError('ROUTE_STOPS_REQUIRED', { tripId })
        const missing = stopsWithoutCoordinates(trip.stops)
        if (missing.length > 0) {
          throw new MockDbError('MISSING_STOP_COORDINATES', { tripId, stopIds: missing.map((stop) => stop.stopId), stopNumbers: missing.map((stop) => stop.number) })
        }
        const ordered = reorderStops(trip.stops, trip.packages, optimizedStopOrder(trip))
        const routed: Trip = { ...trip, stops: [...ordered.stops], packages: [...ordered.packages], inputVersion: trip.inputVersion + (ordered.changed ? 1 : 0) }
        const routePlan = routePlanOf(routed, { optimizedAt: ctx.nowIso(), optimizedBy: ctx.state.session.userId })
        const stored = put(trips, { ...routed, routePlan })
        // Dòng kiện đã đánh số lại: kiện kho kiện của chuyến đồng bộ theo điểm giao của dòng (FE-3b-07)
        if (ordered.changed) syncTripPool(ctx, stored)
        ctx.log('trip.routeOptimized', { type: 'trip', id: tripId }, {
          stops: stored.stops.length, totalKm: routePlan.totalKm, totalMinutes: routePlan.totalMinutes, lateStops: routePlan.missedStopIds.length,
        })
        return stored
      }),
    getTripEta: (tripId) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.read(tripId)
        if (!trip.routePlan) return null
        const stopById = new Map(trip.stops.map((stop, index) => [stop.id, { number: index + 1, deadline: stop.deadline }]))
        const { stops, ...plan } = trip.routePlan
        return {
          ...plan,
          stops: stops.map((eta) => {
            const stop = stopById.get(eta.stopId)
            return { ...eta, number: stop?.number ?? 0, ...(stop?.deadline === undefined ? {} : { deadline: stop.deadline }) }
          }),
        }
      }),
  }
}
