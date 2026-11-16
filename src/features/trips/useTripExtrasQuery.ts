import { useQuery } from '@tanstack/react-query'
import { fetchServerTripReport } from './server-trip-report-api'
import { fetchTripLabels, fetchTripReadiness, fetchTripReport, fetchTripRequirements } from './trip-extras-api'

/**
 * Hook Query cho dữ liệu chuyến của Review 1 (LM-104). Khoá nằm dưới `['trips', tripId]`: mọi ghi của chuyến (kiện, điểm giao, yêu cầu
 * giao, tối ưu) làm mới chúng; tiến độ kho / tài xế ghi ở màn khác nên đọc lại mỗi lần mở.
 */

export function useTripReadinessQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'readiness'], queryFn: () => fetchTripReadiness(tripId), enabled: tripId !== '', staleTime: 0 })
}

export function useTripRequirementsQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'requirements'], queryFn: () => fetchTripRequirements(tripId), enabled: tripId !== '', staleTime: 0 })
}

export function useTripLabelsQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'labels'], queryFn: () => fetchTripLabels(tripId), enabled: tripId !== '' })
}

/** Báo cáo chuyến của máy chủ (nhóm `trips` nối backend); khoá riêng với bản kho mẫu vì dữ liệu khác hình. */
export function useServerTripReportQuery(tripCode: string) {
  return useQuery({ queryKey: ['trips', tripCode, 'server-report'], queryFn: () => fetchServerTripReport(tripCode), enabled: tripCode !== '', staleTime: 0 })
}

export function useTripReportQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'report'], queryFn: () => fetchTripReport(tripId), enabled: tripId !== '', staleTime: 0 })
}
