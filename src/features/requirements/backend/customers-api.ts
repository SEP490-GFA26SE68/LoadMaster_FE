
import { apiFetch } from '@/lib/api-client'

export type Customer = {
  id: number
  companyId: number
  name: string
  contactPhone: string
  address: string
}

export type CreateCustomerInput = {
  name: string
  contactPhone: string
  address: string
}

type CustomerPageResponse = {
  success: boolean
  data: Customer[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

type CustomerApiResponse = {
  success: boolean
  data: Customer
}

/**
 * Lấy danh sách khách hàng của công ty logistics hiện tại.
 * Backend tự xác định companyId từ Keycloak.
 *
 * Đọc đủ các trang để phục vụ dropdown chọn khách hàng.
 */
export async function fetchCustomers(): Promise<Customer[]> {
  const size = 100

  const first = await apiFetch<CustomerPageResponse>(
    `/api/customers?page=0&size=${size}`,
  )

  // Biết số trang sau trang đầu: đọc các trang còn lại cùng lúc, giữ đúng thứ tự trang
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, index) =>
      apiFetch<CustomerPageResponse>(`/api/customers?page=${index + 1}&size=${size}`),
    ),
  )

  return [first, ...rest].flatMap((response) => response.data)
}

/**
 * Dispatcher đăng ký khách hàng mới.
 * Không gửi companyId từ FE.
 */
export async function createCustomer(
  input: CreateCustomerInput,
): Promise<Customer> {
  const response = await apiFetch<CustomerApiResponse>(
    '/api/customers',
    {
      method: 'POST',
      body: JSON.stringify({
        name: input.name.trim(),
        contactPhone: input.contactPhone.trim(),
        address: input.address.trim(),
      }),
    },
  )

  return response.data
}
