/**
 * Planner khi nhóm `trips` nối backend. Hàm → endpoint:
 *   fetchBackendPlanSource  → GET /api/trips?search= · GET /api/trips/{id}/detail · GET /api/trips/{id}/vehicle-config ·
 *                             GET /api/trips/{id}/load-plans
 *   approveBackendLoadPlan  → POST /api/load-plans/{id}/approve
 *   approveBackendEdits     → POST /api/load-plans/{id}/approve-edits
 *   pinBackendPlacement     → POST /api/load-plans/{id}/pin
 *   unpinBackendPlacement   → DELETE /api/load-plans/{id}/pin/{placementId}
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
      plannedArrival: stop.plannedArrival ? isoFromBackend(stop.plannedArrival) : null,
    })),
    plan: plan ?? null,
  }
}

/** Máy chủ chỉ duyệt phương án của chuyến Đã lập kế hoạch (`PLAN_TRIP_NOT_PLANNED`), chưa duyệt (`PLAN_ALREADY_APPROVED`). */
// POST /api/load-plans/{id}/approve
export async function approveBackendLoadPlan(planId: string): Promise<LoadPlan> {
  return loadPlanOf(await api().post<LoadPlanDto>(`/api/load-plans/${encodeURIComponent(planId)}/approve`))
}

const planPath = (planId: string) => `/api/load-plans/${encodeURIComponent(planId)}`

/** Một kiện đã dời / xoay của bản chỉnh tay: mã số placement của máy chủ, toạ độ cm, mã hướng 0..5 của dịch vụ tối ưu. */
export type BackendPlacementEdit = {
  readonly placementId: string
  readonly x: number
  readonly y: number
  readonly z: number
  readonly rotationType: number
}

/**
 * Duyệt bản chỉnh tay: máy chủ kiểm lại cách xếp (trong lòng thùng, không chồng lấn, có chỗ đỡ, tải trục, hướng xoay theo loại kiện) rồi lưu
 * thành bản duyệt **mới** đánh dấu chỉnh tay; phương án nguồn giữ nguyên. Từ chối bằng `MANUAL_EDIT_*`, `PLAN_STALE`, `PLAN_TRIP_NOT_PLANNED`.
 * `pinnedPlacementIds` vắng là giữ ghim của phương án nguồn.
 */
// POST /api/load-plans/{id}/approve-edits
export async function approveBackendEdits(
  planId: string,
  edits: readonly BackendPlacementEdit[],
  pinnedPlacementIds?: readonly string[],
): Promise<LoadPlan> {
  const body = {
    placements: edits.map((edit) => ({
      placementId: Number(edit.placementId),
      posX: edit.x,
      posY: edit.y,
      posZ: edit.z,
      rotationType: edit.rotationType,
    })),
    ...(pinnedPlacementIds === undefined ? {} : { pinnedPlacementIds: pinnedPlacementIds.map(Number) }),
  }
  return loadPlanOf(await api().post<LoadPlanDto>(`${planPath(planId)}/approve-edits`, { body }))
}

/**
 * Ghim một kiện của phương án (lưu ngay ở máy chủ, không qua Duyệt): lần chạy lại giữ nguyên chỗ và hướng của nó. `placementId` là mã số
 * placement của máy chủ (`LoadPlacement.id`). Máy chủ trả placement vừa ghim; màn đọc lại phương án nên không dùng nó.
 */
// POST /api/load-plans/{id}/pin
export async function pinBackendPlacement(planId: string, placementId: string): Promise<void> {
  await api().post(`${planPath(planId)}/pin`, { body: { placementId: Number(placementId) } })
}

// DELETE /api/load-plans/{id}/pin/{placementId}
export async function unpinBackendPlacement(planId: string, placementId: string): Promise<void> {
  await api().delete(`${planPath(planId)}/pin/${encodeURIComponent(placementId)}`)
}
