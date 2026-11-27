import { api, apiFetch } from '@/lib/api-client'
import { fetchAllPages } from '@/lib/api-page'
import { parseVehicleBodyStyle, type VehicleBodyStyle } from '@/types/vehicle-body-style'

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
  /** BigDecimal, tuỳ chọn; máy chủ cũ không trả. */
  maxCogOffsetRatioY?: number | string | null
  floorLoadCapacityKgM2?: number | string | null
  hazardousCapable: boolean
  obstacles: VehicleTypeObstacleApi[]
  vehicleCount: number
  /** Tên enum kiểu thân xe; `null` là tự chọn theo kích thước, máy chủ cũ không trả. */
  bodyStyle?: string | null
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
  /** Lệch trọng tâm ngang tối đa (tỷ lệ chiều rộng); `null` là dùng `maxCogOffsetRatio`. */
  maxCogOffsetRatioY: number | null
  /** Tải trọng sàn, kg/m²; `null` là không kiểm tải sàn. */
  floorLoadCapacityKgM2: number | null

  hazardousCapable: boolean
  obstacles: VehicleTypeObstacle[]
  vehicleCount: number
  /** Kiểu thân xe, chỉ đổi hình xe ở khung 3D; vắng (hay giá trị máy chủ trả mà app không biết) là tự chọn theo kích thước. */
  bodyStyle?: VehicleBodyStyle
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

/** BigDecimal của máy chủ có thể là số hoặc chuỗi; vắng hay không đọc được là `null`. */
function decimalOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function mapVehicleType(
  item: VehicleTypeApi,
): VehicleType {
  const bodyStyle = parseVehicleBodyStyle(item.bodyStyle)
  return {
    ...(bodyStyle === undefined ? {} : { bodyStyle }),
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
    maxCogOffsetRatioY: decimalOrNull(item.maxCogOffsetRatioY),
    floorLoadCapacityKgM2: decimalOrNull(item.floorLoadCapacityKgM2),

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
  maxCogOffsetRatioY?: number | null
  floorLoadCapacityKgM2?: number | null

  hazardousCapable: boolean
  obstacles: VehicleTypeObstacleInput[]
  /** Vắng là "Tự chọn theo kích thước". */
  bodyStyle?: VehicleBodyStyle
}

/**
 * Kiểu thân xe trong thân request. Thêm mới chỉ gửi kiểu đã chọn. Sửa: máy chủ giữ kiểu đã lưu khi vắng `bodyStyle` (client cũ không
 * gửi), nên "Tự chọn" phải gửi `clearBodyStyle: true` — không gửi cùng `bodyStyle` (máy chủ từ chối `INVALID_INPUT`).
 */
function bodyStyleFields(bodyStyle: VehicleBodyStyle | undefined, editing: boolean) {
  if (bodyStyle !== undefined) return { bodyStyle }
  return editing ? { clearBodyStyle: true } : {}
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
    // Máy chủ bỏ qua null khi sửa: null chỉ có nghĩa "không đổi" (form chặn việc xoá giá trị đã lưu).
    maxCogOffsetRatioY: input.maxCogOffsetRatioY ?? null,
    floorLoadCapacityKgM2: input.floorLoadCapacityKgM2 ?? null,

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
/** Complete tenant-scoped catalog, bounded by the shared completeness guard. */
export async function fetchAllVehicleTypes(): Promise<VehicleType[]> {
  return (await fetchAllPages<VehicleTypeApi>('/api/vehicle-types', { size: 100 })).map(mapVehicleType)
}

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

/**
 * `id` vắng là loại mới. Sửa gửi lại cả bản ghi: số, cửa, vật cản như đang nhập; vị trí và tải rỗng của trục máy chủ giữ nguyên. Kiểu thân
 * xe theo `bodyStyleFields`; máy chủ không coi đổi kiểu thân là đổi xe nên phương án không lỗi thời.
 */
// POST /api/vehicle-types · PUT /api/vehicle-types/{id}
export async function saveVehicleType(
  input: VehicleTypeInput,
  id?: string,
): Promise<VehicleType> {
  const body = { ...toCreateVehicleTypeRequest(input), ...bodyStyleFields(input.bodyStyle, id !== undefined) }
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
