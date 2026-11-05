
import { apiFetch } from '@/lib/api-client'

export type PackageTypeApi = {
  id: number
  companyId: number
  typeCode: string | null
  name: string

  length: number
  width: number
  height: number
  weightKg: number
  maxStackingWeightKg: number

  isFragile: boolean
  rotationAllowed: boolean
  allowRotateX: boolean
  allowRotateY: boolean
  allowRotateZ: boolean
}

export type PackageType = {
  id: string
  companyId: string
  typeCode: string | null
  name: string

  lengthCm: number
  widthCm: number
  heightCm: number
  weightKg: number
  maxStackWeightKg: number

  isFragile: boolean
  rotationAllowed: boolean
  allowRotateX: boolean
  allowRotateY: boolean
  allowRotateZ: boolean
}

export type PackageTypeInput = Omit<
  PackageType,
  'id' | 'companyId'
>

type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
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

function mapPackageType(
  item: PackageTypeApi,
): PackageType {
  return {
    id: String(item.id),
    companyId: String(item.companyId),
    typeCode: item.typeCode,
    name: item.name,

    lengthCm: item.length,
    widthCm: item.width,
    heightCm: item.height,
    weightKg: item.weightKg,
    maxStackWeightKg: item.maxStackingWeightKg,

    isFragile: item.isFragile,
    rotationAllowed: item.rotationAllowed,
    allowRotateX: item.allowRotateX,
    allowRotateY: item.allowRotateY,
    allowRotateZ: item.allowRotateZ,
  }
}

function toRequest(input: PackageTypeInput) {
  return {
    typeCode: input.typeCode,
    name: input.name.trim(),
    length: input.lengthCm,
    width: input.widthCm,
    height: input.heightCm,
    weightKg: input.weightKg,
    maxStackingWeightKg: input.maxStackWeightKg,
    isFragile: input.isFragile,
    rotationAllowed: input.rotationAllowed,
    allowRotateX: input.allowRotateX,
    allowRotateY: input.allowRotateY,
    allowRotateZ: input.allowRotateZ,
  }
}

export async function fetchPackageTypes(
  page = 0,
  size = 25,
): Promise<PageResponse<PackageType>> {
  const response =
    await apiFetch<PageResponse<PackageTypeApi>>(
      `/api/package-types?page=${page}&size=${size}`,
    )

  return {
    ...response,
    data: response.data.map(mapPackageType),
  }
}

export async function fetchPackageType(
  id: string,
): Promise<PackageType> {
  const response =
    await apiFetch<ApiResponse<PackageTypeApi>>(
      `/api/package-types/${id}`,
    )

  return mapPackageType(response.data)
}

export async function savePackageType(
  input: PackageTypeInput,
  id?: string,
): Promise<PackageType> {
  const response =
    await apiFetch<ApiResponse<PackageTypeApi>>(
      id
        ? `/api/package-types/${id}`
        : '/api/package-types',
      {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(toRequest(input)),
      },
    )

  return mapPackageType(response.data)
}

export async function deletePackageType(
  id: string,
): Promise<void> {
  await apiFetch(
    `/api/package-types/${id}`,
    {
      method: 'DELETE',
    },
  )
}
