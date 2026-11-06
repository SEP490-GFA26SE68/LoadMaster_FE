/**
 * Hàm → endpoint backend (FE-0-09). Nhóm `fleet` nối backend (`usesBackend('fleet')`, thân hàm ở `fleet-backend-api.ts`), chỉ phần đọc:
 *   fetchVehicles      → GET /api/vehicles · GET /api/vehicle-types
 *   fetchVehicle       → GET /api/vehicles/{id}/config
 *   fetchVehicleStates → GET /api/vehicles
 *   chưa có ở BE: saveVehicle, deleteVehicle, saveVehicleMaintenance
 */

import type { VehicleConfig } from '@/domain/models'
import { ApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import { getMockDb, type VehicleState } from '@/lib/mock-db'
import { readBackendVehicle, readBackendVehicles, readBackendVehicleStates } from './fleet-backend-api'
import type { FleetVehicle, FleetVehicleState } from './vehicle-status'

/**
 * Lớp gọi API cho Đội xe (D-06): kho mẫu dùng chung (`@/lib/mock-db`), hoặc backend khi nhóm `fleet` bật. Component không gọi trực tiếp
 * file này (AGENTS mục 9) — đi qua `useVehiclesQuery` và các hook cùng thư mục.
 */

const ON_BACKEND = usesBackend('fleet')

/**
 * Việc Đội xe và Loại xe làm được với nguồn dữ liệu đang dùng (D-20: không có nút giả). Kho mẫu làm được hết. Backend chỉ có phần đọc:
 * danh sách xe kèm trạng thái, cấu hình một xe (thùng hàng, vật cản, trục của loại xe), danh sách loại xe và loại của từng xe. Backend
 * chưa có — màn ẩn: thêm / sửa / xoá xe, bảo dưỡng, thêm / sửa / xoá loại xe, đổi loại của xe, chuyến đang dùng xe, ghi chú bảo dưỡng,
 * khoảng hở quanh kiện. Chỉ điều phối viên đọc được xe và loại xe (backend từ chối quản lý công ty).
 */
export type FleetCapabilities = {
  /** Thêm, sửa, xoá xe và loại xe, bảo dưỡng, đổi loại của xe. */
  readonly write: boolean
  /** Trạng thái kèm chuyến đang dùng xe và ghi chú bảo dưỡng. */
  readonly stateDetails: boolean
  /** Khoảng hở quanh kiện của xe. */
  readonly clearance: boolean
  /** Trạng thái "Ngừng sử dụng" (chỉ backend có). */
  readonly retired: boolean
  /** Chỉ điều phối viên đọc được đội xe và loại xe. */
  readonly dispatcherOnly: boolean
}

export const FLEET_CAPABILITIES: FleetCapabilities = {
  write: !ON_BACKEND,
  stateDetails: !ON_BACKEND,
  clearance: !ON_BACKEND,
  retired: ON_BACKEND,
  dispatcherOnly: ON_BACKEND,
}

/** Việc backend chưa có: màn đã ẩn nút, lỡ gọi tới thì từ chối — không bao giờ báo thành công giả hay ghi kho mẫu thay. */
const unsupported = (): Promise<never> => Promise.reject(new ApiError('NOT_SUPPORTED'))

// GET /api/vehicles · GET /api/vehicle-types
export function fetchVehicles(): Promise<FleetVehicle[]> {
  if (ON_BACKEND) return readBackendVehicles()
  return getMockDb().listVehicles()
}

// GET /api/vehicles/{id}/config
export function fetchVehicle(id: string): Promise<FleetVehicle> {
  if (ON_BACKEND) return readBackendVehicle(id)
  return getMockDb().getVehicle(id)
}

/** Xe chưa có mã (`id` rỗng) là xe mới: kho cấp mã `VEHICLE-NNN` kế tiếp. */
// chưa có ở BE
export function saveVehicle(vehicle: VehicleConfig): Promise<VehicleConfig> {
  if (ON_BACKEND) return unsupported()
  const { id, ...input } = vehicle
  return id === '' ? getMockDb().createVehicle(input) : getMockDb().updateVehicle(vehicle)
}

// chưa có ở BE
export function deleteVehicle(id: string): Promise<void> {
  if (ON_BACKEND) return unsupported()
  return getMockDb().deleteVehicle(id)
}

/**
 * Trạng thái mọi xe (D-53): đang chạy suy từ chuyến `loading`…`delivering`, bảo dưỡng do người đặt. Xe đang chạy kèm pha của chuyến
 * (đọc từ danh sách chuyến, chỉ khi có xe đang chạy) để danh sách ghi chuyến đó đang ở bước nào. Backend chỉ trả trạng thái.
 */
// GET /api/vehicles
export async function fetchVehicleStates(): Promise<FleetVehicleState[]> {
  if (ON_BACKEND) return readBackendVehicleStates()
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
// chưa có ở BE
export function saveVehicleMaintenance(id: string, note: string | null): Promise<VehicleState> {
  if (ON_BACKEND) return unsupported()
  return getMockDb().setVehicleMaintenance(id, note)
}
