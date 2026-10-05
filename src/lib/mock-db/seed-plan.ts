import { PLAN_LABELS, type OptimizationRequest, type VehicleConfig } from '@/domain/models'
import { runMockCandidates } from '@/services/optimization'
import { approvedResult } from './revisions'
import { routePlanOf, stopsWithoutCoordinates } from './trip-route'
import type { SeedEvent } from './seed-progress'
import { DEFAULT_RUN_ALGORITHM, type OptimizationRun } from './source-types'
import type { Revision, Trip } from './types'

/**
 * Tuyến đã tối ưu của chuyến seed (FE-4b-09): chuyến đã có phương án thì đã tối ưu tuyến trước đó, nên là Đã lập kế hoạch. Thứ tự
 * điểm của seed được giữ nguyên — như điều phối viên đã kéo lại thứ tự sau khi tối ưu — vì phương án 3D của seed xếp theo đúng thứ tự
 * đó; giờ đến dự kiến tính bằng cùng công thức của mock. Chuyến còn điểm chưa có toạ độ thì không có tuyến. Không ghi sự kiện nhật ký:
 * lịch sử seed giữ nguyên số sự kiện.
 */
export function withSeedRoute(trip: Trip, optimizedAt: string, optimizedBy: string): Trip {
  if (trip.stops.length === 0 || stopsWithoutCoordinates(trip.stops).length > 0) return trip
  return { ...trip, routePlan: routePlanOf(trip, { optimizedAt, optimizedBy }) }
}

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

/** Mục tiêu của phương án mà điều phối viên seed duyệt: ít dỡ-xếp lại (C) — kho và tài xế dỡ theo vùng điểm giao. */
const SEED_APPROVED_OBJECTIVE = 'MIN_REHANDLING'

/**
 * Lập phương án cho chuyến seed của một công ty: chạy mock optimization với seed ngẫu nhiên cố định (`runtimeMs` = 0 vì không đo lần
 * chạy lúc nạp kho), ghi revision, lần chạy và sự kiện như `saveOptimizationRun` / `approveRevision`.
 *
 * Một lần chạy ra ba phương án ứng viên (FE-5b-05). Phương án ít dỡ-xếp lại (C) — bản được duyệt — giữ **mã số** của seed trước đó
 * (`REV-001`); hai phương án còn lại mang mã của nó kèm nhãn (`REV-001-A`, `REV-001-B`), dạng mà `nextId` không tính: mã số, thứ tự và mã
 * kế tiếp của kho giữ nguyên. Thứ tự ghi là A, B, C nên bản mới nhất chưa duyệt của chuyến vẫn là bản mang mã số.
 */
export function seedPlanner({ vehicles, actorId, revisionId, runId, revisions, runs, events }: SeedPlanBook): SeedPlanner {
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]))
  /** Số revision mang mã số đã cấp: mỗi lần chạy một mã, mỗi lần duyệt một mã. */
  let numbered = 0
  return (trip, randomSeed, times) => {
    const vehicle = vehicleById.get(trip.vehicleId)
    if (vehicle === undefined) throw new Error(`Seed thiếu xe ${trip.vehicleId} của chuyến ${trip.id}`)
    const request: OptimizationRequest = {
      vehicle,
      packages: trip.packages,
      settings: { method: 'MOCK', timeLimitSeconds: 30, randomSeed, enforceLifo: true, prioritizeLowCenterOfGravity: false },
    }
    const job = runMockCandidates(request, { clock: () => 0 })
    const run = runId(runs.length + 1)
    const baseId = revisionId((numbered += 1))
    const candidates = job.plans.map(({ objective, result }): Revision => ({
      id: objective === SEED_APPROVED_OBJECTIVE ? baseId : `${baseId}-${PLAN_LABELS[objective]}`,
      jobId: result.jobId, tripId: trip.id, request, result, inputVersion: trip.inputVersion, createdAt: times.optimized,
      manuallyEdited: false, ordersRecomputed: false, run: { objective, algorithm: DEFAULT_RUN_ALGORITHM }, runId: run,
    }))
    revisions.push(...candidates)
    runs.push({
      id: run, tripId: trip.id, algorithm: DEFAULT_RUN_ALGORITHM, status: 'COMPLETED', at: times.optimized, by: actorId, jobId: job.jobId,
      plans: candidates.map(({ id, jobId, result, run: settings }) => ({
        objective: settings?.objective ?? SEED_APPROVED_OBJECTIVE, revisionId: id, jobId, placedCount: result.metrics.placedCount,
        unplacedCount: result.metrics.unplacedCount, volumeUtilizationPercent: result.metrics.volumeUtilizationPercent,
      })),
    })
    const target = { type: 'trip' as const, id: trip.id }
    events.push({ at: times.optimized, actorId, action: 'optimization.saved', target, params: { runId: run, revisionId: candidates.map(({ id }) => id).join(', ') } })
    if (times.approved === undefined) return undefined
    const source = candidates.find(({ id }) => id === baseId)
    if (source === undefined) throw new Error(`Seed thiếu phương án ${SEED_APPROVED_OBJECTIVE} của chuyến ${trip.id}`)
    const approved: Revision = {
      ...source, id: revisionId((numbered += 1)), result: approvedResult(request, source.result, []), createdAt: times.approved,
      draftPatches: [], approvedAt: times.approved, approvedBy: actorId, sourceRevisionId: source.id, ordersRecomputed: true,
    }
    revisions.push(approved)
    events.push({ at: times.approved, actorId, action: 'revision.approved', target, params: { revisionId: approved.id, sourceRevisionId: source.id, edits: 0 } })
    return approved
  }
}
