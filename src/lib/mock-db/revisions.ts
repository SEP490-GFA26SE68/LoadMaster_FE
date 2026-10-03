import { expandPackages } from '@/domain/cargo'
import {
  annotatePlacements,
  applyPose,
  approvalBlockers,
  createConstraintEngine,
  createPlacementLayout,
  createStackGraph,
  recomputeOrders,
  type ConstraintIssue,
  type PlacementPatch,
} from '@/domain/constraints'
import { computeMetrics } from '@/domain/metrics'
import type { OptimizationRequest, OptimizationResult } from '@/domain/models'
import { zonePlacements } from '@/domain/zones'
import { MockDbError } from './errors'
import type { Revision, Trip } from './types'

/** Revision lỗi thời khi xe hoặc kiện của chuyến đã đổi sau khi tạo nó (D-31): chặn Duyệt. Hai tham số phải cùng một chuyến. */
export function isStale(revision: Pick<Revision, 'inputVersion'>, trip: Pick<Trip, 'inputVersion'>): boolean {
  return revision.inputVersion !== trip.inputVersion
}

/**
 * Kết quả của revision approved (D-31, D-32), dựng mới, không sửa `request`/`result` nguồn:
 * 1. áp từng patch bằng `applyPose`, kích thước kiện lấy từ instance của `expandPackages(request.packages)`;
 * 2. tính lại `loadingOrder`/`unloadingOrder` bằng `recomputeOrders` trên đồ thị đỡ của placement đã áp draft, thuộc tính xếp chồng và
 *    điểm giao lấy từ instance;
 * 3. tính lại `supportRatio` và `constraintWarnings` của từng placement bằng constraint engine (`annotatePlacements`, LM-023);
 * 4. ghi lại `stopZoneId` của từng placement và đếm lại số lần dỡ-xếp lại theo các vùng của lần tối ưu (`result.stopZones` — Duyệt
 *    không chia lại vùng, FE-5b-02); kết quả không chia vùng thì giữ nguyên;
 * 5. tính lại `metrics` bằng `computeMetrics`.
 *
 * Các trường khác giữ nguyên, gồm `isMockResult`.
 */
export function approvedResult(
  request: OptimizationRequest,
  result: OptimizationResult,
  patches: readonly PlacementPatch[],
): OptimizationResult {
  const { instances } = expandPackages(request.packages)
  const instanceById = new Map(instances.map((instance) => [instance.packageInstanceId, instance]))
  const placementById = new Map(result.placements.map((placement) => [placement.packageInstanceId, placement]))
  for (const patch of patches) {
    const placement = placementById.get(patch.packageInstanceId)
    const instance = instanceById.get(patch.packageInstanceId)
    // Editor không tạo placement cho kiện chưa xếp: patch chỉ được chỉnh kiện đã có trong kết quả
    if (placement === undefined || instance === undefined) {
      throw new MockDbError('PATCH_UNKNOWN_INSTANCE', { packageInstanceId: patch.packageInstanceId })
    }
    placementById.set(patch.packageInstanceId, applyPose(placement, patch, instance))
  }
  // Map giữ thứ tự chèn: placement vẫn theo thứ tự của kết quả nguồn
  const patched = [...placementById.values()]
  const graph = createStackGraph(createPlacementLayout(request.vehicle, patched), instanceById)
  const deliveryStops = new Map(instances.map(({ packageInstanceId, deliveryStop }) => [packageInstanceId, deliveryStop]))
  const { orders } = recomputeOrders(graph, deliveryStops)
  const annotated = annotatePlacements({
    vehicle: request.vehicle,
    packages: request.packages,
    placements: patched.map((placement) => ({ ...placement, ...orders.get(placement.packageInstanceId) })),
    settings: request.settings,
  })
  const zoned = result.stopZones === undefined ? undefined : zonePlacements(result.stopZones, annotated, deliveryStops)
  const placements = zoned?.placements ?? annotated
  const metrics = computeMetrics({
    vehicle: request.vehicle,
    placements,
    weightByInstanceId: new Map(instances.map(({ packageInstanceId, weightKg }) => [packageInstanceId, weightKg])),
    unplacedCount: result.unplacedPackages.length,
    // Thời gian chạy là của lần tối ưu, Duyệt không chạy lại service
    runtimeMs: result.metrics.runtimeMs,
    rehandlingCount: zoned?.rehandlingCount,
  })
  return { ...result, placements, metrics }
}

/**
 * Lý do chặn Duyệt của một kết quả (D-80), kho tự kiểm lại chứ không tin giao diện: constraint engine chạy trên chính placement sẽ
 * được duyệt (`result` đã áp draft) rồi `approvalBlockers` của domain — lỗi ràng buộc, vượt tải trục, kiện bắt buộc chưa xếp. Lỗi
 * thời kiểm riêng (`isStale`).
 */
export function approvalIssues(request: OptimizationRequest, result: OptimizationResult): readonly ConstraintIssue[] {
  const { issues } = createConstraintEngine({
    vehicle: request.vehicle, packages: request.packages, placements: result.placements, settings: request.settings,
  }).evaluateAll()
  return approvalBlockers({ issues, packages: request.packages, unplacedPackages: result.unplacedPackages, stale: false }).issues
}
