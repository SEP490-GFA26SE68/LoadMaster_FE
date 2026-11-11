import type { VehicleAssignmentRow, VehicleTypeRow } from '@/features/vehicle-types/vehicle-types-api'
import { api, ApiError } from '@/lib/api-client'
import { fetchAllPages } from '@/lib/api-page'
import { compareText } from '@/lib/list-filter'
import {
  configVehicleOf,
  listVehicleOf,
  vehicleNameOf,
  vehicleStateOf,
  vehicleTypeRowsOf,
  type BackendVehicle,
  type BackendVehicleConfig,
  type BackendVehicleType,
} from './fleet-dto'
import type { FleetVehicle, FleetVehicleState } from './vehicle-status'

/**
 * Đội xe và loại xe từ backend (nhóm `fleet`): `vehicles-api.ts` và `vehicle-types-api.ts` gọi vào đây khi nhóm bật. Hai
 * danh sách của backend là `PageResponse` trần (không phong bì), đọc đủ mọi trang rồi màn tự lọc, sắp, phân trang. Thùng hàng của xe là
 * của loại xe đang gắn: danh sách xe ghép với danh sách loại xe, trang cấu hình đọc `/api/vehicles/{id}/config` (có thêm trục).
 */

const listVehicles = () => fetchAllPages<BackendVehicle>('/api/vehicles')
const listVehicleTypes = () => fetchAllPages<BackendVehicleType>('/api/vehicle-types')

function readConfig(id: string): Promise<BackendVehicleConfig> {
  return api().get<BackendVehicleConfig>(`/api/vehicles/${encodeURIComponent(id)}/config`)
}

// GET /api/vehicles · GET /api/vehicle-types · GET /api/vehicles/{id}/config (xe có loại không nằm trong danh sách loại xe)
export async function readBackendVehicles(): Promise<FleetVehicle[]> {
  const [vehicles, types] = await Promise.all([listVehicles(), listVehicleTypes()])
  const typeOf = new Map(types.map((type) => [type.id, type]))
  return Promise.all(vehicles.map(async (vehicle) => {
    const type = vehicle.vehicleTypeId === null || vehicle.vehicleTypeId === undefined ? undefined : typeOf.get(vehicle.vehicleTypeId)
    return type ? listVehicleOf(vehicle, type) : configVehicleOf(await readConfig(String(vehicle.id)))
  }))
}

// GET /api/vehicles/{id}/config
export async function readBackendVehicle(id: string): Promise<FleetVehicle> {
  return configVehicleOf(await readConfig(id))
}

// GET /api/vehicles
export async function readBackendVehicleStates(): Promise<FleetVehicleState[]> {
  return (await listVehicles()).map(vehicleStateOf).filter((state) => state !== null)
}

// GET /api/vehicle-types · GET /api/vehicles
export async function readBackendVehicleTypes(): Promise<VehicleTypeRow[]> {
  const [types, vehicles] = await Promise.all([listVehicleTypes(), listVehicles()])
  return vehicleTypeRowsOf(types, vehicles)
}

// GET /api/vehicles
export async function readBackendAssignments(): Promise<VehicleAssignmentRow[]> {
  return (await listVehicles())
    .map((vehicle) => ({
      vehicle: { id: String(vehicle.id), name: vehicleNameOf(vehicle.name, vehicle.licensePlate) },
      vehicleTypeId: vehicle.vehicleTypeId === null || vehicle.vehicleTypeId === undefined ? null : String(vehicle.vehicleTypeId),
    }))
    .toSorted((a, b) => compareText(a.vehicle.name, b.vehicle.name))
}

// DELETE /api/vehicles/{id}
export async function deleteBackendVehicle(id: string): Promise<void> {
  await api().delete<unknown>(`/api/vehicles/${encodeURIComponent(id)}`)
}

/** Bật bảo dưỡng kèm ghi chú, hoặc tắt khi `note` là `null`; trả trạng thái mới của xe. */
// POST /api/vehicles/{id}/maintenance · DELETE /api/vehicles/{id}/maintenance
export async function setBackendVehicleMaintenance(id: string, note: string | null): Promise<FleetVehicleState> {
  const path = `/api/vehicles/${encodeURIComponent(id)}/maintenance`
  const vehicle = note === null ? await api().delete<BackendVehicle>(path) : await api().post<BackendVehicle>(path, { body: { note } })
  const state = vehicleStateOf(vehicle)
  if (state === null) throw new ApiError('SERVER_ERROR')
  return state
}

// DELETE /api/vehicle-types/{id}
export async function deleteBackendVehicleType(id: string): Promise<void> {
  await api().delete<unknown>(`/api/vehicle-types/${encodeURIComponent(id)}`)
}
