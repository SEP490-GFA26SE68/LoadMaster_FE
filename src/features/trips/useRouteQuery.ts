import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getTripEta, optimizeTripRoute } from './route-api'

/**
 * Hook Query cho tuyến của chuyến (FE-4b-09). Khoá đọc nằm dưới `['trips', tripId]`: đổi thứ tự điểm, thêm / bớt điểm, đưa yêu cầu
 * giao vào chuyến hay đổi giờ xuất phát đều làm mới giờ đến dự kiến. Tối ưu tuyến đổi trạng thái chuyến (Nháp → Đã lập kế hoạch), thứ
 * tự điểm và số điểm giao của dòng kiện, nên làm mới cả chuyến, danh sách chuyến, bảng điều khiển và màn kho.
 */
export function useTripEtaQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'eta'], queryFn: () => getTripEta(tripId), enabled: tripId !== '', staleTime: 0 })
}

export function useOptimizeRouteMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => optimizeTripRoute(tripId),
    onSuccess: () => Promise.all([['trips', tripId], ['trips', 'list'], ['dashboard'], ['warehouse'], ['package-pool']].map((queryKey) => client.invalidateQueries({ queryKey }))),
  })
}
