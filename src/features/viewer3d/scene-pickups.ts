import { isUpright, type PackageDimensions } from '@/domain/geometry'
import type { HandlingClass } from '@/domain/models'
import type { PickupPlacement } from '@/domain/pickup'
import type { ScenePlacement, ViewerSceneModel } from './scene-types'

/**
 * Kiện nhận dọc đường có chỗ trên xe (FE-BL-01, D-88): chỗ do mock tái tối ưu vùng trống tính lúc duyệt và nằm cùng yêu cầu, **ngoài**
 * phương án đã duyệt (revision bất biến). Màn tài xế ghép chúng vào scene để vẽ bằng chính các InstancedMesh của kiện — không mesh hay
 * draw call mới —, cùng màu điểm giao với kiện thường, dỡ ở điểm giao như kiện thường.
 */
export type PickupSceneItem = {
  /** Mã kiện kho kiện (`PK-NNNN`) — cũng là mã đối chiếu và mã trong scene. */
  readonly id: string
  /** Mã của bên gửi. */
  readonly name: string
  /** Số điểm giao **hiện tại** của chuyến (không phải số trong phương án). */
  readonly stop: number
  readonly weightKg: number
  readonly handlingClass: HandlingClass
  /** Kích thước danh nghĩa của kiện, trước khi xoay. */
  readonly base: PackageDimensions
  readonly spot: PickupPlacement
}

/** Scene của phương án cộng các kiện nhận đã có chỗ; không có kiện nhận thì chính scene đó. */
export function withPickupPlacements(model: ViewerSceneModel, items: readonly PickupSceneItem[]): ViewerSceneModel {
  if (items.length === 0) return model
  // Kiện nhận dỡ sau kiện của phương án cùng điểm: thứ tự dỡ và xếp nối tiếp thứ tự lớn nhất đang có
  let step = Math.max(0, ...model.placements.map((placement) => placement.step))
  let unloadingOrder = Math.max(0, ...model.placements.map((placement) => placement.unloadingOrder))
  const added = items.map((item): ScenePlacement => {
    const fragile = item.handlingClass === 'FRAGILE'
    step += 1
    unloadingOrder += 1
    return Object.freeze({
      id: item.id,
      packageId: item.id,
      name: item.name,
      stop: item.stop,
      lengthCm: item.spot.placedLengthCm,
      widthCm: item.spot.placedWidthCm,
      heightCm: item.spot.placedHeightCm,
      weightKg: item.weightKg,
      position: Object.freeze({ x: item.spot.xCm, y: item.spot.yCm, z: item.spot.zCm }),
      step,
      unloadingOrder,
      orientation: item.spot.orientation,
      packaging: 'carton',
      fragilityLevel: fragile ? 'HIGH' : 'NONE',
      fragile,
      stackable: !fragile,
      pinned: false,
      supportRatio: 1,
      constraintWarnings: Object.freeze([]),
      outOfZone: false,
    })
  })
  const placements = [...model.placements, ...added]
  return Object.freeze({
    ...model,
    stops: Object.freeze(model.stops.map((stop) => {
      const extra = items.filter((item) => item.stop === stop.number).length
      return extra === 0 ? stop : Object.freeze({ ...stop, packageCount: stop.packageCount + extra })
    })),
    placements: Object.freeze(placements),
    placementById: new Map([...model.placementById, ...added.map((placement): [string, ScenePlacement] => [placement.id, placement])]),
    baseDimensionsById: new Map([...model.baseDimensionsById, ...items.map((item): [string, PackageDimensions] => [item.id, Object.freeze({ ...item.base })])]),
    orientationRulesById: new Map([
      ...model.orientationRulesById,
      ...items.map((item): [string, { allowedOrientations: readonly [typeof item.spot.orientation]; keepUpright: boolean }] => [item.id, Object.freeze({ allowedOrientations: [item.spot.orientation] as const, keepUpright: isUpright(item.spot.orientation) })]),
    ]),
  })
}
