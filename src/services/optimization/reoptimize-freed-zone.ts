import { expandPackages, type PackageInstance } from '@/domain/cargo'
import { createConstraintEngine, createPlacementLayout, supportRatio, type ConstraintIssue, type PlacementLayout } from '@/domain/constraints'
import { effectiveOrientations, gt, lt, overlaps, roundCm, type Box } from '@/domain/geometry'
import { axleLoadsOf, cargoMass } from '@/domain/metrics'
import { obstacleToBox, placementToBox, type CargoPackage, type PackagePlacement, type UnplacedPackage, type VehicleConfig } from '@/domain/models'
import type { FreedZonePacking, FreedZones, LoadSnapshot, PickupPlacement, PickupUnplaced } from '@/domain/pickup'
import { doorOrientations } from './shelf-packer'

/**
 * Mock tái tối ưu vùng trống (FE-BL-01, D-88, PRD v2 mục 8.7): xếp kiện nhận dọc đường vào phần thùng xe vừa trống sau các điểm đã
 * giao, **không dời kiện nào đang chở**. Hàm thuần, tất định (cùng đầu vào, cùng kết quả), cm / kg.
 *
 * Cách chọn chỗ (điểm cực trị): kiện xếp theo diện tích đáy rồi thể tích giảm dần; mỗi kiện thử lần lượt các điểm ứng viên — sàn trước,
 * rồi theo X tăng (sâu trong thùng trước, chừa lối ra cửa), rồi theo Y — với từng hướng đặt cho phép qua được cửa, và nhận chỗ hợp lệ
 * đầu tiên. Chỗ hợp lệ: nằm trọn trong một đoạn vùng trống và trong lòng thùng, không chồng kiện đang chở, kiện đã xếp hay vật cản,
 * còn tải trọng, và nếu nằm trên cao thì chỉ tựa lên kiện nhận khác cho phép xếp chồng (tải đè, số tầng, diện tích tựa tối thiểu).
 * Kiện nhận không bao giờ tựa lên kiện đang chở, nên tải đè của kiện đang chở không đổi.
 *
 * Kết quả cuối cùng được kiểm lại bằng constraint engine của domain trên toàn bộ hàng (đang chở + kiện nhận): issue xếp chồng của kiện
 * nhận, và số kiện còn chở bị kiện nhận che kín mặt sau (`LIFO_BLOCKED`). Kiện đang chở giao **trước hoặc đúng điểm hiện tại**
 * (`loadedAfterStop`) đã rời xe trước khi kiện nhận lên, nên không tính vào kiện bị chắn.
 *
 * Lý do kiện không xếp được dùng mã của hợp đồng tối ưu: `OVER_PAYLOAD`, `NO_ALLOWED_ORIENTATION`, `DOOR_TOO_SMALL`, `NO_SPACE`,
 * `STACKING_VIOLATION` (chỉ còn cách đè lên kiện không chịu tải).
 *
 * Việc này **không tốn credit** (Q-09: backend chưa trả lời) — quyết định ở một chỗ, `db-pickups.ts`.
 */

export type ReoptimizeFreedZoneInput = {
  vehicle: VehicleConfig
  freed: FreedZones
  /** Dòng kiện của mọi kiện còn chở (phương án đã duyệt và kiện nhận đã duyệt trước), điểm giao đánh số theo thứ tự tuyến sau khi chèn. */
  packages: readonly CargoPackage[]
  /** Chỗ của các kiện còn chở — không đổi. `packageInstanceId` là mã instance của `packages`. */
  onboard: readonly PackagePlacement[]
  /** Kiện nhận: mỗi dòng đúng một kiện (`quantity` 1), theo thứ tự của yêu cầu; kết quả gọi chúng bằng chỉ số trong mảng này. */
  pickups: readonly CargoPackage[]
  /** Điểm giao có số ≤ giá trị này đã giao xong trước khi kiện nhận lên xe (điểm hiện tại trở về trước). */
  loadedAfterStop: number
}

type Point = { x: number; y: number; z: number }
type Placed = { instance: PackageInstance; placement: PackagePlacement; supports: string[]; layer: number; stackLimit: number; topKg: number }
type Reason = UnplacedPackage['reasonCode']

const STACKING_CODES: ReadonlySet<ConstraintIssue['code']> = new Set(['TOP_LOAD_EXCEEDED', 'NOT_STACKABLE', 'STACK_COUNT_EXCEEDED', 'SUPPORT_BELOW_MIN', 'NON_BEARING_SUPPORT'])

const byPoint = (a: Point, b: Point) => a.z - b.z || a.x - b.x || a.y - b.y
const pointKey = (p: Point) => `${p.x}:${p.y}:${p.z}`

function snapshot(vehicle: VehicleConfig, placements: readonly PackagePlacement[], weightOf: (id: string) => number): LoadSnapshot {
  const mass = cargoMass(placements, ({ packageInstanceId }) => weightOf(packageInstanceId))
  return { totalKg: mass.totalKg, ...(mass.center === undefined ? {} : { centerOfGravityCm: mass.center }), axle: axleLoadsOf(vehicle, { totalKg: mass.totalKg, centerXCm: mass.center?.x }) }
}

/**
 * Điểm ứng viên đầu tiên trên sàn: đầu mỗi đoạn trống, và mọi mép sau / mép phải của kiện đang chở hay vật cản nằm lấn vào đoạn trống
 * (tích của các hoành độ và tung độ đó) — để một hốc bánh xe hay kiện nằm lấn không chặn mất cả đoạn.
 */
function startPoints({ vehicle, freed, onboard }: ReoptimizeFreedZoneInput): Map<string, Point> {
  const points = new Map<string, Point>()
  const boxes = [...onboard.map(placementToBox), ...vehicle.obstacles.map(obstacleToBox)]
  for (const span of freed.spans) {
    const inside = boxes.filter((box) => lt(box.xCm, span.endXCm) && gt(box.xCm + box.lengthCm, span.startXCm))
    const xs = new Set([roundCm(span.startXCm), ...inside.map((box) => roundCm(box.xCm + box.lengthCm))])
    const ys = new Set([0, ...inside.map((box) => roundCm(box.yCm + box.widthCm))])
    for (const x of xs) for (const y of ys) points.set(pointKey({ x, y, z: 0 }), { x, y, z: 0 })
  }
  return points
}

export function reoptimizeFreedZone(input: ReoptimizeFreedZoneInput): FreedZonePacking {
  const { vehicle, freed, packages, onboard, pickups, loadedAfterStop } = input
  const onboardInstances = expandPackages(packages).instances
  const pickupInstances = pickups.map((pickup): PackageInstance => {
    const [instance] = expandPackages([pickup]).instances
    if (instance === undefined || pickup.quantity !== 1) throw new Error(`Kiện nhận ${pickup.id} phải có số lượng 1`)
    return instance
  })
  const weights = new Map([...onboardInstances, ...pickupInstances].map((instance) => [instance.packageInstanceId, instance.weightKg]))
  const weightOf = (id: string) => weights.get(id) ?? 0
  const before = snapshot(vehicle, onboard, weightOf)

  const layout: PlacementLayout = createPlacementLayout(vehicle, onboard)
  const obstacleBoxes = vehicle.obstacles.map(obstacleToBox)
  const spans = freed.spans
  const points = startPoints(input)
  const placed = new Map<string, Placed>()
  const unplaced: PickupUnplaced[] = []
  let remainingKg = freed.payloadAvailableKg

  const inFreedSpan = (box: Box) => spans.some((span) => !lt(box.xCm, span.startXCm) && !gt(box.xCm + box.lengthCm, span.endXCm))
  const insideInterior = (box: Box) => !gt(box.yCm + box.widthCm, vehicle.innerWidthCm) && !gt(box.zCm + box.heightCm, vehicle.innerHeightCm)

  /** Chỗ tựa của kiện ở độ cao `z` > 0: `null` khi không đặt được, mảng các kiện nhận bên dưới khi được; `stacking` báo lỗi vì luật xếp chồng. */
  function support(instance: PackageInstance, placement: PackagePlacement, box: Box): { ok: true; below: Placed[] } | { ok: false; stacking: boolean } {
    const ids = layout.grid.queryBelow(box)
    const below = ids.map((id) => placed.get(id))
    if (ids.length === 0 || below.some((item) => item === undefined)) return { ok: false, stacking: false }
    const lowers = below as Placed[]
    const layer = Math.max(...lowers.map((item) => item.layer)) + 1
    const limit = Math.min(instance.maxStackCount ?? Infinity, ...lowers.map((item) => item.stackLimit))
    const blocked = lowers.some((item) => !item.instance.stackable || gt(item.topKg + instance.weightKg, item.instance.maxTopLoadKg)) || gt(layer, limit)
    if (blocked) return { ok: false, stacking: true }
    return lt(supportRatio(placement, layout), instance.minSupportRatio) ? { ok: false, stacking: false } : { ok: true, below: lowers }
  }

  const order = pickupInstances
    .map((instance, index) => ({ instance, index }))
    .toSorted((a, b) => b.instance.lengthCm * b.instance.widthCm - a.instance.lengthCm * a.instance.widthCm
      || b.instance.lengthCm * b.instance.widthCm * b.instance.heightCm - a.instance.lengthCm * a.instance.widthCm * a.instance.heightCm
      || a.index - b.index)

  for (const { instance, index } of order) {
    const reject = (reasonCode: Reason) => unplaced.push({ packageIndex: index, reasonCode })
    if (effectiveOrientations(instance).length === 0) { reject('NO_ALLOWED_ORIENTATION'); continue }
    const orientations = doorOrientations(vehicle, instance)
    if (orientations.length === 0) { reject('DOOR_TOO_SMALL'); continue }
    if (gt(instance.weightKg, remainingKg)) { reject('OVER_PAYLOAD'); continue }

    let stackingRejected = false
    let found: { point: Point; placement: PackagePlacement; below: Placed[] } | undefined
    for (const point of [...points.values()].toSorted(byPoint)) {
      for (const { code, dims } of orientations) {
        const placement: PackagePlacement = {
          packageInstanceId: instance.packageInstanceId, orientation: code, xCm: point.x, yCm: point.y, zCm: point.z, ...dims,
          loadingOrder: placed.size + 1, unloadingOrder: placed.size + 1, supportRatio: 1, constraintWarnings: [],
        }
        const box = placementToBox(placement)
        if (!inFreedSpan(box) || !insideInterior(box)) continue
        if (layout.grid.queryAabb(box).length > 0 || obstacleBoxes.some((obstacle) => overlaps(box, obstacle))) continue
        if (!gt(point.z, 0)) { found = { point, placement, below: [] }; break }
        const resting = support(instance, placement, box)
        if (resting.ok) { found = { point, placement, below: resting.below }; break }
        stackingRejected ||= resting.stacking
      }
      if (found !== undefined) break
    }

    if (found === undefined) { reject(stackingRejected ? 'STACKING_VIOLATION' : 'NO_SPACE'); continue }
    const { point, placement, below } = found
    const layer = below.length === 0 ? 1 : Math.max(...below.map((item) => item.layer)) + 1
    const record: Placed = {
      instance, placement, supports: below.map((item) => item.placement.packageInstanceId), layer, topKg: 0,
      stackLimit: Math.min(instance.maxStackCount ?? Infinity, ...below.map((item) => item.stackLimit)),
    }
    placed.set(instance.packageInstanceId, record)
    layout.placements.set(instance.packageInstanceId, placement)
    layout.grid.update(instance.packageInstanceId, placementToBox(placement))
    remainingKg -= instance.weightKg
    // Tải đè truyền xuống cả chồng bên dưới
    const loaded = new Set<string>()
    const pass = (items: readonly string[]) => items.forEach((id) => {
      const lower = placed.get(id)
      if (lower === undefined || loaded.has(id)) return
      loaded.add(id)
      lower.topKg += instance.weightKg
      pass(lower.supports)
    })
    pass(record.supports)
    points.delete(pointKey(point))
    const box = placementToBox(placement)
    for (const next of [
      { x: roundCm(box.xCm + box.lengthCm), y: box.yCm, z: box.zCm },
      { x: box.xCm, y: roundCm(box.yCm + box.widthCm), z: box.zCm },
      { x: box.xCm, y: box.yCm, z: roundCm(box.zCm + box.heightCm) },
    ]) points.set(pointKey(next), next)
  }

  const placements = [...placed.values()].map(({ placement, instance }): PickupPlacement => ({
    packageIndex: pickupInstances.indexOf(instance), orientation: placement.orientation,
    xCm: placement.xCm, yCm: placement.yCm, zCm: placement.zCm,
    placedLengthCm: placement.placedLengthCm, placedWidthCm: placement.placedWidthCm, placedHeightCm: placement.placedHeightCm,
  })).toSorted((a, b) => a.packageIndex - b.packageIndex)
  unplaced.sort((a, b) => a.packageIndex - b.packageIndex)

  const after = snapshot(vehicle, [...onboard, ...[...placed.values()].map((item) => item.placement)], weightOf)
  if (placed.size === 0) return { placements, unplaced, before, after, stackingIssues: [], blockedCount: 0 }

  // Kiểm lại cả hàng bằng constraint engine: issue xếp chồng của kiện nhận, và kiện còn chở bị kiện nhận che kín mặt sau
  const evaluation = createConstraintEngine({
    vehicle, packages: [...packages, ...pickups], placements: [...onboard, ...[...placed.values()].map((item) => item.placement)], settings: { enforceLifo: true },
  }).evaluateAll()
  const stopOf = new Map([...onboardInstances, ...pickupInstances].map((instance) => [instance.packageInstanceId, instance.deliveryStop]))
  const ownIds = new Set(placed.keys())
  const stackingIssues = [...ownIds].flatMap((id) => evaluation.byInstanceId.get(id) ?? []).filter((issue) => STACKING_CODES.has(issue.code))
  const blocked = new Set(evaluation.issues.flatMap((issue) => {
    const subject = issue.packageInstanceId
    const involvesPickup = (subject !== undefined && ownIds.has(subject)) || (issue.relatedIds ?? []).some((id) => ownIds.has(id))
    return issue.code === 'LIFO_BLOCKED' && subject !== undefined && involvesPickup && gt(stopOf.get(subject) ?? 0, loadedAfterStop) ? [subject] : []
  }))
  return { placements, unplaced, before, after, stackingIssues: [...new Set(stackingIssues)], blockedCount: blocked.size }
}
