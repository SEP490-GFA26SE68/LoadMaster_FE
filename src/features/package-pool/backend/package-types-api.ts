
import { apiFetch } from '@/lib/api-client'
import { listParams, type ListQuery } from './package-list-query'

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
  /** σ, kg/m² (BigDecimal: số hoặc chuỗi); `null` / vắng là chưa khai. */
  topLoadCapacityKgM2?: number | string | null

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
  /** Sức chịu nén mặt trên σ, kg/m²; `null` là chưa khai — không có giá trị mặc định. */
  topLoadCapacityKgM2: number | null

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

/** BigDecimal của Jackson (số hoặc chuỗi) → số; trống hay không đọc được là `null`. */
export function decimalOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
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
    topLoadCapacityKgM2: decimalOrNull(item.topLoadCapacityKgM2),

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
    // Máy chủ bỏ qua `null` khi sửa: gửi `null` không xoá giá trị đã lưu (form chặn việc xoá trước khi gửi).
    topLoadCapacityKgM2: input.topLoadCapacityKgM2,
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
  query: ListQuery = {},
  signal?: AbortSignal,
): Promise<PageResponse<PackageType>> {
  const response =
    await apiFetch<PageResponse<PackageTypeApi>>(
      `/api/package-types?${listParams(page, size, query)}`, { signal },
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
