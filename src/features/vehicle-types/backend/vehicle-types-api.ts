import { api, apiFetch } from '@/lib/api-client'

/**
 * Loại xe đọc ghi máy chủ (nhóm `fleet`):
 *   fetchVehicleTypes  → GET /api/vehicle-types
 *   saveVehicleType    → POST /api/vehicle-types · PUT /api/vehicle-types/{id}
 *   deleteVehicleType  → DELETE /api/vehicle-types/{id}
 * Mọi xe của máy chủ đều có loại, gắn khi tạo hoặc sửa xe.
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



type VehicleTypeApi = {
  id: number
  name: string

  innerLength: number
  innerWidth: number
  innerHeight: number

  doorWidth: number | null
  doorHeight: number | null

  maxPayloadKg: number
  frontAxleLimitKg: number | null
  rearAxleLimitKg: number | null
  frontAxleX: number | null
  rearAxleX: number | null
  emptyFrontAxleLoadKg: number | null
  emptyRearAxleLoadKg: number | null
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
  doorWidthCm: number | null
  doorHeightCm: number | null

  payloadKg: number

  frontAxleLimitKg?: number
  rearAxleLimitKg?: number
  frontAxleX: number | null
  rearAxleX: number | null
  emptyFrontAxleLoadKg: number | null
  emptyRearAxleLoadKg: number | null

  maxCogOffsetRatio: number

  hazardousCapable: boolean
  obstacles: VehicleTypeObstacle[]
  vehicleCount: number
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
    doorWidthCm: item.doorWidth ?? null,
    doorHeightCm: item.doorHeight ?? null,

    payloadKg: item.maxPayloadKg,

    frontAxleLimitKg:
      item.frontAxleLimitKg ?? undefined,

    rearAxleLimitKg:
      item.rearAxleLimitKg ?? undefined,
    frontAxleX: item.frontAxleX ?? null,
    rearAxleX: item.rearAxleX ?? null,
    emptyFrontAxleLoadKg: item.emptyFrontAxleLoadKg ?? null,
    emptyRearAxleLoadKg: item.emptyRearAxleLoadKg ?? null,

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

  // Kích thước cửa xe
  doorWidthCm?: number
  doorHeightCm?: number

  payloadKg: number

  frontAxleLimitKg?: number
  rearAxleLimitKg?: number
  frontAxleX?: number | null
  rearAxleX?: number | null
  emptyFrontAxleLoadKg?: number | null
  emptyRearAxleLoadKg?: number | null

  maxCogOffsetRatio: number

  hazardousCapable: boolean
  obstacles: VehicleTypeObstacleInput[]
}


function toCreateVehicleTypeRequest(
  input: VehicleTypeInput,
) {
  return {
    name: input.name,

    innerLength: input.cargoLengthCm,
    innerWidth: input.cargoWidthCm,
    innerHeight: input.cargoHeightCm,

    // Kích thước cửa xe gửi lên backend
    doorWidth: input.doorWidthCm ?? null,
    doorHeight: input.doorHeightCm ?? null,

    maxPayloadKg: input.payloadKg,

    frontAxleLimitKg:
      input.frontAxleLimitKg ?? null,

    rearAxleLimitKg:
      input.rearAxleLimitKg ?? null,
    frontAxleX: input.frontAxleX ?? null,
    rearAxleX: input.rearAxleX ?? null,
    emptyFrontAxleLoadKg: input.emptyFrontAxleLoadKg ?? null,
    emptyRearAxleLoadKg: input.emptyRearAxleLoadKg ?? null,

    maxCogOffsetRatio:
      input.maxCogOffsetRatio,

    hazardousCapable:
      input.hazardousCapable,

    obstacles:
      input.obstacles,
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
  const params =
    new URLSearchParams({
      page: String(page),
      size: String(size),
    })

  if (search?.trim()) {
    params.set('search', search.trim())
  }

  const body =
    await apiFetch<PageResponse<VehicleTypeApi>>(
      `/api/vehicle-types?${params.toString()}`,
    )

  return {
    ...body,
    data: body.data.map(mapVehicleType),
  }
}

/** `id` vắng là loại mới. Sửa gửi lại cả bản ghi: số, cửa, vật cản như đang nhập; vị trí và tải rỗng của trục máy chủ giữ nguyên. */
// POST /api/vehicle-types · PUT /api/vehicle-types/{id}
export async function saveVehicleType(
  input: VehicleTypeInput,
  id?: string,
): Promise<VehicleType> {
  const body = toCreateVehicleTypeRequest(input)
  const saved = id === undefined
    ? await api().post<VehicleTypeApi>('/api/vehicle-types', { body })
    : await api().put<VehicleTypeApi>(`/api/vehicle-types/${encodeURIComponent(id)}`, { body })
  return mapVehicleType(saved)
}

/** Loại còn xe gắn (kể cả xe ngừng sử dụng): máy chủ từ chối `VEHICLE_TYPE_IN_USE`. */
// DELETE /api/vehicle-types/{id}
export async function deleteVehicleType(id: string): Promise<void> {
  await api().delete<unknown>(`/api/vehicle-types/${encodeURIComponent(id)}`)
}
