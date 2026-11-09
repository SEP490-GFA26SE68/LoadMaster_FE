import { ApiError } from '@/lib/api-client'
import { isoFromBackend } from '@/lib/backend-time'

/**
 * DTO của `WarehouseController` và `WarehouseStagingController` backend (`WarehouseTaskResponse`, `StartLoadingResponse`,
 * `PlacementStepResponse`, `StagingResponse`, `StagingShortageResponse`, `DamageResponse`, `SealResponse`) và hàm đổi sang kiểu của màn kho; chỉ
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
  /** Chỉ khi gọi kèm `includeAwaitingReplan=true`: phiên xếp dừng vì kiện thiếu / hỏng, chờ điều phối viên duyệt phương án mới. */
  readonly awaitingReplan?: boolean | null
  /** `STAGING_SHORTAGE` | `DAMAGED_PACKAGE`, đi cùng `awaitingReplan`. */
  readonly replanReason?: string | null
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
  /** `CONFIRMED` | `DEVIATION` | `DAMAGED` (kiện hỏng bỏ lại kho) | `PENDING`. */
  readonly status?: string | null
  /** Kiện đã vào khu chờ (bước soạn hàng); vắng ở máy chủ cũ. */
  readonly staged?: boolean | null
  /** Báo thiếu còn hiệu lực của kiện: `OPEN` (chờ điều phối viên) | `KEEP_SEARCHING` (điều phối viên bảo tìm tiếp). */
  readonly shortageStatus?: string | null
  /** Xác nhận tay mới nhất của kho với kiện: `PENDING` | `APPROVED` | `REJECTED`, bước `STAGING` | `LOADING`. */
  readonly manualStatus?: string | null
  readonly manualStep?: string | null
  readonly manualRejectReason?: string | null
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
  /** Phiên có bước soạn hàng (bắt đầu kèm `staging: true`); vắng ở máy chủ cũ và phiên của app di động. */
  readonly stagingRequired?: boolean | null
  readonly stagingComplete?: boolean | null
  readonly pendingManualCount?: number | null
  readonly sealNumber?: string | null
  readonly sealedAt?: string | null
  readonly sealedByName?: string | null
}

/** `POST …/staging/packages/{packageId}/confirm` và `…/manual`. */
export type StagingDto = {
  readonly alreadyStaged?: boolean | null
  readonly stagingComplete?: boolean | null
}

/** `POST /api/warehouse/placements/{id}/damaged`: `LEFT_OUT` — kiện bỏ lại kho, xếp tiếp; `REPLANNED` — chuyến về Đã lập kế hoạch. */
export type DamageDto = {
  readonly outcome: string | null
  readonly restingCount?: number | null
}

/**
 * Chuyến ở danh sách kho theo backend: `waiting` — Đã lập kế hoạch, có phương án đã duyệt, chưa bắt đầu xếp; `loading` — Đang xếp hàng,
 * phiên đang dở; `loaded` — đã xếp xong, chờ tài xế xuất phát; `stale` — phiên dừng vì kiện thiếu / hỏng, chờ điều phối viên tối ưu lại (kho chỉ
 * xem). Phiên đọc lại được ở mọi thiết bị (`GET /api/warehouse/tasks/{tripId}`).
 */
export type ServerWarehouseStage = 'loading' | 'waiting' | 'loaded' | 'stale'

/** Vì sao chuyến chờ điều phối tối ưu lại: kiện thiếu bị bỏ lúc soạn, hoặc kiện hỏng có kiện tựa lên. */
export type ServerReplanReason = 'shortage' | 'damaged'

export type ServerWarehouseTrip = {
  /** Mã số của backend (trên URL `/kho?chuyen=`). */
  readonly id: string
  readonly code: string
  readonly vehicle: string
  /** ISO 8601, hoặc `null` khi backend không trả. */
  readonly departureAt: string | null
  readonly packageCount: number | null
  readonly stage: ServerWarehouseStage
  /** Trạng thái chuyến của máy chủ (bỏ yêu cầu giao vừa hết kiện đưa chuyến chờ tối ưu lại về Nháp). */
  readonly status: 'DRAFT' | 'PLANNED' | 'LOADING'
  /** Chỉ với `stale`; `null` khi máy chủ trả lý do lạ. */
  readonly replanReason: ServerReplanReason | null
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

/** Kết quả từng kiện trong phiên: đã xếp đúng chỗ, đã xếp kèm sai lệch vị trí, hoặc kiện hỏng bị bỏ lại kho. */
export type PlacementOutcome = 'confirmed' | 'deviation' | 'damaged'

/** Xác nhận tay mới nhất của kho với một kiện (bước soạn hoặc xếp). */
export type ServerManualState = {
  readonly status: 'PENDING' | 'APPROVED' | 'REJECTED'
  readonly step: 'STAGING' | 'LOADING'
  readonly rejectReason: string | null
}

/** Tiến độ soạn hàng của một kiện: đã vào khu chờ, báo thiếu còn hiệu lực, xác nhận tay mới nhất. */
export type ServerStagingState = {
  readonly staged: boolean
  /** `open` — chờ điều phối viên quyết; `keepSearching` — điều phối viên bảo kho tìm tiếp. */
  readonly shortage: 'open' | 'keepSearching' | null
  readonly manual: ServerManualState | null
}

/** Số seal đã ghi sau khi xếp xong. */
export type ServerSeal = { readonly number: string; readonly at: string | null; readonly byName: string | null }

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
  /** Kết quả từng kiện theo máy chủ (`CONFIRMED` / `DEVIATION` / `DAMAGED`); kiện chưa xử lý không có mục. */
  readonly outcomes: Readonly<Record<string, PlacementOutcome>>
  /** Tiến độ soạn và xác nhận tay theo mã vị trí của kiện. */
  readonly staging: Readonly<Record<string, ServerStagingState>>
  /** Phiên có bước soạn hàng. */
  readonly stagingRequired: boolean
  /** Soạn đủ: mọi kiện đã vào khu chờ và không còn báo thiếu chờ quyết. Phiên không có bước soạn luôn đủ. */
  readonly stagingComplete: boolean
  /** Xác nhận tay của kho còn chờ điều phối viên duyệt: còn thì chưa hoàn tất xếp được. */
  readonly pendingManual: number
  readonly seal: ServerSeal | null
  readonly completed: boolean
}

const numberOf = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ApiError('SERVER_ERROR')
  return value
}

function stageOf(dto: WarehouseTaskDto): ServerWarehouseStage {
  if (dto.awaitingReplan === true) return 'stale'
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
    status: dto.status === 'LOADING' ? 'LOADING' : dto.status === 'DRAFT' ? 'DRAFT' : 'PLANNED',
    replanReason: dto.awaitingReplan !== true ? null
      : dto.replanReason === 'STAGING_SHORTAGE' ? 'shortage'
        : dto.replanReason === 'DAMAGED_PACKAGE' ? 'damaged' : null,
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

const OUTCOMES: Readonly<Record<string, PlacementOutcome>> = { CONFIRMED: 'confirmed', DEVIATION: 'deviation', DAMAGED: 'damaged' }

const MANUAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const
const MANUAL_STEPS = ['STAGING', 'LOADING'] as const

function manualOf(dto: PlacementStepDto): ServerManualState | null {
  const status = MANUAL_STATUSES.find((value) => value === dto.manualStatus)
  const step = MANUAL_STEPS.find((value) => value === dto.manualStep)
  if (status === undefined || step === undefined) return null
  return { status, step, rejectReason: dto.manualRejectReason?.trim() || null }
}

function stagingOf(dto: PlacementStepDto): ServerStagingState {
  const shortage = dto.shortageStatus === 'OPEN' ? 'open' : dto.shortageStatus === 'KEEP_SEARCHING' ? 'keepSearching' : null
  return { staged: dto.staged === true, shortage, manual: manualOf(dto) }
}

function sealOf(dto: StartLoadingDto): ServerSeal | null {
  const number = dto.sealNumber?.trim()
  if (!number) return null
  return { number, at: dto.sealedAt ? isoFromBackend(dto.sealedAt) : null, byName: dto.sealedByName?.trim() || null }
}

export function sessionOf(dto: StartLoadingDto): ServerLoadingSession {
  const id = String(dto.tripId)
  const steps = (dto.placements ?? []).map((step) => ({ status: step.status, placement: placementOf(step), staging: stagingOf(step) }))
  const staging = Object.fromEntries(steps.map((item) => [item.placement.id, item.staging] as const))
  const stagingRequired = dto.stagingRequired === true
  const pendingManual = typeof dto.pendingManualCount === 'number' ? dto.pendingManualCount
    : steps.filter((item) => item.staging.manual?.status === 'PENDING').length
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
    staging,
    stagingRequired,
    stagingComplete: !stagingRequired || dto.stagingComplete === true,
    pendingManual,
    seal: sealOf(dto),
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
