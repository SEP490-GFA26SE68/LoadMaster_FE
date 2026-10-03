import { tripReadiness } from '@/domain/constraints'
import { found, put, type DbContext } from './db-context'
import type { Review1Db } from './db-api-review1'
import { MockDbError } from './errors'
import { missingIds, plannedStops } from './operations'
import { tripLinks } from './db-trip-lines'
import { normalizeQrToken } from './qr-token'
import { labelByToken, tripLabels } from './review1-status'
import type { TripLabel } from './source-types'
import type { Trip } from './types'

type ScanMethods = Pick<Review1Db, 'listTripLabels' | 'getTripReadiness' | 'confirmLoadingByQr' | 'recordSeal' | 'confirmUnloadByQr'>

/** Số seal dài tối đa (ký tự). */
export const MAX_SEAL_LENGTH = 32

function assertPhase(trip: Trip, phase: Trip['phase']) {
  if (trip.phase !== phase) throw new MockDbError('TRIP_PHASE_INVALID', { tripId: trip.id, phase: trip.phase })
}

/**
 * Nhãn QR, "Sẵn sàng tối ưu", quét QR khi xếp / dỡ và seal (luồng 2 + 5, LM-104). Mọi hàm nhận một chuyến của công ty của phiên
 * (D-64); mã QR chỉ khớp trong nhãn của chính chuyến đó, nên kiện của công ty khác luôn là `PACKAGE_NOT_IN_TRIP`.
 */
export function scanMethods(ctx: DbContext): ScanMethods {
  const { trips, revisions, packages, vehicles, maintenance } = ctx.state

  function labelsOf(trip: Trip): TripLabel[] {
    return tripLabels(trip, tripLinks(ctx, trip.id), packages)
  }

  /** Nhãn khớp mã quét trong chuyến; không có thì `PACKAGE_NOT_IN_TRIP`. */
  function scanned(trip: Trip, token: string): TripLabel {
    const label = labelByToken(labelsOf(trip), token)
    if (!label) throw new MockDbError('PACKAGE_NOT_IN_TRIP', { tripId: trip.id, token: normalizeQrToken(token) })
    return label
  }

  function planOf(trip: Trip) {
    return found(revisions, 'revisions', trip.loading?.revisionId ?? '')
  }

  return {
    listTripLabels: (tripId) => ctx.respond(() => labelsOf(ctx.scope.trips.read(tripId))),
    getTripReadiness: (tripId) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.read(tripId)
        return tripReadiness({
          vehicle: vehicles.get(trip.vehicleId),
          vehicleInMaintenance: maintenance.has(trip.vehicleId),
          packages: trip.packages,
          stopCount: trip.stops.length,
          ...(trip.overrideReason === undefined ? {} : { overrideReason: trip.overrideReason }),
        })
      }),
    confirmLoadingByQr: (tripId, token) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertPhase(trip, 'loading')
        const loading = trip.loading
        const plan = planOf(trip)
        const label = scanned(trip, token)
        if (!plannedStops(plan).has(label.packageInstanceId)) throw new MockDbError('PACKAGE_NOT_IN_TRIP', { tripId, token: label.qrToken })
        // Bước hiện tại: kiện chưa có kết quả đầu tiên theo thứ tự xếp — cùng cách màn kho chọn kiện (`loadingProgress`)
        const recorded = new Set(loading?.steps.map((step) => step.packageInstanceId))
        const expected = plan.result.placements.toSorted((a, b) => a.loadingOrder - b.loadingOrder).find((p) => !recorded.has(p.packageInstanceId))
        if (!loading || expected?.packageInstanceId !== label.packageInstanceId) {
          throw new MockDbError('WRONG_PACKAGE_SCANNED', { expected: expected?.packageInstanceId ?? '', scanned: label.packageInstanceId })
        }
        const steps = [...loading.steps, { packageInstanceId: label.packageInstanceId, outcome: 'loaded' as const, at: ctx.nowIso(), via: 'qr' as const }]
        return { trip: put(trips, { ...trip, loading: { ...loading, steps } }), packageInstanceId: label.packageInstanceId }
      }),
    recordSeal: (tripId, sealNumber) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertPhase(trip, 'loaded')
        const number = sealNumber.trim()
        if (number === '' || number.length > MAX_SEAL_LENGTH) throw new MockDbError('SEAL_INVALID', { max: MAX_SEAL_LENGTH })
        const loading = trip.loading
        if (!loading) throw new Error(`Chuyến ${tripId} đã xếp xong nhưng không có tiến độ xếp`)
        ctx.log('loading.sealed', { type: 'trip', id: tripId }, { sealNumber: number })
        return put(trips, { ...trip, loading: { ...loading, seal: { number, at: ctx.nowIso(), by: ctx.state.session.userId } } })
      }),
    confirmUnloadByQr: (tripId, stopNumber, token) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertPhase(trip, 'delivering')
        const delivery = trip.delivery
        const current = delivery?.stops.find((stop) => stop.completedAt === undefined)
        if (!delivery || current?.number !== stopNumber) throw new MockDbError('STOP_NOT_CURRENT', { tripId, stopNumber })
        const label = scanned(trip, token)
        const plannedStop = plannedStops(planOf(trip)).get(label.packageInstanceId)
        if (plannedStop === undefined) throw new MockDbError('PACKAGE_NOT_IN_TRIP', { tripId, token: label.qrToken })
        if (plannedStop !== stopNumber) throw new MockDbError('QR_WRONG_STOP', { packageInstanceId: label.packageInstanceId, stopNumber: plannedStop })
        if (missingIds(trip).has(label.packageInstanceId)) throw new MockDbError('INSTANCE_NOT_LOADED', { tripId, packageInstanceId: label.packageInstanceId })
        const id = label.packageInstanceId
        const stops = delivery.stops.map((stop) => stop.number !== stopNumber ? stop : {
          ...stop,
          unloadedIds: [...stop.unloadedIds.filter((item) => item !== id), id],
          qrConfirmedIds: [...(stop.qrConfirmedIds ?? []).filter((item) => item !== id), id],
        })
        return { trip: put(trips, { ...trip, delivery: { ...delivery, stops } }), packageInstanceId: id }
      }),
  }
}
