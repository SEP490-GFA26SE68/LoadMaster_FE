import { apiFetch } from '@/lib/api-client'

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

