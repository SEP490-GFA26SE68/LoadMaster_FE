import { effectiveOrientations, gt, orientDimensions, roundKg } from '@/domain/geometry'
import { axleLoadsOf } from '@/domain/metrics'
import type { CargoPackage, VehicleConfig } from '@/domain/models'
import { segregation, type SegregationWarning } from './segregation'

/**
 * Xe có chở được hàng của chuyến không — kiểm khi **đổi xe** (FE-5b-08, D-80): kích thước, tải trọng, trục, loại hàng. Hàm thuần, trả
 * mã + tham số (D-28). Chỉ kiểm điều kiện **cần** trên tổng hàng, không xếp thử: xe qua được ở đây vẫn có thể để lại kiện khi tối ưu,
 * nhưng xe bị loại thì không cách xếp nào chở hết.
 *
 * - `CARGO_TOO_LARGE`: dòng kiện không có hướng đặt nào vừa lọt cửa (kèm clearance, Spec 7.4) vừa nằm trong lòng thùng.
 * - `CARGO_VOLUME_EXCEEDED`: tổng thể tích kiện lớn hơn thể tích lòng thùng.
 * - `CARGO_WEIGHT_EXCEEDED`: tổng khối lượng lớn hơn tải trọng.
 * - `AXLE_CAPACITY_EXCEEDED`: tổng khối lượng lớn hơn phần hai nhóm trục còn nhận được (giới hạn − tải rỗng, D-78) — đặt hàng ở đâu
 *   cũng có nhóm trục vượt giới hạn. Xe chưa khai trục, hoặc một nhóm chưa có giới hạn, thì không kiểm.
 * - Loại hàng: cảnh báo xe của luật phân tách hàng (`REFRIGERATION_MISSING`, `HAZARDOUS_VEHICLE_REQUIRED`, D-74) — **không** loại xe.
 */
export const VEHICLE_FIT_ERROR_CODES = ['CARGO_TOO_LARGE', 'CARGO_VOLUME_EXCEEDED', 'CARGO_WEIGHT_EXCEEDED', 'AXLE_CAPACITY_EXCEEDED'] as const
export type VehicleFitErrorCode = (typeof VEHICLE_FIT_ERROR_CODES)[number]

type FitError<Code extends VehicleFitErrorCode, Params> = { code: Code; severity: 'error'; params: Params }

export type VehicleFitIssue =
  /** `packageIds`: mã các dòng kiện không lọt, theo thứ tự dòng; `count` là số dòng. */
  | FitError<'CARGO_TOO_LARGE', { count: number; packageIds: string[] }>
  | FitError<'CARGO_VOLUME_EXCEEDED', { totalCm3: number; cargoCm3: number }>
  | FitError<'CARGO_WEIGHT_EXCEEDED', { totalKg: number; maxPayloadKg: number; overKg: number }>
  | FitError<'AXLE_CAPACITY_EXCEEDED', { totalKg: number; capacityKg: number; overKg: number }>
  | SegregationWarning

export type VehicleFit = {
  /** Không có lỗi nào; cảnh báo loại hàng không tính. */
  fits: boolean
  /** Lỗi theo thứ tự kích thước, thể tích, tải trọng, trục; rồi cảnh báo loại hàng. */
  issues: VehicleFitIssue[]
}

function passesDoorAndInterior(pkg: CargoPackage, vehicle: VehicleConfig): boolean {
  return effectiveOrientations(pkg).some((code) => {
    const { placedLengthCm, placedWidthCm, placedHeightCm } = orientDimensions(pkg, code)
    return (
      !gt(placedLengthCm, vehicle.innerLengthCm) && !gt(placedWidthCm, vehicle.innerWidthCm) && !gt(placedHeightCm, vehicle.innerHeightCm) &&
      !gt(placedWidthCm + vehicle.clearanceCm, vehicle.doorWidthCm) && !gt(placedHeightCm + vehicle.clearanceCm, vehicle.doorHeightCm)
    )
  })
}

/** Khối lượng hàng hai nhóm trục còn nhận được; `undefined` khi không tính được tải trục hoặc một nhóm chưa có giới hạn. */
function axleCapacityKg(vehicle: VehicleConfig): number | undefined {
  const loads = axleLoadsOf(vehicle, { totalKg: 0 })
  if (loads.status !== 'computed' || loads.front.limitKg === undefined || loads.rear.limitKg === undefined) return undefined
  return loads.front.limitKg - loads.front.emptyLoadKg + (loads.rear.limitKg - loads.rear.emptyLoadKg)
}

export function vehicleFit(vehicle: VehicleConfig, packages: readonly CargoPackage[]): VehicleFit {
  const issues: VehicleFitIssue[] = []
  const tooLarge = packages.filter((pkg) => !passesDoorAndInterior(pkg, vehicle)).map((pkg) => pkg.id)
  if (tooLarge.length > 0) issues.push({ code: 'CARGO_TOO_LARGE', severity: 'error', params: { count: tooLarge.length, packageIds: tooLarge } })

  const totalCm3 = packages.reduce((sum, pkg) => sum + pkg.lengthCm * pkg.widthCm * pkg.heightCm * pkg.quantity, 0)
  const cargoCm3 = vehicle.innerLengthCm * vehicle.innerWidthCm * vehicle.innerHeightCm
  if (gt(totalCm3, cargoCm3)) issues.push({ code: 'CARGO_VOLUME_EXCEEDED', severity: 'error', params: { totalCm3, cargoCm3 } })

  const totalKg = roundKg(packages.reduce((sum, pkg) => sum + pkg.weightKg * pkg.quantity, 0))
  if (gt(totalKg, vehicle.maxPayloadKg)) {
    issues.push({ code: 'CARGO_WEIGHT_EXCEEDED', severity: 'error', params: { totalKg, maxPayloadKg: vehicle.maxPayloadKg, overKg: roundKg(totalKg - vehicle.maxPayloadKg) } })
  }

  const capacityKg = axleCapacityKg(vehicle)
  if (capacityKg !== undefined && gt(totalKg, capacityKg)) {
    issues.push({ code: 'AXLE_CAPACITY_EXCEEDED', severity: 'error', params: { totalKg, capacityKg: roundKg(capacityKg), overKg: roundKg(totalKg - capacityKg) } })
  }

  const fits = issues.length === 0
  return { fits, issues: [...issues, ...segregation(packages, vehicle).vehicleWarnings] }
}
