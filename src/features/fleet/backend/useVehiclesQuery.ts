import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import {
  deleteVehicle,
  endVehicleMaintenance,
  fetchVehicles,
  saveVehicle,
  startVehicleMaintenance,
  updateVehicle,
  type CreateVehicleInput,
} from './vehicles-api'

/**
 * React Query cho module Đội xe đọc ghi máy chủ. Trạng thái xe, ghi chú bảo dưỡng và chuyến đang dùng xe đi kèm từng xe.
 * Mọi lần ghi làm mới danh sách xe, trang xe (`['backend', 'vehicle', id]`), số xe của loại xe, bảng điều khiển và chuyến
 * (đổi loại xe làm phương án của chuyến chưa rời kho lỗi thời).
 */

const VEHICLES_KEY = ['vehicles'] as const

function refreshFleet(client: QueryClient) {
  return Promise.all(
    [VEHICLES_KEY, ['backend'], ['vehicle-types'], ['dashboard'], ['trips']].map((queryKey) => client.invalidateQueries({ queryKey })),
  )
}

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

/** Tạo xe mới (`id` vắng) hoặc sửa tên, biển số, loại của xe đang có. */
export function useSaveVehicleMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ input, id }: { input: CreateVehicleInput; id?: string }) =>
      id === undefined ? saveVehicle(input) : updateVehicle(id, input),
    onSuccess: () => refreshFleet(queryClient),
  })
}

export function useDeleteVehicleMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteVehicle(id),
    onSuccess: () => refreshFleet(queryClient),
  })
}

/** Bật bảo dưỡng kèm ghi chú, hoặc tắt khi `note` là `null`. */
export function useVehicleMaintenanceMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string | null }) =>
      note === null ? endVehicleMaintenance(id) : startVehicleMaintenance(id, note),
    onSuccess: () => refreshFleet(queryClient),
  })
}
