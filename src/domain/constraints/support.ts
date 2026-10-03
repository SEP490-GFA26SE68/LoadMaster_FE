import { coveredArea, lt, type Box, type Rect } from '@/domain/geometry'
import { obstacleToBox, placementToBox, type PackagePlacement } from '@/domain/models'
import { restsOn, touchesTop } from './contact'
import type { ConstraintIssue } from './issues'
import type { PlacementLayout } from './layout'

/**
 * Tỷ lệ diện tích đáy phải được đỡ khi kiện không tự khai (D-79, theo backend): mặc định của dòng kiện dựng từ loại kiện / kiện kho
 * kiện, của form kiện và của file nhập thiếu cột này.
 */
export const DEFAULT_MIN_SUPPORT_RATIO = 0.7

/** Đáy hộp trên mặt sàn: u = X, v = Y. */
function footprint(box: Box): Rect {
  return { u1: box.xCm, u2: box.xCm + box.lengthCm, v1: box.yCm, v2: box.yCm + box.widthCm }
}

/**
 * Tỷ lệ đỡ khi đã biết các hộp đỡ (kiện bên dưới và vật cản chịu tải chạm đáy) — engine LM-023 lấy chúng từ cạnh của
 * đồ thị đỡ LM-019 để không truy vấn lưới lần hai. Đáy chạm sàn thì đỡ toàn bộ.
 */
export function supportRatioOver(placement: PackagePlacement, supports: readonly Box[]): number {
  if (touchesTop(placement.zCm, 0)) return 1
  const box = placementToBox(placement)
  // Hợp diện tích không âm; chỉ chặn trên, vì mép trôi dấu phẩy động có thể đẩy tỷ lệ lên 1.0000000000000002
  return Math.min(1, coveredArea(footprint(box), supports.map(footprint)) / (box.lengthCm * box.widthCm))
}

/**
 * Spec 7.7: tỷ lệ diện tích đáy kiện được đỡ, 0..1. Đáy chạm sàn (trong `CONTACT_TOLERANCE_CM`) được đỡ toàn bộ;
 * nếu không, mặt đỡ là mặt trên của kiện khác và của vật cản chịu tải chạm đáy trong dung sai.
 * Vật cản không chịu tải không đỡ (Spec 7.6, lỗi riêng `NON_BEARING_SUPPORT`).
 * `placement` có thể là vị trí thử của một kiện đã có trong `layout` (editor): vị trí cũ của chính nó không được tính.
 */
export function supportRatio(placement: PackagePlacement, layout: PlacementLayout): number {
  if (touchesTop(placement.zCm, 0)) return 1
  const box = placementToBox(placement)
  return supportRatioOver(placement, [
    ...layout.grid
      .queryBelow(box, { excludeId: placement.packageInstanceId })
      .map((id) => placementToBox(layout.placements.get(id)!)),
    ...layout.vehicle.obstacles
      .filter(({ loadBearing }) => loadBearing)
      .map(obstacleToBox)
      .filter((obstacleBox) => restsOn(box, obstacleBox)),
  ])
}

/** `SUPPORT_BELOW_MIN` (cảnh báo) khi `ratio` nhỏ hơn `minSupportRatio` qua EPSILON; tham số là tỷ lệ thô 0..1. */
export function belowMinSupport(
  placement: PackagePlacement,
  ratio: number,
  minSupportRatio: number,
): ConstraintIssue<'SUPPORT_BELOW_MIN'>[] {
  if (!lt(ratio, minSupportRatio)) return []
  return [
    {
      code: 'SUPPORT_BELOW_MIN',
      severity: 'warning',
      packageInstanceId: placement.packageInstanceId,
      params: { ratio, required: minSupportRatio },
    },
  ]
}

/** Spec 7.7: tỷ lệ đỡ dưới `minSupportRatio` của kiện gốc → `SUPPORT_BELOW_MIN` (cảnh báo), tham số là tỷ lệ thô 0..1. */
export function supportIssues(
  placement: PackagePlacement,
  minSupportRatio: number,
  layout: PlacementLayout,
): ConstraintIssue<'SUPPORT_BELOW_MIN'>[] {
  return belowMinSupport(placement, supportRatio(placement, layout), minSupportRatio)
}
