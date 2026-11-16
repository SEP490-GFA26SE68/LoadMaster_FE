import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { GeoPoint } from '@/domain/routing'
import { getTripEta, optimizeTripRoute } from './route-api'
import { getActiveRoutePlan, getTripRoutePath } from './route-plan-api'

/**
 * Hook Query cho tuyến của chuyến (FE-4b-09). Khoá đọc nằm dưới `['trips', tripId]`: đổi thứ tự điểm, thêm / bớt điểm, đưa yêu cầu
 * giao vào chuyến hay đổi giờ xuất phát đều làm mới giờ đến dự kiến. Tối ưu tuyến đổi trạng thái chuyến (Nháp → Đã lập kế hoạch), thứ
 * tự điểm và số điểm giao của dòng kiện, nên làm mới cả chuyến, danh sách chuyến, bảng điều khiển và màn kho.
 */
export function useTripEtaQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'eta'], queryFn: () => getTripEta(tripId), enabled: tripId !== '', staleTime: 0 })
}

/**
 * Đường vẽ cho `RouteMap`: tuyến đã lưu ở máy chủ khi `onServer` (chuyến của máy chủ), không thì các đoạn nối thẳng kho → điểm giao.
 * Lỗi của máy chủ nằm ở `isError` của truy vấn và màn nói ra — không thành "không có đường".
 */
export function useTripRoutePathQuery(
  tripId: string,
  fallback: { depot?: GeoPoint; stops: readonly GeoPoint[] },
  enabled: boolean,
  onServer: boolean,
) {
  const depotKey = fallback.depot ? `${fallback.depot.lat},${fallback.depot.lng}` : ''
  const stopsKey = fallback.stops.map((stop) => `${stop.lat},${stop.lng}`).join('|')
  return useQuery({
    queryKey: ['trips', tripId, 'route-path', onServer, depotKey, stopsKey],
    queryFn: () => getTripRoutePath(tripId, fallback, onServer),
    enabled: enabled && tripId !== '',
    staleTime: 30_000,
  })
}

/** Tuyến đang dùng kèm hướng dẫn từng chặng (dẫn đường của tài xế); `onServer` như `useTripRoutePathQuery`. */
export function useActiveRoutePlanQuery(tripId: string, onServer: boolean) {
  return useQuery({
    queryKey: ['trips', tripId, 'route-plan'],
    queryFn: () => getActiveRoutePlan(tripId, onServer),
    enabled: tripId !== '',
    staleTime: 15_000,
  })
}

export function useOptimizeRouteMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => optimizeTripRoute(tripId),
    onSuccess: () => Promise.all(
      [['trips', tripId], ['trips', 'list'], ['dashboard'], ['warehouse'], ['package-pool']].map((queryKey) =>
        client.invalidateQueries({ queryKey }),
      ),
    ),
  })
}
