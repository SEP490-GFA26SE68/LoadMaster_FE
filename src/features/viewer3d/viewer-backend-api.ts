/**
 * Planner khi nhóm `trips` nối backend. Hàm → endpoint:
 *   fetchBackendPlanSource  → GET /api/trips?search= · GET /api/trips/{id}/detail · GET /api/trips/{id}/vehicle-config ·
 *                             GET /api/trips/{id}/load-plans
 *   approveBackendLoadPlan  → POST /api/load-plans/{id}/approve
 * Mã chuyến trên URL đổi sang mã số của máy chủ qua `resolveBackendTripId`.
 */

import type { VehicleConfig } from '@/domain/models'
import { configVehicleOf, type BackendVehicleConfig } from '@/features/fleet/fleet-dto'
import { loadPlanOf, type LoadPlan, type LoadPlanDto } from '@/features/optimization/load-plan-dto'
import { fetchTripLoadPlans } from '@/features/optimization/load-plans-backend-api'
import { fetchBackendTripDetail, resolveBackendTripId, type TripDetailApiResponse } from '@/features/trips/trips-api'
import { api } from '@/lib/api-client'
import { isoFromBackend } from '@/lib/backend-time'
import type { BackendSceneStop } from './backend-plan-scene'

export type BackendPlanSource = {
  /** Mã số của chuyến ở máy chủ. */
  readonly tripId: string
  readonly tripName: string
  readonly status: TripDetailApiResponse['status']
  readonly vehicle: VehicleConfig
  readonly stops: readonly BackendSceneStop[]
  /** Phương án đang xem; `null` khi chuyến chưa có phương án nào (hoặc mã trên URL không thuộc chuyến). */
  readonly plan: LoadPlan | null
}

/**
 * Phương án của chuyến cho Planner: `planId` (tham số `?revision=` trên URL) nếu có, không thì phương án đã duyệt, không nữa thì phương
 * án mới nhất.
 */
// GET /api/trips/{id}/detail · GET /api/trips/{id}/vehicle-config · GET /api/trips/{id}/load-plans
export async function fetchBackendPlanSource(tripCode: string, planId?: string): Promise<BackendPlanSource> {
  const tripId = await resolveBackendTripId(tripCode)
  const [detail, config, plans] = await Promise.all([
    fetchBackendTripDetail(tripId),
    api().get<BackendVehicleConfig>(`/api/trips/${encodeURIComponent(tripId)}/vehicle-config`),
    fetchTripLoadPlans(tripId),
  ])
  const wanted = planId ?? plans.approvedPlanId
  const plan = (wanted === null ? undefined : plans.plans.find((item) => item.id === wanted)) ?? (planId ? undefined : plans.plans.at(-1))
  return {
    tripId,
    tripName: detail.trip.tripName,
    status: detail.trip.status,
    vehicle: configVehicleOf(config),
    stops: detail.stops.map((stop) => ({
      id: String(stop.id),
      sequence: stop.stopSequence,
      name: stop.stopName?.trim() || stop.address?.trim() || String(stop.stopSequence),
      deadline: stop.deadline ? isoFromBackend(stop.deadline) : null,
    })),
    plan: plan ?? null,
  }
}

/** Máy chủ chỉ duyệt phương án của chuyến Đã lập kế hoạch (`PLAN_TRIP_NOT_PLANNED`), chưa duyệt (`PLAN_ALREADY_APPROVED`). */
// POST /api/load-plans/{id}/approve
export async function approveBackendLoadPlan(planId: string): Promise<LoadPlan> {
  return loadPlanOf(await api().post<LoadPlanDto>(`/api/load-plans/${encodeURIComponent(planId)}/approve`))
}
