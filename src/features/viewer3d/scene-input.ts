import { expandPackages } from '@/domain/cargo'
import { orientDimensions, type OrientationCode, type PackageDimensions } from '@/domain/geometry'
import { locateInZones, zoneSharePercent, type StopZone } from '@/domain/zones'
import { currentNumbersOfPlan, hasInsertedStops, isStale, type DeliveryStop, type Revision, type RouteStopEta } from '@/lib/mock-db'
import type { ScenePlacement, SceneStop, SceneUnplaced, SceneZone, ViewerSceneModel } from './scene-types'

/** Kiểu của scene (cm) nằm ở `scene-types.ts`; nơi dùng vẫn import từ đây. */
export type { PositionCm, ScenePlacement, SceneStop, SceneUnplaced, SceneZone, ViewerSceneModel } from './scene-types'

/** Vùng nào, và có nằm ngoài vùng của điểm mình không, cho một kiện ở vị trí hiện tại (kể cả vị trí đang chỉnh tay). */
export function zoneFields(zones: readonly StopZone[], placement: Pick<ScenePlacement, 'position' | 'lengthCm' | 'stop'>): Pick<ScenePlacement, 'zoneId' | 'outOfZone'> {
  const { zoneId, rehandled } = locateInZones(zones, { xCm: placement.position.x, lengthCm: placement.lengthCm }, placement.stop)
  return { ...(zoneId === undefined ? {} : { zoneId }), outOfZone: rehandled }
}

/** Kích thước đã xoay của kiện theo tên trường scene; luôn áp lên kích thước danh nghĩa. */
export function orientedSize(base: PackageDimensions, orientation: OrientationCode): PackageDimensions {
  const { placedLengthCm, placedWidthCm, placedHeightCm } = orientDimensions(base, orientation)
  return { lengthCm: placedLengthCm, widthCm: placedWidthCm, heightCm: placedHeightCm }
}

function indexById<T extends { readonly id: string }>(items: readonly T[]): Map<string, T> {
  const byId = new Map<string, T>()
  for (const item of items) {
    if (byId.has(item.id)) throw new Error(`Mã kiện bị trùng trong phương án: ${item.id}`)
    byId.set(item.id, item)
  }
  return byId
}

/**
 * Revision của mock repository (LM-026) → scene cm. Kích thước, luật xoay, tên và điểm giao lấy từ kiện gốc của request. Phương án đánh số
 * điểm giao theo lúc duyệt; chuyến đã chèn điểm nhận dọc đường (FE-7-04) thì số điểm trong scene là số **hiện tại** của điểm
 * (`DeliveryStop.planNumber`), nên màn của tài xế và Planner đọc đúng kiện của từng điểm.
 */
export type ResultSceneSource = {
  readonly trip: {
    readonly id: string
    readonly stops: readonly (Pick<DeliveryStop, 'name'> & Partial<Pick<DeliveryStop, 'id' | 'deadline' | 'planNumber'>>)[]
    readonly inputVersion?: number
    /** Tuyến đã tối ưu của chuyến: giờ đến dự kiến và mức hạn từng điểm, cho hộp Chi tiết của Planner. */
    readonly routePlan?: { readonly stops: readonly RouteStopEta[] }
  }
  readonly revision: Pick<Revision, 'request' | 'result' | 'ordersRecomputed'> & Partial<Pick<Revision, 'id' | 'jobId' | 'inputVersion' | 'approvedAt' | 'manuallyEdited'>>
}

export function adaptResult({ trip, revision }: ResultSceneSource): ViewerSceneModel {
  const { request, result } = revision
  const { instances, packageIdByInstanceId } = expandPackages(request.packages)
  const instanceById = new Map(instances.map((instance) => [instance.packageInstanceId, instance]))
  const nameById = new Map(request.packages.map((pkg) => [pkg.id, pkg.name]))
  const instanceOf = (id: string) => {
    const instance = instanceById.get(id)
    if (instance === undefined) throw new Error(`Placement ${id} không thuộc kiện nào của request`)
    return instance
  }
  const stopZones = result.stopZones ?? []
  const currentNumbers = hasInsertedStops(trip.stops) ? currentNumbersOfPlan(trip.stops) : null
  const current = (planStop: number) => currentNumbers?.get(planStop) ?? planStop
  const zones = stopZones.map((zone): SceneZone => Object.freeze({
    ...zone,
    stopId: current(zone.stopId),
    name: trip.stops[current(zone.stopId) - 1]?.name ?? '',
    sharePercent: zoneSharePercent(stopZones, zone),
  }))
  const etaByStopId = new Map(trip.routePlan?.stops.map((stop) => [stop.stopId, stop]))
  const placements = result.placements.map((placement): ScenePlacement => {
    const instance = instanceOf(placement.packageInstanceId)
    const packageId = packageIdByInstanceId.get(placement.packageInstanceId) ?? ''
    const position = Object.freeze({ x: placement.xCm, y: placement.yCm, z: placement.zCm })
    return Object.freeze({
      id: placement.packageInstanceId,
      packageId,
      name: nameById.get(packageId) ?? packageId,
      stop: current(instance.deliveryStop),
      lengthCm: placement.placedLengthCm,
      widthCm: placement.placedWidthCm,
      heightCm: placement.placedHeightCm,
      weightKg: instance.weightKg,
      position,
      step: placement.loadingOrder,
      unloadingOrder: placement.unloadingOrder,
      orientation: placement.orientation,
      packaging: 'carton',
      fragilityLevel: instance.fragilityLevel,
      fragile: instance.fragilityLevel === 'HIGH',
      stackable: instance.stackable,
      pinned: false,
      supportRatio: placement.supportRatio,
      constraintWarnings: Object.freeze([...placement.constraintWarnings]),
      // Vùng của phương án đánh số theo lúc duyệt: so với số điểm trong phương án, không phải số điểm hiện tại
      ...zoneFields(stopZones, { position, lengthCm: placement.placedLengthCm, stop: instance.deliveryStop }),
    })
  })
  const unplaced = result.unplacedPackages.map((item): SceneUnplaced => {
    const instance = instanceOf(item.packageInstanceId)
    const packageId = packageIdByInstanceId.get(item.packageInstanceId) ?? ''
    return Object.freeze({
      id: item.packageInstanceId,
      packageId,
      name: nameById.get(packageId) ?? packageId,
      stop: current(instance.deliveryStop),
      lengthCm: instance.lengthCm,
      widthCm: instance.widthCm,
      heightCm: instance.heightCm,
      weightKg: instance.weightKg,
      reasonCode: item.reasonCode,
      message: item.message,
      ...(item.violatedConstraints === undefined ? {} : { violatedConstraints: Object.freeze([...item.violatedConstraints]) }),
    })
  })
  return Object.freeze({
    tripId: trip.id,
    vehicle: Object.freeze({ ...request.vehicle, obstacles: request.vehicle.obstacles.map((obstacle) => Object.freeze({ ...obstacle })) }),
    fillRate: result.metrics.volumeUtilizationPercent,
    stops: Object.freeze(trip.stops.map((stop, index): SceneStop => {
      const eta = stop.id === undefined ? undefined : etaByStopId.get(stop.id)
      return Object.freeze({
        number: index + 1,
        name: stop.name,
        packageCount: instances.filter(({ deliveryStop }) => current(deliveryStop) === index + 1).length,
        ...(stop.deadline === undefined ? {} : { deadline: stop.deadline }),
        ...(eta === undefined ? {} : { eta: eta.eta }),
        ...(eta?.deadlineStatus === undefined ? {} : { deadlineStatus: eta.deadlineStatus }),
      })
    })),
    zones: Object.freeze(zones),
    placements: Object.freeze(placements),
    unplaced: Object.freeze(unplaced),
    placementById: indexById(placements),
    baseDimensionsById: new Map(instances.map(({ packageInstanceId, lengthCm, widthCm, heightCm }) => [packageInstanceId, Object.freeze({ lengthCm, widthCm, heightCm })])),
    orientationRulesById: new Map(instances.map(({ packageInstanceId, allowedOrientations, keepUpright }) => [packageInstanceId, Object.freeze({ allowedOrientations, keepUpright })])),
    isMockResult: result.isMockResult,
    ordersRecomputed: revision.ordersRecomputed,
    engineInput: Object.freeze({
      vehicle: request.vehicle,
      packages: request.packages,
      placements: result.placements,
      settings: { enforceLifo: request.settings.enforceLifo },
    }),
    revision: revision.id === undefined || revision.jobId === undefined ? null : Object.freeze({
      id: revision.id,
      jobId: revision.jobId,
      method: result.method,
      approved: revision.approvedAt !== undefined,
      approvedAt: revision.approvedAt ?? null,
      manuallyEdited: revision.manuallyEdited ?? false,
      stale: trip.inputVersion !== undefined && revision.inputVersion !== undefined
        && isStale({ inputVersion: revision.inputVersion }, { inputVersion: trip.inputVersion }),
    }),
    metrics: result.metrics,
  })
}


