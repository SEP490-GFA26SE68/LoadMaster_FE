import { roundCm, roundKg } from '@/domain/geometry'
import { PLAN_OBJECTIVES, type PlanLabel, type PlanObjective } from '@/domain/models'
import { ApiError } from '@/lib/api-client'
import { isoFromBackend } from '@/lib/backend-time'

/**
 * DTO tối ưu xếp hàng của backend (`LoadingOptimizationController`, `LoadPlanController`) và phép đổi sang kiểu của app. Chỉ lớp `-api.ts`
 * của tối ưu và của Planner import file này. Toạ độ, kích thước là **cm**, khối lượng kg, tỷ lệ sử dụng 0..1 (app đổi sang %). Hàm thuần.
 *
 * Hợp đồng đích (đang được sửa ở backend, 05/11/2026): trạng thái job là phong bì `ApiResponse` camelCase; mỗi lần chạy ra ba phương án
 * cùng job, mỗi phương án có `objective` và `candidateLabel` (`A`, `B`, `C`; phương án cũ `null`). Trường nào máy chủ chưa trả thì vắng.
 */

/** BigDecimal của Jackson: số, hoặc chuỗi khi máy chủ ghi BigDecimal bằng chuỗi. */
type Decimal = number | string

/** `POST /api/trips/{tripId}/optimize-loading` (202). */
export type OptimizationStartDto = {
  readonly jobId: string
  readonly tripId?: number | null
  readonly subscriptionTier?: string | null
  /** Số kiện đã ghim lần chạy giữ nguyên (0 khi không giữ ghim); máy chủ cũ không trả. */
  readonly pinnedCount?: number | null
}

/** `GET /api/trips/optimization-jobs/{jobId}`. */
export type OptimizationJobDto = {
  readonly id?: number | null
  readonly jobId: string
  readonly tripId?: number | null
  readonly objective?: string | null
  readonly timeLimitSec?: number | null
  readonly status: string
  readonly computationMs?: number | null
  readonly createdAt?: string | null
  readonly packedPlanCount?: number | null
  /** Số kiện đã ghim lần chạy giữ nguyên; máy chủ cũ không trả. */
  readonly pinnedCount?: number | null
}

export type PlacementDto = {
  readonly id: number
  readonly packageId: number
  readonly packageCode?: string | null
  readonly trackingBarcode?: string | null
  readonly weightKg?: Decimal | null
  readonly posX: Decimal
  readonly posY: Decimal
  readonly posZ: Decimal
  readonly packedLength: Decimal
  readonly packedWidth: Decimal
  readonly packedHeight: Decimal
  readonly rotationType?: number | null
  readonly stepSequence?: number | null
  readonly pinned?: boolean | null
  readonly stopId?: number | null
  readonly stopName?: string | null
  readonly stopSequence?: number | null
  /** Mã hướng (0..5) kiện được nhận khi chỉnh tay theo loại kiện; máy chủ cũ không trả. */
  readonly allowedRotations?: readonly number[] | null
}

export type UnplacedDto = {
  readonly packageId: number
  readonly packageCode?: string | null
  readonly trackingBarcode?: string | null
  readonly reason?: string | null
  /** Kích thước (cm) và khối lượng (kg) của kiện; máy chủ cũ không trả. */
  readonly lengthCm?: Decimal | null
  readonly widthCm?: Decimal | null
  readonly heightCm?: Decimal | null
  readonly weightKg?: Decimal | null
}

/** `StopZoneResponse`: vùng theo điểm giao dọc trục X, cm. */
export type StopZoneDto = {
  readonly id: string
  readonly stopId?: number | null
  readonly stopSequence?: number | null
  readonly startXCm?: Decimal | null
  readonly endXCm?: Decimal | null
  readonly volumeRatio?: Decimal | null
}

/** `LoadPlanDetailResponse`. */
export type LoadPlanDto = {
  readonly id: number
  readonly tripId: number
  readonly jobUuid?: string | null
  readonly objective?: string | null
  /** Hợp đồng đích: `A` · `B` · `C` theo mục tiêu; phương án cũ `null`. */
  readonly candidateLabel?: string | null
  readonly algorithmName?: string | null
  readonly computationMs?: number | null
  readonly planName?: string | null
  readonly version?: number | null
  readonly packedItemsCount?: number | null
  readonly volumeUtilization?: Decimal | null
  readonly weightUtilization?: Decimal | null
  readonly approved?: boolean | null
  readonly approvedByName?: string | null
  readonly cogX?: Decimal | null
  readonly cogY?: Decimal | null
  readonly cogZ?: Decimal | null
  readonly frontAxleLoad?: Decimal | null
  readonly rearAxleLoad?: Decimal | null
  readonly rehandlingCount?: number | null
  /** Bản duyệt dựng từ bản chỉnh tay (`POST /api/load-plans/{id}/approve-edits`). */
  readonly manuallyEdited?: boolean | null
  /** Hàng, xe hoặc điểm giao của chuyến đã đổi sau khi tối ưu: không duyệt được. */
  readonly stale?: boolean | null
  readonly placements?: readonly PlacementDto[] | null
  readonly unplaced?: readonly UnplacedDto[] | null
  /** Vùng theo điểm giao; máy chủ chỉ trả khi vùng dựng lại cho ra đúng `rehandlingCount` đã lưu. */
  readonly stopZones?: readonly StopZoneDto[] | null
}

/** `TripLoadPlansResponse`: cũ trước mới sau. */
export type TripLoadPlansDto = {
  readonly tripId: number
  readonly approvedPlanId?: number | null
  readonly plans?: readonly LoadPlanDto[] | null
}

/** Trạng thái job của dịch vụ tối ưu. `SUCCESS` (tên cũ) đọc là `COMPLETED`, `TIMEOUT` đọc là `FAILED`. */
export const JOB_STATUSES = ['PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL', 'NO_SOLUTION', 'FAILED'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

/** Job đã kết thúc: có phương án (`COMPLETED`, `PARTIAL`) hoặc không (`NO_SOLUTION`, `FAILED` — máy chủ không trừ credit). */
export const FINISHED_JOB_STATUSES: ReadonlySet<JobStatus> = new Set(['COMPLETED', 'PARTIAL', 'NO_SOLUTION', 'FAILED'])

export type OptimizationJob = {
  readonly jobId: string
  readonly status: JobStatus
  readonly finished: boolean
  /** Số phương án đã lưu; vắng khi máy chủ chưa trả. */
  readonly packedPlanCount: number | null
  /** Số kiện đã ghim lần chạy giữ nguyên; `null` khi máy chủ không trả. */
  readonly pinnedCount: number | null
  readonly computationMs: number | null
  readonly createdAt: string | null
}

export type LoadPlacement = {
  readonly id: string
  readonly packageId: string
  /** Mã của kiện (mã của bên gửi, không có thì mã vạch, không có nữa thì mã số). */
  readonly code: string
  readonly weightKg: number
  readonly x: number
  readonly y: number
  readonly z: number
  /** Kích thước đã áp hướng xoay, cm. */
  readonly lengthCm: number
  readonly widthCm: number
  readonly heightCm: number
  readonly rotationType: number | null
  readonly step: number
  readonly pinned: boolean
  readonly stopId: string | null
  readonly stopSequence: number | null
  /**
   * Mã `rotation_type` kiện được nhận khi chỉnh tay (theo loại kiện, như dịch vụ tối ưu đọc), gồm hướng đang xếp; vắng khi máy chủ
   * không trả — chỉnh tay giữ nguyên hướng.
   */
  readonly allowedRotations?: readonly number[]
}

export type LoadUnplaced = {
  readonly packageId: string
  readonly code: string
  readonly reason: string | null
  /** Kích thước cm và khối lượng kg của kiện; `null` khi máy chủ không trả. */
  readonly size: { readonly lengthCm: number; readonly widthCm: number; readonly heightCm: number } | null
  readonly weightKg: number | null
}

/** Vùng theo điểm giao của phương án (cm), theo thứ tự điểm giao của máy chủ. */
export type LoadStopZone = {
  readonly id: string
  readonly stopId: string | null
  readonly stopSequence: number | null
  readonly startXCm: number
  readonly endXCm: number
}

/** Một phương án của máy chủ. Số máy chủ không trả là `null` — màn bỏ phần đó, không vẽ 0. */
export type LoadPlan = {
  readonly id: string
  readonly tripId: string
  readonly jobId: string | null
  readonly objective: PlanObjective | null
  readonly label: PlanLabel | null
  readonly algorithmName: string | null
  readonly computationMs: number | null
  readonly name: string | null
  readonly volumePercent: number | null
  readonly payloadPercent: number | null
  readonly approved: boolean
  readonly approvedByName: string | null
  readonly centerOfGravityCm: { readonly x: number; readonly y: number; readonly z: number } | null
  readonly frontAxleLoadKg: number | null
  readonly rearAxleLoadKg: number | null
  readonly rehandlingCount: number | null
  readonly manuallyEdited: boolean
  readonly stale: boolean
  readonly placements: readonly LoadPlacement[]
  readonly unplaced: readonly LoadUnplaced[]
  /** `null` khi máy chủ không trả vùng (hoặc trả vùng thiếu mốc): Planner không có dải vùng, không đếm dỡ-xếp lại. */
  readonly stopZones: readonly LoadStopZone[] | null
}

export type TripLoadPlans = { readonly approvedPlanId: string | null; readonly plans: readonly LoadPlan[] }

const LABELS: readonly PlanLabel[] = ['A', 'B', 'C']

function numberOf(value: Decimal | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function requiredNumber(value: Decimal | null | undefined): number {
  const number = numberOf(value)
  if (number === null) throw new ApiError('SERVER_ERROR')
  return number
}

const percentOf = (ratio: Decimal | null | undefined) => {
  const value = numberOf(ratio)
  return value === null ? null : value * 100
}

export function jobStatusOf(value: string): JobStatus {
  if (value === 'SUCCESS') return 'COMPLETED'
  if (value === 'TIMEOUT') return 'FAILED'
  const status = JOB_STATUSES.find((item) => item === value)
  if (status === undefined) throw new ApiError('SERVER_ERROR')
  return status
}

export function optimizationJobOf(dto: OptimizationJobDto): OptimizationJob {
  const status = jobStatusOf(dto.status)
  return {
    jobId: dto.jobId,
    status,
    finished: FINISHED_JOB_STATUSES.has(status),
    packedPlanCount: dto.packedPlanCount ?? null,
    pinnedCount: dto.pinnedCount ?? null,
    computationMs: dto.computationMs ?? null,
    createdAt: dto.createdAt ? isoFromBackend(dto.createdAt) : null,
  }
}

const codeOf = (dto: { packageId: number; packageCode?: string | null; trackingBarcode?: string | null }) =>
  dto.packageCode?.trim() || dto.trackingBarcode?.trim() || String(dto.packageId)

function placementOf(dto: PlacementDto): LoadPlacement {
  return {
    id: String(dto.id),
    packageId: String(dto.packageId),
    code: codeOf(dto),
    weightKg: roundKg(numberOf(dto.weightKg) ?? 0),
    x: roundCm(requiredNumber(dto.posX)),
    y: roundCm(requiredNumber(dto.posY)),
    z: roundCm(requiredNumber(dto.posZ)),
    lengthCm: roundCm(requiredNumber(dto.packedLength)),
    widthCm: roundCm(requiredNumber(dto.packedWidth)),
    heightCm: roundCm(requiredNumber(dto.packedHeight)),
    rotationType: dto.rotationType ?? null,
    step: dto.stepSequence ?? 0,
    pinned: dto.pinned === true,
    stopId: dto.stopId === null || dto.stopId === undefined ? null : String(dto.stopId),
    stopSequence: dto.stopSequence ?? null,
    ...(dto.allowedRotations
      ? { allowedRotations: dto.allowedRotations.filter((code) => Number.isInteger(code) && code >= 0 && code <= 5) }
      : {}),
  }
}

function unplacedOf(dto: UnplacedDto): LoadUnplaced {
  const [lengthCm, widthCm, heightCm] = [numberOf(dto.lengthCm), numberOf(dto.widthCm), numberOf(dto.heightCm)]
  const weightKg = numberOf(dto.weightKg)
  return {
    packageId: String(dto.packageId),
    code: codeOf(dto),
    reason: dto.reason ?? null,
    size: lengthCm === null || widthCm === null || heightCm === null
      ? null
      : { lengthCm: roundCm(lengthCm), widthCm: roundCm(widthCm), heightCm: roundCm(heightCm) },
    weightKg: weightKg === null ? null : roundKg(weightKg),
  }
}

/** Vùng thiếu mốc hay không gắn được với điểm giao nào thì bỏ cả bộ vùng: không vẽ nửa bộ. */
function stopZonesOf(dtos: readonly StopZoneDto[] | null | undefined): LoadStopZone[] | null {
  if (!dtos || dtos.length === 0) return null
  const zones: LoadStopZone[] = []
  for (const dto of dtos) {
    const [startXCm, endXCm] = [numberOf(dto.startXCm), numberOf(dto.endXCm)]
    const stopId = dto.stopId === null || dto.stopId === undefined ? null : String(dto.stopId)
    const stopSequence = dto.stopSequence ?? null
    if (startXCm === null || endXCm === null || endXCm < startXCm || (stopId === null && stopSequence === null)) return null
    zones.push({ id: String(dto.id), stopId, stopSequence, startXCm: roundCm(startXCm), endXCm: roundCm(endXCm) })
  }
  return zones
}

export function loadPlanOf(dto: LoadPlanDto): LoadPlan {
  const objective = PLAN_OBJECTIVES.find((item) => item === dto.objective) ?? null
  const label = LABELS.find((item) => item === dto.candidateLabel) ?? null
  const [x, y, z] = [numberOf(dto.cogX), numberOf(dto.cogY), numberOf(dto.cogZ)]
  return {
    id: String(dto.id),
    tripId: String(dto.tripId),
    jobId: dto.jobUuid ?? null,
    objective,
    label,
    algorithmName: dto.algorithmName?.trim() || null,
    computationMs: dto.computationMs ?? null,
    name: dto.planName?.trim() || null,
    volumePercent: percentOf(dto.volumeUtilization),
    payloadPercent: percentOf(dto.weightUtilization),
    approved: dto.approved === true,
    approvedByName: dto.approvedByName?.trim() || null,
    centerOfGravityCm: x === null || y === null || z === null ? null : { x, y, z },
    frontAxleLoadKg: numberOf(dto.frontAxleLoad),
    rearAxleLoadKg: numberOf(dto.rearAxleLoad),
    rehandlingCount: dto.rehandlingCount ?? null,
    manuallyEdited: dto.manuallyEdited === true,
    stale: dto.stale === true,
    placements: (dto.placements ?? []).map(placementOf),
    unplaced: (dto.unplaced ?? []).map(unplacedOf),
    stopZones: stopZonesOf(dto.stopZones),
  }
}

/** Phương án của một lần chạy theo thứ tự A · B · C; phương án không có nhãn đứng sau, giữ thứ tự máy chủ trả. */
export function sortCandidates(plans: readonly LoadPlan[]): LoadPlan[] {
  const rank = (plan: LoadPlan) => (plan.label === null ? LABELS.length : LABELS.indexOf(plan.label))
  return plans.map((plan, index) => ({ plan, index })).sort((a, b) => rank(a.plan) - rank(b.plan) || a.index - b.index).map(({ plan }) => plan)
}

export function tripLoadPlansOf(dto: TripLoadPlansDto): TripLoadPlans {
  return {
    approvedPlanId: dto.approvedPlanId === null || dto.approvedPlanId === undefined ? null : String(dto.approvedPlanId),
    plans: (dto.plans ?? []).map(loadPlanOf),
  }
}
