import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { GeoPoint } from '@/domain/routing'
import { getTripEta, optimizeTripRoute } from './route-api'
import { getTripRoutePath } from './route-plan-api'

/**
 * Hook Query cho tuyến của chuyến (FE-4b-09). Khoá đọc nằm dưới `['trips', tripId]`: đổi thứ tự điểm, thêm / bớt điểm, đưa yêu cầu
 * giao vào chuyến hay đổi giờ xuất phát đều làm mới giờ đến dự kiến. Tối ưu tuyến đổi trạng thái chuyến (Nháp → Đã lập kế hoạch), thứ
 * tự điểm và số điểm giao của dòng kiện, nên làm mới cả chuyến, danh sách chuyến, bảng điều khiển và màn kho.
 */
export function useTripEtaQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'eta'], queryFn: () => getTripEta(tripId), enabled: tripId !== '', staleTime: 0 })
}

/** Path polyline cho `RouteMap` (canonical RoutePlan khi BE thật; mock suy từ kho + stops). */
export function useTripRoutePathQuery(
  tripId: string,
  fallback?: { depot?: GeoPoint; stops: readonly GeoPoint[] },
  enabled = true,
) {
  const depotKey = fallback?.depot ? `${fallback.depot.lat},${fallback.depot.lng}` : ''
  const stopsKey = (fallback?.stops ?? []).map((stop) => `${stop.lat},${stop.lng}`).join('|')
  return useQuery({
    queryKey: ['trips', tripId, 'route-path', depotKey, stopsKey],
    queryFn: () => getTripRoutePath(tripId, fallback),
    enabled: enabled && tripId !== '',
    staleTime: 30_000,
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
