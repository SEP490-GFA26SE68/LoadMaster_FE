
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  createCompanyWarehouse,
  fetchCompanyWarehouse,
  fetchCompanyWarehouses,
  setCompanyWarehouseActive,
  setDefaultCompanyWarehouse,
  updateCompanyWarehouse,
  type CompanyWarehouseInput,
} from './company-warehouses-api'

export const companyWarehouseKeys = {
  all: ['company-warehouses'] as const,

  lists: () =>
    [...companyWarehouseKeys.all, 'list'] as const,

  list: (activeOnly: boolean) =>
    [...companyWarehouseKeys.lists(), activeOnly] as const,

  detail: (warehouseId: number) =>
    [...companyWarehouseKeys.all, 'detail', warehouseId] as const,
}

/** Lấy danh sách kho của công ty đang đăng nhập. */
export function useCompanyWarehousesQuery(
  activeOnly = false,
) {
  return useQuery({
    queryKey: companyWarehouseKeys.list(activeOnly),
    queryFn: () => fetchCompanyWarehouses(activeOnly),
  })
}

/** Lấy chi tiết một kho. */
export function useCompanyWarehouseQuery(
  warehouseId: number | null,
) {
  return useQuery({
    queryKey: companyWarehouseKeys.detail(warehouseId ?? 0),
    queryFn: () => fetchCompanyWarehouse(warehouseId!),
    enabled: warehouseId !== null,
  })
}

/** Tạo kho mới. */
export function useCreateCompanyWarehouseMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createCompanyWarehouse,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: companyWarehouseKeys.all,
      })
    },
  })
}

/** Sửa thông tin kho. */
export function useUpdateCompanyWarehouseMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      warehouseId,
      input,
    }: {
      warehouseId: number
      input: CompanyWarehouseInput
    }) => updateCompanyWarehouse(warehouseId, input),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: companyWarehouseKeys.all,
      })
    },
  })
}

/** Đặt một kho làm kho mặc định. */
export function useSetDefaultCompanyWarehouseMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: setDefaultCompanyWarehouse,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: companyWarehouseKeys.all,
      })
    },
  })
}

/** Kích hoạt hoặc ngừng hoạt động kho. */
export function useSetCompanyWarehouseActiveMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      warehouseId,
      active,
    }: {
      warehouseId: number
      active: boolean
    }) => setCompanyWarehouseActive(warehouseId, active),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: companyWarehouseKeys.all,
      })
    },
  })
}
