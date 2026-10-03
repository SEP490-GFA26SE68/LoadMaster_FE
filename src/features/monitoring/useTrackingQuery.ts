import { useQuery } from '@tanstack/react-query'
import { getTripMonitoring, listTripMonitoring } from './monitoring-api'

/**
 * Hook Query của giám sát (FE-6-08, FE-6-09). Kho không tự chạy: nó ghi điểm vị trí mới và tính lại ETA mỗi lần được đọc, nên màn đang
 * mở đọc lại theo `refreshMs` kho trả — thời gian thật tới điểm vị trí kế tiếp (30 giây ở giờ thật, ít nhất 1 giây khi tua nhanh).
 * Nhịp đó là `refetchInterval` của Query: không có `setInterval` riêng, gỡ màn là hết nhịp, tab ẩn thì nghỉ, và kho trả `null` (không
 * chuyến nào đang chạy) là dừng hẳn cho tới khi dữ liệu chuyến đổi. Khoá nằm dưới `['trips']`: mọi lần ghi của chuyến làm mới chúng.
 */
export function useTripMonitoringQuery(tripId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['trips', tripId, 'monitoring'],
    queryFn: () => getTripMonitoring(tripId),
    enabled: enabled && tripId !== '',
    staleTime: 0,
    refetchInterval: (query) => query.state.data?.refreshMs ?? false,
  })
}

/** Mọi chuyến Đang vận chuyển của công ty; làm mới theo chuyến có điểm vị trí kế tiếp sớm nhất. */
export function useFleetMonitoringQuery(enabled: boolean) {
  return useQuery({
    queryKey: ['trips', 'monitoring'],
    queryFn: listTripMonitoring,
    enabled,
    staleTime: 0,
    refetchInterval: (query) => {
      const waits = (query.state.data ?? []).flatMap((trip) => (trip.refreshMs === null ? [] : [trip.refreshMs]))
      return waits.length > 0 ? Math.min(...waits) : false
    },
  })
}
