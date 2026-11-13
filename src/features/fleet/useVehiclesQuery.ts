import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { VehicleConfig } from '@/domain/models'
import type { FleetVehicleState } from './vehicle-status'
import {
  deleteVehicle,
  fetchVehicle,
  fetchVehicles,
  fetchVehicleStates,
  saveVehicle,
  saveVehicleMaintenance,
} from './vehicles-api'

/**
 * Hook Query của Đội xe (D-06): component chỉ gọi vào đây, không gọi `vehicles-api.ts`.
 * Ghi xong thì vô hiệu hoá cache danh sách và chi tiết, nên danh sách tự cập nhật mà không tải lại trang.
 */

const VEHICLES_KEY = ['vehicles'] as const
/** Nằm dưới `['vehicles']`: ghi xe hay bảo dưỡng đều làm mới trạng thái. */
const VEHICLE_STATES_KEY = [...VEHICLES_KEY, 'states'] as const

function vehicleKey(id: string) {
  return [...VEHICLES_KEY, id] as const
}

export function useVehiclesQuery() {
  return useQuery({ queryKey: VEHICLES_KEY, queryFn: fetchVehicles })
}

/** `id` rỗng (trang thêm xe) thì không gọi kho. */
export function useVehicleQuery(id: string) {
  return useQuery({
    queryKey: vehicleKey(id),
    queryFn: () => fetchVehicle(id),
    enabled: id !== '',
  })
}

/**
 * Trạng thái mọi xe (D-53). "Đang chạy" đổi theo pha chuyến do kho và tài xế ghi ở màn khác, nên luôn đọc lại khi mở màn
 * (`staleTime: 0`) thay vì chờ các màn đó vô hiệu hoá cache của đội xe.
 */
export function useVehicleStatesQuery() {
  return useQuery({ queryKey: VEHICLE_STATES_KEY, queryFn: fetchVehicleStates, staleTime: 0 })
}

/** Trạng thái một xe, lọc từ danh sách trạng thái; `id` rỗng (xe mới) thì không gọi kho. */
export function useVehicleStateQuery(id: string) {
  return useQuery({
    queryKey: VEHICLE_STATES_KEY,
    queryFn: fetchVehicleStates,
    staleTime: 0,
    enabled: id !== '',
    select: (states: FleetVehicleState[]) => states.find((state) => state.vehicleId === id) ?? null,
  })
}

export function useSaveVehicleMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vehicle: VehicleConfig) => saveVehicle(vehicle),
    onSuccess: async (saved) => {
      queryClient.setQueryData(vehicleKey(saved.id), saved)
      // Số xe trên bảng điều khiển (LM-052) cũng đổi.
      await Promise.all([queryClient.invalidateQueries({ queryKey: VEHICLES_KEY }), queryClient.invalidateQueries({ queryKey: ['dashboard'] })])
    },
  })
}

export function useDeleteVehicleMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteVehicle(id),
    onSuccess: async (_result, id) => {
      queryClient.removeQueries({ queryKey: vehicleKey(id) })
      // Số xe trên bảng điều khiển (LM-052) cũng đổi.
      await Promise.all([queryClient.invalidateQueries({ queryKey: VEHICLES_KEY }), queryClient.invalidateQueries({ queryKey: ['dashboard'] })])
    },
  })
}

/**
 * Bật (`note`) hoặc tắt (`null`) bảo dưỡng. Làm mới mọi query dưới `['vehicles']` — kể cả danh sách xe để chọn ở form chuyến —
 * và bảng điều khiển.
 */
export function useVehicleMaintenanceMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string | null }) => saveVehicleMaintenance(id, note),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: VEHICLES_KEY }), queryClient.invalidateQueries({ queryKey: ['dashboard'] })])
    },
  })
}
