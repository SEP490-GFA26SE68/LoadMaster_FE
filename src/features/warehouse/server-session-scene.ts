import type { VehicleConfig } from '@/domain/models'
import type { LoadPlan } from '@/features/optimization/load-plan-dto'
import { backendPlacementIds, backendPlanScene, type BackendSceneStop } from '@/features/viewer3d/backend-plan-scene'
import type { ViewerSceneModel } from '@/features/viewer3d/scene-types'
import type { ServerLoadingSession } from './warehouse-server-api'

export type ServerSessionScene = {
  readonly model: ViewerSceneModel
  /** Mã số placement của máy chủ → mã của kiện trên khung 3D. */
  readonly sceneIdOf: ReadonlyMap<string, string>
}

/**
 * Hàm thuần: phiên xếp của máy chủ thành snapshot cho khung 3D của kho — lòng thùng, cửa và chỗ từng kiện (cm) theo phương án đã duyệt.
 * `null` khi phiên không đủ dữ liệu để vẽ đúng: máy chủ không trả lòng thùng, hoặc có kiện không mang số điểm giao (màu kiện theo điểm
 * giao). Phiên không trả khối lượng kiện, tải trọng xe: hai số đó là 0 và khung kho không hiện chúng.
 */
export function serverSessionScene(session: ServerLoadingSession): ServerSessionScene | null {
  const { box } = session
  if (box === null || session.placements.length === 0) return null
  if (session.placements.some((item) => item.stopSequence === null || item.stopSequence < 1)) return null
  const stops = new Map<number, BackendSceneStop>()
  for (const item of session.placements) {
    const sequence = item.stopSequence ?? 0
    if (!stops.has(sequence)) stops.set(sequence, { id: `stop-${sequence}`, sequence, name: item.stopName ?? '', deadline: null })
  }
  const plan: LoadPlan = {
    id: session.tripId, tripId: session.tripId, jobId: null, objective: null, label: null, algorithmName: null, computationMs: null, name: null,
    volumePercent: null, payloadPercent: null, approved: true, approvedByName: null, centerOfGravityCm: null, frontAxleLoadKg: null,
    rearAxleLoadKg: null, rehandlingCount: null, unplaced: [],
    placements: session.placements.map((item) => ({
      id: item.id,
      packageId: item.packageId ?? item.id,
      code: item.packageCode ?? item.barcode ?? item.packageId ?? item.id,
      weightKg: 0,
      x: item.x, y: item.y, z: item.z,
      lengthCm: item.lengthCm, widthCm: item.widthCm, heightCm: item.heightCm,
      rotationType: item.rotation,
      step: item.sequence,
      pinned: false,
      stopId: null,
      stopSequence: item.stopSequence,
    })),
  }
  const vehicle: VehicleConfig = {
    id: session.tripId, name: session.vehicle, innerLengthCm: box.innerLengthCm, innerWidthCm: box.innerWidthCm, innerHeightCm: box.innerHeightCm,
    maxPayloadKg: 0, doorWidthCm: box.doorWidthCm, doorHeightCm: box.doorHeightCm, doorPosition: 'REAR', clearanceCm: 0, obstacles: [],
  }
  const model = backendPlanScene({ tripCode: session.code, plan, vehicle, stops: [...stops.values()] })
  const sceneIdOf = new Map([...backendPlacementIds(plan)].map(([sceneId, placementId]) => [placementId, sceneId]))
  return { model, sceneIdOf }
}
