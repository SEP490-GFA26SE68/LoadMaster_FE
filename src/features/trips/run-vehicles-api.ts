/**
 * Xe của các phương án ở So sánh theo lần chạy bản máy chủ (ảnh cách xếp, thanh tải trục). Hàm → endpoint:
 *   fetchRunVehicles → GET /api/vehicles/{id}/config (xe phương án được tính cho) · GET /api/trips?search= · GET /api/trips/{id}/vehicle-config
 *                      (phương án không ghi xe: xe hiện tại của chuyến)
 * Đọc lỗi thì phương án đó không có xe — màn bỏ ảnh và thanh tải trục, không báo lỗi thay cho cả màn.
 */

import type { VehicleConfig } from '@/domain/models'
import { configVehicleOf, type BackendVehicleConfig } from '@/features/fleet/fleet-dto'
import type { LoadPlan } from '@/features/optimization/load-plans-backend-api'
import { api } from '@/lib/api-client'
import { resolveBackendTripId } from './trips-api'

/** Mã phương án → xe; phương án đọc xe lỗi thì vắng. */
export type RunVehicles = ReadonlyMap<string, VehicleConfig>

const TRIP_VEHICLE = ''

// GET /api/vehicles/{id}/config · GET /api/trips/{id}/vehicle-config
export async function fetchRunVehicles(tripParam: string, plans: readonly LoadPlan[]): Promise<RunVehicles> {
  const keys = [...new Set(plans.map((plan) => plan.vehicleId ?? TRIP_VEHICLE))]
  const settled = await Promise.allSettled(keys.map(async (key) => {
    const path = key === TRIP_VEHICLE
      ? `/api/trips/${encodeURIComponent(await resolveBackendTripId(tripParam))}/vehicle-config`
      : `/api/vehicles/${encodeURIComponent(key)}/config`
    return [key, configVehicleOf(await api().get<BackendVehicleConfig>(path))] as const
  }))
  const byKey = new Map(settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])))
  return new Map(plans.flatMap((plan) => {
    const vehicle = byKey.get(plan.vehicleId ?? TRIP_VEHICLE)
    return vehicle ? [[plan.id, vehicle] as const] : []
  }))
}
