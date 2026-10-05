import type { ConstraintIssue } from '@/domain/constraints'
import { gt, lt, roundCm } from '@/domain/geometry'
import { DEFAULT_MAX_COG_OFFSET_RATIO, type PackagePlacement, type VehicleConfig } from '@/domain/models'

export type PointCm = { x: number; y: number; z: number }

/** Trọng tâm hàng cao hơn tỷ lệ này của chiều cao lòng thùng thì cảnh báo — loại xe không khai ngưỡng theo chiều cao. */
export const COG_HEIGHT_RATIO = 0.5

type CenterOfGravityIssue = ConstraintIssue<'COG_LATERAL' | 'COG_LONGITUDINAL' | 'COG_HIGH'>

type CogVehicle = Pick<VehicleConfig, 'innerLengthCm' | 'innerWidthCm' | 'innerHeightCm' | 'maxCogOffsetRatio'>

/**
 * Cảnh báo (không chặn) khi trọng tâm hàng lệch khỏi giữa thùng quá `maxCogOffsetRatio` của xe (theo loại xe, mặc định 0,15 — D-79)
 * nhân chiều rộng (lệch ngang) hoặc chiều dài (lệch dọc) lòng thùng, hoặc cao hơn `COG_HEIGHT_RATIO` chiều cao. Đúng bằng ngưỡng thì
 * không cảnh báo. So sánh trên số chưa làm tròn; `params` làm tròn 0,1 cm để hiển thị.
 */
export function checkCenterOfGravity(vehicle: CogVehicle, centerOfGravityCm: PointCm): CenterOfGravityIssue[] {
  const ratio = vehicle.maxCogOffsetRatio ?? DEFAULT_MAX_COG_OFFSET_RATIO
  const issues: CenterOfGravityIssue[] = []
  const lateralCm = Math.abs(centerOfGravityCm.y - vehicle.innerWidthCm / 2)
  const lateralLimitCm = vehicle.innerWidthCm * ratio
  if (gt(lateralCm, lateralLimitCm)) {
    issues.push({
      code: 'COG_LATERAL',
      severity: 'warning',
      params: { offsetCm: roundCm(lateralCm), limitCm: roundCm(lateralLimitCm) },
    })
  }
  const alongCm = centerOfGravityCm.x - vehicle.innerLengthCm / 2
  const alongLimitCm = vehicle.innerLengthCm * ratio
  if (gt(Math.abs(alongCm), alongLimitCm)) {
    issues.push({
      code: 'COG_LONGITUDINAL',
      severity: 'warning',
      // X tăng từ vách trước ra cửa sau: lệch âm là dồn về đầu thùng
      params: { offsetCm: roundCm(Math.abs(alongCm)), limitCm: roundCm(alongLimitCm), toward: lt(alongCm, 0) ? 'front' : 'rear' },
    })
  }
  const heightLimitCm = vehicle.innerHeightCm * COG_HEIGHT_RATIO
  if (gt(centerOfGravityCm.z, heightLimitCm)) {
    issues.push({
      code: 'COG_HIGH',
      severity: 'warning',
      params: { heightCm: roundCm(centerOfGravityCm.z), limitCm: roundCm(heightLimitCm) },
    })
  }
  return issues
}

/** Khối hàng đã xếp: tổng khối lượng (kg, chưa làm tròn) và trọng tâm; `center` vắng khi chưa có khối lượng nào. */
export type CargoMass = { totalKg: number; center?: PointCm }

/**
 * Spec 7.9: trọng tâm hàng = tổng (khối lượng × tâm hộp) / tổng khối lượng, theo từng trục, cm.
 * Tâm hàng đã xếp, không phải trọng tâm toàn xe (AGENTS mục 7).
 */
export function cargoMass(
  placements: readonly PackagePlacement[],
  weightOf: (placement: PackagePlacement) => number,
): CargoMass {
  let totalKg = 0, x = 0, y = 0, z = 0
  for (const p of placements) {
    const kg = weightOf(p)
    totalKg += kg
    x += kg * (p.xCm + p.placedLengthCm / 2)
    y += kg * (p.yCm + p.placedWidthCm / 2)
    z += kg * (p.zCm + p.placedHeightCm / 2)
  }
  if (!(totalKg > 0)) return { totalKg: 0 }
  return { totalKg, center: { x: x / totalKg, y: y / totalKg, z: z / totalKg } }
}
