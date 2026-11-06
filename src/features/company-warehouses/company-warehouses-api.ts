
import { ApiError, apiFetch } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'

/** Kho của công ty chỉ có ở máy chủ: kho mẫu không có danh mục này, nên khi nhóm `companies` chưa nối mọi hàm từ chối `NOT_SUPPORTED` mà không gọi mạng. */
const ON_BACKEND = usesBackend('companies')
const unsupported = (): Promise<never> => Promise.reject(new ApiError('NOT_SUPPORTED'))

export type CompanyWarehouse = {
  id: number
  companyId: number
  warehouseName: string
  address: string
  latitude: number | null
  longitude: number | null
  isDefault: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CompanyWarehouseInput = {
  warehouseName: string
  address: string
  latitude: number | null
  longitude: number | null
}

type ApiResponse<T> = {
  success: boolean
  data: T
}

/** Danh sách kho thuộc công ty đang đăng nhập. */
export async function fetchCompanyWarehouses(
  activeOnly = false,
): Promise<CompanyWarehouse[]> {
  if (!ON_BACKEND) return unsupported()
  const response = await apiFetch<ApiResponse<CompanyWarehouse[]>>(
    `/api/company-warehouses?activeOnly=${activeOnly}`,
  )

  return response.data
}

/** Xem chi tiết một kho. */
export async function fetchCompanyWarehouse(
  warehouseId: number,
): Promise<CompanyWarehouse> {
  if (!ON_BACKEND) return unsupported()
  const response = await apiFetch<ApiResponse<CompanyWarehouse>>(
    `/api/company-warehouses/${warehouseId}`,
  )

  return response.data
}

/** Company Manager đăng ký kho mới. */
export async function createCompanyWarehouse(
  input: CompanyWarehouseInput,
): Promise<CompanyWarehouse> {
  if (!ON_BACKEND) return unsupported()
  const response = await apiFetch<ApiResponse<CompanyWarehouse>>(
    '/api/company-warehouses',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )

  return response.data
}

/** Company Manager sửa thông tin kho. */
export async function updateCompanyWarehouse(
  warehouseId: number,
  input: CompanyWarehouseInput,
): Promise<CompanyWarehouse> {
  if (!ON_BACKEND) return unsupported()
  const response = await apiFetch<ApiResponse<CompanyWarehouse>>(
    `/api/company-warehouses/${warehouseId}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  )

  return response.data
}

/** Chọn kho mặc định cho công ty. */
export async function setDefaultCompanyWarehouse(
  warehouseId: number,
): Promise<CompanyWarehouse> {
  if (!ON_BACKEND) return unsupported()
  const response = await apiFetch<ApiResponse<CompanyWarehouse>>(
    `/api/company-warehouses/${warehouseId}/default`,
    {
      method: 'PATCH',
    },
  )

  return response.data
}

/** Kích hoạt hoặc ngừng sử dụng kho. */
export async function setCompanyWarehouseActive(
  warehouseId: number,
  active: boolean,
): Promise<CompanyWarehouse> {
  if (!ON_BACKEND) return unsupported()
  const response = await apiFetch<ApiResponse<CompanyWarehouse>>(
    `/api/company-warehouses/${warehouseId}/active?active=${active}`,
    {
      method: 'PATCH',
    },
  )

  return response.data
}
