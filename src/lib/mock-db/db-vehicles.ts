import type { VehicleConfig } from '@/domain/models'
import { nextId, put, sameData, type DbContext } from './db-context'
import { MockDbError } from './errors'
import { isActivePhase, isFinishedPhase } from './operations'
import type { MockDb, Trip, VehicleState } from './types'
import { withoutLimits, withTypeLimits } from './vehicle-limits'

type VehicleMethods = Pick<
  MockDb,
  'listVehicles' | 'getVehicle' | 'createVehicle' | 'updateVehicle' | 'deleteVehicle' | 'listVehicleStates' | 'setVehicleMaintenance'
>

/** Ghi chú bảo dưỡng dài tối đa (ký tự), như máy chủ. */
export const MAINTENANCE_NOTE_MAX = 500

/** Chuyến đang xếp / đã xếp xong / đang giao dùng xe `vehicleId`. */
export function activeTripOf(trips: Iterable<Trip>, vehicleId: string): Trip | undefined {
  for (const trip of trips) if (trip.vehicleId === vehicleId && isActivePhase(trip.phase)) return trip
  return undefined
}

/**
 * Xe của công ty của phiên (D-64): công ty lưu cạnh xe ở `vehicleCompany`; chuyến dùng xe luôn cùng công ty với xe. Kho lưu xe **không
 * kèm giới hạn**; xe trả ra mang giới hạn tải trục và độ lệch trọng tâm của loại xe đang gắn (FE-5b-01, `withTypeLimits`) — nhờ đó
 * request tối ưu và phương án chụp lại đúng giới hạn lúc chạy.
 */
export function vehicleMethods(ctx: DbContext): VehicleMethods {
  const { vehicles, trips, maintenance, retiredVehicles, vehicleCompany, vehicleTypes, vehicleTypeOf } = ctx.state
  const scope = ctx.scope.vehicles
  const resolved = (vehicle: VehicleConfig) => withTypeLimits(vehicle, vehicleTypes.get(vehicleTypeOf.get(vehicle.id) ?? ''))

  function stateOf(vehicleId: string): VehicleState {
    const retiredAt = retiredVehicles.get(vehicleId)
    if (retiredAt !== undefined) return { vehicleId, status: 'retired', retiredAt }
    const inMaintenance = maintenance.get(vehicleId)
    if (inMaintenance) return { vehicleId, status: 'maintenance', maintenance: inMaintenance }
    const trip = activeTripOf(trips.values(), vehicleId)
    return trip ? { vehicleId, status: 'in_use', tripId: trip.id } : { vehicleId, status: 'available' }
  }

  function assertNotRetired(vehicleId: string) {
    if (retiredVehicles.has(vehicleId)) throw new MockDbError('VEHICLE_RETIRED', { vehicleId })
  }

  function assertNotRunning(vehicleId: string) {
    const trip = activeTripOf(trips.values(), vehicleId)
    if (trip) throw new MockDbError('VEHICLE_LOCKED', { vehicleId, tripId: trip.id })
  }

  return {
    listVehicles: () => ctx.respond(() => scope.list().map(resolved)),
    getVehicle: (id) => ctx.respond(() => resolved(scope.read(id))),
    createVehicle: (input) =>
      ctx.respond(() => {
        const companyId = ctx.scope.newRecordCompany()
        const created = put(vehicles, withoutLimits({ ...input, id: nextId('VEHICLE', vehicles.keys()) }))
        vehicleCompany.set(created.id, companyId)
        ctx.log('vehicle.created', { type: 'vehicle', id: created.id }, { name: created.name })
        return created
      }),
    updateVehicle: (input) =>
      ctx.respond(() => {
        const vehicle = withoutLimits(input)
        const current = scope.own(vehicle.id)
        if (sameData(vehicle, current)) return resolved(current)
        assertNotRetired(vehicle.id)
        assertNotRunning(vehicle.id)
        // Xe là một phần đầu vào tối ưu của mọi chuyến đang lập kế hoạch với nó
        for (const trip of trips.values()) {
          if (trip.vehicleId === vehicle.id && trip.phase === 'planning') put(trips, { ...trip, inputVersion: trip.inputVersion + 1 })
        }
        ctx.log('vehicle.updated', { type: 'vehicle', id: vehicle.id }, { name: vehicle.name })
        return resolved(put(vehicles, vehicle))
      }),
    deleteVehicle: (id) =>
      ctx.respond(() => {
        const vehicle = scope.own(id)
        const used = [...trips.values()].filter((trip) => trip.vehicleId === id)
        // Như máy chủ: còn chuyến chưa xong (nháp, lập kế hoạch, xếp, giao) thì không xoá; xe từng chạy chuyến giữ lại ở Ngừng sử dụng để
        // lịch sử chuyến còn xe, chỉ xe chưa từng có chuyến mới bị xoá hẳn
        const unfinished = used.filter((trip) => !isFinishedPhase(trip.phase)).map((trip) => trip.id)
        if (unfinished.length > 0) throw new MockDbError('VEHICLE_IN_USE', { vehicleId: id, tripIds: unfinished })
        if (used.length > 0) {
          if (retiredVehicles.has(id)) return 'RETIRED' as const
          maintenance.delete(id)
          retiredVehicles.set(id, ctx.nowIso())
          ctx.log('vehicle.retired', { type: 'vehicle', id }, { name: vehicle.name })
          return 'RETIRED' as const
        }
        vehicles.delete(id)
        vehicleCompany.delete(id)
        maintenance.delete(id)
        ctx.log('vehicle.deleted', { type: 'vehicle', id }, { name: vehicle.name })
        return 'DELETED' as const
      }),
    listVehicleStates: () => ctx.respond(() => scope.list().map((vehicle) => stateOf(vehicle.id))),
    setVehicleMaintenance: (id, note) =>
      ctx.respond(() => {
        scope.own(id)
        if (note === null) {
          if (maintenance.delete(id)) ctx.log('vehicle.maintenanceOff', { type: 'vehicle', id })
          return stateOf(id)
        }
        assertNotRetired(id)
        assertNotRunning(id)
        const trimmed = note.trim()
        if (trimmed.length > MAINTENANCE_NOTE_MAX) throw new MockDbError('MAINTENANCE_NOTE_TOO_LONG', { max: MAINTENANCE_NOTE_MAX })
        maintenance.set(id, { note: trimmed, since: ctx.nowIso() })
        ctx.log('vehicle.maintenanceOn', { type: 'vehicle', id }, { note: trimmed })
        return stateOf(id)
      }),
  }
}
