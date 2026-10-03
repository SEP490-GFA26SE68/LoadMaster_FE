import { delaysAfterReroute, rerouteOptions } from '@/domain/routing'
import type { Role } from '@/types/user'
import type { ExceptionsDb } from './db-api-exceptions'
import { nextId, optionalText, put, type DbContext } from './db-context'
import { syncRequirementOnTrip } from './db-requirement-trips'
import { advanceTracking, refreshLiveEta } from './db-tracking'
import { MockDbError } from './errors'
import {
  MAX_EXCEPTION_DELAY_MINUTES,
  MAX_EXCEPTION_NOTE_LENGTH,
  TRIP_EXCEPTION_TYPES,
  type TripException,
  type TripIncidents,
  type TripReroute,
} from './exception-model'
import { isRequirementClosed } from './requirement-model'
import type { Trip } from './types'

/**
 * Sự cố cấp chuyến, tuyến thay thế và gia hạn (FE-6-11, FE-6-12, D-87). Tài xế hoặc điều phối viên báo sự cố kèm số phút dự kiến chậm:
 * xe mô phỏng đứng thêm đúng số phút đó (`TripIncidents.holds` → `advanceTracking`), ETA tự dời theo vị trí — không cộng lần hai. Điều
 * phối viên tìm tuyến khác (mock, chỉ đổi đường tới điểm kế tiếp — **thứ tự điểm không đổi**), đánh dấu đã xử lý, hoặc chuyển quản lý
 * công ty; quá 30 phút chưa xử lý thì kho tự chuyển (`db-tracking.ts`). Quản lý công ty ghi đã liên hệ khách và nhập hạn mới.
 */
export function exceptionMethods(ctx: DbContext): ExceptionsDb {
  const { exceptions, users, requirements, packages } = ctx.state

  function incidentsOf(tripId: string): TripIncidents {
    let record = exceptions.get(tripId)
    if (!record) {
      record = { exceptions: [], holds: [], reroutes: [] }
      exceptions.set(tripId, record)
    }
    return record
  }

  const sessionUser = () => (ctx.state.session.userId === null ? undefined : users.get(ctx.state.session.userId))

  /** Việc của một vai trò; kho không có phiên (test logic) thì không xét. */
  function assertRole(...roles: Role[]) {
    const user = sessionUser()
    if (user !== undefined && !roles.includes(user.role)) throw new MockDbError('ROLE_NOT_ALLOWED', { role: user.role })
  }

  /**
   * Chuyến Đang vận chuyển là đích của một lệnh ghi của `roles`, đã ghi bù vị trí tới giờ hiện tại. Công ty xét trước vai trò: chuyến
   * của công ty khác là `FORBIDDEN_COMPANY` với mọi vai trò.
   */
  function inTransit(tripId: string, ...roles: Role[]): Trip {
    const trip = ctx.scope.trips.own(tripId)
    assertRole(...roles)
    if (trip.phase !== 'delivering') throw new MockDbError('TRIP_PHASE_INVALID', { tripId, phase: trip.phase })
    advanceTracking(ctx, trip)
    return trip
  }

  function exceptionOf(tripId: string, exceptionId: string): TripException {
    const exception = exceptions.get(tripId)?.exceptions.find((item) => item.id === exceptionId)
    if (!exception) throw new MockDbError('NOT_FOUND', { collection: 'exceptions', id: exceptionId })
    return exception
  }

  const allIds = () => [...exceptions.values()].flatMap((record) => record.exceptions.map((exception) => exception.id))

  return {
    reportTripException: (tripId, input) =>
      ctx.respond(() => {
        const trip = inTransit(tripId, 'dispatcher', 'driver')
        const user = sessionUser()
        if (user?.role === 'driver' && trip.driverId !== user.id) throw new MockDbError('ROLE_NOT_ALLOWED', { role: user.role })
        if (!TRIP_EXCEPTION_TYPES.includes(input.type)) throw new MockDbError('EXCEPTION_INVALID', { field: 'type' })
        const description = input.description.trim().slice(0, MAX_EXCEPTION_NOTE_LENGTH)
        if (description === '') throw new MockDbError('EXCEPTION_INVALID', { field: 'description' })
        const { delayMinutes } = input
        if (!Number.isInteger(delayMinutes) || delayMinutes < 0 || delayMinutes > MAX_EXCEPTION_DELAY_MINUTES) throw new MockDbError('EXCEPTION_INVALID', { field: 'delayMinutes' })
        const at = ctx.nowIso()
        const stopNumber = trip.delivery?.stops.find((stop) => stop.completedAt === undefined)?.number
        const exception: TripException = {
          id: nextId('EXC', allIds()), tripId, type: input.type, description, delayMinutes, status: 'OPEN',
          ...(stopNumber === undefined ? {} : { stopNumber }),
          reportedAt: at, reportedBy: ctx.state.session.userId,
        }
        const record = incidentsOf(tripId)
        record.exceptions.push(exception)
        record.holds.push({ at, minutes: delayMinutes })
        ctx.log('exception.reported', { type: 'trip', id: tripId }, {
          exceptionId: exception.id, exceptionType: exception.type, delayMinutes, ...(stopNumber === undefined ? {} : { stopNumber }), note: description,
        })
        return exception
      }),
    listTripExceptions: (tripId) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.read(tripId)
        advanceTracking(ctx, trip)
        return exceptions.get(tripId)?.exceptions ?? []
      }),
    escalateTripException: (tripId, exceptionId) =>
      ctx.respond(() => {
        inTransit(tripId, 'dispatcher')
        const exception = exceptionOf(tripId, exceptionId)
        if (exception.status !== 'OPEN') throw new MockDbError('EXCEPTION_STATUS_INVALID', { exceptionId, status: exception.status })
        exception.status = 'ESCALATED'
        exception.escalation = { reason: 'NO_ROUTE', at: ctx.nowIso(), by: ctx.state.session.userId }
        ctx.log('exception.escalated', { type: 'trip', id: tripId }, { exceptionId, exceptionType: exception.type, escalation: 'NO_ROUTE' })
        return exception
      }),
    resolveTripException: (tripId, exceptionId, note) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertRole('dispatcher')
        advanceTracking(ctx, trip)
        const exception = exceptionOf(tripId, exceptionId)
        if (exception.status === 'RESOLVED') throw new MockDbError('EXCEPTION_STATUS_INVALID', { exceptionId, status: exception.status })
        const text = optionalText(note)?.slice(0, MAX_EXCEPTION_NOTE_LENGTH)
        exception.status = 'RESOLVED'
        exception.resolution = { at: ctx.nowIso(), by: ctx.state.session.userId, ...(text === undefined ? {} : { note: text }) }
        ctx.log('exception.resolved', { type: 'trip', id: tripId }, { exceptionId, exceptionType: exception.type, ...(text === undefined ? {} : { note: text }) })
        return exception
      }),
    requestReroute: (tripId) =>
      ctx.respond(() => {
        const trip = inTransit(tripId, 'dispatcher')
        const state = ctx.state.tracking.get(tripId)
        const position = state?.points.at(-1)
        // Điểm kế tiếp xe chưa tới: xe đang đứng ở một điểm thì đường vòng là của chặng sau đó
        const done = new Set(trip.delivery?.stops.filter((stop) => stop.completedAt !== undefined).map((stop) => stop.number))
        const next = state?.live.find((stop) => stop.arrived !== true && !done.has(stop.number))
        const target = next === undefined ? undefined : trip.stops[next.number - 1]
        if (!position || !next || target?.lat === undefined || target.lng === undefined) throw new MockDbError('REROUTE_UNAVAILABLE', { tripId })
        const requestedAt = ctx.nowIso()
        const options = rerouteOptions(position, { lat: target.lat, lng: target.lng }, requestedAt).map((option, index) => ({ ...option, index }))
        const proposal = { tripId, requestedAt, stopId: next.stopId, stopNumber: next.number, options, isMockResult: true as const }
        incidentsOf(tripId).proposal = proposal
        return proposal
      }),
    confirmReroute: (tripId, routeIndex) =>
      ctx.respond(() => {
        inTransit(tripId, 'dispatcher')
        const record = incidentsOf(tripId)
        const option = record.proposal?.options.find((item) => item.index === routeIndex)
        if (!record.proposal || !option) throw new MockDbError('REROUTE_UNAVAILABLE', { tripId })
        const at = ctx.nowIso()
        const reroute: TripReroute = { ...option, stopNumber: record.proposal.stopNumber, confirmedAt: at, confirmedBy: ctx.state.session.userId }
        record.holds = delaysAfterReroute(record.holds, at, option.extraMs)
        record.reroutes.push(reroute)
        delete record.proposal
        ctx.log('trip.rerouted', { type: 'trip', id: tripId }, { route: option.route, stopNumber: reroute.stopNumber, totalKm: option.distanceKm, totalMinutes: option.durationMinutes })
        return reroute
      }),
    listTripReroutes: (tripId) => ctx.respond(() => exceptions.get(ctx.scope.trips.read(tripId).id)?.reroutes ?? []),
    renegotiateDeadline: (tripId, exceptionId, input) =>
      ctx.respond(() => {
        const trip = inTransit(tripId, 'manager')
        const exception = exceptionOf(tripId, exceptionId)
        if (exception.status !== 'ESCALATED') throw new MockDbError('EXCEPTION_STATUS_INVALID', { exceptionId, status: exception.status })
        const contactNote = input.contactNote.trim().slice(0, MAX_EXCEPTION_NOTE_LENGTH)
        if (contactNote === '') throw new MockDbError('REASON_REQUIRED', {})
        const requirement = ctx.scope.requirements.ref(input.requirementId, trip.companyId)
        if (requirement.tripId !== tripId) throw new MockDbError('EXCEPTION_INVALID', { field: 'requirementId' })
        const members = requirement.packageIds.flatMap((id) => packages.get(id) ?? [])
        if (isRequirementClosed(requirement, members)) throw new MockDbError('REQUIREMENT_STATUS_INVALID', { requirementId: requirement.id, status: requirement.status })
        const deadlineMs = Date.parse(input.deadline)
        if (Number.isNaN(deadlineMs)) throw new MockDbError('EXCEPTION_INVALID', { field: 'deadline' })
        const deadline = new Date(deadlineMs).toISOString()
        const at = ctx.nowIso()
        if (deadlineMs <= Date.parse(at)) throw new MockDbError('REQUIREMENT_DEADLINE_PAST', { deadline })
        const next = put(requirements, { ...requirement, deadline })
        syncRequirementOnTrip(ctx, next, false)
        exception.renegotiation = { requirementId: requirement.id, previousDeadline: requirement.deadline, deadline, contactNote, at, by: ctx.state.session.userId }
        // Hạn của điểm giao vừa đổi: mức hạn tính lại ngay từ vị trí xe, không chờ điểm vị trí kế tiếp
        refreshLiveEta(ctx, ctx.scope.trips.own(tripId))
        ctx.log('requirement.updated', { type: 'requirement', id: requirement.id }, { destinationName: requirement.destinationName, fields: 'deadline' })
        ctx.log('exception.deadlineRenegotiated', { type: 'trip', id: tripId }, { exceptionId, requirementId: requirement.id, deadline, note: contactNote })
        return exception
      }),
  }
}
