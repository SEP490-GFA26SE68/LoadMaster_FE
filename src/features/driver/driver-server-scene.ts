import type { VehicleConfig } from '@/domain/models'
import type { LoadPlan } from '@/features/optimization/load-plans-backend-api'
import { backendPlacementIds, backendPlanScene, type BackendSceneStop } from '@/features/viewer3d/backend-plan-scene'
import type { ScenePlacement, ViewerSceneModel } from '@/features/viewer3d/scene-types'

/** Một kiện kho đã xếp lên xe theo máy chủ (cm, đã áp hướng đặt; vị trí là chỗ thật nếu kho ghi sai lệch). */
export type LoadedPlacement = {
  readonly id: string
  readonly packageId: string
  readonly code: string
  readonly weightKg: number
  readonly x: number
  readonly y: number
  readonly z: number
  readonly lengthCm: number
  readonly widthCm: number
  readonly heightCm: number
  readonly rotation: number | null
  readonly step: number
  /** Thứ tự dỡ cả chuyến của máy chủ: điểm giao trước dỡ trước, trong một điểm kiện xếp sau ra trước. */
  readonly unloadOrder: number
  readonly stopSequence: number | null
  readonly unloaded: boolean
}

/** Phương án kho đã xếp của chuyến tài xế: lòng thùng, cửa, kiện đang trên xe (`GET /api/driver/trips/{id}/load-plan`). */
export type DriverLoadedPlan = {
  readonly tripId: string
  readonly tripCode: string
  readonly planId: string
  readonly vehicleName: string
  readonly box: {
    readonly innerLengthCm: number
    readonly innerWidthCm: number
    readonly innerHeightCm: number
    readonly doorWidthCm: number
    readonly doorHeightCm: number
  } | null
  readonly maxPayloadKg: number | null
  readonly stops: readonly { readonly sequence: number; readonly name: string }[]
  readonly placements: readonly LoadedPlacement[]
}

export type DriverServerScene = {
  readonly model: ViewerSceneModel
  /** Kiện không còn trên xe (đã dỡ ở các điểm trước hoặc điểm này), theo mã trên khung 3D. */
  readonly doneIds: ReadonlySet<string>
}

/**
 * Hàm thuần: phương án kho đã xếp thành snapshot cho khung 3D "Xem vị trí hàng" của tài xế, như khung của kho (`serverSessionScene`) —
 * cùng `backendPlanScene`, không MOCK RESULT. Thứ tự dỡ là của máy chủ (không phải thứ tự "gợi ý" khung tự suy). `null` khi không vẽ đúng
 * được: máy chủ không trả lòng thùng, không còn kiện nào trên xe, hoặc có kiện không mang số điểm giao (màu kiện theo điểm giao).
 */
export function driverServerScene(plan: DriverLoadedPlan): DriverServerScene | null {
  const { box } = plan
  if (box === null || plan.placements.length === 0) return null
  if (plan.placements.some((item) => item.stopSequence === null || item.stopSequence < 1)) return null
  const stops = new Map<number, BackendSceneStop>()
  for (const stop of plan.stops) stops.set(stop.sequence, { id: `stop-${stop.sequence}`, sequence: stop.sequence, name: stop.name, deadline: null })
  for (const item of plan.placements) {
    const sequence = item.stopSequence ?? 0
    if (!stops.has(sequence)) stops.set(sequence, { id: `stop-${sequence}`, sequence, name: '', deadline: null })
  }
  const loadPlan: LoadPlan = {
    id: plan.planId, tripId: plan.tripId, jobId: null, objective: null, label: null, algorithmName: null, runAlgorithm: null, computationMs: null, name: null,
    volumePercent: null, payloadPercent: null, approved: true, approvedByName: null, centerOfGravityCm: null, frontAxleLoadKg: null,
    rearAxleLoadKg: null, rehandlingCount: null, unplaced: [], manuallyEdited: false, stale: false, stopZones: null,
    placements: plan.placements.map((item) => ({
      id: item.id,
      packageId: item.packageId,
      code: item.code,
      weightKg: item.weightKg,
      x: item.x, y: item.y, z: item.z,
      lengthCm: item.lengthCm, widthCm: item.widthCm, heightCm: item.heightCm,
      rotationType: item.rotation,
      step: item.step,
      pinned: false,
      stopId: null,
      stopSequence: item.stopSequence,
    })),
  }
  const vehicle: VehicleConfig = {
    id: plan.tripId, name: plan.vehicleName, innerLengthCm: box.innerLengthCm, innerWidthCm: box.innerWidthCm, innerHeightCm: box.innerHeightCm,
    maxPayloadKg: plan.maxPayloadKg ?? 0, doorWidthCm: box.doorWidthCm, doorHeightCm: box.doorHeightCm, doorPosition: 'REAR', clearanceCm: 0, obstacles: [],
  }
  const base = backendPlanScene({ tripCode: plan.tripCode, plan: loadPlan, vehicle, stops: [...stops.values()] })
  const placementIdOf = backendPlacementIds(loadPlan)
  const sceneIdOf = new Map([...placementIdOf].map(([sceneId, placementId]) => [placementId, sceneId]))
  const byPlacement = new Map(plan.placements.map((item) => [item.id, item]))
  const placements = base.placements.map((item): ScenePlacement => {
    const placementId = placementIdOf.get(item.id)
    const order = placementId === undefined ? undefined : byPlacement.get(placementId)?.unloadOrder
    return order === undefined ? item : Object.freeze({ ...item, unloadingOrder: order })
  })
  const model: ViewerSceneModel = Object.freeze({ ...base, placements: Object.freeze(placements), placementById: new Map(placements.map((item) => [item.id, item])) })
  const doneIds = new Set(plan.placements.flatMap((item) => {
    const sceneId = sceneIdOf.get(item.id)
    return item.unloaded && sceneId !== undefined ? [sceneId] : []
  }))
  return { model, doneIds }
}
