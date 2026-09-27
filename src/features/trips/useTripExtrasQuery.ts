import { useQuery } from '@tanstack/react-query'
import { fetchTripLabels, fetchTripOrders, fetchTripReadiness, fetchTripReport } from './trip-extras-api'

/**
 * Hook Query cho dữ liệu chuyến của Review 1 (LM-104). Khoá nằm dưới `['trips', tripId]`: mọi ghi của chuyến (kiện, điểm giao, đơn
 * gán, tối ưu) làm mới chúng; tiến độ kho / tài xế ghi ở màn khác nên đọc lại mỗi lần mở.
 */

export function useTripReadinessQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'readiness'], queryFn: () => fetchTripReadiness(tripId), enabled: tripId !== '', staleTime: 0 })
}

export function useTripOrdersQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'orders'], queryFn: () => fetchTripOrders(tripId), enabled: tripId !== '', staleTime: 0 })
}

export function useTripLabelsQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'labels'], queryFn: () => fetchTripLabels(tripId), enabled: tripId !== '' })
}

export function useTripReportQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'report'], queryFn: () => fetchTripReport(tripId), enabled: tripId !== '', staleTime: 0 })
}
