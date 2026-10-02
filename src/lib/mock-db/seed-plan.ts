import type { OptimizationRequest, VehicleConfig } from '@/domain/models'
import { runMockOptimization } from '@/services/optimization'
import { approvedResult } from './revisions'
import type { SeedEvent } from './seed-progress'
import { DEFAULT_RUN_SETTINGS, type OptimizationRun } from './source-types'
import type { Revision, Trip } from './types'

/** Một lần tối ưu (và Duyệt, nếu có `approved`) của chuyến seed; trả bản đã duyệt. */
export type SeedPlanner = (trip: Trip, randomSeed: number, times: { optimized: string; approved?: string }) => Revision | undefined

export type SeedPlanBook = {
  vehicles: readonly VehicleConfig[]
  /** Người điều phối của công ty: chạy tối ưu và duyệt (FE-0-07). */
  actorId: string
  /** Mã theo số thứ tự (từ 1) trong `revisions` / `runs` — mỗi công ty một bộ mã riêng. */
  revisionId: (order: number) => string
  runId: (order: number) => string
  /** Kết quả ghi thêm vào ba mảng này, theo thứ tự chạy. */
  revisions: Revision[]
  runs: OptimizationRun[]
  events: SeedEvent[]
}

/**
 * Lập phương án cho chuyến seed của một công ty: chạy mock optimization với seed ngẫu nhiên cố định (`runtimeMs` = 0 vì không đo lần
 * chạy lúc nạp kho), ghi revision, lần chạy và sự kiện như `addRevision` / `approveRevision`.
 */
export function seedPlanner({ vehicles, actorId, revisionId, runId, revisions, runs, events }: SeedPlanBook): SeedPlanner {
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]))
  return (trip, randomSeed, times) => {
    const vehicle = vehicleById.get(trip.vehicleId)
    if (vehicle === undefined) throw new Error(`Seed thiếu xe ${trip.vehicleId} của chuyến ${trip.id}`)
    const request: OptimizationRequest = {
      vehicle,
      packages: trip.packages,
      settings: { method: 'MOCK', timeLimitSeconds: 30, randomSeed, enforceLifo: true, prioritizeLowCenterOfGravity: false },
    }
    const result = runMockOptimization(request, { clock: () => 0 })
    const optimized: Revision = {
      id: revisionId(revisions.length + 1), jobId: result.jobId, tripId: trip.id, request, result, inputVersion: trip.inputVersion,
      createdAt: times.optimized, manuallyEdited: false, ordersRecomputed: false, run: { ...DEFAULT_RUN_SETTINGS },
    }
    revisions.push(optimized)
    runs.push({
      id: runId(runs.length + 1), tripId: trip.id, ...DEFAULT_RUN_SETTINGS, status: 'COMPLETED', at: times.optimized, by: actorId,
      revisionId: optimized.id, jobId: optimized.jobId, placedCount: result.metrics.placedCount, unplacedCount: result.metrics.unplacedCount,
      volumeUtilizationPercent: result.metrics.volumeUtilizationPercent,
    })
    const target = { type: 'trip' as const, id: trip.id }
    events.push({ at: times.optimized, actorId, action: 'optimization.saved', target, params: { revisionId: optimized.id, placed: result.metrics.placedCount, unplaced: result.metrics.unplacedCount } })
    if (times.approved === undefined) return undefined
    const approved: Revision = {
      ...optimized, id: revisionId(revisions.length + 1), result: approvedResult(request, result, []), createdAt: times.approved,
      draftPatches: [], approvedAt: times.approved, approvedBy: actorId, sourceRevisionId: optimized.id, ordersRecomputed: true,
    }
    revisions.push(approved)
    events.push({ at: times.approved, actorId, action: 'revision.approved', target, params: { revisionId: approved.id, sourceRevisionId: optimized.id, edits: 0 } })
    return approved
  }
}
