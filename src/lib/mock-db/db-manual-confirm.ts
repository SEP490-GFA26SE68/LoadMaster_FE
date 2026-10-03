import { optionalText, put, type DbContext } from './db-context'
import type { Review1Db } from './db-api-review1'
import { assertPhase, assertUnloadable, currentStopProgress, expectedLoadingInstance, labelsOf, loadingPlan, verificationBy } from './db-scans'
import { MockDbError } from './errors'
import { plannedStops } from './operations'
import type { Trip } from './types'
import {
  MANUAL_CONFIRM_REASONS,
  MAX_MANUAL_NOTE_LENGTH,
  withVerification,
  type ManualConfirm,
  type ManualConfirmInput,
  type PackageVerification,
} from './verify-model'

type ManualConfirmMethods = Pick<
  Review1Db,
  'confirmLoadingManually' | 'confirmUnloadManually' | 'approveManualConfirmation' | 'rejectManualConfirmation'
>

/**
 * Xác nhận tay (mức 3 của đối chiếu kiện, FE-6-03) và việc duyệt của điều phối viên (FE-6-04, D-83). Kho hoặc tài xế chọn kiện kèm lý
 * do khi nhãn không đọc được: kiện được ghi như đã xếp / đã dỡ để làm tiếp, kèm một xác nhận tay `MANUAL_PENDING`. Còn xác nhận tay chờ
 * thì `completeLoading` và `completeStop` từ chối (`db-operations.ts`). Điều phối viên duyệt — kiện giữ kết quả — hoặc từ chối kèm lý
 * do — kết quả của kiện bị gỡ, kho / tài xế phải kiểm lại.
 */
export function manualConfirmMethods(ctx: DbContext): ManualConfirmMethods {
  const { trips, users } = ctx.state

  /** Lý do và ghi chú của xác nhận tay; "Khác" phải có ghi chú. */
  function manualOf({ reason, note }: ManualConfirmInput): ManualConfirm {
    const text = optionalText(note)?.slice(0, MAX_MANUAL_NOTE_LENGTH)
    if (!MANUAL_CONFIRM_REASONS.includes(reason) || (reason === 'OTHER' && text === undefined)) throw new MockDbError('REASON_REQUIRED', {})
    return { status: 'MANUAL_PENDING', reason, ...(text === undefined ? {} : { note: text }) }
  }

  function logRequested(tripId: string, entry: Omit<PackageVerification, 'id'>) {
    ctx.log('manualConfirm.requested', { type: 'trip', id: tripId }, {
      packageInstanceId: entry.packageInstanceId,
      verifyContext: entry.context,
      ...(entry.stopNumber === undefined ? {} : { stopNumber: entry.stopNumber }),
      manualReason: entry.manual?.reason ?? '',
      ...(entry.manual?.note === undefined ? {} : { note: entry.manual.note }),
    })
  }

  /** Duyệt là việc của điều phối viên (`manualConfirm.approve`); kho không có phiên (test logic) thì không xét. */
  function assertDispatcher() {
    const userId = ctx.state.session.userId
    const user = userId === null ? undefined : users.get(userId)
    if (user !== undefined && user.role !== 'dispatcher') throw new MockDbError('ROLE_NOT_ALLOWED', { role: user.role })
  }

  /** Xác nhận tay còn chờ `confirmationId` của chuyến đang xếp / đang giao; không có, hoặc đã có quyết định: `MANUAL_CONFIRM_NOT_PENDING`. */
  function pending(trip: Trip, confirmationId: string): PackageVerification & { manual: ManualConfirm } {
    const entry = trip.verifications?.find((item) => item.id === confirmationId)
    if (entry?.manual?.status !== 'MANUAL_PENDING') throw new MockDbError('MANUAL_CONFIRM_NOT_PENDING', { tripId: trip.id, confirmationId })
    assertPhase(trip, entry.context === 'LOADING' ? 'loading' : 'delivering')
    return { ...entry, manual: entry.manual }
  }

  function decide(trip: Trip, entry: PackageVerification & { manual: ManualConfirm }, decision: Pick<ManualConfirm, 'status' | 'rejectReason'>): PackageVerification[] {
    const manual: ManualConfirm = { ...entry.manual, ...decision, decidedAt: ctx.nowIso(), decidedBy: ctx.state.session.userId }
    return (trip.verifications ?? []).map((item) => (item.id === entry.id ? { ...item, manual } : item))
  }

  /** Chuyến sau khi gỡ kết quả của kiện bị từ chối: bước xếp của nó, hoặc dấu đã dỡ ở điểm giao của nó. */
  function withoutResult(trip: Trip, { context, stopNumber, packageInstanceId }: PackageVerification): Trip {
    if (context === 'LOADING') {
      return trip.loading ? { ...trip, loading: { ...trip.loading, steps: trip.loading.steps.filter((step) => step.packageInstanceId !== packageInstanceId) } } : trip
    }
    if (!trip.delivery) return trip
    const stops = trip.delivery.stops.map((stop) => stop.number !== stopNumber ? stop : {
      ...stop,
      unloadedIds: stop.unloadedIds.filter((id) => id !== packageInstanceId),
      ...(stop.qrConfirmedIds === undefined ? {} : { qrConfirmedIds: stop.qrConfirmedIds.filter((id) => id !== packageInstanceId) }),
    })
    return { ...trip, delivery: { ...trip.delivery, stops } }
  }

  /** Người gửi xác nhận tay, để chuông báo đúng người khi bị từ chối; không có phiên lúc gửi (test logic kho) thì không ghi. */
  const requestedBy = (entry: PackageVerification): Record<string, string> => (entry.by === null ? {} : { requestedBy: entry.by })

  return {
    confirmLoadingManually: (tripId, input) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertPhase(trip, 'loading')
        const loading = trip.loading
        const plan = loadingPlan(ctx, trip)
        const id = input.packageInstanceId
        if (!plannedStops(plan).has(id)) throw new MockDbError('INSTANCE_NOT_IN_PLAN', { tripId, packageInstanceId: id })
        const expected = expectedLoadingInstance(trip, plan)
        if (!loading || expected !== id) throw new MockDbError('WRONG_PACKAGE_SCANNED', { expected: expected ?? '', scanned: id })
        const entry = verificationBy(ctx, { context: 'LOADING', packageInstanceId: id, method: 'MANUAL', manual: manualOf(input) })
        logRequested(tripId, entry)
        const steps = [...loading.steps, { packageInstanceId: id, outcome: 'loaded' as const, at: ctx.nowIso() }]
        return { trip: put(trips, { ...trip, loading: { ...loading, steps }, verifications: withVerification(trip.verifications, entry) }), packageInstanceId: id }
      }),
    confirmUnloadManually: (tripId, stopNumber, input) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertPhase(trip, 'delivering')
        const delivery = trip.delivery
        currentStopProgress(trip, stopNumber)
        if (!delivery) throw new Error(`Chuyến ${tripId} đang giao nhưng không có tiến độ giao`)
        const id = input.packageInstanceId
        const token = labelsOf(ctx, trip).find((label) => label.packageInstanceId === id)?.qrToken ?? id
        assertUnloadable(trip, loadingPlan(ctx, trip), stopNumber, id, token)
        const entry = verificationBy(ctx, { context: 'UNLOADING', stopNumber, packageInstanceId: id, method: 'MANUAL', manual: manualOf(input) })
        logRequested(tripId, entry)
        // Xác nhận tay không phải đối chiếu bằng nhãn: kiện rời `qrConfirmedIds` nếu trước đó từng được quét
        const stops = delivery.stops.map((stop) => stop.number !== stopNumber ? stop : {
          ...stop,
          unloadedIds: [...stop.unloadedIds.filter((item) => item !== id), id],
          ...(stop.qrConfirmedIds === undefined ? {} : { qrConfirmedIds: stop.qrConfirmedIds.filter((item) => item !== id) }),
        })
        return { trip: put(trips, { ...trip, delivery: { ...delivery, stops }, verifications: withVerification(trip.verifications, entry) }), packageInstanceId: id }
      }),
    approveManualConfirmation: (tripId, confirmationId) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertDispatcher()
        const entry = pending(trip, confirmationId)
        ctx.log('manualConfirm.approved', { type: 'trip', id: tripId }, { packageInstanceId: entry.packageInstanceId, ...requestedBy(entry) })
        return put(trips, { ...trip, verifications: decide(trip, entry, { status: 'MANUAL_APPROVED' }) })
      }),
    rejectManualConfirmation: (tripId, confirmationId, reason) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertDispatcher()
        const entry = pending(trip, confirmationId)
        const rejectReason = reason.trim().slice(0, MAX_MANUAL_NOTE_LENGTH)
        if (rejectReason === '') throw new MockDbError('REASON_REQUIRED', {})
        ctx.log('manualConfirm.rejected', { type: 'trip', id: tripId }, { packageInstanceId: entry.packageInstanceId, reason: rejectReason, ...requestedBy(entry) })
        return put(trips, { ...withoutResult(trip, entry), verifications: decide(trip, entry, { status: 'MANUAL_REJECTED', rejectReason }) })
      }),
  }
}
