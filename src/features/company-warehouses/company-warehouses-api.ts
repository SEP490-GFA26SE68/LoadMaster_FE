
import { apiFetch } from '@/lib/api-client'

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
  const response = await apiFetch<ApiResponse<CompanyWarehouse[]>>(
    `/api/company-warehouses?activeOnly=${activeOnly}`,
  )

  return response.data
}

/** Xem chi tiết một kho. */
export async function fetchCompanyWarehouse(
  warehouseId: number,
): Promise<CompanyWarehouse> {
  const response = await apiFetch<ApiResponse<CompanyWarehouse>>(
    `/api/company-warehouses/${warehouseId}`,
  )

  return response.data
}

/** Company Manager đăng ký kho mới. */
export async function createCompanyWarehouse(
  input: CompanyWarehouseInput,
): Promise<CompanyWarehouse> {
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
  const response = await apiFetch<ApiResponse<CompanyWarehouse>>(
    `/api/company-warehouses/${warehouseId}/active?active=${active}`,
    {
      method: 'PATCH',
    },
  )

  return response.data
}
