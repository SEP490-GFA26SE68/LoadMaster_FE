/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   changeTripVehicle → POST /api/trips/{id}/change-vehicle
 *   runOptimization   → POST /api/v1/optimization/jobs · tiến độ: WS /ws/jobs/{job_uuid} · ba phương án: GET /api/v1/optimization/jobs/{id}/plans (Q-07)
 *                       (giữ / trừ / hoàn credit do BE làm phía server, HTTP 402 `INSUFFICIENT_CREDITS`; mock gọi thẳng kho)
 *   fetchOptimizationCredit → GET /api/subscription/current · GET /api/credits/balance
 *   chưa có ở BE: fetchOptimizationSetup, fetchOptimizationRuns, fetchRunHistory
 */

import type { OptimizationRequest, OptimizationResult, VehicleConfig } from '@/domain/models'
import {
  creditBlock,
  getMockDb,
  optimizationCost,
  type AlgorithmTier,
  type CreditBlock,
  type OptimizationRun,
  type Revision,
  type Trip,
  tripStatus,
  tripSubStatus,
  type VehicleStatus,
} from '@/lib/mock-db'
import type { TripStatus, TripSubStatus } from '@/types/trip'
import { createOptimizationService, OptimizationServiceError, type CandidateProgress, type CandidateRun } from '@/services/optimization'
import { buildRunHistory, type RunHistoryRow } from './run-history'

/**
 * Lớp dữ liệu của Thiết lập tối ưu và job (LM-047, LM-048): nơi duy nhất trong feature biết về kho và service tối ưu.
 * API thật sau này thay thân hàm; `OptimizationService` giữ nguyên contract Spec mục 11.
 */

export type OptimizationSetup = {
  readonly trip: Trip
  readonly vehicle: VehicleConfig
  readonly vehicles: readonly VehicleConfig[]
  /** Trạng thái từng xe (D-53): xe bảo dưỡng hiện trong ô chọn nhưng không chọn được (LM-088). */
  readonly vehicleStatus: Readonly<Record<string, VehicleStatus>>
  /** Chip trạng thái và dòng phụ ở đầu màn (V2.3, LM-106), cùng cách tính với Chi tiết chuyến. */
  readonly status: TripStatus
  readonly sub: TripSubStatus | null
  /** Họ tên tài xế; `null` khi chưa gán hoặc tài khoản không còn trong kho. */
  readonly driverName: string | null
}

// chưa có ở BE
export async function fetchOptimizationSetup(tripId: string): Promise<OptimizationSetup> {
  const db = getMockDb()
  const [trip, vehicles, states, revisions, users] = await Promise.all([
    db.getTrip(tripId), db.listVehicles(), db.listVehicleStates(), db.listRevisions(tripId), db.listUsers(),
  ])
  const vehicleStatus = Object.fromEntries(states.map((state) => [state.vehicleId, state.status]))
  const driverName = trip.driverId === null ? null : users.find((user) => user.id === trip.driverId)?.fullName ?? null
  return {
    trip, vehicle: await db.getVehicle(trip.vehicleId), vehicles, vehicleStatus,
    status: tripStatus(trip), sub: tripSubStatus(trip, revisions), driverName,
  }
}

// POST /api/trips/{id}/change-vehicle
export async function changeTripVehicle(tripId: string, vehicleId: string): Promise<Trip> {
  return getMockDb().updateTrip(tripId, { vehicleId })
}

/** Gói và credit của công ty cho một lần chạy: dòng "Lần chạy này dùng N credit · còn M", hạng thuật toán và trạng thái chặn. */
export type OptimizationCredit = {
  /** Tên và hạng thuật toán của gói; `null` khi công ty chưa có gói. */
  readonly planName: string | null
  readonly algorithmTier: AlgorithmTier | null
  /** Credit một lần chạy tốn: 1, gói không giới hạn 0. */
  readonly cost: number
  readonly balance: number
  readonly unlimited: boolean
  /** Vì sao chưa chạy được (gói hết hạn xét trước số dư); `null` khi chạy được. Kho kiểm lại bằng cùng luật. */
  readonly block: CreditBlock | null
}

// GET /api/subscription/current · GET /api/credits/balance
export async function fetchOptimizationCredit(): Promise<OptimizationCredit> {
  const db = getMockDb()
  const [current, credit] = await Promise.all([db.getCurrentSubscription(), db.getCreditBalance()])
  return {
    planName: current?.plan.name ?? null,
    algorithmTier: current?.plan.algorithmTier ?? null,
    cost: current ? optimizationCost(current.plan) : 0,
    balance: credit.balance,
    unlimited: credit.unlimited,
    block: creditBlock(current, credit.balance),
  }
}

export type RunInput = {
  readonly tripId: string
  readonly request: OptimizationRequest
  /** `?mo-phong=loi` (D-12): service giả lập không phản hồi. */
  readonly simulateFailure: boolean
  readonly signal?: AbortSignal
  /** Tiến trình của từng phương án ứng viên. */
  readonly onProgress?: (progress: CandidateProgress) => void
}

/**
 * `saved`: service trả đủ ba phương án (kể cả phương án một phần) và kho đã lưu lần chạy cùng ba revision; `failed` khi request bị
 * service từ chối.
 */
export type RunOutcome =
  | { readonly kind: 'saved'; readonly run: OptimizationRun; readonly revisions: readonly Revision[] }
  | { readonly kind: 'failed'; readonly result: OptimizationResult }

/**
 * Chạy tối ưu qua `createOptimizationService` (Web Worker trong trình duyệt, D-30): một job ra ba phương án ứng viên theo ba mục tiêu
 * (FE-5b-05, D-77), kho lưu mỗi phương án thành một revision bất biến (D-31) của cùng một lần chạy. `status: FAILED` không lưu revision.
 * Lỗi service (`OptimizationServiceError`), huỷ (`AbortError` — không phương án nào được lưu) và lỗi của kho (`MockDbError`, ví dụ chuyến
 * chưa tối ưu tuyến) ném lên cho UI.
 *
 * Credit (FE-8-05, D-89): kho giữ 1 credit trước khi chạy — hết credit hoặc gói hết hạn thì ném `MockDbError` và không chạy —, trừ hẳn
 * khi lưu xong, hoàn khi service lỗi, request bị từ chối, bị huỷ, hoặc kho không lưu được. Mỗi lần chạy đúng một bộ giao dịch.
 */
// POST /api/v1/optimization/jobs · WS /ws/jobs/{job_uuid} · GET /api/v1/optimization/jobs/{id}/plans (Q-07)
export async function runOptimization({ tripId, request, simulateFailure, signal, onProgress }: RunInput): Promise<RunOutcome> {
  const service = createOptimizationService({ simulateFailure })
  const db = getMockDb()
  const { reference } = await db.reserveOptimizationCredit(tripId)
  let job: CandidateRun
  try {
    job = await service.optimizeCandidates(request, { signal, onProgress })
  } catch (error) {
    await db.refundOptimizationCredit(reference)
    // Lịch sử lần chạy (LM-104): service không phản hồi vẫn là một lần chạy; người dùng huỷ thì không
    if (error instanceof OptimizationServiceError) await db.recordFailedRun(tripId, { failureCode: 'SERVICE_UNAVAILABLE' })
    throw error
  }
  const failed = job.plans.find(({ result }) => result.status === 'FAILED')
  if (failed) {
    await db.refundOptimizationCredit(reference)
    await db.recordFailedRun(tripId, { failureCode: 'REQUEST_REJECTED' })
    return { kind: 'failed', result: failed.result }
  }
  try {
    return { kind: 'saved', ...(await db.saveOptimizationRun({ tripId, request, jobId: job.jobId, plans: job.plans, creditReference: reference })) }
  } catch (error) {
    await db.refundOptimizationCredit(reference)
    throw error
  }
}

/** Lịch sử lần chạy tối ưu của chuyến (LM-104), cũ trước: thuật toán, các phương án ứng viên hoặc lý do không ra kết quả. */
// chưa có ở BE
export function fetchOptimizationRuns(tripId: string): Promise<OptimizationRun[]> {
  return getMockDb().listOptimizationRuns(tripId)
}

/**
 * Bảng "Lần chạy tối ưu" của Thiết lập tối ưu, mới nhất trước: lần chạy kèm người chạy, thiết lập, ba phương án ứng viên nó tạo, và
 * lần chạy đó đã có phương án được duyệt hay còn chờ duyệt.
 */
// chưa có ở BE
export async function fetchRunHistory(tripId: string): Promise<RunHistoryRow[]> {
  const db = getMockDb()
  const [trip, runs, revisions, users] = await Promise.all([
    db.getTrip(tripId), db.listOptimizationRuns(tripId), db.listRevisions(tripId), db.listUsers(),
  ])
  return buildRunHistory({ trip, runs, revisions, userNames: new Map(users.map((user) => [user.id, user.fullName])) })
}
