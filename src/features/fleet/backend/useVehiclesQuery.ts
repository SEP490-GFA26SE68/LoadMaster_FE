
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  fetchVehicles,
  saveVehicle,
  type CreateVehicleInput,
} from './vehicles-api'

/**
 * React Query cho module Đội xe.
 *
 * Dữ liệu Vehicle lấy từ backend thật.
 * Trạng thái xe đã được BE trả về trong Vehicle.status.
 */

const VEHICLES_KEY = ['vehicles'] as const

export function useVehiclesQuery(
  page = 0,
  size = 20,
  search?: string,
  vehicleTypeId?: string,
) {
  return useQuery({
    queryKey: [
      ...VEHICLES_KEY,
      'list',
      page,
      size,
      search ?? '',
      vehicleTypeId ?? '',
    ],

    queryFn: () =>
      fetchVehicles(
        page,
        size,
        search,
        vehicleTypeId,
      ),
  })
}

/**
 * Tạo xe mới.
 * Sau khi tạo thành công, danh sách xe và
 * dashboard sẽ được cập nhật lại.
 */
export function useSaveVehicleMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateVehicleInput) =>
      saveVehicle(input),

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: VEHICLES_KEY,
        }),

        queryClient.invalidateQueries({
          queryKey: ['dashboard'],
        }),
      ])
    },
  })
}
