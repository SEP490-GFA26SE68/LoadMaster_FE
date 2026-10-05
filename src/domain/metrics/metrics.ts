import { roundKg } from '@/domain/geometry'
import { axleLoadsOf } from './axle-load'
import { cargoMass } from './center-of-gravity'
import type { OptimizationResult, PackagePlacement, VehicleConfig } from '@/domain/models'

export type OptimizationMetrics = OptimizationResult['metrics']

export type MetricsInput = {
  vehicle: VehicleConfig
  placements: readonly PackagePlacement[]
  /** Khối lượng từng instance đã xếp (placement không mang khối lượng — lấy từ kiện gốc qua LM-013). */
  weightByInstanceId: ReadonlyMap<string, number>
  unplacedCount: number
  runtimeMs: number
  /** Số kiện nằm ngoài vùng của điểm giao mình (`zonePlacements` của `@/domain/zones`); vắng khi phương án không chia vùng. */
  rehandlingCount?: number
}

/** Nhân trước rồi chia: `324000 / 36e6 * 100` trôi thành 0,8999…, `324000 * 100 / 36e6` ra đúng 0,9. */
function percentOf(part: number, whole: number): number {
  return whole > 0 ? (part * 100) / whole : 0
}

/** Khối lượng của một placement; thiếu là lỗi lập trình (instance luôn sinh từ kiện gốc), không coi là 0 kg. */
function weightOf(placement: PackagePlacement, weightByInstanceId: ReadonlyMap<string, number>): number {
  const weightKg = weightByInstanceId.get(placement.packageInstanceId)
  if (weightKg === undefined) throw new Error(`Không có khối lượng cho placement ${placement.packageInstanceId}`)
  return weightKg
}

/**
 * Spec 11: metrics tính từ placement, không gõ cứng.
 * `totalVehicleVolumeCm3` là toàn bộ lòng thùng, **không trừ vật cản** (LM-021) — tỷ lệ lấp đầy so được
 * giữa các phương án trên cùng xe và khớp nghĩa tên trường của Spec.
 * `centerOfGravityCm` vắng mặt khi chưa xếp kiện nào.
 * `frontAxleLoadKg` / `rearAxleLoadKg` (FE-5b-03, D-78): tải hai nhóm trục theo mô hình đòn bẩy, làm tròn 0,01 kg; vắng mặt khi xe
 * không đủ dữ liệu trục để tính (`axleLoadsOf`).
 * `rehandlingCount` (FE-5b-02, D-79): số lần dỡ-xếp lại nơi gọi đã đếm theo vùng điểm giao; vắng thì metrics không có trường này.
 */
export function computeMetrics({ vehicle, placements, weightByInstanceId, runtimeMs, unplacedCount, rehandlingCount }: MetricsInput): OptimizationMetrics {
  const totalVehicleVolumeCm3 = vehicle.innerLengthCm * vehicle.innerWidthCm * vehicle.innerHeightCm
  const usedVolumeCm3 = placements.reduce((sum, p) => sum + p.placedLengthCm * p.placedWidthCm * p.placedHeightCm, 0)
  const usedPayloadKg = roundKg(placements.reduce((sum, p) => sum + weightOf(p, weightByInstanceId), 0))
  const mass = cargoMass(placements, (p) => weightOf(p, weightByInstanceId))
  const centerOfGravityCm = mass.center
  const axles = axleLoadsOf(vehicle, { totalKg: mass.totalKg, centerXCm: mass.center?.x })
  return {
    totalVehicleVolumeCm3,
    usedVolumeCm3,
    volumeUtilizationPercent: percentOf(usedVolumeCm3, totalVehicleVolumeCm3),
    maxPayloadKg: vehicle.maxPayloadKg,
    usedPayloadKg,
    payloadUtilizationPercent: percentOf(usedPayloadKg, vehicle.maxPayloadKg),
    placedCount: placements.length,
    unplacedCount,
    ...(centerOfGravityCm && { centerOfGravityCm }),
    ...(axles.status === 'computed' && { frontAxleLoadKg: roundKg(axles.front.loadKg), rearAxleLoadKg: roundKg(axles.rear.loadKg) }),
    ...(rehandlingCount !== undefined && { rehandlingCount }),
    runtimeMs,
  }
}
