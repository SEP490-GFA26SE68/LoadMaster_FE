import type { PackageInstance } from '@/domain/cargo'
import { annotatePlacements, createPlacementLayout, createStackGraph, recomputeOrders } from '@/domain/constraints'
import { gt, roundKg } from '@/domain/geometry'
import { computeMetrics } from '@/domain/metrics'
import type { OptimizationRequest, OptimizationResult, PackagePlacement, UnplacedPackage } from '@/domain/models'
import { stopVolumes, stopZones, zonePlacements, type StopZone } from '@/domain/zones'
import { preflight } from './mock-preflight'
import type { Packed, PackInput } from './shelf-packer'

type ReasonCode = UnplacedPackage['reasonCode']

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
function overPayload(chosen: readonly PackageInstance[], known: ReadonlyMap<string, ReasonCode>, maxPayloadKg: number): Map<string, ReasonCode> {
  const reasons = new Map(known)
  let reservedKg = 0
  for (const { packageInstanceId, weightKg } of chosen) {
    if (reasons.has(packageInstanceId)) continue
    if (gt(reservedKg + weightKg, maxPayloadKg)) reasons.set(packageInstanceId, 'OVER_PAYLOAD')
    else reservedKg = roundKg(reservedKg + weightKg)
  }
  return reasons
}

/** Mã job của một request: tất định theo request + seed. */
export function mockJobId(request: OptimizationRequest): string {
  const seed = request.settings?.randomSeed ?? 0
  return `MOCK-${seed}-${fnv1a(JSON.stringify(request)).toString(16).padStart(8, '0')}`
}

/** Request đã qua kiểm, sẵn sàng đưa vào bộ xếp kệ. */
export type MockPlan = {
  readonly request: OptimizationRequest
  /** Mọi instance của request, theo mã. */
  readonly instances: ReadonlyMap<string, PackageInstance>
  /** Theo thứ tự chọn (D-23). */
  readonly chosen: readonly PackageInstance[]
  /** Theo thứ tự đặt chỗ khi `enforceLifo`: điểm giao muộn trước. */
  readonly lifo: readonly PackageInstance[]
  /** Lý do chưa xếp biết trước: kiểm request và dành tải. */
  readonly reasons: ReadonlyMap<string, ReasonCode>
  /** Vùng theo điểm giao, chia theo thể tích các kiện còn xếp được (D-79). */
  readonly zones: readonly StopZone[]
}

/** Kiểm request rồi dựng đầu vào của bộ xếp kệ; request không chạy được thì trả các instance để dựng kết quả `FAILED`. */
export function planMockRun(request: OptimizationRequest): { ok: true; plan: MockPlan } | { ok: false; instances: readonly PackageInstance[] } {
  const checked = preflight(request)
  if (!checked.ok) return { ok: false, instances: checked.instances }
  const chosen = selectionOrder(checked.instances, request.settings.randomSeed ?? 0)
  const reasons = overPayload(chosen, checked.reasons, request.vehicle.maxPayloadKg)
  return {
    ok: true,
    plan: {
      request,
      instances: new Map(checked.instances.map((instance) => [instance.packageInstanceId, instance])),
      chosen,
      lifo: lifoOrder(chosen),
      reasons,
      zones: stopZones(request.vehicle, stopVolumes(chosen.filter(({ packageInstanceId }) => !reasons.has(packageInstanceId)))),
    },
  }
}

/** Đầu vào chung của mọi lượt xếp trên một `MockPlan`; nơi gọi thêm thứ tự kiện, vùng và báo tiến độ. */
export function packInput(plan: MockPlan, instances: readonly PackageInstance[]): PackInput {
  const { vehicle, settings } = plan.request
  return { vehicle, instances, reasons: plan.reasons, lowCenterOfGravity: settings.prioritizeLowCenterOfGravity }
}

/** Số kiện nằm ngoài vùng của điểm giao mình trong một lượt xếp (`zonePlacements`). */
export function rehandlingOf(plan: MockPlan, packed: Packed): number {
  const deliveryStops = new Map([...plan.instances].map(([id, instance]) => [id, instance.deliveryStop]))
  return zonePlacements(plan.zones, packed.placements, deliveryStops).rehandlingCount
}

/**
 * Kết quả `COMPLETED` của một lượt xếp, phần còn lại do domain tính: thứ tự xếp/dỡ (LM-022), `supportRatio`/`constraintWarnings`
 * (engine LM-023), vùng của từng kiện và số lần dỡ-xếp lại (FE-5b-02), metrics (LM-021). Luôn `isMockResult: true`, `method: 'MOCK'`.
 * `runtimeMs` được gọi khi mọi thứ khác đã tính xong.
 */
export function completedResult(plan: MockPlan, packed: Packed, jobId: string, runtimeMs: () => number): OptimizationResult {
  const { vehicle, packages, settings } = plan.request
  const deliveryStops = new Map([...plan.instances].map(([id, instance]) => [id, instance.deliveryStop]))
  const graph = createStackGraph(createPlacementLayout(vehicle, packed.placements), plan.instances)
  const { orders } = recomputeOrders(graph, deliveryStops)
  const ordered = packed.placements.map((placement): PackagePlacement => ({ ...placement, ...orders.get(placement.packageInstanceId) }))
  const zoned = zonePlacements(plan.zones, annotatePlacements({ vehicle, packages, placements: ordered, settings }), deliveryStops)
  return {
    jobId,
    status: 'COMPLETED',
    method: 'MOCK',
    isMockResult: true,
    placements: zoned.placements,
    unplacedPackages: packed.unplaced,
    stopZones: [...plan.zones],
    metrics: computeMetrics({
      vehicle,
      placements: zoned.placements,
      weightByInstanceId: new Map([...plan.instances].map(([id, instance]) => [id, instance.weightKg])),
      unplacedCount: packed.unplaced.length,
      // Đọc đồng hồ sau cùng: thời gian chạy gồm cả phần domain tính ở trên
      runtimeMs: runtimeMs(),
      rehandlingCount: zoned.rehandlingCount,
    }),
  }
}

/**
 * Kết quả `FAILED` của request không chạy được. Request sai có thể không tính được thể tích xe: metric về 0, chỉ giữ số kiện chưa xếp
 * và thời gian chạy.
 */
export function failedResult(request: OptimizationRequest, instances: readonly PackageInstance[], jobId: string, runtimeMs: number): OptimizationResult {
  const { innerLengthCm = 0, innerWidthCm = 0, innerHeightCm = 0, maxPayloadKg = 0 } = request.vehicle ?? {}
  const volume = innerLengthCm * innerWidthCm * innerHeightCm
  return {
    jobId,
    status: 'FAILED',
    method: 'MOCK',
    isMockResult: true,
    placements: [],
    unplacedPackages: instances.map(({ packageInstanceId }) => ({ packageInstanceId, reasonCode: 'UNKNOWN' as const, message: 'UNKNOWN' })),
    metrics: {
      totalVehicleVolumeCm3: Number.isFinite(volume) ? volume : 0,
      usedVolumeCm3: 0,
      volumeUtilizationPercent: 0,
      maxPayloadKg: Number.isFinite(maxPayloadKg) ? maxPayloadKg : 0,
      usedPayloadKg: 0,
      payloadUtilizationPercent: 0,
      placedCount: 0,
      unplacedCount: instances.length,
      runtimeMs,
    },
  }
}
