import type { PackageInstance } from '@/domain/cargo'
import {
  createSpatialGrid,
  effectiveOrientations,
  gt,
  orientDimensions,
  overlaps,
  roundCm,
  roundKg,
  type Box,
  type OrientationCode,
  type PlacedDimensions,
} from '@/domain/geometry'
import type { ConstraintIssue } from '@/domain/constraints'
import { axleLoadsOf, checkAxleLoads } from '@/domain/metrics'
import { obstacleToBox, type PackagePlacement, type UnplacedPackage, type VehicleConfig } from '@/domain/models'
import type { OptimizationProgress } from './OptimizationService'

type ReasonCode = UnplacedPackage['reasonCode']
/** Vì sao một kiện không lên xe: mã lý do, kèm ràng buộc đã chặn khi lý do là `CONSTRAINT_VIOLATED`. */
type Rejection = Pick<UnplacedPackage, 'reasonCode' | 'violatedConstraints'>
type StackedBox = { readonly instance: PackageInstance; readonly box: Box; loadAboveKg: number }
type Stack = { readonly xCm: number; readonly yCm: number; readonly boxes: StackedBox[] }
type Wall = { readonly xCm: number; depthCm: number; nextYCm: number; readonly stacks: Stack[] }
type Orientation = { readonly code: OrientationCode; readonly dims: PlacedDimensions }
type Spot = { readonly box: Box; readonly code: OrientationCode; readonly stack?: Stack }

export type PackInput = {
  readonly vehicle: VehicleConfig
  /** Theo thứ tự xếp. */
  readonly instances: readonly PackageInstance[]
  readonly reasons: ReadonlyMap<string, ReasonCode>
  /** `settings.prioritizeLowCenterOfGravity`: mở cột mới trên sàn trước khi xếp chồng. */
  readonly lowCenterOfGravity: boolean
  readonly onProgress?: (progress: OptimizationProgress) => void
}

export type Packed = { readonly placements: PackagePlacement[]; readonly unplaced: UnplacedPackage[] }

function boxOf(xCm: number, yCm: number, zCm: number, dims: PlacedDimensions): Box {
  return { xCm, yCm, zCm, lengthCm: dims.placedLengthCm, widthCm: dims.placedWidthCm, heightCm: dims.placedHeightCm }
}

/**
 * Xếp kệ tất định cho mock (Spec mục 11: "shelf/row packing đơn giản"), không phải bộ tối ưu: vách theo X từ vách trong ra cửa,
 * trong vách các cột theo Y, trong cột chồng theo Z. Kiện chỉ chồng lên kiện đỉnh cột khi đáy nằm gọn trong đáy kiện đó
 * (tỷ lệ đỡ 1, tải dồn đúng một cột), và phải đúng `stackable`, `maxTopLoadKg`, `maxStackCount` của cả cột. Không đè vật cản
 * (cột trên sàn nhảy qua vật cản theo Y), không vượt biên, không vượt tải trọng xe. Vách đã qua không quay lại.
 *
 * Xe khai trục (FE-5b-03, FE-5b-04): kiện mà đặt vào chỗ tìm được sẽ làm tải nhóm trục trước hoặc sau vượt giới hạn thì không lên xe,
 * lý do `CONSTRAINT_VIOLATED` kèm issue `AXLE_OVERLOAD` của lần thử đó — kiện nhẹ hơn phía sau vẫn được xếp tiếp. Xe không khai trục
 * không có kiểm này.
 */
export function packShelves({ vehicle, instances, reasons, lowCenterOfGravity, onProgress }: PackInput): Packed {
  const grid = createSpatialGrid([])
  const obstacles = vehicle.obstacles.map(obstacleToBox)
  const placements: PackagePlacement[] = []
  const unplaced: UnplacedPackage[] = []
  let wall: Wall = { xCm: 0, depthCm: 0, nextYCm: 0, stacks: [] }
  let usedKg = 0
  /** Tổng (khối lượng × hoành độ tâm hộp) của kiện đã xếp, kg·cm — trọng tâm hàng theo X cho mô hình tải trục. */
  let momentKgCm = 0

  const inside = (box: Box) =>
    !gt(box.xCm + box.lengthCm, vehicle.innerLengthCm) &&
    !gt(box.yCm + box.widthCm, vehicle.innerWidthCm) &&
    !gt(box.zCm + box.heightCm, vehicle.innerHeightCm)
  const free = (box: Box) => inside(box) && !obstacles.some((obstacle) => overlaps(obstacle, box)) && grid.queryAabb(box).length === 0

  function floorSpot(orientations: readonly Orientation[]): Spot | undefined {
    for (const { code, dims } of orientations) {
      let yCm = wall.nextYCm
      for (;;) {
        const box = boxOf(wall.xCm, yCm, 0, dims)
        if (!inside(box)) break
        const blocking = obstacles.filter((obstacle) => overlaps(obstacle, box))
        if (blocking.length === 0) {
          if (grid.queryAabb(box).length === 0) return { box, code }
          break
        }
        yCm = Math.max(...blocking.map((obstacle) => obstacle.yCm + obstacle.widthCm))
      }
    }
    return undefined
  }

  function topSpot(instance: PackageInstance, orientations: readonly Orientation[]): { spot?: Spot; stackingRejected: boolean } {
    let stackingRejected = false
    for (const stack of wall.stacks) {
      const top = stack.boxes.at(-1)
      if (top === undefined) continue
      const layers = stack.boxes.length + 1
      const breaksRules =
        !top.instance.stackable ||
        stack.boxes.some(({ loadAboveKg, instance: below }) => gt(loadAboveKg + instance.weightKg, below.maxTopLoadKg)) ||
        [...stack.boxes.map((stacked) => stacked.instance), instance].some(({ maxStackCount }) => maxStackCount !== undefined && layers > maxStackCount)
      for (const { code, dims } of orientations) {
        if (gt(dims.placedLengthCm, top.box.lengthCm) || gt(dims.placedWidthCm, top.box.widthCm)) continue
        const box = boxOf(stack.xCm, stack.yCm, top.box.zCm + top.box.heightCm, dims)
        if (!free(box)) continue
        if (breaksRules) stackingRejected = true
        else return { spot: { box, code, stack }, stackingRejected }
      }
    }
    return { stackingRejected }
  }

  function place(instance: PackageInstance, { box, code, stack }: Spot): void {
    grid.update(instance.packageInstanceId, box)
    usedKg = roundKg(usedKg + instance.weightKg)
    momentKgCm += instance.weightKg * (box.xCm + box.lengthCm / 2)
    wall.depthCm = Math.max(wall.depthCm, box.lengthCm)
    if (stack) {
      for (const below of stack.boxes) below.loadAboveKg += instance.weightKg
      stack.boxes.push({ instance, box, loadAboveKg: 0 })
    } else {
      wall.stacks.push({ xCm: box.xCm, yCm: box.yCm, boxes: [{ instance, box, loadAboveKg: 0 }] })
      wall.nextYCm = box.yCm + box.widthCm
    }
    placements.push({
      packageInstanceId: instance.packageInstanceId,
      orientation: code,
      xCm: roundCm(box.xCm),
      yCm: roundCm(box.yCm),
      zCm: roundCm(box.zCm),
      placedLengthCm: box.lengthCm,
      placedWidthCm: box.widthCm,
      placedHeightCm: box.heightCm,
      loadingOrder: placements.length + 1,
      unloadingOrder: 0,
      supportRatio: 1,
      constraintWarnings: [],
    })
  }

  /** `AXLE_OVERLOAD` nếu đặt thêm `instance` vào `box`; rỗng khi xe không khai trục hoặc vẫn trong giới hạn. */
  function axleOverload(instance: PackageInstance, box: Box): ConstraintIssue<'AXLE_OVERLOAD'>[] {
    if (!vehicle.axles?.length) return []
    const totalKg = usedKg + instance.weightKg
    if (!gt(totalKg, 0)) return []
    const centerXCm = (momentKgCm + instance.weightKg * (box.xCm + box.lengthCm / 2)) / totalKg
    return checkAxleLoads(axleLoadsOf(vehicle, { totalKg, centerXCm }))
  }

  function rejectionFor(instance: PackageInstance): Rejection | undefined {
    const known = reasons.get(instance.packageInstanceId)
    if (known !== undefined) return { reasonCode: known }
    if (gt(usedKg + instance.weightKg, vehicle.maxPayloadKg)) return { reasonCode: 'OVER_PAYLOAD' }
    const orientations = effectiveOrientations(instance)
      .map((code) => ({ code, dims: orientDimensions(instance, code) }))
      .filter(({ dims }) => !gt(dims.placedWidthCm + vehicle.clearanceCm, vehicle.doorWidthCm) && !gt(dims.placedHeightCm + vehicle.clearanceCm, vehicle.doorHeightCm))
    let stackingRejected = false
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const onTop = topSpot(instance, orientations)
      stackingRejected ||= onTop.stackingRejected
      const spot = lowCenterOfGravity ? (floorSpot(orientations) ?? onTop.spot) : (onTop.spot ?? floorSpot(orientations))
      if (spot) {
        const overload = axleOverload(instance, spot.box)
        if (overload.length > 0) return { reasonCode: 'CONSTRAINT_VIOLATED', violatedConstraints: overload }
        place(instance, spot)
        return undefined
      }
      if (wall.stacks.length === 0) break
      wall = { xCm: wall.xCm + wall.depthCm, depthCm: 0, nextYCm: 0, stacks: [] }
    }
    return { reasonCode: stackingRejected ? 'STACKING_VIOLATION' : 'NO_SPACE' }
  }

  instances.forEach((instance, index) => {
    const rejection = rejectionFor(instance)
    if (rejection !== undefined) unplaced.push({ packageInstanceId: instance.packageInstanceId, message: rejection.reasonCode, ...rejection })
    if ((index + 1) % 25 === 0 || index + 1 === instances.length) onProgress?.({ placed: index + 1, total: instances.length })
  })
  return { placements, unplaced }
}
