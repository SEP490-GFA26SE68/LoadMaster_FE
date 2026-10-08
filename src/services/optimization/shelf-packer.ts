import type { PackageInstance } from '@/domain/cargo'
import { effectiveOrientations, gt, lt, orientDimensions, roundCm } from '@/domain/geometry'
import type { PackagePlacement, UnplacedPackage, VehicleConfig } from '@/domain/models'
import type { StopZone } from '@/domain/zones'
import type { OptimizationProgress } from './OptimizationService'
import { createShelves, type Lane, type Orientation, type Rejection } from './shelf-walls'

type ReasonCode = UnplacedPackage['reasonCode']
/**
 * Dải của một vùng: bắt đầu ở `startXCm`; kiện của chính vùng không vượt `endXCm`; kiện của điểm kế bên xếp nhờ vào đuôi dải được tới
 * `tailXCm` (đầu dải kế phía cửa).
 */
type LaneSpec = { readonly stopId: number; readonly startXCm: number; readonly endXCm: number; readonly tailXCm: number }
type ZoneLane = Lane & LaneSpec & { carried: boolean }
type Pending = { readonly instance: PackageInstance; readonly orientations: readonly Orientation[]; readonly stackingRejected: boolean }

export type PackInput = {
  readonly vehicle: VehicleConfig
  /** Theo thứ tự xếp. */
  readonly instances: readonly PackageInstance[]
  readonly reasons: ReadonlyMap<string, ReasonCode>
  /** `settings.prioritizeLowCenterOfGravity`: mở cột mới trên sàn trước khi xếp chồng. */
  readonly lowCenterOfGravity: boolean
  /**
   * Vùng theo điểm giao (`stopZones`, theo thứ tự giao — FE-5b-02). Có thì xếp theo vùng, điểm cuối trước; vắng hoặc rỗng thì xếp
   * một dải suốt chiều dài thùng theo đúng thứ tự `instances`.
   */
  readonly zones?: readonly StopZone[]
  readonly onProgress?: (progress: OptimizationProgress) => void
}

export type Packed = { readonly placements: PackagePlacement[]; readonly unplaced: UnplacedPackage[] }

function noSpace(stackingRejected: boolean): Rejection {
  return { reasonCode: stackingRejected ? 'STACKING_VIOLATION' : 'NO_SPACE' }
}

/** Các hướng đặt của kiện đưa được qua cửa. */
export function doorOrientations(vehicle: VehicleConfig, instance: PackageInstance): Orientation[] {
  return effectiveOrientations(instance)
    .map((code) => ({ code, dims: orientDimensions(instance, code) }))
    .filter(({ dims }) => !gt(dims.placedWidthCm + vehicle.clearanceCm, vehicle.doorWidthCm) && !gt(dims.placedHeightCm + vehicle.clearanceCm, vehicle.doorHeightCm))
}

function byStop(instances: readonly PackageInstance[]): Map<number, PackageInstance[]> {
  const groups = new Map<number, PackageInstance[]>()
  for (const instance of instances) {
    const group = groups.get(instance.deliveryStop)
    if (group === undefined) groups.set(instance.deliveryStop, [instance])
    else group.push(instance)
  }
  return groups
}

/** Một lượt xếp trên thùng trống: ghi lý do của kiện ở lại, báo tiến độ nếu có `onProgress`. */
function createRun({ vehicle, instances, reasons, lowCenterOfGravity }: PackInput, onProgress?: PackInput['onProgress']) {
  const shelves = createShelves(vehicle, lowCenterOfGravity)
  const rejections = new Map<string, Rejection>()
  let settled = 0
  return {
    shelves,
    /** Lý do biết trước (kiểm request, vượt tải), hoặc các hướng đặt qua được cửa. */
    prepare(instance: PackageInstance): { rejection: Rejection } | { orientations: Orientation[] } {
      const known = reasons.get(instance.packageInstanceId)
      if (known !== undefined) return { rejection: { reasonCode: known } }
      if (gt(shelves.usedKg() + instance.weightKg, vehicle.maxPayloadKg)) return { rejection: { reasonCode: 'OVER_PAYLOAD' } }
      return { orientations: doorOrientations(vehicle, instance) }
    },
    /** Chốt một kiện: đã xếp (không có `rejection`) hoặc ở lại với lý do. */
    settle(instance: PackageInstance, rejection?: Rejection): void {
      if (rejection !== undefined) rejections.set(instance.packageInstanceId, rejection)
      settled += 1
      if (settled % 25 === 0 || settled === instances.length) onProgress?.({ placed: settled, total: instances.length })
    },
    /** Còn kiện ở lại vì hết chỗ (không phải vì lý do biết trước hay ràng buộc). */
    outOfSpace: () => [...rejections.values()].some(({ reasonCode }) => reasonCode === 'NO_SPACE' || reasonCode === 'STACKING_VIOLATION'),
    /** `unplaced` giữ thứ tự của `instances`. */
    result(): Packed {
      const unplaced = instances.flatMap((instance): UnplacedPackage[] => {
        const rejection = rejections.get(instance.packageInstanceId)
        return rejection === undefined ? [] : [{ packageInstanceId: instance.packageInstanceId, message: rejection.reasonCode, ...rejection }]
      })
      return { placements: shelves.placements, unplaced }
    },
  }
}
type Run = ReturnType<typeof createRun>

/** Một dải liền từ `startXCm` tới cửa, kiện theo đúng thứ tự `instances`. */
function packWhole(input: PackInput, startXCm = 0): Run {
  const run = createRun(input, input.onProgress)
  const lane = run.shelves.lane(startXCm)
  for (const instance of input.instances) {
    const prepared = run.prepare(instance)
    if ('rejection' in prepared) {
      run.settle(instance, prepared.rejection)
      continue
    }
    const outcome = run.shelves.attempt(lane, input.vehicle.innerLengthCm, instance, prepared.orientations)
    run.settle(instance, outcome.placed ? undefined : (outcome.rejection ?? noSpace(outcome.stackingRejected)))
  }
  return run
}

/**
 * Xếp theo dải, từ dải sâu nhất ra cửa (`specs` theo thứ tự giao: dải đầu sát cửa). Kiện không vừa dải của mình được xếp chỗ khác mà
 * vẫn giữ thứ tự dỡ — không bao giờ nằm sau lưng hàng giao muộn hơn:
 * 1. nhờ vào phần đuôi còn trống của dải sâu hơn liền kề (kể cả khoảng đệm), khi dải của mình chưa nhận kiện tràn nào;
 * 2. không được thì tràn sang đầu dải kế phía cửa, xếp trước hàng của dải đó; ở đó cũng không vừa (hoặc đã là dải sát cửa) thì ở
 *    lại với lý do `NO_SPACE` / `STACKING_VIOLATION`.
 */
function packLanes(input: PackInput, specs: readonly LaneSpec[], onProgress?: PackInput['onProgress']): Run {
  const run = createRun(input, onProgress)
  const lanes = specs.map((spec): ZoneLane => ({ ...run.shelves.lane(spec.startXCm), ...spec, carried: false }))
  const groups = byStop(input.instances)
  let overflow: Pending[] = []
  for (let index = lanes.length - 1; index >= 0; index -= 1) {
    const lane = lanes[index] as ZoneLane
    const deeper = lanes[index + 1]
    const incoming = overflow
    overflow = []
    for (const { instance, orientations, stackingRejected } of incoming) {
      const outcome = run.shelves.attempt(lane, lane.endXCm, instance, orientations)
      lane.carried ||= outcome.placed
      run.settle(instance, outcome.placed ? undefined : (outcome.rejection ?? noSpace(stackingRejected || outcome.stackingRejected)))
    }
    for (const instance of groups.get(lane.stopId) ?? []) {
      const prepared = run.prepare(instance)
      if ('rejection' in prepared) {
        run.settle(instance, prepared.rejection)
        continue
      }
      let outcome = run.shelves.attempt(lane, lane.endXCm, instance, prepared.orientations)
      let stackingRejected = outcome.stackingRejected
      if (!outcome.placed && outcome.rejection === undefined && deeper !== undefined && !lane.carried) {
        outcome = run.shelves.attempt(deeper, deeper.tailXCm, instance, prepared.orientations)
        stackingRejected ||= outcome.stackingRejected
      }
      if (outcome.placed || outcome.rejection !== undefined) run.settle(instance, outcome.rejection)
      else if (index > 0) overflow.push({ instance, orientations: prepared.orientations, stackingRejected })
      else run.settle(instance, noSpace(stackingRejected))
    }
    groups.delete(lane.stopId)
  }
  // Điểm giao không có vùng: nơi gọi chỉ chia vùng cho điểm còn kiện xếp được, nên ở đây chỉ còn kiện đã có lý do
  for (const instance of [...groups.values()].flat()) {
    const prepared = run.prepare(instance)
    run.settle(instance, 'rejection' in prepared ? prepared.rejection : noSpace(false))
  }
  return run
}

/**
 * Dải của từng vùng khi dải i bắt đầu ở `starts[i]`. `withinZone`: hàng của vùng dừng ở mép vùng (lượt xếp theo đúng vùng); không thì
 * được xếp tới đầu dải kế phía cửa (lượt đã lùi dải — chỗ của từng dải đã chia theo chiều dài nó cần).
 */
function laneSpecs(zones: readonly StopZone[], starts: readonly number[], innerLengthCm: number, withinZone: boolean): LaneSpec[] {
  return zones.map((zone, index) => {
    // Dải dồn sát có thể bị đẩy quá cửa khi hàng không vừa thùng: không dải nào được vượt chiều dài thùng
    const tailXCm = index === 0 ? innerLengthCm : Math.min(innerLengthCm, starts[index - 1] as number)
    return { stopId: zone.stopId, startXCm: starts[index] as number, endXCm: withinZone ? zone.endXCm : tailXCm, tailXCm }
  })
}

/** Các kiện còn xếp được (chưa có lý do biết trước), gom theo điểm giao. */
function packable({ instances, reasons }: PackInput): Map<number, PackageInstance[]> {
  return byStop(instances.filter(({ packageInstanceId }) => !reasons.has(packageInstanceId)))
}

/**
 * Chiều dài thùng mà hàng của từng vùng cần khi xếp riêng từ đầu vùng của nó (đo trên thùng trống), không quá chiều dài thùng — một
 * điểm giao không dùng được nhiều hơn cả thùng.
 */
function neededDepths(input: PackInput, zones: readonly StopZone[]): number[] {
  const { vehicle, lowCenterOfGravity } = input
  const groups = packable(input)
  return zones.map((zone) => {
    const shelves = createShelves(vehicle, lowCenterOfGravity)
    const lane = shelves.lane(zone.startXCm)
    const limitXCm = zone.startXCm + vehicle.innerLengthCm
    for (const instance of groups.get(zone.stopId) ?? []) shelves.attempt(lane, limitXCm, instance, doorOrientations(vehicle, instance))
    return lane.wall.xCm + lane.wall.depthCm - zone.startXCm
  })
}

/**
 * Điểm bắt đầu của từng dải khi có vùng không đủ chỗ cho hàng của mình: tính từ cửa vào, dải nào cần dài hơn vùng thì lùi đầu dải về
 * phía vách trong đúng phần thiếu, dải sâu hơn nhường chỗ theo. Lùi quá vách trong thì dồn sát từ vách trong ra.
 */
function pulledBackStarts(zones: readonly StopZone[], depths: readonly number[], innerLengthCm: number): number[] {
  const starts: number[] = []
  let nextStartXCm = innerLengthCm
  zones.forEach((zone, index) => {
    nextStartXCm = Math.min(zone.startXCm, Math.min(zone.endXCm, nextStartXCm) - (depths[index] as number))
    starts.push(nextStartXCm)
  })
  if (lt(nextStartXCm, 0)) {
    starts[starts.length - 1] = 0
    for (let index = starts.length - 2; index >= 0; index -= 1) {
      starts[index] = Math.max(starts[index] as number, (starts[index + 1] as number) + (depths[index + 1] as number))
    }
  }
  return starts.map(roundCm)
}

/** Thể tích các kiện còn xếp được lớn hơn cả lòng thùng: không cách xếp nào đưa hết lên xe. */
function exceedsVehicleVolume(input: PackInput): boolean {
  const { innerLengthCm, innerWidthCm, innerHeightCm } = input.vehicle
  let volumeCm3 = 0
  for (const group of packable(input).values()) for (const { lengthCm, widthCm, heightCm } of group) volumeCm3 += lengthCm * widthCm * heightCm
  return gt(volumeCm3, innerLengthCm * innerWidthCm * innerHeightCm)
}

/** Xếp một dải liền bắt đầu ở `startXCm` (mặc định sát vách trong), không chia vùng — lượt dồn sát của các phương án ứng viên. */
export function packWholeLane(input: PackInput, startXCm = 0): Packed {
  return packWhole(input, startXCm).result()
}

/**
 * Xếp kệ tất định cho mock (cơ chế vách / cột / chồng ở `createShelves`), không vượt tải trọng xe.
 *
 * Xếp theo vùng (FE-5b-02, D-79): mỗi vùng là một dải riêng bắt đầu ở mép sâu của vùng, xếp từ vùng sâu nhất (điểm giao cuối) ra
 * cửa (`packLanes`). Vùng chia theo thể tích nên có điểm giao cần nhiều sàn hơn vùng của nó; khi lượt đầu còn kiện ở lại vì hết chỗ,
 * mock thử lại trên thùng trống và lấy lượt xếp được nhiều kiện nhất (hoà thì giữ lượt bám vùng hơn):
 * 1. đo chiều dài từng điểm cần rồi lùi các dải về phía vách trong vừa đủ (`neededDepths`, `pulledBackStarts`) — bỏ qua khi thể tích
 *    hàng đã lớn hơn lòng thùng, vì khi đó lùi dải cũng không xếp hết được;
 * 2. vẫn còn kiện ở lại thì xếp một dải liền suốt thùng theo thứ tự `instances` như khi chưa có vùng — nên mock không bao giờ xếp
 *    được ít kiện hơn trước khi có vùng.
 * Kiện nằm ngoài vùng của điểm mình được đếm là dỡ-xếp lại ở `zonePlacements`. Chỉ lượt đầu báo tiến độ.
 */
export function packShelves(input: PackInput): Packed {
  const { zones = [], vehicle } = input
  if (zones.length === 0) return packWhole(input).result()
  const runs = [packLanes(input, laneSpecs(zones, zones.map(({ startXCm }) => startXCm), vehicle.innerLengthCm, true), input.onProgress)]
  if (runs[0]?.outOfSpace()) {
    if (!exceedsVehicleVolume(input)) {
      runs.push(packLanes(input, laneSpecs(zones, pulledBackStarts(zones, neededDepths(input, zones), vehicle.innerLengthCm), vehicle.innerLengthCm, false)))
    }
    if (runs.at(-1)?.outOfSpace()) runs.push(packWhole({ ...input, onProgress: undefined }))
  }
  // `reduce` giữ lượt đứng trước khi hoà
  return runs.reduce((best, run) => (run.shelves.placements.length > best.shelves.placements.length ? run : best)).result()
}
