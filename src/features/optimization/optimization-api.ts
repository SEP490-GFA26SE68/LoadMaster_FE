/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   changeTripVehicle → POST /api/trips/{id}/change-vehicle
 *   runOptimization   → POST /api/v1/optimization/jobs · tiến độ: WS /ws/jobs/{job_uuid} · kết quả: GET /api/v1/optimization/jobs/{id}/plans
 *   chưa có ở BE: fetchOptimizationSetup, fetchOptimizationRuns, fetchRunHistory
 */

import type { OptimizationRequest, OptimizationResult, VehicleConfig } from '@/domain/models'
import {
  DEFAULT_RUN_SETTINGS,
  getMockDb,
  type OptimizationRun,
  type Revision,
  type RunSettings,
  type Trip,
  tripStatus,
  tripSubStatus,
  type VehicleStatus,
} from '@/lib/mock-db'
import type { TripStatus, TripSubStatus } from '@/types/trip'
import { createOptimizationService, OptimizationServiceError, type OptimizationProgress } from '@/services/optimization'
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
    status: tripStatus(trip, revisions), sub: tripSubStatus(trip, revisions), driverName,
  }
}

// POST /api/trips/{id}/change-vehicle
export async function changeTripVehicle(tripId: string, vehicleId: string): Promise<Trip> {
  return getMockDb().updateTrip(tripId, { vehicleId })
}

export type RunInput = {
  readonly tripId: string
  readonly request: OptimizationRequest
  /** `?mo-phong=loi` (D-12): service giả lập không phản hồi. */
  readonly simulateFailure: boolean
  readonly signal?: AbortSignal
  readonly onProgress?: (progress: OptimizationProgress) => void
  /** Mục tiêu và thuật toán người dùng chọn (LM-104); vắng thì mặc định. Mock bỏ qua, kho lưu vào lịch sử lần chạy. */
  readonly run?: RunSettings
}

/** `revision` khi service trả kết quả chạy xong (kể cả kết quả một phần); `failed` khi request bị service từ chối. */
export type RunOutcome =
  | { readonly kind: 'saved'; readonly revision: Revision }
  | { readonly kind: 'failed'; readonly result: OptimizationResult }

/**
 * Chạy tối ưu qua `createOptimizationService` (Web Worker trong trình duyệt, D-30) rồi lưu kết quả thành revision bất biến
 * (D-31). `status: FAILED` không lưu revision. Lỗi service (`OptimizationServiceError`) và huỷ (`AbortError`) ném lên cho UI.
 */
// POST /api/v1/optimization/jobs · WS /ws/jobs/{job_uuid} · GET /api/v1/optimization/jobs/{id}/plans
export async function runOptimization({ tripId, request, simulateFailure, signal, onProgress, run = DEFAULT_RUN_SETTINGS }: RunInput): Promise<RunOutcome> {
  const service = createOptimizationService({ simulateFailure })
  const db = getMockDb()
  let result: OptimizationResult
  try {
    result = await service.optimize(request, { signal, onProgress })
  } catch (error) {
    // Lịch sử lần chạy (LM-104): service không phản hồi vẫn là một lần chạy; người dùng huỷ thì không
    if (error instanceof OptimizationServiceError) await db.recordFailedRun(tripId, { ...run, failureCode: 'SERVICE_UNAVAILABLE' })
    throw error
  }
  if (result.status === 'FAILED') {
    await db.recordFailedRun(tripId, { ...run, failureCode: 'REQUEST_REJECTED' })
    return { kind: 'failed', result }
  }
  const revision = await db.addRevision({ tripId, request, result, run })
  return { kind: 'saved', revision }
}

/** Lịch sử lần chạy tối ưu của chuyến (LM-104), cũ trước: mục tiêu, thuật toán, kết quả hoặc lý do không ra kết quả. */
// chưa có ở BE
export function fetchOptimizationRuns(tripId: string): Promise<OptimizationRun[]> {
  return getMockDb().listOptimizationRuns(tripId)
}

/**
 * Bảng "Lần chạy tối ưu" của Thiết lập tối ưu, mới nhất trước: lần chạy kèm người chạy, thiết lập và số của revision nó tạo, và phương
 * án đó đã duyệt hay còn chờ duyệt.
 */
// chưa có ở BE
export async function fetchRunHistory(tripId: string): Promise<RunHistoryRow[]> {
  const db = getMockDb()
  const [trip, runs, revisions, users] = await Promise.all([
    db.getTrip(tripId), db.listOptimizationRuns(tripId), db.listRevisions(tripId), db.listUsers(),
  ])
  return buildRunHistory({ trip, runs, revisions, userNames: new Map(users.map((user) => [user.id, user.fullName])) })
}
