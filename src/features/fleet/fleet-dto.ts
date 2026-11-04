import { roundCm, roundKg } from '@/domain/geometry'
import { DEFAULT_MAX_COG_OFFSET_RATIO, MAX_COG_OFFSET_RATIO_CEILING, type VehicleAxle, type VehicleObstacle } from '@/domain/models'
import type { VehicleTypeEntry, VehicleTypeRow } from '@/features/vehicle-types/vehicle-types-api'
import { compareText } from '@/lib/list-filter'
import type { FleetStatus, FleetVehicle, FleetVehicleState } from './vehicle-status'

/**
 * DTO đội xe và loại xe của backend và phép đổi sang kiểu của app (FE-0-09). Chỉ lớp `-api` của đội xe và loại xe dùng file này. Kích
 * thước lòng thùng, cửa, vật cản và vị trí trục của backend là **cm** (`VehicleTypeResponse`, `TripVehicleConfigResponse`, cột của
 * `VehicleType`), như app (D-03): không đổi đơn vị, chỉ làm tròn tại biên. Hàm thuần, không gọi mạng.
 */

/** BigDecimal của Jackson: số, hoặc chuỗi khi máy chủ bật ghi BigDecimal bằng chuỗi. */
type Decimal = number | string

/** Một xe theo `VehicleResponse` (`GET /api/vehicles`). */
export type BackendVehicle = {
  readonly id: number
  readonly name?: string | null
  readonly licensePlate?: string | null
  readonly vehicleTypeId?: number | null
  readonly status?: string | null
}

/** Vật cản trong thùng của một loại xe: `x`, `y`, `z` là góc tính từ vách đầu thùng, vách trái và sàn (cm). */
export type BackendObstacle = {
  readonly id: number
  readonly type?: string | null
  readonly x?: Decimal | null
  readonly y?: Decimal | null
  readonly z?: Decimal | null
  readonly length?: number | null
  readonly width?: number | null
  readonly height?: number | null
  readonly loadBearing?: boolean | null
}

/** Phần thùng hàng chung của `VehicleTypeResponse` và `TripVehicleConfigResponse`. */
type BackendCargoSpace = {
  readonly innerLength: number
  readonly innerWidth: number
  readonly innerHeight: number
  readonly doorWidth?: number | null
  readonly doorHeight?: number | null
  readonly maxPayloadKg: Decimal
  readonly frontAxleLimitKg?: Decimal | null
  readonly rearAxleLimitKg?: Decimal | null
  readonly maxCogOffsetRatio?: Decimal | null
  readonly obstacles?: readonly BackendObstacle[] | null
}

/** Một loại xe theo `VehicleTypeResponse` (`GET /api/vehicle-types`). */
export type BackendVehicleType = BackendCargoSpace & {
  readonly id: number
  readonly name?: string | null
}

/** Cấu hình một xe theo `TripVehicleConfigResponse` (`GET /api/vehicles/{id}/config`): thùng hàng và trục đều lấy từ loại xe. */
export type BackendVehicleConfig = BackendCargoSpace & {
  readonly vehicleId: number
  readonly vehicleName?: string | null
  readonly licensePlate?: string | null
  readonly frontAxleX?: Decimal | null
  readonly rearAxleX?: Decimal | null
  readonly emptyFrontAxleLoadKg?: Decimal | null
  readonly emptyRearAxleLoadKg?: Decimal | null
}

const STATUSES: Readonly<Record<string, FleetStatus>> = { AVAILABLE: 'available', IN_TRIP: 'in_use', MAINTENANCE: 'maintenance', RETIRED: 'retired' }

/** Bốn loại vật cản của Spec. `OTHER` của backend không có trong Spec: đọc là vùng cấm xếp, không đặt kiện vào. */
const SPEC_OBSTACLE_TYPES = ['WHEEL_ARCH', 'COOLING_UNIT', 'PARTITION', 'RESERVED_ZONE'] as const

function numberOf(value: Decimal | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function positiveOf(value: Decimal | null | undefined): number | undefined {
  const number = numberOf(value)
  return number !== undefined && number > 0 ? number : undefined
}

/** Tên xe theo quy ước của app: "Tên · biển số" (`VehicleName` tách biển số ở " · "). */
export function vehicleNameOf(name: string | null | undefined, plate: string | null | undefined): string {
  const parts = [name?.trim(), plate?.trim()].filter((part): part is string => part !== undefined && part !== '')
  return parts.join(' · ')
}

function obstacleOf(dto: BackendObstacle): VehicleObstacle {
  const type = SPEC_OBSTACLE_TYPES.find((code) => code === dto.type) ?? 'RESERVED_ZONE'
  return {
    id: String(dto.id),
    type,
    xCm: roundCm(numberOf(dto.x) ?? 0),
    yCm: roundCm(numberOf(dto.y) ?? 0),
    zCm: roundCm(numberOf(dto.z) ?? 0),
    lengthCm: roundCm(numberOf(dto.length) ?? 0),
    widthCm: roundCm(numberOf(dto.width) ?? 0),
    heightCm: roundCm(numberOf(dto.height) ?? 0),
    loadBearing: dto.loadBearing === true,
  }
}

/** Giới hạn của loại xe: chỉ trường máy chủ có giá trị dùng được (tỷ lệ lệch trọng tâm trong (0, 0,5]). */
function limitsOf(cargo: BackendCargoSpace) {
  const front = positiveOf(cargo.frontAxleLimitKg)
  const rear = positiveOf(cargo.rearAxleLimitKg)
  const ratio = positiveOf(cargo.maxCogOffsetRatio)
  return {
    ...(front === undefined ? {} : { frontAxleLimitKg: roundKg(front) }),
    ...(rear === undefined ? {} : { rearAxleLimitKg: roundKg(rear) }),
    ...(ratio === undefined || ratio > MAX_COG_OFFSET_RATIO_CEILING ? {} : { maxCogOffsetRatio: ratio }),
  }
}

/**
 * Xe của app từ tên, mã và thùng hàng của loại xe. Backend không có khoảng hở quanh kiện (ghi 0, màn ẩn ô đó). Loại xe chưa khai cửa
 * (`doorWidth`, `doorHeight` là `null`): cửa vẽ bằng mặt cắt lòng thùng để mô hình dựng được, kèm `doorUnknown` để màn nói rõ.
 */
function vehicleOf(id: number, name: string, cargo: BackendCargoSpace, axles?: VehicleAxle[]): FleetVehicle {
  const innerWidthCm = roundCm(cargo.innerWidth)
  const innerHeightCm = roundCm(cargo.innerHeight)
  const doorWidth = positiveOf(cargo.doorWidth)
  const doorHeight = positiveOf(cargo.doorHeight)
  return {
    id: String(id),
    name,
    innerLengthCm: roundCm(cargo.innerLength),
    innerWidthCm,
    innerHeightCm,
    maxPayloadKg: roundKg(numberOf(cargo.maxPayloadKg) ?? 0),
    doorWidthCm: doorWidth === undefined ? innerWidthCm : roundCm(doorWidth),
    doorHeightCm: doorHeight === undefined ? innerHeightCm : roundCm(doorHeight),
    doorPosition: 'REAR',
    clearanceCm: 0,
    obstacles: (cargo.obstacles ?? []).map(obstacleOf),
    ...(axles ? { axles } : {}),
    ...limitsOf(cargo),
    ...(doorWidth === undefined || doorHeight === undefined ? { doorUnknown: true as const } : {}),
  }
}

/** Xe ở danh sách: `VehicleResponse` ghép với loại xe đang gắn (danh sách không trả trục, nên không có `axles`). */
export function listVehicleOf(vehicle: BackendVehicle, type: BackendVehicleType): FleetVehicle {
  return vehicleOf(vehicle.id, vehicleNameOf(vehicle.name, vehicle.licensePlate), type)
}

/**
 * Trục của loại xe theo mô hình của app (FE-5b-03): hai nhóm trục, trục trước ở `frontAxleX`, trục sau ở `rearAxleX` (cm từ vách đầu thùng,
 * trước có thể âm), tải rỗng của từng nhóm, tải tối đa là giới hạn của nhóm (0 kg là chưa khai). Thiếu vị trí hoặc tải rỗng của một nhóm,
 * hay trục sau không nằm sau trục trước: không có trục nào — không đoán phần còn thiếu.
 */
function axlesOf(config: BackendVehicleConfig): VehicleAxle[] | undefined {
  const frontX = numberOf(config.frontAxleX)
  const rearX = numberOf(config.rearAxleX)
  const frontEmpty = numberOf(config.emptyFrontAxleLoadKg)
  const rearEmpty = numberOf(config.emptyRearAxleLoadKg)
  if (frontX === undefined || rearX === undefined || frontEmpty === undefined || rearEmpty === undefined) return undefined
  if (rearX <= frontX || frontEmpty < 0 || rearEmpty < 0) return undefined
  return [
    { id: 'front', name: '', positionXCm: roundCm(frontX), emptyLoadKg: roundKg(frontEmpty), maxLoadKg: roundKg(positiveOf(config.frontAxleLimitKg) ?? 0) },
    { id: 'rear', name: '', positionXCm: roundCm(rearX), emptyLoadKg: roundKg(rearEmpty), maxLoadKg: roundKg(positiveOf(config.rearAxleLimitKg) ?? 0) },
  ]
}

/** Xe ở trang cấu hình: `TripVehicleConfigResponse` có cả trục. */
export function configVehicleOf(config: BackendVehicleConfig): FleetVehicle {
  return vehicleOf(config.vehicleId, vehicleNameOf(config.vehicleName, config.licensePlate), config, axlesOf(config))
}

/** Trạng thái xe của backend; trạng thái lạ thì không có (danh sách coi xe đó là Sẵn sàng như kho mẫu). Backend không trả chuyến hay ghi chú bảo dưỡng. */
export function vehicleStateOf(vehicle: BackendVehicle): FleetVehicleState | null {
  const status = vehicle.status ? STATUSES[vehicle.status] : undefined
  return status === undefined ? null : { vehicleId: String(vehicle.id), status }
}

/**
 * Loại xe của app; backend không trả công ty hay ngày tạo, nên loại xe của màn không có hai trường đó. Cột `max_cog_offset_ratio` không
 * rỗng, mặc định 0,15 như app; vắng trong phản hồi thì dùng chính mặc định đó.
 */
export function vehicleTypeOf(type: BackendVehicleType): VehicleTypeEntry {
  const { maxCogOffsetRatio, ...axleLimits } = limitsOf(type)
  return {
    id: String(type.id),
    name: type.name?.trim() ?? '',
    cargoLengthCm: roundCm(type.innerLength),
    cargoWidthCm: roundCm(type.innerWidth),
    cargoHeightCm: roundCm(type.innerHeight),
    payloadKg: roundKg(numberOf(type.maxPayloadKg) ?? 0),
    ...axleLimits,
    maxCogOffsetRatio: maxCogOffsetRatio ?? numberOf(type.maxCogOffsetRatio) ?? DEFAULT_MAX_COG_OFFSET_RATIO,
  }
}

/** Loại xe kèm các xe đang gắn nó (theo tên xe), từ danh sách xe của backend. */
export function vehicleTypeRowsOf(types: readonly BackendVehicleType[], vehicles: readonly BackendVehicle[]): VehicleTypeRow[] {
  return types.map((type) => {
    const refs = vehicles
      .filter((vehicle) => vehicle.vehicleTypeId === type.id)
      .map((vehicle) => ({ id: String(vehicle.id), name: vehicleNameOf(vehicle.name, vehicle.licensePlate) }))
      .toSorted((a, b) => compareText(a.name, b.name))
    return { type: vehicleTypeOf(type), vehicleIds: refs.map((ref) => ref.id), vehicles: refs }
  })
}
