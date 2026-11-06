import { roundKg } from '@/domain/geometry'
import type { CargoPackage, VehicleConfig } from '@/domain/models'
import type { DeliveryStop } from '@/lib/mock-db'
import { packageCountByStop } from './trip-packages'

/** Tổng hợp hàng hoá của chuyến (LM-044) — thuần, không format: UI dịch và định dạng theo locale. */
export type CargoSummary = {
  /** Số dòng kiện đã khai báo. */
  readonly lines: number
  /** Số kiện thật, đã nhân `quantity`. */
  readonly instances: number
  readonly volumeCm3: number
  readonly weightKg: number
  /** So với thể tích lòng thùng và tải trọng tối đa của xe, %. */
  readonly volumePercent: number
  readonly payloadPercent: number
  readonly overPayload: boolean
}

const percentOf = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0)

export function cargoSummary(
  packages: readonly CargoPackage[],
  vehicle: Pick<VehicleConfig, 'innerLengthCm' | 'innerWidthCm' | 'innerHeightCm' | 'maxPayloadKg'>,
): CargoSummary {
  const volumeCm3 = packages.reduce((sum, p) => sum + p.lengthCm * p.widthCm * p.heightCm * p.quantity, 0)
  const weightKg = roundKg(packages.reduce((sum, p) => sum + p.weightKg * p.quantity, 0))
  const vehicleVolumeCm3 = vehicle.innerLengthCm * vehicle.innerWidthCm * vehicle.innerHeightCm
  return {
    lines: packages.length,
    instances: packages.reduce((sum, p) => sum + p.quantity, 0),
    volumeCm3,
    weightKg,
    volumePercent: percentOf(volumeCm3, vehicleVolumeCm3),
    payloadPercent: percentOf(weightKg, vehicle.maxPayloadKg),
    overPayload: weightKg > vehicle.maxPayloadKg,
  }
}

export type StopRow = DeliveryStop & {
  /** Số thứ tự điểm giao, 1-based — bằng `deliveryStop` của kiện. */
  readonly number: number
  readonly packageCount: number
  readonly weightKg: number
}

/** Điểm giao kèm số kiện và khối lượng suy từ danh sách kiện, không lưu sẵn trong dữ liệu chuyến. */
export function stopRows(stops: readonly DeliveryStop[], packages: readonly CargoPackage[]): StopRow[] {
  const counts = packageCountByStop(packages)
  return stops.map((stop, index) => {
    const number = index + 1
    const weightKg = roundKg(packages
      .filter((pkg) => pkg.deliveryStop === number)
      .reduce((sum, pkg) => sum + pkg.weightKg * pkg.quantity, 0))
    return { ...stop, number, packageCount: counts.get(number) ?? 0, weightKg }
  })
}
