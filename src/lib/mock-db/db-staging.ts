import { restingOnIds } from '@/domain/constraints'
import { found, put, type DbContext } from './db-context'
import type { Review1Db } from './db-api-review1'
import { movePackage } from './db-packages'
import { returnToPlanning } from './db-replan'
import { assertPhase, assertStaged, expectedLoadingInstance, labelsOf, loadingPlan, scannedLabel, verificationBy } from './db-scans'
import { MockDbError } from './errors'
import { leftOutIds, plannedStops } from './operations'
import type { Package } from './package-model'
import type { LoadingProgress, Trip } from './types'
import { withoutPendingConfirm, withVerification } from './verify-model'

type StagingMethods = Pick<Review1Db, 'confirmStagingByQr' | 'reportStagingShortage' | 'resolveStagingShortage' | 'reportDamagedPackage'>

/** Quyết định của điều phối viên với một kiện kho báo thiếu lúc soạn (D-82). */
export const SHORTAGE_DECISIONS = ['KEEP_SEARCHING', 'DROP'] as const
export type ShortageDecision = (typeof SHORTAGE_DECISIONS)[number]

/**
 * Soạn hàng trước khi xếp (FE-6-02, D-82) và kiện hỏng lúc xếp (FE-6-05, D-92). Kho đối chiếu từng kiện của phương án vào khu chờ,
 * không cần thứ tự: kiện sang `STAGED` ngay khi đối chiếu bằng nhãn (xác nhận tay: khi điều phối viên duyệt, `db-manual-confirm.ts`).
 * Kiện không tìm thấy thì báo thiếu; điều phối viên chọn "tìm tiếp", hoặc bỏ kiện khỏi chuyến — chuyến về Đã lập kế hoạch
 * (`returnToPlanning`). Soạn đủ mới sang bước xếp. Mọi hàm ghi vào một chuyến của công ty của phiên (D-64).
 */
export function stagingMethods(ctx: DbContext): StagingMethods {
  const { trips, users, packages } = ctx.state

  /** Tiến độ của chuyến đang ở pha `loading` — luôn có vì chỉ `startLoading` đưa chuyến vào pha này. */
  function loadingOf(trip: Trip): LoadingProgress {
    assertPhase(trip, 'loading')
    if (!trip.loading) throw new Error(`Chuyến ${trip.id} đang xếp nhưng không có tiến độ xếp`)
    return trip.loading
  }

  function poolPackage(trip: Trip, packageInstanceId: string): Package {
    const poolId = labelsOf(ctx, trip).find((label) => label.packageInstanceId === packageInstanceId)?.poolPackageId
    return found(packages, 'packages', poolId ?? '')
  }

  /** Tiến độ sau khi bỏ báo thiếu của kiện `packageInstanceId` (kiện vừa được thấy, hoặc điều phối viên đã quyết). */
  function withoutShortage(loading: LoadingProgress, packageInstanceId: string): LoadingProgress {
    const { shortages, ...rest } = loading
    const left = shortages?.filter((item) => item.packageInstanceId !== packageInstanceId) ?? []
    return left.length === 0 ? rest : { ...rest, shortages: left }
  }

  /** Quyết kiện thiếu là việc của điều phối viên; kho không có phiên (test logic) thì không xét. */
  function assertDispatcher() {
    const userId = ctx.state.session.userId
    const user = userId === null ? undefined : users.get(userId)
    if (user !== undefined && user.role !== 'dispatcher') throw new MockDbError('ROLE_NOT_ALLOWED', { role: user.role })
  }

  return {
    confirmStagingByQr: (tripId, code, method = 'QR') =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        const loading = loadingOf(trip)
        const label = scannedLabel(ctx, trip, code, method)
        const id = label.packageInstanceId
        if (!plannedStops(loadingPlan(ctx, trip)).has(id)) throw new MockDbError('PACKAGE_NOT_IN_TRIP', { tripId, token: label.qrToken })
        // Quét lại kiện đã soạn: chỉ báo "đã soạn", không ghi gì
        if (loading.stagedIds.includes(id)) return { trip, packageInstanceId: id, alreadyStaged: true }
        const pkg = found(packages, 'packages', label.poolPackageId)
        if (pkg.status === 'ASSIGNED') movePackage(ctx, pkg, 'STAGED')
        const verifications = withVerification(trip.verifications, verificationBy(ctx, { context: 'STAGING', packageInstanceId: id, method }))
        const next = { ...withoutShortage(loading, id), stagedIds: [...loading.stagedIds, id] }
        return { trip: put(trips, { ...trip, loading: next, verifications }), packageInstanceId: id, alreadyStaged: false }
      }),
    reportStagingShortage: (tripId, packageInstanceId) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        const loading = loadingOf(trip)
        if (!plannedStops(loadingPlan(ctx, trip)).has(packageInstanceId)) throw new MockDbError('INSTANCE_NOT_IN_PLAN', { tripId, packageInstanceId })
        if (loading.stagedIds.includes(packageInstanceId)) throw new MockDbError('PACKAGE_ALREADY_STAGED', { tripId, packageInstanceId })
        if (loading.shortages?.some((item) => item.packageInstanceId === packageInstanceId)) return trip
        const shortage = { packageInstanceId, at: ctx.nowIso(), by: ctx.state.session.userId }
        ctx.log('loading.shortageReported', { type: 'trip', id: tripId }, { packageInstanceId, packageCode: poolPackage(trip, packageInstanceId).packageCode })
        return put(trips, { ...trip, loading: { ...loading, shortages: [...(loading.shortages ?? []), shortage] } })
      }),
    resolveStagingShortage: (tripId, packageInstanceId, decision) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertDispatcher()
        const shortage = trip.phase === 'loading' ? trip.loading?.shortages?.find((item) => item.packageInstanceId === packageInstanceId) : undefined
        if (!shortage) throw new MockDbError('SHORTAGE_NOT_OPEN', { tripId, packageInstanceId })
        const loading = loadingOf(trip)
        const pkg = poolPackage(trip, packageInstanceId)
        // Người báo thiếu, để chuông báo đúng người; không có phiên lúc báo (test logic kho) thì không ghi
        const requestedBy: Record<string, string> = shortage.by === null ? {} : { requestedBy: shortage.by }
        if (decision === 'KEEP_SEARCHING') {
          ctx.log('loading.shortageKept', { type: 'trip', id: tripId }, { packageInstanceId, packageCode: pkg.packageCode, ...requestedBy })
          return put(trips, { ...trip, loading: withoutShortage(loading, packageInstanceId) })
        }
        ctx.log('loading.shortageDropped', { type: 'trip', id: tripId }, {
          packageInstanceId, packageCode: pkg.packageCode, ...(pkg.requirementId === undefined ? {} : { requirementId: pkg.requirementId }), ...requestedBy,
        })
        return returnToPlanning(ctx, trip, packageInstanceId, 'NOT_FOUND', 'SHORTAGE')
      }),
    reportDamagedPackage: (tripId, packageInstanceId) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        const loading = loadingOf(trip)
        const plan = loadingPlan(ctx, trip)
        if (!plannedStops(plan).has(packageInstanceId)) throw new MockDbError('INSTANCE_NOT_IN_PLAN', { tripId, packageInstanceId })
        assertStaged(trip, plan)
        const expected = expectedLoadingInstance(trip, plan)
        if (expected !== packageInstanceId) throw new MockDbError('WRONG_PACKAGE_SCANNED', { expected: expected ?? '', scanned: packageInstanceId })
        const pkg = poolPackage(trip, packageInstanceId)
        // Kiện tựa lên nó trong phương án (trừ kiện cũng đã bị bỏ): còn thì chỗ của nó không bỏ trống được
        const leftOut = leftOutIds(trip)
        const resting = restingOnIds(plan.result.placements, packageInstanceId).filter((id) => !leftOut.has(id))
        const params = { packageInstanceId, packageCode: pkg.packageCode, ...(pkg.requirementId === undefined ? {} : { requirementId: pkg.requirementId }) }
        if (resting.length > 0) {
          ctx.log('loading.damaged', { type: 'trip', id: tripId }, { ...params, supporting: resting.length })
          return returnToPlanning(ctx, trip, packageInstanceId, 'DAMAGED', 'DAMAGED')
        }
        ctx.log('loading.damaged', { type: 'trip', id: tripId }, params)
        movePackage(ctx, pkg, 'IMPORTED', { flags: [...new Set([...pkg.flags, 'DAMAGED' as const])] })
        const steps = [...loading.steps, { packageInstanceId, outcome: 'damaged' as const, at: ctx.nowIso() }]
        // Xác nhận tay còn chờ của kiện (lúc soạn hoặc lúc xếp) không còn gì để duyệt
        const verifications = trip.verifications === undefined
          ? undefined
          : withoutPendingConfirm(withoutPendingConfirm(trip.verifications, 'STAGING', packageInstanceId), 'LOADING', packageInstanceId)
        return put(trips, { ...trip, loading: { ...loading, steps }, ...(verifications === undefined ? {} : { verifications }) })
      }),
  }
}
