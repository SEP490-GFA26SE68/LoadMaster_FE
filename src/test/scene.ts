import { createBenchmarkInput, type BenchmarkCount, type BenchmarkStopCount } from '@/features/viewer3d/benchmark.mock'
import { adaptResult, type ScenePlacement, type ViewerSceneModel } from '@/features/viewer3d/scene-input'
import { createMockDb } from '@/lib/mock-db'

/** Scene cm của fixture benchmark, dựng đúng đường Planner dùng (`adaptResult`); `zonedStops` thêm vùng theo điểm giao (FE-5b-07). */
export function benchmarkScene(count: BenchmarkCount, zonedStops?: BenchmarkStopCount): ViewerSceneModel {
  const input = createBenchmarkInput(count, zonedStops)
  return adaptResult({ trip: input.trip, revision: input })
}

/** Scene cm của revision đã duyệt trong seed (chuyến TRIP-2026-0914) — dữ liệu Planner mở mặc định. */
export function seedScene(): Promise<ViewerSceneModel> {
  return approvedScene('TRIP-2026-0914')
}

/** Scene cm của revision đã duyệt mới nhất của một chuyến seed, như Planner mở chuyến đó. */
export async function approvedScene(tripId: string): Promise<ViewerSceneModel> {
  const db = createMockDb()
  const trip = await db.getTrip(tripId)
  const approved = (await db.listRevisions(trip.id)).findLast((revision) => revision.approvedAt !== undefined)
  if (!approved) throw new Error(`seed has no approved revision for ${tripId}`)
  return adaptResult({ trip, revision: approved })
}

const TEMPLATE = benchmarkScene(132).placements[0]!

/** Khối lập phương 10 cm dùng cho test hình học editor/operations; `extra` ghi đè trường bất kỳ. */
export function sceneBox(id: string, x = 0, y = 0, z = 0, extra: Partial<ScenePlacement> = {}): ScenePlacement {
  return {
    ...TEMPLATE,
    id,
    lengthCm: 10,
    widthCm: 10,
    heightCm: 10,
    weightKg: 10,
    stop: 1,
    fragile: false,
    pinned: false,
    orientation: 'LWH',
    position: { x, y, z },
    ...extra,
  }
}
