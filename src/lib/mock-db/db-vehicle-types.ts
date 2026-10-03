import { gt } from '@/domain/geometry'
import { DEFAULT_MAX_COG_OFFSET_RATIO, MAX_COG_OFFSET_RATIO_CEILING } from '@/domain/models'
import { nextId, put, type DbContext } from './db-context'
import type { Review1Db } from './db-api-review1'
import { MockDbError } from './errors'
import type { VehicleType, VehicleTypeInput } from './source-types'
import { limitsOfType, sameLimits, type VehicleLimits } from './vehicle-limits'

type VehicleTypeMethods = Pick<
  Review1Db,
  | 'listVehicleTypes' | 'getVehicleType' | 'createVehicleType' | 'updateVehicleType' | 'deleteVehicleType' | 'listVehicleTypeAssignments'
  | 'setVehicleType'
>

const POSITIVE_FIELDS = ['cargoLengthCm', 'cargoWidthCm', 'cargoHeightCm', 'payloadKg'] as const
const AXLE_LIMIT_FIELDS = ['frontAxleLimitKg', 'rearAxleLimitKg'] as const

type TypeFields = Omit<VehicleType, 'id' | 'companyId' | 'createdAt'>

function isPositive(value: number): boolean {
  return Number.isFinite(value) && gt(value, 0)
}

/**
 * Tên không trống, kích thước và tải trọng dương; giới hạn trục để trống hoặc dương; độ lệch trọng tâm trong (0, 0,5], vắng thì mặc
 * định 0,15 (D-79). Chỉ giữ trường của loại xe.
 */
function typeFields(input: VehicleTypeInput): TypeFields {
  const name = input.name.trim()
  if (name === '') throw new MockDbError('VEHICLE_TYPE_INVALID', { field: 'name' })
  for (const field of POSITIVE_FIELDS) {
    if (!isPositive(input[field])) throw new MockDbError('VEHICLE_TYPE_INVALID', { field })
  }
  const limits: Pick<TypeFields, 'frontAxleLimitKg' | 'rearAxleLimitKg'> = {}
  for (const field of AXLE_LIMIT_FIELDS) {
    const value = input[field]
    if (value === undefined) continue
    if (!isPositive(value)) throw new MockDbError('VEHICLE_TYPE_INVALID', { field })
    limits[field] = value
  }
  const maxCogOffsetRatio = input.maxCogOffsetRatio ?? DEFAULT_MAX_COG_OFFSET_RATIO
  if (!isPositive(maxCogOffsetRatio) || gt(maxCogOffsetRatio, MAX_COG_OFFSET_RATIO_CEILING)) {
    throw new MockDbError('VEHICLE_TYPE_INVALID', { field: 'maxCogOffsetRatio' })
  }
  return {
    name, cargoLengthCm: input.cargoLengthCm, cargoWidthCm: input.cargoWidthCm, cargoHeightCm: input.cargoHeightCm, payloadKg: input.payloadKg,
    ...limits, maxCogOffsetRatio,
  }
}

/**
 * Danh mục loại xe (`/api/vehicle-types` của backend) và gắn loại cho xe (LM-104). Mỗi công ty một danh mục riêng; xe chỉ gắn loại
 * xe của công ty mình (D-64). Xe lấy giới hạn tải trục và độ lệch trọng tâm từ loại đang gắn (FE-5b-01): đổi giới hạn của loại, hoặc
 * gắn / gỡ loại làm giới hạn hiệu lực của xe đổi, thì phương án của các chuyến đang lập kế hoạch với xe đó lỗi thời — như khi sửa xe.
 */
export function vehicleTypeMethods(ctx: DbContext): VehicleTypeMethods {
  const { vehicleTypes, vehicleTypeOf, vehicleCompany, trips } = ctx.state
  const scope = ctx.scope.vehicleTypes

  /** Giới hạn của xe là đầu vào tối ưu: đổi thì chuyến đang lập kế hoạch với xe đó phải tối ưu lại. */
  function limitsChanged(vehicleIds: readonly string[], before: VehicleLimits, after: VehicleLimits): void {
    if (sameLimits(before, after)) return
    const affected = new Set(vehicleIds)
    for (const trip of trips.values()) {
      if (affected.has(trip.vehicleId) && trip.phase === 'planning') put(trips, { ...trip, inputVersion: trip.inputVersion + 1 })
    }
  }

  return {
    listVehicleTypes: () => ctx.respond(() => scope.list()),
    getVehicleType: (id) => ctx.respond(() => scope.read(id)),
    createVehicleType: (input) =>
      ctx.respond(() => {
        const companyId = ctx.scope.newRecordCompany()
        const created = put(vehicleTypes, { ...typeFields(input), id: nextId('VT', vehicleTypes.keys()), companyId, createdAt: ctx.nowIso() })
        ctx.log('vehicleType.created', { type: 'vehicleType', id: created.id }, { name: created.name })
        return created
      }),
    updateVehicleType: (id, input) =>
      ctx.respond(() => {
        const current = scope.own(id)
        const next: VehicleType = { ...typeFields(input), id, companyId: current.companyId, createdAt: current.createdAt }
        const vehicleIds = [...vehicleTypeOf].filter(([, typeId]) => typeId === id).map(([vehicleId]) => vehicleId)
        limitsChanged(vehicleIds, limitsOfType(current), limitsOfType(next))
        ctx.log('vehicleType.updated', { type: 'vehicleType', id }, { name: next.name })
        return put(vehicleTypes, next)
      }),
    deleteVehicleType: (id) =>
      ctx.respond(() => {
        const current = scope.own(id)
        const vehicleIds = [...vehicleTypeOf].filter(([, typeId]) => typeId === id).map(([vehicleId]) => vehicleId)
        if (vehicleIds.length > 0) throw new MockDbError('VEHICLE_TYPE_IN_USE', { vehicleTypeId: id, vehicleIds })
        vehicleTypes.delete(id)
        ctx.log('vehicleType.deleted', { type: 'vehicleType', id }, { name: current.name })
      }),
    listVehicleTypeAssignments: () =>
      ctx.respond(() => {
        const visible = new Set(ctx.scope.vehicles.list().map((vehicle) => vehicle.id))
        return [...vehicleTypeOf].filter(([vehicleId]) => visible.has(vehicleId)).map(([vehicleId, vehicleTypeId]) => ({ vehicleId, vehicleTypeId }))
      }),
    setVehicleType: (vehicleId, vehicleTypeId) =>
      ctx.respond(() => {
        ctx.scope.vehicles.own(vehicleId)
        const before = limitsOfType(vehicleTypes.get(vehicleTypeOf.get(vehicleId) ?? ''))
        if (vehicleTypeId === null) vehicleTypeOf.delete(vehicleId)
        else {
          scope.ref(vehicleTypeId, vehicleCompany.get(vehicleId))
          vehicleTypeOf.set(vehicleId, vehicleTypeId)
        }
        limitsChanged([vehicleId], before, limitsOfType(vehicleTypes.get(vehicleTypeId ?? '')))
        ctx.log('vehicleType.assigned', { type: 'vehicle', id: vehicleId }, { vehicleTypeId: vehicleTypeId ?? '' })
        return vehicleTypeId === null ? null : { vehicleId, vehicleTypeId }
      }),
  }
}
