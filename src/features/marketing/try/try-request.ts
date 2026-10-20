import { expandPackages } from '@/domain/cargo'
import { validateRequest, type ConstraintIssue } from '@/domain/constraints'
import { roundCm, roundKg } from '@/domain/geometry'
import type { CargoPackage, OptimizationRequest, OptimizationResult, UnplacedPackage, VehicleConfig } from '@/domain/models'
import { DEFAULT_SETTINGS } from '@/features/optimization/optimization-request'
import { cargoFromPackage } from '@/lib/mock-db'
import type { TryInput } from './try-form'

/**
 * Dựng request Spec cho bản thử và đọc kết quả về số của màn — tải lười cùng bộ tối ưu (`try-api.ts`) để chunk của trang giới thiệu
 * không kéo theo constraint engine. Đơn vị cm/kg, làm tròn tại biên (`roundCm`, `roundKg`).
 */

/** Mã dòng kiện thứ `index` (0, 1) của bản thử: ASCII, không lọt vào giao diện. */
export function tryPackageId(index: number): string {
  return `TRY-${index + 1}`
}

/**
 * Xe của bản thử: lòng thùng và tải trọng khách nhập; cửa sau mở hết lòng thùng, không vật cản, không trục (màn nói rõ điều này).
 */
function tryVehicle({ truck }: TryInput): VehicleConfig {
  const lengthCm = roundCm(truck.lengthCm)
  const widthCm = roundCm(truck.widthCm)
  const heightCm = roundCm(truck.heightCm)
  return {
    id: 'TRY-VEHICLE',
    name: 'TRY',
    innerLengthCm: lengthCm,
    innerWidthCm: widthCm,
    innerHeightCm: heightCm,
    maxPayloadKg: roundKg(truck.payloadKg),
    doorWidthCm: widthCm,
    doorHeightCm: heightCm,
    doorPosition: 'REAR',
    clearanceCm: 0,
    obstacles: [],
  }
}

/**
 * Dòng kiện theo cùng mặc định của kiện thêm lẻ ở kho kiện (`cargoFromPackage`: giữ đứng, hai hướng đặt, xếp chồng được), một điểm giao.
 * Không bắt buộc xếp: hàng vượt tải trọng thành "chưa xếp" kèm lý do thay vì làm hỏng cả lần chạy.
 */
function tryPackages({ cartons }: TryInput): CargoPackage[] {
  return cartons.map((carton, index) => {
    const id = tryPackageId(index)
    const cargo = cargoFromPackage(
      {
        id,
        packageCode: id,
        lengthCm: roundCm(carton.lengthCm),
        widthCm: roundCm(carton.widthCm),
        heightCm: roundCm(carton.heightCm),
        weightKg: roundKg(carton.weightKg),
        handlingClass: 'STANDARD',
      },
      undefined,
      { id, quantity: carton.quantity, deliveryStop: 1 },
    )
    return { ...cargo, mustLoad: false }
  })
}

/** Request Spec của bản thử, cùng thiết lập mặc định của màn Thiết lập tối ưu. */
export function buildTryRequest(input: TryInput): OptimizationRequest {
  return { vehicle: tryVehicle(input), packages: tryPackages(input), settings: { ...DEFAULT_SETTINGS } }
}

/** Lỗi của kiện riêng lẻ không chặn lần chạy: bộ tối ưu đưa kiện đó vào "chưa xếp" kèm lý do. */
const PACKAGE_LEVEL = new Set<ConstraintIssue['code']>(['DOOR_TOO_SMALL', 'NO_ALLOWED_ORIENTATION'])

/** Lỗi chặn lần chạy (`validateRequest`, chỉ mức `error`, trừ lỗi riêng của một kiện). Form đã giới hạn số nên thường rỗng. */
export function tryRequestIssues(request: OptimizationRequest): ConstraintIssue[] {
  return validateRequest(request).filter((issue) => issue.severity === 'error' && !PACKAGE_LEVEL.has(issue.code))
}

/** Một kiện đã xếp, cm, kèm loại kiện (0, 1) và thứ tự xếp. */
export type TryBox = {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly length: number
  readonly width: number
  readonly height: number
  readonly kind: number
  readonly order: number
}

export type TryUnplaced = { readonly kind: number; readonly reason: UnplacedPackage['reasonCode']; readonly count: number }

/** Số của một lần thử — mọi số lấy từ kết quả của bộ tối ưu mô phỏng. */
export type TryOutcome = {
  readonly input: TryInput
  readonly container: { readonly lengthCm: number; readonly widthCm: number; readonly heightCm: number }
  readonly totalCount: number
  readonly placedCount: number
  readonly volumePercent: number
  readonly usedKg: number
  readonly maxKg: number
  readonly runtimeMs: number
  readonly boxes: readonly TryBox[]
  /** Gộp theo loại kiện rồi theo lý do, giữ thứ tự gặp trong kết quả. */
  readonly unplaced: readonly TryUnplaced[]
  readonly isMockResult: boolean
}

export function tryOutcome(input: TryInput, request: OptimizationRequest, result: OptimizationResult): TryOutcome {
  const { instances, packageIdByInstanceId } = expandPackages(request.packages)
  const kindIds = request.packages.map(({ id }) => id)
  const kindOf = (instanceId: string) => Math.max(0, kindIds.indexOf(packageIdByInstanceId.get(instanceId) ?? ''))
  const unplaced = new Map<string, TryUnplaced>()
  for (const item of result.unplacedPackages) {
    const kind = kindOf(item.packageInstanceId)
    const key = `${kind}:${item.reasonCode}`
    const seen = unplaced.get(key)
    unplaced.set(key, { kind, reason: item.reasonCode, count: (seen?.count ?? 0) + 1 })
  }
  const { vehicle } = request
  return {
    input,
    container: { lengthCm: vehicle.innerLengthCm, widthCm: vehicle.innerWidthCm, heightCm: vehicle.innerHeightCm },
    totalCount: instances.length,
    placedCount: result.placements.length,
    volumePercent: result.metrics.volumeUtilizationPercent,
    usedKg: result.metrics.usedPayloadKg,
    maxKg: result.metrics.maxPayloadKg,
    runtimeMs: result.metrics.runtimeMs,
    boxes: result.placements.map((placement) => ({
      x: placement.xCm,
      y: placement.yCm,
      z: placement.zCm,
      length: placement.placedLengthCm,
      width: placement.placedWidthCm,
      height: placement.placedHeightCm,
      kind: kindOf(placement.packageInstanceId),
      order: placement.loadingOrder,
    })),
    unplaced: [...unplaced.values()],
    isMockResult: result.isMockResult,
  }
}
