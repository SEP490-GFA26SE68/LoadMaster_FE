import { tripReadiness } from '@/domain/constraints'
import { found, put, type DbContext } from './db-context'
import type { Review1Db } from './db-api-review1'
import { MockDbError } from './errors'
import { leftOutIds, plannedStops, stagingRemaining } from './operations'
import { tripLinks } from './db-trip-lines'
import { normalizeQrToken } from './qr-token'
import { tripLabels } from './review1-status'
import type { TripLabel } from './source-types'
import type { Revision, StopProgress, Trip } from './types'
import { resolveVerifyCode, withVerification, type LabelVerifyMethod, type PackageVerification } from './verify-model'

type ScanMethods = Pick<Review1Db, 'listTripLabels' | 'getTripReadiness' | 'confirmLoadingByQr' | 'recordSeal' | 'confirmUnloadByQr'>

/** Số seal dài tối đa (ký tự). */
export const MAX_SEAL_LENGTH = 32

export function assertPhase(trip: Trip, phase: Trip['phase']) {
  if (trip.phase !== phase) throw new MockDbError('TRIP_PHASE_INVALID', { tripId: trip.id, phase: trip.phase })
}

/** Nhãn QR của mọi kiện trong chuyến: mã QR và mã của bên gửi của kiện kho kiện ứng với từng instance. */
export function labelsOf(ctx: DbContext, trip: Trip): TripLabel[] {
  return tripLabels(trip, tripLinks(ctx, trip.id), ctx.state.packages)
}

/** Phương án kho đang xếp theo (bản duyệt chốt lúc bắt đầu xếp). */
export function loadingPlan(ctx: DbContext, trip: Trip): Revision {
  return found(ctx.state.revisions, 'revisions', trip.loading?.revisionId ?? '')
}

/** Kiện của bước xếp hiện tại: kiện chưa có kết quả đầu tiên theo thứ tự xếp — cùng cách màn kho chọn kiện (`loadingProgress`). */
export function expectedLoadingInstance(trip: Trip, plan: Revision): string | undefined {
  const recorded = new Set(trip.loading?.steps.map((step) => step.packageInstanceId))
  return plan.result.placements.toSorted((a, b) => a.loadingOrder - b.loadingOrder).find((p) => !recorded.has(p.packageInstanceId))?.packageInstanceId
}

/** Bước xếp chỉ mở khi mọi kiện của phương án đã soạn (FE-6-02, D-82); còn kiện chưa soạn: `STAGING_INCOMPLETE`. */
export function assertStaged(trip: Trip, plan: Revision) {
  const remaining = stagingRemaining(trip, plan).length
  if (remaining > 0) throw new MockDbError('STAGING_INCOMPLETE', { tripId: trip.id, remaining })
}

/** Điểm đang giao là `stopNumber` (điểm chưa hoàn tất đầu tiên); điểm khác: `STOP_NOT_CURRENT`. */
export function currentStopProgress(trip: Trip, stopNumber: number): StopProgress {
  const current = trip.delivery?.stops.find((stop) => stop.completedAt === undefined)
  if (current?.number !== stopNumber) throw new MockDbError('STOP_NOT_CURRENT', { tripId: trip.id, stopNumber })
  return current
}

/** Điểm đang giao mà tài xế đã bấm "Đã đến" (FE-6-06, D-84): chưa đến thì chưa dỡ, chưa hoàn tất điểm được — `STOP_NOT_ARRIVED`. */
export function arrivedStopProgress(trip: Trip, stopNumber: number): StopProgress {
  const current = currentStopProgress(trip, stopNumber)
  if (current.arrivedAt === undefined) throw new MockDbError('STOP_NOT_ARRIVED', { tripId: trip.id, stopNumber })
  return current
}

/** Kiện `packageInstanceId` dỡ được ở điểm `stopNumber`: thuộc phương án, đúng điểm, và có trên xe. */
export function assertUnloadable(trip: Trip, plan: Revision, stopNumber: number, packageInstanceId: string, token: string) {
  const plannedStop = plannedStops(plan).get(packageInstanceId)
  if (plannedStop === undefined) throw new MockDbError('PACKAGE_NOT_IN_TRIP', { tripId: trip.id, token })
  if (plannedStop !== stopNumber) throw new MockDbError('QR_WRONG_STOP', { packageInstanceId, stopNumber: plannedStop })
  if (leftOutIds(trip).has(packageInstanceId)) throw new MockDbError('INSTANCE_NOT_LOADED', { tripId: trip.id, packageInstanceId })
}

/** Một lần đối chiếu mới của phiên hiện tại, chưa có mã. */
export function verificationBy(ctx: DbContext, entry: Omit<PackageVerification, 'id' | 'at' | 'by'>): Omit<PackageVerification, 'id'> {
  return { ...entry, at: ctx.nowIso(), by: ctx.state.session.userId }
}

/**
 * Nhãn khớp mã quét (`QR`) hoặc mã gõ (`CODE`, D-83) trong chuyến. Mã của bên gửi trùng nhiều kiện: `PACKAGE_CODE_AMBIGUOUS`; không khớp
 * kiện nào: `PACKAGE_NOT_IN_TRIP`.
 */
export function scannedLabel(ctx: DbContext, trip: Trip, code: string, method: LabelVerifyMethod): TripLabel {
  const match = resolveVerifyCode(labelsOf(ctx, trip), code, method)
  if (match.kind === 'ambiguous') throw new MockDbError('PACKAGE_CODE_AMBIGUOUS', { tripId: trip.id, code: code.trim(), count: match.count })
  if (match.kind === 'unknown') throw new MockDbError('PACKAGE_NOT_IN_TRIP', { tripId: trip.id, token: normalizeQrToken(code) })
  return match.label
}

/**
 * Nhãn QR, "Sẵn sàng tối ưu", đối chiếu kiện bằng nhãn khi xếp / dỡ và seal (luồng 2 + 5, LM-104; FE-6-03). Mọi hàm nhận một chuyến
 * của công ty của phiên (D-64); mã chỉ khớp trong nhãn của chính chuyến đó, nên kiện của công ty khác luôn là `PACKAGE_NOT_IN_TRIP`.
 * Mỗi lần đối chiếu ghi cách, người, thời điểm vào `Trip.verifications`.
 */
export function scanMethods(ctx: DbContext): ScanMethods {
  const { trips, vehicles, maintenance } = ctx.state

  return {
    listTripLabels: (tripId) => ctx.respond(() => labelsOf(ctx, ctx.scope.trips.read(tripId))),
    getTripReadiness: (tripId) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.read(tripId)
        return tripReadiness({
          vehicle: vehicles.get(trip.vehicleId),
          vehicleInMaintenance: maintenance.has(trip.vehicleId),
          packages: trip.packages,
          stopCount: trip.stops.length,
          routePlanned: trip.routePlan !== undefined,
          ...(trip.overrideReason === undefined ? {} : { overrideReason: trip.overrideReason }),
        })
      }),
    confirmLoadingByQr: (tripId, code, method = 'QR') =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertPhase(trip, 'loading')
        const loading = trip.loading
        const plan = loadingPlan(ctx, trip)
        const label = scannedLabel(ctx, trip, code, method)
        const id = label.packageInstanceId
        if (!plannedStops(plan).has(id)) throw new MockDbError('PACKAGE_NOT_IN_TRIP', { tripId, token: label.qrToken })
        assertStaged(trip, plan)
        const expected = expectedLoadingInstance(trip, plan)
        if (!loading || expected !== id) throw new MockDbError('WRONG_PACKAGE_SCANNED', { expected: expected ?? '', scanned: id })
        const steps = [...loading.steps, { packageInstanceId: id, outcome: 'loaded' as const, at: ctx.nowIso(), via: 'qr' as const }]
        const verifications = withVerification(trip.verifications, verificationBy(ctx, { context: 'LOADING', packageInstanceId: id, method }))
        return { trip: put(trips, { ...trip, loading: { ...loading, steps }, verifications }), packageInstanceId: id }
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
    confirmUnloadByQr: (tripId, stopNumber, code, method = 'QR') =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertPhase(trip, 'delivering')
        const delivery = trip.delivery
        arrivedStopProgress(trip, stopNumber)
        if (!delivery) throw new Error(`Chuyến ${tripId} đang giao nhưng không có tiến độ giao`)
        const label = scannedLabel(ctx, trip, code, method)
        const id = label.packageInstanceId
        assertUnloadable(trip, loadingPlan(ctx, trip), stopNumber, id, label.qrToken)
        const stops = delivery.stops.map((stop) => stop.number !== stopNumber ? stop : {
          ...stop,
          unloadedIds: [...stop.unloadedIds.filter((item) => item !== id), id],
          qrConfirmedIds: [...(stop.qrConfirmedIds ?? []).filter((item) => item !== id), id],
        })
        const verifications = withVerification(trip.verifications, verificationBy(ctx, { context: 'UNLOADING', stopNumber, packageInstanceId: id, method }))
        return { trip: put(trips, { ...trip, delivery: { ...delivery, stops }, verifications }), packageInstanceId: id }
      }),
  }
}
