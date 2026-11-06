import { roundKg, type OrientationCode, type PackageDimensions } from '@/domain/geometry'
import type { PackageInstance } from '@/domain/cargo'
import { deadlineStatus } from '@/domain/routing'
import { locateInZones, zoneSharePercent, type StopZone } from '@/domain/zones'
import { DEFAULT_MIN_SUPPORT_RATIO, type ConstraintEngineInput } from '@/domain/constraints'
import type { OptimizationResult, PackagePlacement, UnplacedPackage, VehicleConfig } from '@/domain/models'
import type { LoadPlan, LoadPlacement } from '@/features/optimization/load-plan-dto'
import { ApiError } from '@/lib/api-client'
import type { ScenePlacement, SceneStop, SceneUnplaced, SceneZone, ViewerSceneModel } from './scene-types'

/**
 * Phương án của máy chủ (`LoadPlanDetailResponse`, đã đổi ở `load-plan-dto.ts`) thành snapshot của engine 3D — hàm thuần. Cm giữ nguyên;
 * kết quả của máy chủ không mang MOCK RESULT. Đầu vào constraint engine dựng từ chính các kiện đã xếp (mỗi chỗ xếp một instance mang mã
 * của khung 3D, hướng đặt được phép theo `allowedRotations` của máy chủ, có thể xếp chồng, diện tích tựa tối thiểu mặc định) để Planner chỉnh tay và kiểm trước khi gửi
 * "Duyệt bản chỉnh" — máy chủ kiểm lại. Máy chủ không trả thứ tự dỡ (Planner dùng thứ tự gợi ý, có ghi rõ), độ dễ vỡ, bao bì; số máy chủ không trả thì vắng.
 * Vùng điểm giao có khi máy chủ trả `stopZones`: vùng của kiện và kiện nằm ngoài vùng tính bằng `locateInZones` của domain — cùng luật
 * tâm theo X với số dỡ-xếp lại của máy chủ —, nên dải vùng, nhãn "Ngoài vùng" và số dỡ-xếp lại theo được cả bản đang chỉnh tay.
 */

/** Điểm giao của chuyến theo máy chủ (`TripStopResponse`). */
export type BackendSceneStop = {
  readonly id: string
  readonly sequence: number
  readonly name: string
  /** ISO 8601. */
  readonly deadline: string | null
  /** Giờ đến dự kiến của tuyến máy chủ đã tối ưu (ISO 8601); `null` khi chưa tối ưu tuyến. */
  readonly plannedArrival?: string | null
}

/** `rotation_type` của dịch vụ tối ưu: bộ ba cạnh kiện dọc trục X, Y, Z của thùng. */
const ROTATIONS: Readonly<Record<number, OrientationCode>> = { 0: 'LWH', 1: 'WLH', 2: 'LHW', 3: 'WHL', 4: 'HLW', 5: 'HWL' }

const UNPLACED_REASONS: Readonly<Record<string, UnplacedPackage['reasonCode']>> = {
  OVER_WEIGHT: 'OVER_PAYLOAD',
  WEIGHT_LIMIT_EXCEEDED: 'OVER_PAYLOAD',
  OUT_OF_SPACE: 'NO_SPACE',
  VOLUME_EXCEEDED: 'NO_SPACE',
  DOES_NOT_FIT_DIMENSIONS: 'NO_ALLOWED_ORIENTATION',
  STACKING_CONFLICT: 'STACKING_VIOLATION',
  LIFO_BLOCK: 'LIFO_VIOLATION',
}

export function orientationOf(rotationType: number | null): OrientationCode {
  return rotationType === null ? 'LWH' : ROTATIONS[rotationType] ?? 'LWH'
}

/** Chiều ngược của `orientationOf`: mã `rotation_type` của dịch vụ tối ưu. */
export function rotationTypeOf(code: OrientationCode): number {
  return Number(Object.entries(ROTATIONS).find(([, value]) => value === code)?.[0] ?? 0)
}

/** Chiều ngược của `orientDimensions`: kích thước danh nghĩa từ kích thước đã xoay. */
export function baseDimensionsOf(placed: { lengthCm: number; widthCm: number; heightCm: number }, code: OrientationCode): PackageDimensions {
  const { lengthCm: x, widthCm: y, heightCm: z } = placed
  switch (code) {
    case 'LWH': return { lengthCm: x, widthCm: y, heightCm: z }
    case 'LHW': return { lengthCm: x, widthCm: z, heightCm: y }
    case 'WLH': return { lengthCm: y, widthCm: x, heightCm: z }
    case 'WHL': return { lengthCm: z, widthCm: x, heightCm: y }
    case 'HLW': return { lengthCm: y, widthCm: z, heightCm: x }
    case 'HWL': return { lengthCm: z, widthCm: y, heightCm: x }
  }
}

function stopNumberOf(placement: LoadPlacement, sequenceById: ReadonlyMap<string, number>): number {
  const number = placement.stopSequence ?? (placement.stopId === null ? undefined : sequenceById.get(placement.stopId))
  if (number === undefined || number < 1) throw new ApiError('SERVER_ERROR')
  return number
}

/**
 * Vùng của máy chủ thành vùng của scene (số điểm giao theo thứ tự của chuyến). Vùng không gắn được với điểm giao nào thì không có
 * vùng nào: không vẽ nửa bộ.
 */
function zonesOf(plan: LoadPlan, sequenceById: ReadonlyMap<string, number>, nameByNumber: ReadonlyMap<number, string>): SceneZone[] {
  if (plan.stopZones === null) return []
  const zones: StopZone[] = []
  for (const zone of plan.stopZones) {
    const number = zone.stopSequence ?? (zone.stopId === null ? undefined : sequenceById.get(zone.stopId))
    if (number === undefined || number < 1) return []
    zones.push({ id: zone.id, stopId: number, startXCm: zone.startXCm, endXCm: zone.endXCm })
  }
  return zones.map((zone) => Object.freeze({
    ...zone, name: nameByNumber.get(zone.stopId) ?? '', sharePercent: zoneSharePercent(zones, zone),
  }))
}

/** Vùng chứa tâm kiện theo X và kiện có nằm ngoài vùng của điểm mình không (như `zoneFields` của phương án mock). */
function zoneOf(zones: readonly StopZone[], item: LoadPlacement, stop: number): Pick<ScenePlacement, 'zoneId' | 'outOfZone'> {
  const { zoneId, rehandled } = locateInZones(zones, { xCm: item.x, lengthCm: item.lengthCm }, stop)
  return { ...(zoneId === undefined ? {} : { zoneId }), outOfZone: rehandled }
}

const volumeOf = (item: { lengthCm: number; widthCm: number; heightCm: number }) => item.lengthCm * item.widthCm * item.heightCm

/**
 * Chỉ số của phương án: phần trăm của máy chủ (không có thì tính từ chính các kiện đã xếp và xe); trọng tâm, tải trục, số lần dỡ-xếp lại
 * chỉ khi máy chủ trả. Thời gian chạy vắng thì `NaN` — bảng chỉ số bỏ dòng đó.
 */
function metricsOf(plan: LoadPlan, vehicle: VehicleConfig): OptimizationResult['metrics'] {
  const totalVehicleVolumeCm3 = volumeOf({ lengthCm: vehicle.innerLengthCm, widthCm: vehicle.innerWidthCm, heightCm: vehicle.innerHeightCm })
  const usedVolumeCm3 = plan.placements.reduce((sum, item) => sum + volumeOf(item), 0)
  const usedPayloadKg = roundKg(plan.placements.reduce((sum, item) => sum + item.weightKg, 0))
  const ratio = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0)
  return {
    totalVehicleVolumeCm3,
    usedVolumeCm3,
    volumeUtilizationPercent: plan.volumePercent ?? ratio(usedVolumeCm3, totalVehicleVolumeCm3),
    maxPayloadKg: vehicle.maxPayloadKg,
    usedPayloadKg,
    payloadUtilizationPercent: plan.payloadPercent ?? ratio(usedPayloadKg, vehicle.maxPayloadKg),
    placedCount: plan.placements.length,
    unplacedCount: plan.unplaced.length,
    runtimeMs: plan.computationMs ?? Number.NaN,
    ...(plan.centerOfGravityCm === null ? {} : { centerOfGravityCm: plan.centerOfGravityCm }),
    ...(plan.frontAxleLoadKg === null ? {} : { frontAxleLoadKg: plan.frontAxleLoadKg }),
    ...(plan.rearAxleLoadKg === null ? {} : { rearAxleLoadKg: plan.rearAxleLoadKg }),
    ...(plan.rehandlingCount === null ? {} : { rehandlingCount: plan.rehandlingCount }),
  }
}

/**
 * Mã của từng placement trên khung 3D theo thứ tự `plan.placements`: nhãn kiện đọc mã của placement, nên dùng mã kiện khi nó duy nhất
 * trong phương án, không thì mã placement của máy chủ.
 */
function sceneIdsOf(plan: LoadPlan): string[] {
  const codeCount = new Map<string, number>()
  for (const item of plan.placements) codeCount.set(item.code, (codeCount.get(item.code) ?? 0) + 1)
  return plan.placements.map((item) => (item.code !== '' && codeCount.get(item.code) === 1 ? item.code : item.id))
}

/** Mã trên khung 3D → mã số placement của máy chủ (để ghim / bỏ ghim kiện đang chọn). */
export function backendPlacementIds(plan: LoadPlan): ReadonlyMap<string, string> {
  const sceneIds = sceneIdsOf(plan)
  return new Map(plan.placements.map((item, index) => [sceneIds[index] ?? item.id, item.id]))
}

/**
 * Hướng đặt kiện được nhận khi chỉnh tay: các mã `allowedRotations` máy chủ trả (theo loại kiện), luôn gồm hướng đang xếp; máy chủ không
 * trả thì chỉ hướng đang xếp. Theo thứ tự mã của dịch vụ tối ưu.
 */
function allowedOrientationsOf(item: LoadPlacement, current: OrientationCode): OrientationCode[] {
  const codes = new Set([...(item.allowedRotations ?? []).map(orientationOf), current])
  return Object.values(ROTATIONS).filter((code) => codes.has(code))
}

/**
 * Mỗi chỗ xếp của máy chủ một instance: máy chủ không trả luật xếp chồng của kiện, nên engine kiểm hình học và hướng đặt được phép.
 */
function engineInputOf(placements: readonly ScenePlacement[], vehicle: VehicleConfig,
  allowedById: ReadonlyMap<string, readonly OrientationCode[]>): ConstraintEngineInput {
  const instances = placements.map((item): PackageInstance => {
    const base = baseDimensionsOf(item, item.orientation)
    return {
      packageInstanceId: item.id,
      ...base,
      weightKg: item.weightKg,
      allowedOrientations: [...(allowedById.get(item.id) ?? [item.orientation])],
      keepUpright: false,
      fragilityLevel: 'NONE',
      stackable: true,
      maxTopLoadKg: Number.MAX_SAFE_INTEGER,
      minSupportRatio: DEFAULT_MIN_SUPPORT_RATIO,
      deliveryStop: item.stop,
      priority: 0,
      mustLoad: false,
    }
  })
  const enginePlacements = placements.map((item): PackagePlacement => ({
    packageInstanceId: item.id,
    orientation: item.orientation,
    xCm: item.position.x,
    yCm: item.position.y,
    zCm: item.position.z,
    placedLengthCm: item.lengthCm,
    placedWidthCm: item.widthCm,
    placedHeightCm: item.heightCm,
    loadingOrder: item.step,
    unloadingOrder: 0,
    supportRatio: 1,
    constraintWarnings: [],
  }))
  return Object.freeze({ vehicle, packages: [], instances, placements: enginePlacements, settings: { enforceLifo: false } })
}

export function backendPlanScene({ tripCode, plan, vehicle, stops }: {
  /** Mã chuyến trên URL. */
  tripCode: string
  plan: LoadPlan
  vehicle: VehicleConfig
  stops: readonly BackendSceneStop[]
}): ViewerSceneModel {
  const ordered = [...stops].sort((a, b) => a.sequence - b.sequence)
  const sequenceById = new Map(ordered.map((stop) => [stop.id, stop.sequence]))
  const sceneIds = sceneIdsOf(plan)
  const zones = zonesOf(plan, sequenceById, new Map(ordered.map((stop) => [stop.sequence, stop.name])))
  const allowedById = new Map(plan.placements.map((item, index) =>
    [sceneIds[index] ?? item.id, Object.freeze(allowedOrientationsOf(item, orientationOf(item.rotationType)))] as const))
  const placements = plan.placements.map((item, index): ScenePlacement => {
    const orientation = orientationOf(item.rotationType)
    const stop = stopNumberOf(item, sequenceById)
    const position = Object.freeze({ x: item.x, y: item.y, z: item.z })
    return Object.freeze({
      id: sceneIds[index] ?? item.id,
      packageId: item.packageId,
      name: item.code,
      stop,
      lengthCm: item.lengthCm,
      widthCm: item.widthCm,
      heightCm: item.heightCm,
      weightKg: item.weightKg,
      position,
      step: item.step,
      unloadingOrder: 0,
      orientation,
      packaging: 'carton',
      fragilityLevel: 'NONE',
      fragile: false,
      stackable: true,
      pinned: item.pinned,
      supportRatio: 1,
      constraintWarnings: Object.freeze([]),
      ...zoneOf(zones, item, stop),
    })
  })
  const unplaced = plan.unplaced.map((item): SceneUnplaced => Object.freeze({
    id: `unplaced-${item.packageId}`,
    packageId: item.packageId,
    name: item.code,
    stop: 0,
    lengthCm: item.size?.lengthCm ?? 0,
    widthCm: item.size?.widthCm ?? 0,
    heightCm: item.size?.heightCm ?? 0,
    weightKg: item.weightKg ?? 0,
    reasonCode: (item.reason === null ? undefined : UNPLACED_REASONS[item.reason]) ?? 'UNKNOWN',
    ...(item.size === null || item.weightKg === null ? { detailUnknown: true } : {}),
  }))
  const metrics = metricsOf(plan, vehicle)
  return Object.freeze({
    tripId: tripCode,
    vehicle,
    fillRate: metrics.volumeUtilizationPercent,
    stops: Object.freeze(ordered.map((stop): SceneStop => Object.freeze({
      number: stop.sequence,
      name: stop.name,
      packageCount: placements.filter((item) => item.stop === stop.sequence).length,
      ...(stop.deadline === null ? {} : { deadline: stop.deadline }),
      ...(stop.plannedArrival ? { eta: stop.plannedArrival } : {}),
      ...(stop.plannedArrival && stop.deadline ? { deadlineStatus: deadlineStatus(stop.plannedArrival, stop.deadline) } : {}),
    }))),
    zones: Object.freeze(zones),
    placements: Object.freeze(placements),
    unplaced: Object.freeze(unplaced),
    placementById: new Map(placements.map((item) => [item.id, item])),
    baseDimensionsById: new Map(placements.map((item) => [item.id, Object.freeze(baseDimensionsOf(item, item.orientation))])),
    orientationRulesById: new Map(placements.map((item) => [item.id, Object.freeze({
      allowedOrientations: allowedById.get(item.id) ?? [item.orientation], keepUpright: false,
    })])),
    isMockResult: false,
    ordersRecomputed: false,
    engineInput: engineInputOf(placements, vehicle, allowedById),
    metrics,
    revision: Object.freeze({
      id: plan.id,
      jobId: plan.jobId ?? plan.id,
      method: plan.algorithmName ?? '',
      approved: plan.approved,
      approvedAt: null,
      manuallyEdited: plan.manuallyEdited,
      stale: plan.stale,
    }),
  })
}

