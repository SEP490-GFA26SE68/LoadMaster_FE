import { gt, roundKg } from '@/domain/geometry'
import type { CargoPackage, VehicleConfig } from '@/domain/models'
import { validatePackages } from './validate-packages'

/**
 * Kiểm tra "Sẵn sàng tối ưu" của chuyến (luồng 2 Review 1, LM-104) — bản FE của `GET /validate/trips/{id}` bên FastAPI. Hàm thuần,
 * trả mã + tham số (D-28), UI dịch nhánh `readiness`. Chỉ kiểm tổng: xếp được hay không vẫn do tối ưu quyết định.
 */
export const READINESS_CODES = [
  'VEHICLE_ASSIGNED',
  'PACKAGES_PRESENT',
  'PACKAGES_VALID',
  'STOPS_VALID',
  'WEIGHT_WITHIN_PAYLOAD',
  'VOLUME_WITHIN_CARGO',
] as const

export type ReadinessCode = (typeof READINESS_CODES)[number]

/** `warn` không chặn tối ưu (điểm giao chưa có kiện). */
export type ReadinessStatus = 'pass' | 'warn' | 'fail'

export type ReadinessCheck = { code: ReadinessCode; status: ReadinessStatus; params: Record<string, number> }

export type TripReadiness = { ready: boolean; checks: ReadinessCheck[] }

export type ReadinessInput = {
  /** `undefined` khi chuyến chưa chọn xe hoặc xe không còn. */
  vehicle: VehicleConfig | undefined
  vehicleInMaintenance: boolean
  packages: readonly CargoPackage[]
  stopCount: number
}

export function tripReadiness({ vehicle, vehicleInMaintenance, packages, stopCount }: ReadinessInput): TripReadiness {
  const count = packages.reduce((sum, pkg) => sum + pkg.quantity, 0)
  const invalid = new Set(validatePackages(packages).filter((issue) => issue.severity === 'error').map((issue) => issue.packageInstanceId)).size
  const outside = packages.filter((pkg) => pkg.deliveryStop < 1 || pkg.deliveryStop > stopCount).length
  const used = new Set(packages.map((pkg) => pkg.deliveryStop))
  const empty = Array.from({ length: stopCount }, (_, index) => index + 1).filter((stop) => !used.has(stop)).length
  const totalKg = roundKg(packages.reduce((sum, pkg) => sum + pkg.weightKg * pkg.quantity, 0))
  const totalCm3 = packages.reduce((sum, pkg) => sum + pkg.lengthCm * pkg.widthCm * pkg.heightCm * pkg.quantity, 0)

  const checks: ReadinessCheck[] = [
    { code: 'VEHICLE_ASSIGNED', status: vehicle && !vehicleInMaintenance ? 'pass' : 'fail', params: {} },
    { code: 'PACKAGES_PRESENT', status: count > 0 ? 'pass' : 'fail', params: { count } },
    { code: 'PACKAGES_VALID', status: invalid === 0 ? 'pass' : 'fail', params: { invalid } },
    {
      code: 'STOPS_VALID',
      status: stopCount === 0 || outside > 0 ? 'fail' : empty > 0 ? 'warn' : 'pass',
      params: { stops: stopCount, outside, empty },
    },
  ]
  if (vehicle) {
    const cargoCm3 = vehicle.innerLengthCm * vehicle.innerWidthCm * vehicle.innerHeightCm
    checks.push(
      { code: 'WEIGHT_WITHIN_PAYLOAD', status: gt(totalKg, vehicle.maxPayloadKg) ? 'fail' : 'pass', params: { totalKg, payloadKg: vehicle.maxPayloadKg } },
      { code: 'VOLUME_WITHIN_CARGO', status: gt(totalCm3, cargoCm3) ? 'fail' : 'pass', params: { totalCm3, cargoCm3 } },
    )
  }
  return { ready: checks.every((check) => check.status !== 'fail'), checks }
}
