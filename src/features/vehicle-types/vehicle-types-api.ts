import { api } from '@/lib/api-client'
import { DEFAULT_MAX_COG_OFFSET_RATIO } from '@/domain/models'
import { backendConfig } from '@/lib/backend-config'

import { compareText } from '@/lib/list-filter'
import {
  getMockDb,
  type VehicleTypeAssignment,
} from '@/lib/mock-db'

/**
 * Lớp dữ liệu loại xe (LM-104) — backend đã có CRUD thật `/api/vehicle-types` (Spring, `VehicleTypeController`); khi nối chỉ thay thân
 * các hàm ở đây. Xe gắn loại tuỳ chọn, lưu ngoài `VehicleConfig` (D-04).
 */

type PageResponse<T> = {
  success: boolean
  message?: string
  data: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

<<<<<<< HEAD
type SpringPage<T> = {
  content: T[]
  number: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}
=======

>>>>>>> 852201851fa0ed1118b7cb902879b59920460a13

type VehicleTypeApi = {
  id: number
  name: string
  innerLength: number
  innerWidth: number
  innerHeight: number
  maxPayloadKg: number
  frontAxleLimitKg: number | null
  rearAxleLimitKg: number | null
  maxCogOffsetRatio: number
  hazardousCapable: boolean
  obstacles: VehicleTypeObstacleApi[]
  vehicleCount: number
}

type VehicleTypeObstacleApi = {
  id: number
  name: string
  type:
    | 'WHEEL_ARCH'
    | 'COOLING_UNIT'
    | 'PARTITION'
    | 'RESERVED_ZONE'
    | 'OTHER'
  x: number
  y: number
  z: number
  length: number
  width: number
  height: number
  loadBearing: boolean
}

export type VehicleType = {
  id: string
  name: string

  cargoLengthCm: number
  cargoWidthCm: number
  cargoHeightCm: number

  payloadKg: number

  frontAxleLimitKg?: number
  rearAxleLimitKg?: number

  maxCogOffsetRatio: number

<<<<<<< HEAD
  hazardousCapable?: boolean
  obstacles?: VehicleTypeObstacle[]
=======
  hazardousCapable: boolean
  obstacles: VehicleTypeObstacle[]
  vehicleCount: number
>>>>>>> 852201851fa0ed1118b7cb902879b59920460a13
}

export type VehicleTypeObstacle = {
  id: string
  name: string
  type: VehicleTypeObstacleApi['type']
  x: number
  y: number
  z: number
  length: number
  width: number
  height: number
  loadBearing: boolean
}

function mapVehicleType(
  item: VehicleTypeApi,
): VehicleType {
  return {
    id: String(item.id),
    name: item.name,

    cargoLengthCm: item.innerLength,
    cargoWidthCm: item.innerWidth,
    cargoHeightCm: item.innerHeight,

    payloadKg: item.maxPayloadKg,

    frontAxleLimitKg:
      item.frontAxleLimitKg ?? undefined,

    rearAxleLimitKg:
      item.rearAxleLimitKg ?? undefined,

    maxCogOffsetRatio:
      item.maxCogOffsetRatio,

    hazardousCapable:
      item.hazardousCapable,

    obstacles:
      item.obstacles.map((obstacle) => ({
        id: String(obstacle.id),
        name: obstacle.name,
        type: obstacle.type,
        x: obstacle.x,
        y: obstacle.y,
        z: obstacle.z,
        length: obstacle.length,
        width: obstacle.width,
        height: obstacle.height,
        loadBearing:
          obstacle.loadBearing,
      })),
      vehicleCount: item.vehicleCount,
  }
}

export type VehicleTypeObstacleInput = {
  name: string
  type:
    | 'WHEEL_ARCH'
    | 'COOLING_UNIT'
    | 'PARTITION'
    | 'RESERVED_ZONE'
    | 'OTHER'
  x: number
  y: number
  z: number
  length: number
  width: number
  height: number
  loadBearing: boolean
}

export type VehicleTypeInput = {
  name: string

  cargoLengthCm: number
  cargoWidthCm: number
  cargoHeightCm: number

  payloadKg: number

  frontAxleLimitKg?: number
  rearAxleLimitKg?: number

  maxCogOffsetRatio?: number

  hazardousCapable?: boolean
  obstacles?: VehicleTypeObstacleInput[]
}

function toCreateVehicleTypeRequest(
  input: VehicleTypeInput,
) {
  return {
    name: input.name,

    innerLength: input.cargoLengthCm,
    innerWidth: input.cargoWidthCm,
    innerHeight: input.cargoHeightCm,

    maxPayloadKg: input.payloadKg,

    frontAxleLimitKg:
      input.frontAxleLimitKg,

    rearAxleLimitKg:
      input.rearAxleLimitKg,

    maxCogOffsetRatio:
      input.maxCogOffsetRatio ?? DEFAULT_MAX_COG_OFFSET_RATIO,

    hazardousCapable:
      input.hazardousCapable ?? false,

    obstacles:
      input.obstacles ?? [],
  }
}

export type VehicleRef = { readonly id: string; readonly name: string }

/** Loại xe kèm các xe đang gắn (mã và tên, theo tên xe). */
export type VehicleTypeRow = { readonly type: VehicleType; readonly vehicleIds: readonly string[]; readonly vehicles: readonly VehicleRef[] }

/** Một xe của đội và loại đang gắn (`null` khi chưa gắn) — bảng "Gắn loại cho xe". */
export type VehicleAssignmentRow = { readonly vehicle: VehicleRef; readonly vehicleTypeId: string | null }

// GET /api/vehicle-types (xe đang gắn loại: chưa có ở BE)
export async function fetchVehicleTypes(
  page = 0,
  size = 20,
  search?: string,
): Promise<PageResponse<VehicleType>> {
  if (backendConfig.authSource === 'mock') {
    const all = await getMockDb().listVehicleTypes()
    const normalizedSearch = search?.trim().toLocaleLowerCase('vi')
    const filtered = normalizedSearch ? all.filter((type) => type.name.toLocaleLowerCase('vi').includes(normalizedSearch)) : all
    const data = filtered.slice(page * size, (page + 1) * size)
    return {
      success: true,
      data,
      page,
      size,
      totalElements: filtered.length,
      totalPages: Math.ceil(filtered.length / size),
      last: (page + 1) * size >= filtered.length,
    }
  }
  const params =
    new URLSearchParams({
      page: String(page),
      size: String(size),
    })

  if (search?.trim()) {
    params.set('search', search.trim())
  }

  const pageResult = await api().get<SpringPage<VehicleTypeApi>>(
    `/api/vehicle-types?${params.toString()}`,
  )

  return {
    success: true,
    data: pageResult.content.map(mapVehicleType),
    page: pageResult.number,
    size: pageResult.size,
    totalElements: pageResult.totalElements,
    totalPages: pageResult.totalPages,
    last: pageResult.last,
  }
}

// chưa có ở BE
export function fetchVehicleTypeAssignments(): Promise<VehicleTypeAssignment[]> {
  return getMockDb().listVehicleTypeAssignments()
}

/** Mọi xe của đội (theo tên) kèm loại đang gắn. */
// chưa có ở BE
export async function fetchVehicleAssignmentRows(): Promise<VehicleAssignmentRow[]> {
  const db = getMockDb()
  const [vehicles, assignments] = await Promise.all([db.listVehicles(), db.listVehicleTypeAssignments()])
  const typeOf = new Map(assignments.map((item) => [item.vehicleId, item.vehicleTypeId]))
  return vehicles
    .map((vehicle) => ({ vehicle: { id: vehicle.id, name: vehicle.name }, vehicleTypeId: typeOf.get(vehicle.id) ?? null }))
    .toSorted((a, b) => compareText(a.vehicle.name, b.vehicle.name))
}

/** `id` vắng là loại mới (`VT-NNN`). Sai dữ liệu: `VEHICLE_TYPE_INVALID` kèm tên trường. */
// POST /api/vehicle-types (tạo) · PUT /api/vehicle-types/{id} (sửa — kiểm lại phương thức khi nối)
export async function saveVehicleType(
  input: VehicleTypeInput,
  id?: string,
): Promise<VehicleType> {
  if (backendConfig.authSource === 'mock') {
    return id === undefined ? getMockDb().createVehicleType(input) : getMockDb().updateVehicleType(id, input)
  }
  if (id !== undefined) {
    throw new Error(
      'Update vehicle type API is not implemented yet',
    )
  }

  const created = await api().post<VehicleTypeApi>('/api/vehicle-types', {
    body: toCreateVehicleTypeRequest(input),
  })

  return mapVehicleType(created)
}

// DELETE /api/vehicle-types/{id}
export function deleteVehicleType(id: string): Promise<void> {
  return backendConfig.authSource === 'mock' ? getMockDb().deleteVehicleType(id) : api().delete(`/api/vehicle-types/${encodeURIComponent(id)}`)
}

// chưa có ở BE
export function setVehicleType(vehicleId: string, vehicleTypeId: string | null): Promise<VehicleTypeAssignment | null> {
  return getMockDb().setVehicleType(vehicleId, vehicleTypeId)
}
