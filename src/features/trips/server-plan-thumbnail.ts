import { gt, lt } from '@/domain/geometry'
import type { VehicleConfig } from '@/domain/models'
import { thumbnailOf, type RevisionThumbnail } from '@/components/revision-thumbnail'
import type { LoadPlan } from '@/features/optimization/load-plans-backend-api'
import type { IsoBox } from '@/lib/isometric'
import { stopColor } from '@/lib/stops'

const CM_PER_M = 100
/** Dung sai khi so chỗ xếp với lòng thùng: máy chủ làm tròn cm. */
const FIT_TOLERANCE_CM = 0.5

/**
 * Ảnh thu nhỏ của một phương án máy chủ: chỗ xếp thật (cm, đã áp hướng xoay) trong lòng thùng của xe phương án được tính cho, tô theo số
 * điểm giao (`stopSequence`). Không dựng được — không có xe, lòng thùng không có kích thước, chỗ xếp nào không có kích thước, thiếu số điểm
 * giao hay nằm ngoài lòng thùng (xe đã đổi sau lần chạy) — thì `null`: màn không vẽ ảnh, không vẽ khung rỗng. Thuần.
 */
export function serverPlanThumbnail(plan: LoadPlan, vehicle: VehicleConfig | undefined): RevisionThumbnail | null {
  if (!vehicle || !gt(vehicle.innerLengthCm, 0) || !gt(vehicle.innerWidthCm, 0) || !gt(vehicle.innerHeightCm, 0)) return null
  const boxes: IsoBox[] = []
  for (const item of plan.placements) {
    if (!gt(item.lengthCm, 0) || !gt(item.widthCm, 0) || !gt(item.heightCm, 0) || item.stopSequence === null) return null
    const inside = (start: number, size: number, inner: number) =>
      !lt(start, -FIT_TOLERANCE_CM) && !gt(start + size, inner + FIT_TOLERANCE_CM)
    if (!inside(item.x, item.lengthCm, vehicle.innerLengthCm) || !inside(item.y, item.widthCm, vehicle.innerWidthCm)
      || !inside(item.z, item.heightCm, vehicle.innerHeightCm)) return null
    boxes.push({
      x: item.x / CM_PER_M,
      y: item.y / CM_PER_M,
      z: item.z / CM_PER_M,
      length: item.lengthCm / CM_PER_M,
      width: item.widthCm / CM_PER_M,
      height: item.heightCm / CM_PER_M,
      color: stopColor(item.stopSequence),
    })
  }
  return thumbnailOf(vehicle, boxes, plan.placements.length)
}
