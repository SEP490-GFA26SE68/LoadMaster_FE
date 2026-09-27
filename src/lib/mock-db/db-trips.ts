import { found, nextId, put, sameData, type DbContext } from './db-context'
import { MockDbError } from './errors'
import { isCancellablePhase } from './operations'
import { tripChangeParams } from './trip-changes'
import type { MockDb, Trip, TripChanges } from './types'

type TripMethods = Pick<MockDb, 'listTrips' | 'getTrip' | 'createTrip' | 'updateTrip' | 'cancelTrip'>

/** Trường của `TripChanges`, theo thứ tự ghi vào tham số `fields` của sự kiện `trip.updated`. */
const EDITABLE = ['name', 'scheduledDate', 'driverId', 'vehicleId', 'stops', 'packages'] as const satisfies readonly (keyof TripChanges)[]

/** Pha `loading`/`loaded` vẫn đổi được tên, ngày, tài xế — xe, điểm giao, kiện thì không (D-45). */
const LOCKED_WHILE_LOADING: ReadonlySet<keyof TripChanges> = new Set(['vehicleId', 'stops', 'packages'])

export function tripMethods(ctx: DbContext): TripMethods {
  const { trips, vehicles, maintenance, users } = ctx.state

  function assertVehicleUsable(vehicleId: string) {
    found(vehicles, 'vehicles', vehicleId)
    if (maintenance.has(vehicleId)) throw new MockDbError('VEHICLE_IN_MAINTENANCE', { vehicleId })
  }

  function assertDriver(userId: string | null) {
    if (userId === null) return
    const user = users.get(userId)
    if (user?.role !== 'driver' || user.status !== 'active') throw new MockDbError('DRIVER_INVALID', { userId })
  }

  return {
    listTrips: () => ctx.respond(() => [...trips.values()]),
    getTrip: (id) => ctx.respond(() => found(trips, 'trips', id)),
    createTrip: ({ name, vehicleId, stops, packages, scheduledDate, driverId = null }) =>
      ctx.respond(() => {
        assertVehicleUsable(vehicleId)
        assertDriver(driverId)
        const trip: Trip = {
          id: nextId('TRIP', trips.keys()),
          name,
          vehicleId,
          stops,
          packages,
          inputVersion: 1,
          scheduledDate,
          driverId,
          phase: 'planning',
          createdAt: ctx.nowIso(),
        }
        const created = put(trips, trip)
        ctx.log('trip.created', { type: 'trip', id: created.id }, { name })
        return created
      }),
    updateTrip: (id, changes) =>
      ctx.respond(() => {
        const current = found(trips, 'trips', id)
        if (changes.vehicleId !== undefined) found(vehicles, 'vehicles', changes.vehicleId)
        // Chỉ nhận các trường sửa được: trường kho quản lý trong một bản sao cũ bị trải vào `changes` không được ghi đè
        const changed = EDITABLE.filter((field) => changes[field] !== undefined && !sameData(changes[field], current[field]))
        if (changed.length === 0) return current
        if (current.phase !== 'planning') {
          const lockedNow = current.phase !== 'loading' && current.phase !== 'loaded'
          if (lockedNow || changed.some((field) => LOCKED_WHILE_LOADING.has(field))) {
            throw new MockDbError('TRIP_LOCKED', { tripId: id, phase: current.phase })
          }
        }
        if (changed.includes('vehicleId')) assertVehicleUsable(changes.vehicleId ?? current.vehicleId)
        if (changed.includes('driverId')) assertDriver(changes.driverId ?? null)
        const next: Trip = { ...current }
        for (const field of changed) Object.assign(next, { [field]: changes[field] })
        const inputChanged = changed.includes('vehicleId') || changed.includes('packages')
        next.inputVersion = current.inputVersion + (inputChanged ? 1 : 0)
        ctx.log('trip.updated', { type: 'trip', id }, { fields: changed.join(','), ...tripChangeParams(current, next, changed) })
        return put(trips, next)
      }),
    cancelTrip: (id, reason) =>
      ctx.respond(() => {
        const current = found(trips, 'trips', id)
        if (!isCancellablePhase(current.phase)) throw new MockDbError('TRIP_PHASE_INVALID', { tripId: id, phase: current.phase })
        const trimmed = reason.trim()
        if (trimmed === '') throw new MockDbError('REASON_REQUIRED', {})
        const cancellation = { at: ctx.nowIso(), by: ctx.state.session.userId, reason: trimmed, fromPhase: current.phase }
        ctx.log('trip.cancelled', { type: 'trip', id }, { reason: trimmed })
        return put(trips, { ...current, phase: 'cancelled', cancellation })
      }),
  }
}
