import type { PackageInstance } from '@/domain/cargo'
import { annotatePlacements, createPlacementLayout, createStackGraph, recomputeOrders } from '@/domain/constraints'
import { gt, roundKg } from '@/domain/geometry'
import { computeMetrics } from '@/domain/metrics'
import type { OptimizationRequest, OptimizationResult, PackagePlacement, UnplacedPackage } from '@/domain/models'
import { stopVolumes, stopZones, zonePlacements } from '@/domain/zones'
import { preflight } from './mock-preflight'
import type { OptimizationProgress } from './OptimizationService'
import { packShelves } from './shelf-packer'

export type MockRunOptions = {
  /** Đồng hồ ms cho `runtimeMs`; test truyền đồng hồ giả để kết quả tất định. */
  readonly clock?: () => number
  readonly onProgress?: (progress: OptimizationProgress) => void
}

/** FNV-1a 32 bit: băm tất định, đủ cho `jobId` và phá hoà theo seed. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

function volumeCm3({ lengthCm, widthCm, heightCm }: PackageInstance): number {
  return lengthCm * widthCm * heightCm
}

/** D-23, thứ tự chọn kiện lên xe: `mustLoad` trước, `priority` cao, điểm giao muộn, thể tích lớn; hoà thì theo seed, rồi mã. */
function selectionOrder(instances: readonly PackageInstance[], seed: number): PackageInstance[] {
  const tieBreak = (instance: PackageInstance) => fnv1a(`${seed}:${instance.packageInstanceId}`)
  return instances.toSorted(
    (a, b) =>
      Number(b.mustLoad) - Number(a.mustLoad) ||
      b.priority - a.priority ||
      b.deliveryStop - a.deliveryStop ||
      volumeCm3(b) - volumeCm3(a) ||
      tieBreak(a) - tieBreak(b) ||
      (a.packageInstanceId < b.packageInstanceId ? -1 : 1),
  )
}

/**
 * Khi `enforceLifo`: điểm giao muộn vào sâu trước, trong cùng điểm giữ thứ tự chọn — ưu tiên chỉ quyết định kiện nào lên xe,
 * không đẩy hàng giao sớm vào trong hàng giao muộn (D-26). Không bật thì đặt chỗ theo đúng thứ tự chọn.
 */
function lifoOrder(chosen: readonly PackageInstance[]): PackageInstance[] {
  const rank = new Map(chosen.map((instance, index) => [instance.packageInstanceId, index]))
  const rankOf = (instance: PackageInstance) => rank.get(instance.packageInstanceId) ?? 0
  return chosen.toSorted((a, b) => b.deliveryStop - a.deliveryStop || rankOf(a) - rankOf(b))
}

/**
 * D-23: dành tải trọng theo thứ tự chọn trước khi đặt chỗ, phần vượt trả `OVER_PAYLOAD` — nhờ vậy xếp theo điểm giao không để kiện
 * ưu tiên thấp chiếm tải của kiện ưu tiên cao. Kiện đã dành tải mà hết chỗ vẫn giữ phần tải đó (ước tính thận trọng của mock).
 */
function overPayload(
  chosen: readonly PackageInstance[],
  known: ReadonlyMap<string, UnplacedPackage['reasonCode']>,
  maxPayloadKg: number,
): Map<string, UnplacedPackage['reasonCode']> {
  const reasons = new Map(known)
  let reservedKg = 0
  for (const { packageInstanceId, weightKg } of chosen) {
    if (reasons.has(packageInstanceId)) continue
    if (gt(reservedKg + weightKg, maxPayloadKg)) reasons.set(packageInstanceId, 'OVER_PAYLOAD')
    else reservedKg = roundKg(reservedKg + weightKg)
  }
  return reasons
}

/**
 * Mock optimization thuần (Spec mục 11, LM-024) — chạy được trong worker và trong test, cùng request + seed cho cùng kết quả.
 * Kiểm request (`preflight`), xếp kệ (`packShelves`), rồi dùng domain cho phần còn lại: thứ tự xếp/dỡ (LM-022),
 * `supportRatio`/`constraintWarnings` (engine LM-023), metrics (LM-021). Luôn `isMockResult: true`, `method: 'MOCK'`.
 *
 * Vùng theo điểm giao (FE-5b-02, D-79): thùng chia theo tỷ lệ thể tích của các kiện **còn xếp được** (đã qua kiểm request và dành
 * tải) của từng điểm. Khi `enforceLifo`, kiện xếp theo vùng, điểm cuối trước; không bật thì xếp theo thứ tự chọn như trước. Cả hai
 * trường hợp kết quả đều mang `stopZones`, `stopZoneId` của từng placement và `metrics.rehandlingCount`.
 */
export function runMockOptimization(request: OptimizationRequest, { clock = () => performance.now(), onProgress }: MockRunOptions = {}): OptimizationResult {
  const startedAt = clock()
  const seed = request.settings?.randomSeed ?? 0
  const jobId = `MOCK-${seed}-${fnv1a(JSON.stringify(request)).toString(16).padStart(8, '0')}`
  const checked = preflight(request)
  const weights = new Map(checked.instances.map((instance) => [instance.packageInstanceId, instance.weightKg]))

  if (!checked.ok) {
    const unplacedPackages = checked.instances.map(({ packageInstanceId }) => ({ packageInstanceId, reasonCode: 'UNKNOWN' as const, message: 'UNKNOWN' }))
    return {
      jobId,
      status: 'FAILED',
      method: 'MOCK',
      isMockResult: true,
      placements: [],
      unplacedPackages,
      metrics: failedMetrics(request, unplacedPackages.length, clock() - startedAt),
    }
  }

  const { vehicle, packages, settings } = request
  const chosen = selectionOrder(checked.instances, seed)
  const reasons = overPayload(chosen, checked.reasons, vehicle.maxPayloadKg)
  const zones = stopZones(vehicle, stopVolumes(chosen.filter(({ packageInstanceId }) => !reasons.has(packageInstanceId))))
  const packed = packShelves({
    vehicle,
    instances: settings.enforceLifo ? lifoOrder(chosen) : chosen,
    reasons,
    lowCenterOfGravity: settings.prioritizeLowCenterOfGravity,
    zones: settings.enforceLifo ? zones : undefined,
    onProgress,
  })
  const instances = new Map(checked.instances.map((instance) => [instance.packageInstanceId, instance]))
  const deliveryStops = new Map(checked.instances.map((instance) => [instance.packageInstanceId, instance.deliveryStop]))
  const graph = createStackGraph(createPlacementLayout(vehicle, packed.placements), instances)
  const { orders } = recomputeOrders(graph, deliveryStops)
  const ordered = packed.placements.map((placement): PackagePlacement => ({ ...placement, ...orders.get(placement.packageInstanceId) }))
  const zoned = zonePlacements(zones, annotatePlacements({ vehicle, packages, placements: ordered, settings }), deliveryStops)
  return {
    jobId,
    status: 'COMPLETED',
    method: 'MOCK',
    isMockResult: true,
    placements: zoned.placements,
    unplacedPackages: packed.unplaced,
    stopZones: zones,
    metrics: computeMetrics({
      vehicle,
      placements: zoned.placements,
      weightByInstanceId: weights,
      unplacedCount: packed.unplaced.length,
      runtimeMs: clock() - startedAt,
      rehandlingCount: zoned.rehandlingCount,
    }),
  }
}

/** Request sai thì có thể không tính được thể tích xe: metric về 0, chỉ giữ số kiện chưa xếp và thời gian chạy. */
function failedMetrics(request: OptimizationRequest, unplacedCount: number, runtimeMs: number): OptimizationResult['metrics'] {
  const { innerLengthCm = 0, innerWidthCm = 0, innerHeightCm = 0, maxPayloadKg = 0 } = request.vehicle ?? {}
  const volume = innerLengthCm * innerWidthCm * innerHeightCm
  return {
    totalVehicleVolumeCm3: Number.isFinite(volume) ? volume : 0,
    usedVolumeCm3: 0,
    volumeUtilizationPercent: 0,
    maxPayloadKg: Number.isFinite(maxPayloadKg) ? maxPayloadKg : 0,
    usedPayloadKg: 0,
    payloadUtilizationPercent: 0,
    placedCount: 0,
    unplacedCount,
    runtimeMs,
  }
}
