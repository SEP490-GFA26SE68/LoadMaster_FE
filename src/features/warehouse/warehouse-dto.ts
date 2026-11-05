import { ApiError } from '@/lib/api-client'
import { isoFromBackend } from '@/lib/backend-time'

/**
 * DTO của `WarehouseController` backend (`WarehouseTaskResponse`, `StartLoadingResponse`, `PlacementStepResponse`,
 * `ConfirmPlacementResponse`, `DeviationResponse`, `CompleteLoadingResponse`) và hàm đổi sang kiểu của màn kho; chỉ
 * `warehouse-backend-api.ts` import file này. Toạ độ, kích thước kiện và lòng thùng là cm, gốc ở góc trong cùng bên trái sàn thùng (như
 * phương án).
 */

export type WarehouseTaskDto = {
  readonly tripId: number
  readonly tripCode: string | null
  readonly vehicleInfo: string | null
  readonly totalPackages: number | null
  readonly loadPlanId: number | null
  readonly departureTime: string | null
  /** Trạng thái chuyến: `PLANNED` (chờ xếp) hoặc `LOADING` (đã có phiên xếp). */
  readonly status: string | null
  readonly executionId?: number | null
  /** `IN_PROGRESS` | `COMPLETED`; vắng khi chưa bắt đầu xếp. */
  readonly executionStatus?: string | null
}

export type PlacementStepDto = {
  readonly placementId: number
  readonly packageId: number | null
  readonly packageName: string | null
  readonly packageCode?: string | null
  readonly trackingBarcode: string | null
  readonly qrToken?: string | null
  readonly posX: number | null
  readonly posY: number | null
  readonly posZ: number | null
  readonly packedLength: number | null
  readonly packedWidth: number | null
  readonly packedHeight: number | null
  readonly rotation: number | null
  /** Khối lượng thực tế của kiện (kg), không có thì của loại kiện. */
  readonly weightKg?: number | null
  readonly sequence: number | null
  readonly stopId?: number | null
  readonly stopSequence?: number | null
  readonly stopName?: string | null
  /** `CONFIRMED` | `DEVIATION` | `PENDING`. */
  readonly status?: string | null
}

/** Phiên xếp: `POST /api/warehouse/tasks/{tripId}/start` và `GET /api/warehouse/tasks/{tripId}` trả cùng dạng. Lòng thùng và cửa: cm. */
export type StartLoadingDto = {
  readonly executionId: number
  readonly loadPlanId?: number | null
  readonly tripId: number
  readonly tripCode: string | null
  readonly vehicleInfo: string | null
  readonly licensePlate?: string | null
  readonly vehicleTypeName?: string | null
  readonly innerLength?: number | null
  readonly innerWidth?: number | null
  readonly innerHeight?: number | null
  readonly doorWidth?: number | null
  readonly doorHeight?: number | null
  /** Tải trọng tối đa của xe (kg) theo loại xe; `null` khi xe chưa gắn loại hoặc loại chưa khai. */
  readonly maxPayloadKg?: number | null
  readonly totalPackages: number | null
  /** `IN_PROGRESS` | `COMPLETED` của phiên xếp. */
  readonly status: string | null
  readonly startedAt: string | null
  readonly completedAt?: string | null
  readonly placements: readonly PlacementStepDto[] | null
}

/**
 * Chuyến ở danh sách kho theo backend: `waiting` — Đã lập kế hoạch, có phương án đã duyệt, chưa bắt đầu xếp; `loading` — Đang xếp hàng,
 * phiên đang dở; `loaded` — đã xếp xong, chờ tài xế xuất phát. Phiên đọc lại được ở mọi thiết bị (`GET /api/warehouse/tasks/{tripId}`).
 */
export type ServerWarehouseStage = 'loading' | 'waiting' | 'loaded'

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
  /** Mã của bên gửi. */
  readonly packageCode: string | null
  /** Mã QR in trên nhãn. */
  readonly qrToken: string | null
  readonly x: number
  readonly y: number
  readonly z: number
  readonly lengthCm: number
  readonly widthCm: number
  readonly heightCm: number
  readonly rotation: number | null
  /** kg; `null` khi máy chủ không trả. */
  readonly weightKg: number | null
  readonly sequence: number
  /** Điểm giao thật của kiện (qua yêu cầu giao): số thứ tự và tên; `null` khi máy chủ không trả. */
  readonly stopSequence: number | null
  readonly stopName: string | null
}

/** Kết quả từng kiện trong phiên: đã xếp đúng chỗ, hoặc đã xếp kèm sai lệch vị trí. */
export type PlacementOutcome = 'confirmed' | 'deviation'

/** Lòng thùng và cửa xe của phiên, cm; `null` khi xe chưa gắn loại hoặc loại chưa khai lòng thùng — khi đó không có khung 3D. */
export type ServerCargoBox = {
  readonly innerLengthCm: number
  readonly innerWidthCm: number
  readonly innerHeightCm: number
  readonly doorWidthCm: number
  readonly doorHeightCm: number
}

export type ServerLoadingSession = {
  readonly tripId: string
  readonly code: string
  readonly vehicle: string
  readonly box: ServerCargoBox | null
  /** Tải trọng tối đa của xe (kg); `null` khi máy chủ không trả. */
  readonly maxPayloadKg: number | null
  readonly placements: readonly ServerPlacement[]
  /** Kết quả từng kiện theo máy chủ (`CONFIRMED` / `DEVIATION`); kiện chưa xử lý không có mục. */
  readonly outcomes: Readonly<Record<string, PlacementOutcome>>
  readonly completed: boolean
}

const numberOf = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ApiError('SERVER_ERROR')
  return value
}

function stageOf(dto: WarehouseTaskDto): ServerWarehouseStage {
  if (dto.status !== 'LOADING') return 'waiting'
  return dto.executionStatus === 'COMPLETED' ? 'loaded' : 'loading'
}

export function taskOf(dto: WarehouseTaskDto): ServerWarehouseTrip {
  const id = String(dto.tripId)
  return {
    id,
    code: dto.tripCode ?? id,
    vehicle: dto.vehicleInfo ?? '',
    departureAt: dto.departureTime ? isoFromBackend(dto.departureTime) : null,
    packageCount: dto.totalPackages ?? null,
    stage: stageOf(dto),
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
    packageCode: dto.packageCode?.trim() || null,
    qrToken: dto.qrToken?.trim() || null,
    x: numberOf(dto.posX),
    y: numberOf(dto.posY),
    z: numberOf(dto.posZ),
    lengthCm: numberOf(dto.packedLength),
    widthCm: numberOf(dto.packedWidth),
    heightCm: numberOf(dto.packedHeight),
    rotation: dto.rotation,
    weightKg: finiteOrNull(dto.weightKg),
    sequence: numberOf(dto.sequence),
    stopSequence: typeof dto.stopSequence === 'number' ? dto.stopSequence : null,
    stopName: dto.stopName?.trim() || null,
  }
}

const finiteOrNull = (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null)

const positive = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0

function boxOf(dto: StartLoadingDto): ServerCargoBox | null {
  const { innerLength, innerWidth, innerHeight, doorWidth, doorHeight } = dto
  if (!positive(innerLength) || !positive(innerWidth) || !positive(innerHeight)) return null
  // Loại xe chưa khai cửa: cửa là mặt cắt lòng thùng (như đội xe)
  return {
    innerLengthCm: innerLength,
    innerWidthCm: innerWidth,
    innerHeightCm: innerHeight,
    doorWidthCm: positive(doorWidth) ? doorWidth : innerWidth,
    doorHeightCm: positive(doorHeight) ? doorHeight : innerHeight,
  }
}

const OUTCOMES: Readonly<Record<string, PlacementOutcome>> = { CONFIRMED: 'confirmed', DEVIATION: 'deviation' }

export function sessionOf(dto: StartLoadingDto): ServerLoadingSession {
  const id = String(dto.tripId)
  const steps = (dto.placements ?? []).map((step) => ({ status: step.status, placement: placementOf(step) }))
  const vehicle = dto.vehicleInfo?.trim() ?? ''
  return {
    tripId: id,
    code: dto.tripCode ?? id,
    vehicle: vehicle !== '' ? vehicle : (dto.licensePlate?.trim() ?? ''),
    box: boxOf(dto),
    maxPayloadKg: positive(dto.maxPayloadKg) ? dto.maxPayloadKg : null,
    placements: steps.map((item) => item.placement).toSorted((a, b) => a.sequence - b.sequence),
    outcomes: Object.fromEntries(steps.flatMap(({ status, placement }) => {
      const outcome = status ? OUTCOMES[status] : undefined
      return outcome === undefined ? [] : [[placement.id, outcome] as const]
    })),
    completed: dto.status === 'COMPLETED',
  }
}

const normalized = (value: string | null | undefined) => value?.trim().toLocaleUpperCase('vi') ?? ''

/**
 * Mã quét hoặc gõ có khớp kiện không: mã QR, mã vạch, mã của bên gửi hoặc mã của kho kiện, không phân biệt hoa thường (mã QR của máy chủ là
 * chữ thường, máy quét hay người gõ có thể đưa chữ hoa).
 */
export function codeMatches(placement: ServerPlacement, code: string): boolean {
  const typed = normalized(code)
  return typed !== '' && [placement.qrToken, placement.barcode, placement.packageCode, placement.packageId].some((value) => typed === normalized(value))
}
