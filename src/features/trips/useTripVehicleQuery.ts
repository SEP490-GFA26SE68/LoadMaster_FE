import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { changeTripVehicle, fetchVehicleChoices } from './trip-vehicle-api'

/**
 * Hook Query cho Đổi xe (FE-5b-08). Danh sách xe chọn được nằm dưới `['trips', tripId]`: sửa kiện của chuyến làm mới nó; đọc lại mỗi
 * lần mở hộp thoại vì trạng thái xe đổi ở màn khác (kho bắt đầu xếp, bảo dưỡng). Đổi xe làm phương án của chuyến lỗi thời nên làm mới
 * cả chuyến (chi tiết, Planner), danh sách chuyến, bảng điều khiển và màn kho.
 */
export function useVehicleChoicesQuery(tripId: string, enabled: boolean) {
  return useQuery({ queryKey: ['trips', tripId, 'vehicle-choices'], queryFn: () => fetchVehicleChoices(tripId), enabled, staleTime: 0 })
}

export function useChangeTripVehicleMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (vehicleId: string) => changeTripVehicle(tripId, vehicleId),
    onSuccess: () => Promise.all([['trips', tripId], ['trips', 'list'], ['dashboard'], ['warehouse']].map((queryKey) => client.invalidateQueries({ queryKey }))),
  })
}
