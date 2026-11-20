import { expandPackages } from '@/domain/cargo'
import type { OptimizationRequest, PackagePlacement } from '@/domain/models'
import type { IsoBox, IsoSize } from '@/lib/isometric'
import { stopColor } from '@/lib/stops'

/** Trần số khối vẽ trong một ảnh thu nhỏ: ba mặt mỗi khối, nên 150 khối là 450 polygon — đủ nhẹ cho nhiều thẻ. */
export const THUMBNAIL_MAX_BOXES = 150

const CM_PER_M = 100

export type RevisionThumbnail = {
  /** Lòng thùng, mét (đơn vị của `lib/isometric`). */
  container: IsoSize
  /** Khối sẽ vẽ, mét, màu theo điểm giao. Chưa sắp theo chiều sâu. */
  boxes: IsoBox[]
  placedCount: number
}

/**
 * Ảnh thu nhỏ dựng từ placement thật của revision (LM-051): toạ độ và kích thước đã áp hướng đặt, cm → m, tô màu theo
 * điểm giao của kiện gốc. Vượt `maxBoxes` thì giữ các khối có góc xa gốc nhất (gần người nhìn của phép chiếu đẳng cự,
 * nhìn từ phía cửa sau, bên phải, trên cao) vì chúng che các khối còn lại. Placement không khớp kiện nào trong request
 * thì không vẽ.
 */
export function revisionThumbnail(
  request: Pick<OptimizationRequest, 'vehicle' | 'packages'>,
  placements: readonly PackagePlacement[],
  maxBoxes = THUMBNAIL_MAX_BOXES,
): RevisionThumbnail {
  const stopByInstance = new Map(
    expandPackages(request.packages).instances.map((instance) => [instance.packageInstanceId, instance.deliveryStop]),
  )
  const boxes = placements.flatMap((placement): IsoBox[] => {
    const stop = stopByInstance.get(placement.packageInstanceId)
    if (stop === undefined) return []
    return [
      {
        x: placement.xCm / CM_PER_M,
        y: placement.yCm / CM_PER_M,
        z: placement.zCm / CM_PER_M,
        length: placement.placedLengthCm / CM_PER_M,
        width: placement.placedWidthCm / CM_PER_M,
        height: placement.placedHeightCm / CM_PER_M,
        color: stopColor(stop),
      },
    ]
  })
  const nearest = (box: IsoBox) => box.x + box.length + box.y + box.width + box.z + box.height
  const drawn = boxes.length > maxBoxes ? boxes.toSorted((a, b) => nearest(b) - nearest(a)).slice(0, maxBoxes) : boxes
  const { vehicle } = request
  return {
    container: {
      length: vehicle.innerLengthCm / CM_PER_M,
      width: vehicle.innerWidthCm / CM_PER_M,
      height: vehicle.innerHeightCm / CM_PER_M,
    },
    boxes: drawn,
    placedCount: placements.length,
  }
}
