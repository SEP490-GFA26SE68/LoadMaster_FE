/**
 * Hàm → endpoint backend (FE-0-09). Nhóm `fleet` nối backend (`usesBackend('fleet')`, thân hàm ở `fleet-backend-api.ts`):
 *   fetchVehicles          → GET /api/vehicles · GET /api/vehicle-types
 *   fetchVehicle           → GET /api/vehicles/{id}/config
 *   fetchVehicleStates     → GET /api/vehicles
 *   deleteVehicle          → DELETE /api/vehicles/{id}
 *   saveVehicleMaintenance → POST /api/vehicles/{id}/maintenance · DELETE /api/vehicles/{id}/maintenance
 *   saveVehicle            → màn máy chủ dùng `backend/vehicles-api.ts` (POST /api/vehicles, PUT /api/vehicles/{id})
 */

import type { VehicleConfig } from '@/domain/models'
import { ApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import { getMockDb } from '@/lib/mock-db'
import {
  deleteBackendVehicle,
  readBackendVehicle,
  readBackendVehicles,
  readBackendVehicleStates,
  setBackendVehicleMaintenance,
} from './fleet-backend-api'
import type { FleetVehicle, FleetVehicleState } from './vehicle-status'

/**
 * Lớp gọi API cho Đội xe (D-06): kho mẫu dùng chung (`@/lib/mock-db`), hoặc backend khi nhóm `fleet` bật. Component không gọi trực tiếp
 * file này (AGENTS mục 9) — đi qua `useVehiclesQuery` và các hook cùng thư mục.
 */

const ON_BACKEND = usesBackend('fleet')

/**
 * Việc Đội xe và Loại xe làm được với nguồn dữ liệu đang dùng (D-20: không có nút giả). Kho mẫu làm được hết. Backend có thêm, sửa,
 * xoá xe (xe đã có chuyến thì máy chủ chuyển Ngừng sử dụng), bảo dưỡng, thêm / sửa / xoá loại xe, đổi loại của xe, chuyến đang dùng xe
 * và ghi chú bảo dưỡng — màn của nhóm `./backend` dùng; form xe của máy chủ chỉ có tên, biển số, loại xe vì thùng hàng là của loại xe.
 * Backend chưa có khoảng hở quanh kiện. Điều phối viên và quản lý công ty đọc được xe và loại xe (backend `VEHICLES_READ`,
 * `VEHICLE_TYPES_READ`) — đúng hai vai trò có `fleet.view`, nên màn mở theo quyền đó như kho mẫu.
 */
export type FleetCapabilities = {
  /** Thêm, sửa, xoá xe và loại xe, bảo dưỡng, đổi loại của xe. */
  readonly write: boolean
  /** Trạng thái kèm chuyến đang dùng xe và ghi chú bảo dưỡng. */
  readonly stateDetails: boolean
  /** Khoảng hở quanh kiện của xe. */
  readonly clearance: boolean
}

export const FLEET_CAPABILITIES: FleetCapabilities = {
  write: true,
  stateDetails: true,
  clearance: !ON_BACKEND,
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

/**
 * Xe chưa có mã (`id` rỗng) là xe mới: kho cấp mã `VEHICLE-NNN` kế tiếp. Xe của máy chủ không mang thùng hàng riêng (thùng là của loại
 * xe), nên form cấu hình xe của kho mẫu không ghi lên máy chủ: màn máy chủ ghi qua `backend/vehicles-api.ts`.
 */
export function saveVehicle(vehicle: VehicleConfig): Promise<VehicleConfig> {
  if (ON_BACKEND) return unsupported()
  const { id, ...input } = vehicle
  return id === '' ? getMockDb().createVehicle(input) : getMockDb().updateVehicle(vehicle)
}

/** Xe từng chạy chuyến không bị xoá mà chuyển sang Ngừng sử dụng (`RETIRED`), như máy chủ; màn báo đúng kết quả. */
// DELETE /api/vehicles/{id}
export function deleteVehicle(id: string): Promise<'DELETED' | 'RETIRED'> {
  if (ON_BACKEND) return deleteBackendVehicle(id)
  return getMockDb().deleteVehicle(id)
}

/**
 * Trạng thái mọi xe (D-53): đang chạy suy từ chuyến `loading`…`delivering`, bảo dưỡng do người đặt. Xe đang chạy kèm pha của chuyến
 * (đọc từ danh sách chuyến, chỉ khi có xe đang chạy) để danh sách ghi chuyến đó đang ở bước nào. Backend trả kèm chuyến và pha của nó.
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

/** Bật bảo dưỡng kèm ghi chú, hoặc tắt khi `note` là `null`. Xe đang chạy chuyến: `VEHICLE_LOCKED` (máy chủ: `VEHICLE_BUSY`). */
// POST /api/vehicles/{id}/maintenance · DELETE /api/vehicles/{id}/maintenance
export function saveVehicleMaintenance(id: string, note: string | null): Promise<FleetVehicleState> {
  if (ON_BACKEND) return setBackendVehicleMaintenance(id, note)
  return getMockDb().setVehicleMaintenance(id, note)
}
