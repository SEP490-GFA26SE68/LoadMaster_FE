import { api, apiFetch } from '@/lib/api-client'
import { isoFromBackend } from '@/lib/backend-time'
import type { TripVehicleConfigResponse } from '@/features/trips/trips-api'

/**
 * Hàm → endpoint (nhóm `fleet`):
 *   fetchVehicles            → GET /api/vehicles
 *   saveVehicle              → POST /api/vehicles
 *   updateVehicle            → PUT /api/vehicles/{id}
 *   deleteVehicle            → DELETE /api/vehicles/{id}
 *   startVehicleMaintenance  → POST /api/vehicles/{id}/maintenance
 *   endVehicleMaintenance    → DELETE /api/vehicles/{id}/maintenance
 *   fetchVehicleById         → GET /api/vehicles/{id}
 *   fetchVehicleConfig       → GET /api/vehicles/{id}/config
 */

export type VehicleApi = {
  id: number
  name: string
  licensePlate: string

  vehicleTypeId: number
  vehicleTypeName: string

  companyId: number
  companyName: string
  status: VehicleStatus
  maintenanceNote?: string | null
  maintenanceSince?: string | null
  currentTripCode?: string | null
  currentTripStatus?: string | null
}

export type Vehicle = {
  id: string
  name: string
  licensePlate: string

  vehicleTypeId: string
  vehicleTypeName: string

  companyId: string
  companyName: string

  status: VehicleStatus
  /** Khi bảo dưỡng: ghi chú (có thể trống) và lúc bắt đầu (ISO). */
  maintenance?: { readonly note: string; readonly since: string }
  /** Khi đang chạy: mã chuyến và trạng thái chuyến của máy chủ (`LOADING` | `IN_TRANSIT`). */
  currentTrip?: { readonly code: string; readonly status: string }
}

export type CreateVehicleInput = {
  name: string
  licensePlate: string
  vehicleTypeId: string
}

type CreateVehicleRequest = {
  name: string
  licensePlate: string
  vehicleTypeId: number
}

export type PageResponse<T> = {
  success: boolean
  message?: string
  data: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export type VehicleStatus =
  | 'AVAILABLE'
  | 'IN_TRIP'
  | 'MAINTENANCE'
  | 'RETIRED'

function mapVehicle(
  vehicle: VehicleApi,
): Vehicle {
  return {
    id: String(vehicle.id),
    name: vehicle.name,
    licensePlate: vehicle.licensePlate,

    vehicleTypeId:
      String(vehicle.vehicleTypeId),

    vehicleTypeName:
      vehicle.vehicleTypeName,

    companyId:
      String(vehicle.companyId),

    companyName:
      vehicle.companyName,

    status: vehicle.status,
    ...(vehicle.status === 'MAINTENANCE' && vehicle.maintenanceSince
      ? { maintenance: { note: vehicle.maintenanceNote?.trim() ?? '', since: isoFromBackend(vehicle.maintenanceSince) } }
      : {}),
    ...(vehicle.currentTripCode
      ? { currentTrip: { code: vehicle.currentTripCode, status: vehicle.currentTripStatus ?? '' } }
      : {}),
  }
}

function toCreateVehicleRequest(
  input: CreateVehicleInput,
): CreateVehicleRequest {
  return {
    name: input.name.trim(),

    licensePlate:
      input.licensePlate
        .trim()
        .toUpperCase(),

    vehicleTypeId:
      Number(input.vehicleTypeId),
  }
}

export async function fetchVehicles(
  page = 0,
  size = 20,
  search?: string,
  vehicleTypeId?: string,
): Promise<PageResponse<Vehicle>> {
  const params =
    new URLSearchParams({
      page: String(page),
      size: String(size),
    })

  if (search?.trim()) {
    params.set(
      'search',
      search.trim(),
    )
  }

  if (vehicleTypeId) {
    params.set(
      'vehicleTypeId',
      vehicleTypeId,
    )
  }

  const response =
    await apiFetch<PageResponse<VehicleApi>>(
      `/api/vehicles?${params.toString()}`,
    )

  return {
    ...response,
    data: response.data.map(mapVehicle),
  }
}

export async function saveVehicle(
  input: CreateVehicleInput,
): Promise<Vehicle> {
  const response =
    await apiFetch<{
      success: boolean
      message?: string
      data: VehicleApi
    }>(
      '/api/vehicles',
      {
        method: 'POST',
        body: JSON.stringify(
          toCreateVehicleRequest(input),
        ),
      },
    )

  return mapVehicle(response.data)
}

/**
 * Lấy thông tin một xe theo Vehicle ID.
 * Chỉ đọc, không thay đổi trạng thái xe.
 */
export async function fetchVehicleById(
  vehicleId: string,
): Promise<Vehicle> {
  const response = await apiFetch<{
    success: boolean
    message?: string
    data: VehicleApi
  }>(
    `/api/vehicles/${encodeURIComponent(vehicleId)}`,
  )

  return mapVehicle(response.data)
}

/**
 * Lấy cấu hình 3D của xe theo Vehicle ID.
 * Bao gồm kích thước thùng, cửa, thông số trục và vật cản.
 */
export async function fetchVehicleConfig(
  vehicleId: string,
): Promise<TripVehicleConfigResponse> {
  const response = await apiFetch<{
    success: boolean
    message?: string
    data: TripVehicleConfigResponse
  }>(
    `/api/vehicles/${encodeURIComponent(vehicleId)}/config`,
  )

  return response.data
}
/** Xoá xe: `DELETED` là đã xoá hẳn, `RETIRED` là xe còn trong lịch sử chuyến nên máy chủ chuyển sang Ngừng sử dụng. */
export type VehicleDeleteOutcome = 'DELETED' | 'RETIRED'

// PUT /api/vehicles/{id}
export async function updateVehicle(id: string, input: CreateVehicleInput): Promise<Vehicle> {
  return mapVehicle(await api().put<VehicleApi>(`/api/vehicles/${encodeURIComponent(id)}`, { body: toCreateVehicleRequest(input) }))
}

// DELETE /api/vehicles/{id}
export async function deleteVehicle(id: string): Promise<VehicleDeleteOutcome> {
  const result = await api().delete<{ outcome?: string } | null>(`/api/vehicles/${encodeURIComponent(id)}`)
  return result?.outcome === 'RETIRED' ? 'RETIRED' : 'DELETED'
}

// POST /api/vehicles/{id}/maintenance
export async function startVehicleMaintenance(id: string, note: string): Promise<Vehicle> {
  return mapVehicle(await api().post<VehicleApi>(`/api/vehicles/${encodeURIComponent(id)}/maintenance`, { body: { note } }))
}

// DELETE /api/vehicles/{id}/maintenance
export async function endVehicleMaintenance(id: string): Promise<Vehicle> {
  return mapVehicle(await api().delete<VehicleApi>(`/api/vehicles/${encodeURIComponent(id)}/maintenance`))
}
