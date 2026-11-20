import { gt } from '@/domain/geometry'
import { axleLoadsOf, type AxleGroup, type AxleGroupLoad } from '@/domain/metrics'
import type { VehicleConfig } from '@/domain/models'
import { seedVehicles } from '@/lib/mock-db/seed-vehicles'

/**
 * Tab "Tải trục" của "Thử với hàng của bạn": khách kéo khối lượng hàng và vị trí trọng tâm hàng dọc thùng, màn hiện tải hai nhóm trục.
 * Thuần — mọi số là kết quả của `axleLoadsOf` (mô hình đòn bẩy của ứng dụng) trên đúng hai giá trị đang kéo; file này chỉ chọn xe mẫu,
 * khoảng kéo và ghép kết quả với giới hạn.
 */

/**
 * Xe mẫu: Hino XZU720 3,5 tấn của đội xe mẫu (`seed-vehicles.ts`) — cùng cỡ lòng thùng 520 × 200 × 200 cm với xe mở sẵn ở tab xếp thử,
 * và đã khai hai trục (số theo cỡ xe, nhóm đã xác nhận): trục trước dưới cabin ở −100 cm, trục sau ở 342,5 cm.
 */
const AXLE_VEHICLE_ID = 'VEHICLE-005'

let cached: VehicleConfig | undefined
export function axleSampleVehicle(): VehicleConfig {
  cached ??= seedVehicles().find((vehicle) => vehicle.id === AXLE_VEHICLE_ID)
  if (!cached) throw new Error(`Không có xe mẫu ${AXLE_VEHICLE_ID} trong seed`)
  return cached
}

/** Khoảng kéo của một thanh: nhỏ nhất, lớn nhất, bước và giá trị mở đầu. */
export type AxleRange = { readonly min: number; readonly max: number; readonly step: number; readonly initial: number }

/** Trọng tâm khối hàng không thể sát vách: chừa mỗi đầu thùng chừng này cm (nửa chiều dài một pallet). */
const CENTER_MARGIN_CM = 50

/**
 * Khoảng kéo theo xe: khối lượng 0 → tải trọng xe (bước 50 kg, mở ở đủ tải); trọng tâm từ 50 cm sau vách trước tới 50 cm trước cửa sau
 * (bước 5 cm, mở ở giữa thùng — hàng dàn đều).
 */
export function axleRanges(vehicle: Pick<VehicleConfig, 'innerLengthCm' | 'maxPayloadKg'>): { readonly massKg: AxleRange; readonly centerXCm: AxleRange } {
  return {
    massKg: { min: 0, max: vehicle.maxPayloadKg, step: 50, initial: vehicle.maxPayloadKg },
    centerXCm: { min: CENTER_MARGIN_CM, max: vehicle.innerLengthCm - CENTER_MARGIN_CM, step: 5, initial: vehicle.innerLengthCm / 2 },
  }
}

/** Tải của một nhóm trục kèm giới hạn: phần trăm giới hạn đã dùng và số kg vượt (0 khi còn trong giới hạn). */
export type AxleGauge = AxleGroupLoad & { readonly group: AxleGroup; readonly limitKg: number; readonly percent: number; readonly overKg: number }

export type AxleTry = {
  readonly massKg: number
  readonly centerXCm: number
  readonly front: AxleGauge
  readonly rear: AxleGauge
  /** Khoảng cách hai nhóm trục, cm. */
  readonly wheelbaseCm: number
  /** Khoảng cách từ trọng tâm hàng tới trục trước, cm. */
  readonly armCm: number
}

function gauge(group: AxleGroup, load: AxleGroupLoad): AxleGauge | null {
  const { limitKg } = load
  if (limitKg === undefined) return null
  return { ...load, group, limitKg, percent: (load.loadKg * 100) / limitKg, overKg: gt(load.loadKg, limitKg) ? load.loadKg - limitKg : 0 }
}

/** Tải hai nhóm trục khi hàng nặng `massKg` có trọng tâm cách vách trước `centerXCm`; `null` khi xe không đủ dữ liệu trục hay giới hạn. */
export function axleTry(vehicle: VehicleConfig, massKg: number, centerXCm: number): AxleTry | null {
  const loads = axleLoadsOf(vehicle, { totalKg: massKg, centerXCm })
  if (loads.status !== 'computed') return null
  const front = gauge('front', loads.front)
  const rear = gauge('rear', loads.rear)
  if (!front || !rear) return null
  return { massKg, centerXCm, front, rear, wheelbaseCm: rear.positionXCm - front.positionXCm, armCm: centerXCm - front.positionXCm }
}
