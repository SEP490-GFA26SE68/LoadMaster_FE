/**
 * Lớp gọi API cho Đội xe của kho mẫu (D-06): kho dùng chung `@/lib/mock-db`. Nhóm `fleet` nối backend thì màn là bản của
 * `./backend` (đọc ghi máy chủ qua `backend/vehicles-api.ts`), không đi qua file này. Component không gọi trực tiếp file này
 * (AGENTS mục 9) — đi qua `useVehiclesQuery` và các hook cùng thư mục.
 */

import type { VehicleConfig } from '@/domain/models'
import { getMockDb } from '@/lib/mock-db'
import type { FleetVehicle, FleetVehicleState } from './vehicle-status'

export function fetchVehicles(): Promise<FleetVehicle[]> {
  return getMockDb().listVehicles()
}

export function fetchVehicle(id: string): Promise<FleetVehicle> {
  return getMockDb().getVehicle(id)
}

/** Xe chưa có mã (`id` rỗng) là xe mới: kho cấp mã `VEHICLE-NNN` kế tiếp. */
export function saveVehicle(vehicle: VehicleConfig): Promise<VehicleConfig> {
  const { id, ...input } = vehicle
  return id === '' ? getMockDb().createVehicle(input) : getMockDb().updateVehicle(vehicle)
}

/** Xe từng chạy chuyến không bị xoá mà chuyển sang Ngừng sử dụng (`RETIRED`), như máy chủ; màn báo đúng kết quả. */
export function deleteVehicle(id: string): Promise<'DELETED' | 'RETIRED'> {
  return getMockDb().deleteVehicle(id)
}

/**
 * Trạng thái mọi xe (D-53): đang chạy suy từ chuyến `loading`…`delivering`, bảo dưỡng do người đặt. Xe đang chạy kèm pha của chuyến
 * (đọc từ danh sách chuyến, chỉ khi có xe đang chạy) để danh sách ghi chuyến đó đang ở bước nào.
 */
export async function fetchVehicleStates(): Promise<FleetVehicleState[]> {
  const db = getMockDb()
  const states = await db.listVehicleStates()
  if (!states.some((state) => state.tripId !== undefined)) return states
  const phaseOf = new Map((await db.listTrips()).map((trip) => [trip.id, trip.phase]))
  return states.map((state) => {
    const tripPhase = state.tripId === undefined ? undefined : phaseOf.get(state.tripId)
    return tripPhase === undefined ? state : { ...state, tripPhase }
  })
}

/** Bật bảo dưỡng kèm ghi chú, hoặc tắt khi `note` là `null`. Xe đang chạy chuyến: `VEHICLE_LOCKED`. */
export function saveVehicleMaintenance(id: string, note: string | null): Promise<FleetVehicleState> {
  return getMockDb().setVehicleMaintenance(id, note)
}
