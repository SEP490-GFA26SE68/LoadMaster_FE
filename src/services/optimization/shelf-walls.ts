import type { PackageInstance } from '@/domain/cargo'
import type { ConstraintIssue } from '@/domain/constraints'
import { createSpatialGrid, gt, overlaps, roundCm, roundKg, type Box, type OrientationCode, type PlacedDimensions } from '@/domain/geometry'
import { axleLoadsOf, checkAxleLoads } from '@/domain/metrics'
import { obstacleToBox, placementToBox, type PackagePlacement, type UnplacedPackage, type VehicleConfig } from '@/domain/models'

/** Vì sao một kiện không lên xe: mã lý do, kèm ràng buộc đã chặn khi lý do là `CONSTRAINT_VIOLATED`. */
export type Rejection = Pick<UnplacedPackage, 'reasonCode' | 'violatedConstraints'>
export type Orientation = { readonly code: OrientationCode; readonly dims: PlacedDimensions }
/** Lần tìm chỗ không ra chỗ của một dạng kiện trong một dải, với giới hạn `limitXCm`. */
type Miss = { readonly limitXCm: number; readonly stackingRejected: boolean }
type StackedBox = { readonly instance: PackageInstance; readonly box: Box; loadAboveKg: number }
type Stack = { readonly xCm: number; readonly yCm: number; readonly boxes: StackedBox[] }
type Wall = { readonly xCm: number; depthCm: number; nextYCm: number; readonly stacks: Stack[] }
type Spot = { readonly box: Box; readonly code: OrientationCode; readonly stack?: Stack }

/**
 * Kiện ghim (FE-BL-02): hộp cố định đã có chỗ. Với bộ xếp nó là vật cản — kiện khác không đè lên, không chồng lên — nhưng khối lượng và
 * trọng tâm của nó tính vào tải trọng và tải trục như mọi kiện, và placement của nó nằm đầu danh sách kết quả, giữ nguyên.
 */
export type FixedCargo = { readonly weightKg: number; readonly placement: PackagePlacement }

/**
 * Một dải xếp dọc thùng, bắt đầu ở `startXCm`: giữ vách đang xếp. Vách đã qua không quay lại. `misses` nhớ dạng kiện đã thử mà dải
 * không còn chỗ: chỗ trống trong dải chỉ ít đi, nên kiện cùng dạng tới sau không cần dò lại cho tới khi dải nhận thêm kiện (đỉnh cột
 * mới là chỗ chồng mới).
 */
export type Lane = { wall: Wall; readonly misses: Map<string, Miss> }
/** Kết quả một lần tìm chỗ: đã xếp, bị ràng buộc chặn hẳn (`rejection`), hoặc không có chỗ trong dải. */
export type Outcome = { readonly placed: boolean; readonly rejection?: Rejection; readonly stackingRejected: boolean }

function boxOf(xCm: number, yCm: number, zCm: number, dims: PlacedDimensions): Box {
  return { xCm, yCm, zCm, lengthCm: dims.placedLengthCm, widthCm: dims.placedWidthCm, heightCm: dims.placedHeightCm }
}

function wallAt(xCm: number): Wall {
  return { xCm, depthCm: 0, nextYCm: 0, stacks: [] }
}

/**
 * Cơ chế xếp kệ của mock (Spec mục 11: "shelf/row packing đơn giản"), không phải bộ tối ưu: trong một dải, vách theo X từ trong ra
 * cửa, trong vách các cột theo Y, trong cột chồng theo Z. Kiện chỉ chồng lên kiện đỉnh cột khi đáy nằm gọn trong đáy kiện đó
 * (tỷ lệ đỡ 1, tải dồn đúng một cột), và phải đúng `stackable`, `maxTopLoadKg`, `maxStackCount` của cả cột. Không đè vật cản
 * (cột trên sàn nhảy qua vật cản theo Y), không đè kiện khác, không vượt biên. Vách mới chỉ mở khi có kiện đặt được vào nó.
 *
 * Xe khai trục (FE-5b-03, FE-5b-04): kiện mà đặt vào chỗ tìm được sẽ làm tải nhóm trục trước hoặc sau vượt giới hạn thì không lên xe,
 * lý do `CONSTRAINT_VIOLATED` kèm issue `AXLE_OVERLOAD` của lần thử đó. Xe không khai trục không có kiểm này.
 *
 * `fixed` (FE-BL-02): kiện ghim — vật cản cho việc tìm chỗ, đã nằm sẵn trong `placements` và trong khối lượng / trọng tâm đã xếp. Vách
 * trống bị kiện ghim chắn kín thì nhảy tới mép sau của kiện ghim (`skipFixed`), không bỏ dải.
 */
export function createShelves(vehicle: VehicleConfig, lowCenterOfGravity: boolean, fixed: readonly FixedCargo[] = []) {
  const grid = createSpatialGrid([])
  const fixedBoxes = fixed.map(({ placement }) => placementToBox(placement))
  const obstacles = [...vehicle.obstacles.map(obstacleToBox), ...fixedBoxes]
  const placements: PackagePlacement[] = fixed.map(({ placement }) => ({ ...placement, pinned: true }))
  let usedKg = roundKg(fixed.reduce((sum, { weightKg }) => sum + weightKg, 0))
  /** Tổng (khối lượng × hoành độ tâm hộp) của kiện đã xếp, kg·cm — trọng tâm hàng theo X cho mô hình tải trục. */
  let momentKgCm = fixed.reduce((sum, { weightKg, placement }) => sum + weightKg * (placement.xCm + placement.placedLengthCm / 2), 0)

  const inside = (box: Box, limitXCm: number) =>
    !gt(box.xCm + box.lengthCm, limitXCm) &&
    !gt(box.yCm + box.widthCm, vehicle.innerWidthCm) &&
    !gt(box.zCm + box.heightCm, vehicle.innerHeightCm)
  const free = (box: Box, limitXCm: number) =>
    inside(box, limitXCm) && !obstacles.some((obstacle) => overlaps(obstacle, box)) && grid.queryAabb(box).length === 0

  function floorSpot(wall: Wall, limitXCm: number, orientations: readonly Orientation[]): Spot | undefined {
    for (const { code, dims } of orientations) {
      let yCm = wall.nextYCm
      for (;;) {
        const box = boxOf(wall.xCm, yCm, 0, dims)
        if (!inside(box, limitXCm)) break
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

  function topSpot(wall: Wall, limitXCm: number, instance: PackageInstance, orientations: readonly Orientation[]): { spot?: Spot; stackingRejected: boolean } {
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
        if (!free(box, limitXCm)) continue
        if (breaksRules) stackingRejected = true
        else return { spot: { box, code, stack }, stackingRejected }
      }
    }
    return { stackingRejected }
  }

  /** Vách trống kế tiếp nằm sau mép sau của kiện ghim đang chắn vách `wall`; không còn thì `undefined`. */
  function skipFixed(wall: Wall, limitXCm: number): Wall | undefined {
    const ahead = fixedBoxes.map((box) => box.xCm + box.lengthCm).filter((endXCm) => gt(endXCm, wall.xCm) && !gt(endXCm, limitXCm))
    return ahead.length === 0 ? undefined : wallAt(Math.min(...ahead))
  }

  function place(wall: Wall, instance: PackageInstance, { box, code, stack }: Spot): void {
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

  return {
    placements,
    usedKg: () => usedKg,
    lane: (startXCm: number): Lane => ({ wall: wallAt(startXCm), misses: new Map() }),
    /** Tìm chỗ trong vách đang xếp của dải, không có thì ở một vách mới ngay sau nó; kiện không được vượt `limitXCm`. */
    attempt(lane: Lane, limitXCm: number, instance: PackageInstance, orientations: readonly Orientation[]): Outcome {
      // Mọi thứ quyết định một kiện có chỗ hay không ngoài trạng thái của dải: kích thước theo từng hướng, khối lượng, số tầng tối đa.
      // Chỉ dựng khoá khi dải đã có lần hụt — lượt xếp vừa hết thì không tốn gì.
      const shape = () => `${instance.lengthCm}|${instance.widthCm}|${instance.heightCm}|${instance.weightKg}|${instance.maxStackCount}|${orientations.map(({ code }) => code).join()}`
      const miss = lane.misses.size > 0 ? lane.misses.get(shape()) : undefined
      if (miss !== undefined && !gt(limitXCm, miss.limitXCm)) return { placed: false, stackingRejected: miss.stackingRejected }
      let stackingRejected = false
      let wall: Wall | undefined = lane.wall
      let opened = false
      while (wall !== undefined) {
        const onTop = topSpot(wall, limitXCm, instance, orientations)
        stackingRejected ||= onTop.stackingRejected
        const spot = lowCenterOfGravity ? (floorSpot(wall, limitXCm, orientations) ?? onTop.spot) : (onTop.spot ?? floorSpot(wall, limitXCm, orientations))
        if (spot) {
          const overload = axleOverload(instance, spot.box)
          if (overload.length > 0) return { placed: false, rejection: { reasonCode: 'CONSTRAINT_VIOLATED', violatedConstraints: overload }, stackingRejected }
          lane.wall = wall
          lane.misses.clear()
          place(wall, instance, spot)
          return { placed: true, stackingRejected }
        }
        // Vách trống mà vẫn không vừa thì vách mới ngay sau cũng không vừa: chỉ còn kiện ghim chắn kín vách là có lối tiếp (sau mép nó).
        // Vách đã có kiện thì thử đúng một vách mới ngay sau nó.
        if (wall.stacks.length === 0) wall = skipFixed(wall, limitXCm)
        else if (!opened) {
          opened = true
          wall = wallAt(wall.xCm + wall.depthCm)
        } else wall = undefined
      }
      lane.misses.set(shape(), { limitXCm, stackingRejected })
      return { placed: false, stackingRejected }
    },
  }
}
