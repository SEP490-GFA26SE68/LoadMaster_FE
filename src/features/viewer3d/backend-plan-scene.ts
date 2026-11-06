import { roundKg, type OrientationCode, type PackageDimensions } from '@/domain/geometry'
import type { OptimizationResult, UnplacedPackage, VehicleConfig } from '@/domain/models'
import type { LoadPlan, LoadPlacement } from '@/features/optimization/load-plan-dto'
import { ApiError } from '@/lib/api-client'
import type { ScenePlacement, SceneStop, SceneUnplaced, ViewerSceneModel } from './scene-types'

/**
 * Phương án của máy chủ (`LoadPlanDetailResponse`, đã đổi ở `load-plan-dto.ts`) thành snapshot của engine 3D — hàm thuần. Cm giữ nguyên;
 * kết quả của máy chủ không mang MOCK RESULT. Chỉ xem: không có đầu vào constraint engine nên Planner không chỉnh tay, không Duyệt bản
 * chỉnh. Máy chủ không trả thứ tự dỡ (Planner dùng thứ tự gợi ý, có ghi rõ), độ dễ vỡ, bao bì, vùng điểm giao; số máy chủ không trả thì vắng.
 */

/** Điểm giao của chuyến theo máy chủ (`TripStopResponse`). */
export type BackendSceneStop = {
  readonly id: string
  readonly sequence: number
  readonly name: string
  /** ISO 8601. */
  readonly deadline: string | null
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

export function backendPlanScene({ tripCode, plan, vehicle, stops }: {
  /** Mã chuyến trên URL. */
  tripCode: string
  plan: LoadPlan
  vehicle: VehicleConfig
  stops: readonly BackendSceneStop[]
}): ViewerSceneModel {
  const ordered = [...stops].sort((a, b) => a.sequence - b.sequence)
  const sequenceById = new Map(ordered.map((stop) => [stop.id, stop.sequence]))
  // Nhãn kiện trên khung 3D đọc mã của placement: dùng mã kiện khi nó duy nhất trong phương án, không thì mã placement của máy chủ.
  const codeCount = new Map<string, number>()
  for (const item of plan.placements) codeCount.set(item.code, (codeCount.get(item.code) ?? 0) + 1)
  const sceneIdOf = (item: (typeof plan.placements)[number]) => (item.code !== '' && codeCount.get(item.code) === 1 ? item.code : item.id)
  const placements = plan.placements.map((item): ScenePlacement => {
    const orientation = orientationOf(item.rotationType)
    return Object.freeze({
      id: sceneIdOf(item),
      packageId: item.packageId,
      name: item.code,
      stop: stopNumberOf(item, sequenceById),
      lengthCm: item.lengthCm,
      widthCm: item.widthCm,
      heightCm: item.heightCm,
      weightKg: item.weightKg,
      position: Object.freeze({ x: item.x, y: item.y, z: item.z }),
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
      outOfZone: false,
    })
  })
  const unplaced = plan.unplaced.map((item): SceneUnplaced => Object.freeze({
    id: `unplaced-${item.packageId}`,
    packageId: item.packageId,
    name: item.code,
    stop: 0,
    lengthCm: 0,
    widthCm: 0,
    heightCm: 0,
    weightKg: 0,
    reasonCode: (item.reason === null ? undefined : UNPLACED_REASONS[item.reason]) ?? 'UNKNOWN',
    detailUnknown: true,
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
    }))),
    zones: Object.freeze([]),
    placements: Object.freeze(placements),
    unplaced: Object.freeze(unplaced),
    placementById: new Map(placements.map((item) => [item.id, item])),
    baseDimensionsById: new Map(placements.map((item) => [item.id, Object.freeze(baseDimensionsOf(item, item.orientation))])),
    orientationRulesById: new Map(placements.map((item) => [item.id, Object.freeze({ allowedOrientations: [item.orientation], keepUpright: false })])),
    isMockResult: false,
    ordersRecomputed: false,
    engineInput: null,
    metrics,
    revision: Object.freeze({
      id: plan.id,
      jobId: plan.jobId ?? plan.id,
      method: plan.algorithmName ?? '',
      approved: plan.approved,
      approvedAt: null,
      manuallyEdited: false,
      stale: false,
    }),
  })
}

