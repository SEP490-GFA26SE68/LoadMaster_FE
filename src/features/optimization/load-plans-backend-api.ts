/**
 * Tối ưu xếp hàng của chuyến khi nhóm `trips` nối backend. Hàm → endpoint:
 *   startLoadingOptimization → POST /api/trips/{tripId}/optimize-loading
 *   fetchOptimizationJob     → GET /api/trips/optimization-jobs/{jobId}
 *   fetchJobPlans            → GET /api/trips/optimization-jobs/{jobId}/plans
 *   fetchTripLoadPlans       → GET /api/trips/{tripId}/load-plans
 * `tripId` là mã số của máy chủ (màn đổi mã chuyến trên URL qua `resolveBackendTripId`).
 */

import { api } from '@/lib/api-client'
import {
  loadPlanOf,
  optimizationJobOf,
  sortCandidates,
  tripLoadPlansOf,
  type LoadPlan,
  type LoadPlanDto,
  type OptimizationJob,
  type OptimizationJobDto,
  type OptimizationStartDto,
  type TripLoadPlans,
  type TripLoadPlansDto,
} from './load-plan-dto'

/** Kiểu của app dựng từ DTO — màn import từ đây, không từ `load-plan-dto.ts`. */
export type { LoadPlacement, LoadPlan, OptimizationJob } from './load-plan-dto'

const tripPath = (tripId: string) => `/api/trips/${encodeURIComponent(tripId)}`
const jobPath = (jobId: string) => `/api/trips/optimization-jobs/${encodeURIComponent(jobId)}`

/**
 * Gửi một lần chạy (credit của một lần chạy, ba phương án). Hết credit: 402 `INSUFFICIENT_CREDITS`, không tạo job nào. `keepPinsFromPlanId`: giữ nguyên
 * các kiện đã ghim của phương án đó (cùng chuyến) trong cả ba phương án; bộ ghim không đứng vững là 400 `PINNED_SET_INVALID` trước khi chạy,
 * không trừ credit.
 */
// POST /api/trips/{tripId}/optimize-loading
export async function startLoadingOptimization(
  tripId: string, keepPinsFromPlanId?: string,
): Promise<{ readonly jobId: string; readonly pinnedCount: number }> {
  const body = keepPinsFromPlanId === undefined ? undefined : { keepPinsFromPlanId: Number(keepPinsFromPlanId) }
  const started = await api().post<OptimizationStartDto>(`${tripPath(tripId)}/optimize-loading`, body === undefined ? undefined : { body })
  return { jobId: started.jobId, pinnedCount: started.pinnedCount ?? 0 }
}

// GET /api/trips/optimization-jobs/{jobId}
export async function fetchOptimizationJob(jobId: string): Promise<OptimizationJob> {
  return optimizationJobOf(await api().get<OptimizationJobDto>(jobPath(jobId)))
}

/** Phương án của một lần chạy, theo thứ tự A · B · C. */
// GET /api/trips/optimization-jobs/{jobId}/plans
export async function fetchJobPlans(jobId: string): Promise<LoadPlan[]> {
  return sortCandidates((await api().get<readonly LoadPlanDto[]>(`${jobPath(jobId)}/plans`)).map(loadPlanOf))
}

// GET /api/trips/{tripId}/load-plans
export async function fetchTripLoadPlans(tripId: string): Promise<TripLoadPlans> {
  return tripLoadPlansOf(await api().get<TripLoadPlansDto>(`${tripPath(tripId)}/load-plans`))
}
