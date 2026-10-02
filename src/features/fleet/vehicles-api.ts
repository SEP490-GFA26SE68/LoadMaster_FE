/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   chưa có ở BE: fetchVehicles, fetchVehicle, saveVehicle, deleteVehicle, fetchVehicleStates, saveVehicleMaintenance
 */

import type { VehicleConfig } from '@/domain/models'
import { getMockDb, type VehicleState } from '@/lib/mock-db'

/**
 * Lớp gọi API cho Đội xe (D-06). Backend Spring Boot chưa có nên mọi lượt đọc/ghi đi qua kho mock
 * dùng chung (`@/lib/mock-db`), đã có độ trễ giả và trả `MockDbError` cho lỗi nghiệp vụ. Khi nối API
 * thật chỉ thay thân các hàm ở đây; hook Query và component không đổi.
 *
 * Component không gọi trực tiếp file này (AGENTS mục 9) — đi qua `useVehiclesQuery` và các hook cùng thư mục.
 */

// chưa có ở BE
export function fetchVehicles(): Promise<VehicleConfig[]> {
  return getMockDb().listVehicles()
}

// chưa có ở BE
export function fetchVehicle(id: string): Promise<VehicleConfig> {
  return getMockDb().getVehicle(id)
}

/** Xe chưa có mã (`id` rỗng) là xe mới: kho cấp mã `VEHICLE-NNN` kế tiếp. */
// chưa có ở BE
export function saveVehicle(vehicle: VehicleConfig): Promise<VehicleConfig> {
  const { id, ...input } = vehicle
  return id === '' ? getMockDb().createVehicle(input) : getMockDb().updateVehicle(vehicle)
}

// chưa có ở BE
export function deleteVehicle(id: string): Promise<void> {
  return getMockDb().deleteVehicle(id)
}

/** Trạng thái mọi xe (D-53): đang chạy suy từ chuyến `loading`…`delivering`, bảo dưỡng do người đặt. */
// chưa có ở BE
export function fetchVehicleStates(): Promise<VehicleState[]> {
  return getMockDb().listVehicleStates()
}

/** Bật bảo dưỡng kèm ghi chú, hoặc tắt khi `note` là `null`. Xe đang chạy chuyến: `VEHICLE_LOCKED`. */
// chưa có ở BE
export function saveVehicleMaintenance(id: string, note: string | null): Promise<VehicleState> {
  return getMockDb().setVehicleMaintenance(id, note)
}
