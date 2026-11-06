import { ApiError } from '@/lib/api-client'
import { isoFromBackend } from '@/lib/backend-time'

/**
 * DTO của `WarehouseController` backend (`WarehouseTaskResponse`, `StartLoadingResponse`, `PlacementStepResponse`,
 * `ConfirmPlacementResponse`, `DeviationResponse`, `CompleteLoadingResponse`) và hàm đổi sang kiểu của màn kho; chỉ
 * `warehouse-backend-api.ts` import file này. Toạ độ và kích thước là cm, gốc ở góc trong cùng bên trái sàn thùng (như phương án).
 */

export type WarehouseTaskDto = {
  readonly tripId: number
  readonly tripCode: string | null
  readonly vehicleInfo: string | null
  readonly totalPackages: number | null
  readonly loadPlanId: number | null
  readonly departureTime: string | null
  readonly status: string | null
}

export type PlacementStepDto = {
  readonly placementId: number
  readonly packageId: number | null
  readonly packageName: string | null
  readonly trackingBarcode: string | null
  readonly posX: number | null
  readonly posY: number | null
  readonly posZ: number | null
  readonly packedLength: number | null
  readonly packedWidth: number | null
  readonly packedHeight: number | null
  readonly rotation: number | null
  readonly sequence: number | null
}

export type StartLoadingDto = {
  readonly executionId: number
  readonly tripId: number
  readonly tripCode: string | null
  readonly vehicleInfo: string | null
  readonly totalPackages: number | null
  readonly status: string | null
  readonly startedAt: string | null
  readonly placements: readonly PlacementStepDto[] | null
}

export type ConfirmPlacementDto = { readonly placementId: number; readonly status: string | null }
export type DeviationDto = { readonly placementId: number; readonly totalDeviations: number | null }
export type CompleteLoadingDto = { readonly tripId: number; readonly totalPackages: number | null; readonly totalDeviations: number | null }

/** Một dòng `TripResponse` của `GET /api/trips` — chỉ phần màn kho dùng. */
export type LoadingTripDto = {
  readonly id: number | string
  readonly tripCode: string
  readonly vehicleName?: string | null
  readonly licensePlate?: string | null
  readonly departureTime?: string | null
  readonly packageCount?: number | null
}

/**
 * Chuyến ở danh sách kho theo backend: `waiting` — Đã lập kế hoạch, có phương án đã duyệt, chưa bắt đầu xếp; `loading` / `loaded` — Đang
 * xếp hàng, phiên xếp bắt đầu ở tab này (đang xếp hoặc đã xếp xong chờ xe xuất phát); `elsewhere` — Đang xếp hàng nhưng phiên bắt đầu ở thiết
 * bị hay tab khác: backend chưa cho đọc lại danh sách kiện của phiên nên tab này không làm tiếp được.
 */
export type ServerWarehouseStage = 'loading' | 'waiting' | 'loaded' | 'elsewhere'

export type ServerWarehouseTrip = {
  /** Mã số của backend (trên URL `/kho?chuyen=`). */
  readonly id: string
  readonly code: string
  readonly vehicle: string
  /** ISO 8601, hoặc `null` khi backend không trả. */
  readonly departureAt: string | null
  readonly packageCount: number | null
  readonly stage: ServerWarehouseStage
}

/** Một kiện của phiên xếp, theo thứ tự xếp của phương án đã duyệt. */
export type ServerPlacement = {
  readonly id: string
  readonly packageId: string | null
  readonly name: string
  readonly barcode: string | null
  readonly x: number
  readonly y: number
  readonly z: number
  readonly lengthCm: number
  readonly widthCm: number
  readonly heightCm: number
  readonly rotation: number | null
  readonly sequence: number
}

/** Kết quả từng kiện trong phiên: đã xếp đúng chỗ, hoặc đã xếp kèm sai lệch vị trí. */
export type PlacementOutcome = 'confirmed' | 'deviation'

export type ServerLoadingSession = {
  readonly tripId: string
  readonly code: string
  readonly vehicle: string
  readonly placements: readonly ServerPlacement[]
  readonly outcomes: Readonly<Record<string, PlacementOutcome>>
  readonly completed: boolean
}

const numberOf = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ApiError('SERVER_ERROR')
  return value
}

export function taskOf(dto: WarehouseTaskDto): ServerWarehouseTrip {
  const id = String(dto.tripId)
  return {
    id,
    code: dto.tripCode ?? id,
    vehicle: dto.vehicleInfo ?? '',
    departureAt: dto.departureTime ? isoFromBackend(dto.departureTime) : null,
    packageCount: dto.totalPackages ?? null,
    stage: 'waiting',
  }
}

export function loadingTripOf(dto: LoadingTripDto, stage: ServerWarehouseStage): ServerWarehouseTrip {
  const name = dto.vehicleName?.trim() ?? ''
  const plate = dto.licensePlate?.trim() ?? ''
  return {
    id: String(dto.id),
    code: dto.tripCode,
    vehicle: name.includes(plate) ? name : [name, plate].filter((part) => part !== '').join(' · '),
    departureAt: dto.departureTime ? isoFromBackend(dto.departureTime) : null,
    packageCount: dto.packageCount ?? null,
    stage,
  }
}

export function placementOf(dto: PlacementStepDto): ServerPlacement {
  const barcode = dto.trackingBarcode?.trim() || null
  const packageId = dto.packageId === null ? null : String(dto.packageId)
  return {
    id: String(dto.placementId),
    packageId,
    name: dto.packageName?.trim() || barcode || packageId || String(dto.placementId),
    barcode,
    x: numberOf(dto.posX),
    y: numberOf(dto.posY),
    z: numberOf(dto.posZ),
    lengthCm: numberOf(dto.packedLength),
    widthCm: numberOf(dto.packedWidth),
    heightCm: numberOf(dto.packedHeight),
    rotation: dto.rotation,
    sequence: numberOf(dto.sequence),
  }
}

export function sessionOf(dto: StartLoadingDto): ServerLoadingSession {
  const id = String(dto.tripId)
  return {
    tripId: id,
    code: dto.tripCode ?? id,
    vehicle: dto.vehicleInfo ?? '',
    placements: (dto.placements ?? []).map(placementOf).toSorted((a, b) => a.sequence - b.sequence),
    outcomes: {},
    completed: false,
  }
}

const normalized = (value: string | null | undefined) => value?.trim().toLocaleUpperCase('vi') ?? ''

/** Mã gõ có khớp kiện không: mã vạch của kiện hoặc mã của kho kiện, không phân biệt hoa thường. */
export function codeMatches(placement: ServerPlacement, code: string): boolean {
  const typed = normalized(code)
  return typed !== '' && (typed === normalized(placement.barcode) || typed === normalized(placement.packageId))
}
