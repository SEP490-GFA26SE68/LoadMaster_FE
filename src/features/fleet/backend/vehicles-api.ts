import { apiFetch } from '@/lib/api-client'
import { fetchAllPages } from '@/lib/api-page'
import type { TripVehicleConfigResponse } from '@/features/trips/trips-api'
export type VehicleApi = {
  id: number
  name: string
  licensePlate: string

  vehicleTypeId: number
  vehicleTypeName: string

  companyId: number
  companyName: string
  status: VehicleStatus
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

    status: vehicle.status
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

export type VehicleListOptions = {
  status?: VehicleStatus
  sortBy?: string
  sortDir?: 'ASC' | 'DESC'
}

export async function fetchAllVehicles(): Promise<Vehicle[]> {
  return (await fetchAllPages<VehicleApi>('/api/vehicles', { size: 100 })).map(mapVehicle)
}

export async function fetchVehicles(
  page = 0,
  size = 20,
  search?: string,
  vehicleTypeId?: string,
  options: VehicleListOptions = {},
  signal?: AbortSignal,
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

  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && value !== '') params.set(key, value)
  }

  const response =
    await apiFetch<PageResponse<VehicleApi>>(
      `/api/vehicles?${params.toString()}`, { signal },
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