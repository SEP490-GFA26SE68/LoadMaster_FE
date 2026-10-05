import { expandPackages } from '@/domain/cargo'
import { axleLoadsOf, cargoMass, checkAxleLoads, checkCenterOfGravity } from '@/domain/metrics'
import {
  obstacleToBox,
  type CargoPackage,
  type OptimizationRequest,
  type PackagePlacement,
  type VehicleConfig,
} from '@/domain/models'
import { instanceOf, neighboursOf, placementChecks, placementOf, type EngineContext } from './engine-checks'
import type { ConstraintIssue } from './issues'
import { createPlacementLayout, movePlacement } from './layout'
import { loadingOrderIssues } from './loading-order'
import { applyPose, type PlacementPose } from './pose'
import { stackIssues } from './stack-issues'
import { createStackGraph, recomputeColumn, topLoadKg } from './stack-load'

export type ConstraintEngineInput = {
  readonly vehicle: VehicleConfig
  readonly packages: readonly CargoPackage[]
  readonly placements: readonly PackagePlacement[]
  readonly settings: Pick<OptimizationRequest['settings'], 'enforceLifo'>
}

/** Ảnh chụp kết quả kiểm: không đổi khi engine đổi về sau. */
export type EngineEvaluation = {
  /** Theo thứ tự: issue từng kiện theo thứ tự placement, rồi xếp chồng, thứ tự xếp, trọng tâm, tải trục. */
  readonly issues: readonly ConstraintIssue[]
  /** Issue mà kiện là chủ thể hoặc nằm trong `relatedIds`. */
  readonly byInstanceId: ReadonlyMap<string, readonly ConstraintIssue[]>
  readonly supportRatioById: ReadonlyMap<string, number>
  readonly loadById: ReadonlyMap<string, number>
}

export type ConstraintEngine = {
  evaluateAll(): EngineEvaluation
  /** Kết quả nếu kiện `id` ở `pose` — preview khi kéo; engine giữ nguyên trạng thái. */
  evaluateMove(id: string, pose: PlacementPose): EngineEvaluation
  /** Dời kiện `id` tới `pose` (qua `applyPose`, toạ độ `roundCm`) và tính lại cục bộ. */
  commitMove(id: string, pose: PlacementPose): EngineEvaluation
  /** Placement hiện tại, theo thứ tự ban đầu. */
  placements(): readonly PackagePlacement[]
}

function groupByInstance(issues: readonly ConstraintIssue[], placements: ReadonlyMap<string, unknown>) {
  const grouped = new Map<string, ConstraintIssue[]>()
  for (const issue of issues) {
    for (const id of new Set([issue.packageInstanceId, ...(issue.relatedIds ?? [])])) {
      if (id === undefined || !placements.has(id)) continue
      const own = grouped.get(id)
      if (own) own.push(issue)
      else grouped.set(id, [issue])
    }
  }
  return grouped
}

/**
 * Placement mang `supportRatio` và `constraintWarnings` (mã issue của kiện, không lặp, theo thứ tự issue) do engine tính trên
 * chính phương án này — dùng khi service trả kết quả (LM-024) và khi Duyệt áp draft (LM-026), không giữ số cũ.
 */
export function annotatePlacements(input: ConstraintEngineInput): PackagePlacement[] {
  const { supportRatioById, byInstanceId } = createConstraintEngine(input).evaluateAll()
  return input.placements.map((placement) => ({
    ...placement,
    supportRatio: supportRatioById.get(placement.packageInstanceId) ?? placement.supportRatio,
    constraintWarnings: [...new Set((byInstanceId.get(placement.packageInstanceId) ?? []).map(({ code }) => code))],
  }))
}

/**
 * Constraint engine của Spec mục 7 cho một phương án (D-29): dựng lưới, đồ thị đỡ và issue từng kiện một lần; khi dời một
 * kiện chỉ tính lại kiện đó, các kiện chồng lấn / tựa lên / có nó trong hành lang dỡ ở vị trí cũ và mới, cột đỡ của nó.
 * Xếp chồng, thứ tự xếp, trọng tâm và tải trục (D-78) tính lại toàn bộ mỗi lần kiểm (O(N), rẻ).
 *
 * Request phải hợp lệ trước (`validateRequest`): trùng mã instance hoặc placement không thuộc kiện nào → `throw`.
 */
export function createConstraintEngine({ vehicle, packages, placements, settings }: ConstraintEngineInput): ConstraintEngine {
  const expanded = expandPackages(packages)
  const duplicate = expanded.issues[0]
  if (duplicate) throw new Error(`Mã instance trùng trong request: ${duplicate.packageInstanceId}`)
  const instances = new Map(expanded.instances.map((instance) => [instance.packageInstanceId, instance]))
  const layout = createPlacementLayout(vehicle, placements)
  const ctx: EngineContext = {
    vehicle,
    layout,
    graph: createStackGraph(layout, instances),
    instances,
    lifo: {
      deliveryStopByInstanceId: new Map(expanded.instances.map((instance) => [instance.packageInstanceId, instance.deliveryStop])),
      enforceLifo: settings.enforceLifo,
    },
    rank: new Map(placements.map((placement, index) => [placement.packageInstanceId, index])),
    obstacleBoxes: new Map(vehicle.obstacles.map((obstacle) => [obstacle.id, obstacleToBox(obstacle)])),
  }
  const weights = new Map(expanded.instances.map((instance) => [instance.packageInstanceId, instance.weightKg]))
  const local = new Map<string, readonly ConstraintIssue[]>()
  const ratios = new Map<string, number>()

  function refresh(id: string): void {
    const checked = placementChecks(id, ctx)
    local.set(id, checked.issues)
    ratios.set(id, checked.supportRatio)
  }

  function moveTo(id: string, placement: PackagePlacement): void {
    const before = neighboursOf(id, ctx)
    movePlacement(layout, placement)
    recomputeColumn(ctx.graph, [id])
    for (const affected of new Set([id, ...before, ...neighboursOf(id, ctx)])) refresh(affected)
  }

  function evaluate(): EngineEvaluation {
    const current = [...layout.placements.values()]
    const mass = cargoMass(current, ({ packageInstanceId }) => weights.get(packageInstanceId) ?? 0)
    const issues = [
      ...current.flatMap(({ packageInstanceId }) => local.get(packageInstanceId) ?? []),
      ...stackIssues(ctx.graph),
      ...loadingOrderIssues(ctx.graph),
      ...(mass.center ? checkCenterOfGravity(vehicle, mass.center) : []),
      ...checkAxleLoads(axleLoadsOf(vehicle, { totalKg: mass.totalKg, centerXCm: mass.center?.x })),
    ]
    return {
      issues,
      byInstanceId: groupByInstance(issues, layout.placements),
      supportRatioById: new Map(ratios),
      loadById: new Map(current.map(({ packageInstanceId }) => [packageInstanceId, topLoadKg(ctx.graph, packageInstanceId)])),
    }
  }

  for (const { packageInstanceId } of placements) instanceOf(ctx, packageInstanceId)
  for (const id of layout.placements.keys()) refresh(id)

  return {
    evaluateAll: evaluate,
    evaluateMove(id, pose) {
      const original = placementOf(ctx, id)
      moveTo(id, applyPose(original, pose, instanceOf(ctx, id)))
      try {
        return evaluate()
      } finally {
        moveTo(id, original)
      }
    },
    commitMove(id, pose) {
      moveTo(id, applyPose(placementOf(ctx, id), pose, instanceOf(ctx, id)))
      return evaluate()
    },
    placements: () => [...layout.placements.values()],
  }
}
