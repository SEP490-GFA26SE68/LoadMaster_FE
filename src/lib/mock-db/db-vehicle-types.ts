import { gt } from '@/domain/geometry'
import { found, nextId, put, type DbContext } from './db-context'
import type { Review1Db } from './db-api-review1'
import { MockDbError } from './errors'
import type { VehicleType, VehicleTypeInput } from './source-types'

type VehicleTypeMethods = Pick<
  Review1Db,
  | 'listVehicleTypes' | 'getVehicleType' | 'createVehicleType' | 'updateVehicleType' | 'deleteVehicleType' | 'listVehicleTypeAssignments'
  | 'setVehicleType'
>

const POSITIVE_FIELDS = ['cargoLengthCm', 'cargoWidthCm', 'cargoHeightCm', 'payloadKg'] as const

/** Tên không trống, kích thước và tải trọng dương; chỉ giữ trường của loại xe. */
function typeFields(input: VehicleTypeInput): VehicleTypeInput {
  const name = input.name.trim()
  if (name === '') throw new MockDbError('VEHICLE_TYPE_INVALID', { field: 'name' })
  for (const field of POSITIVE_FIELDS) {
    if (!Number.isFinite(input[field]) || !gt(input[field], 0)) throw new MockDbError('VEHICLE_TYPE_INVALID', { field })
  }
  return { name, cargoLengthCm: input.cargoLengthCm, cargoWidthCm: input.cargoWidthCm, cargoHeightCm: input.cargoHeightCm, payloadKg: input.payloadKg }
}

/** Danh mục loại xe (`/api/vehicle-types` của backend) và gắn loại cho xe (LM-104). */
export function vehicleTypeMethods(ctx: DbContext): VehicleTypeMethods {
  const { vehicleTypes, vehicleTypeOf, vehicles } = ctx.state
  return {
    listVehicleTypes: () => ctx.respond(() => [...vehicleTypes.values()]),
    getVehicleType: (id) => ctx.respond(() => found(vehicleTypes, 'vehicleTypes', id)),
    createVehicleType: (input) =>
      ctx.respond(() => {
        const created = put(vehicleTypes, { ...typeFields(input), id: nextId('VT', vehicleTypes.keys()), createdAt: ctx.nowIso() })
        ctx.log('vehicleType.created', { type: 'vehicleType', id: created.id }, { name: created.name })
        return created
      }),
    updateVehicleType: (id, input) =>
      ctx.respond(() => {
        const current = found(vehicleTypes, 'vehicleTypes', id)
        const next: VehicleType = { ...typeFields(input), id, createdAt: current.createdAt }
        ctx.log('vehicleType.updated', { type: 'vehicleType', id }, { name: next.name })
        return put(vehicleTypes, next)
      }),
    deleteVehicleType: (id) =>
      ctx.respond(() => {
        const current = found(vehicleTypes, 'vehicleTypes', id)
        const vehicleIds = [...vehicleTypeOf].filter(([, typeId]) => typeId === id).map(([vehicleId]) => vehicleId)
        if (vehicleIds.length > 0) throw new MockDbError('VEHICLE_TYPE_IN_USE', { vehicleTypeId: id, vehicleIds })
        vehicleTypes.delete(id)
        ctx.log('vehicleType.deleted', { type: 'vehicleType', id }, { name: current.name })
      }),
    listVehicleTypeAssignments: () =>
      ctx.respond(() => [...vehicleTypeOf].filter(([vehicleId]) => vehicles.has(vehicleId)).map(([vehicleId, vehicleTypeId]) => ({ vehicleId, vehicleTypeId }))),
    setVehicleType: (vehicleId, vehicleTypeId) =>
      ctx.respond(() => {
        found(vehicles, 'vehicles', vehicleId)
        if (vehicleTypeId === null) vehicleTypeOf.delete(vehicleId)
        else {
          found(vehicleTypes, 'vehicleTypes', vehicleTypeId)
          vehicleTypeOf.set(vehicleId, vehicleTypeId)
        }
        ctx.log('vehicleType.assigned', { type: 'vehicle', id: vehicleId }, { vehicleTypeId: vehicleTypeId ?? '' })
        return vehicleTypeId === null ? null : { vehicleId, vehicleTypeId }
      }),
  }
}
