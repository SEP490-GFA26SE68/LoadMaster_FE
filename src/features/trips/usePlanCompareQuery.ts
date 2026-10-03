import { useQuery } from '@tanstack/react-query'
import { fetchRunComparison } from './plan-compare-api'

/**
 * Ba phương án ứng viên của một lần chạy (FE-5b-06). Khoá nằm dưới `['trips', tripId]`: lần tối ưu mới, duyệt, sửa chuyến hay tối ưu
 * lại tuyến đều làm mới. Duyệt ghi ở Planner nên đọc lại mỗi lần mở màn (`staleTime: 0`).
 */
export function useRunComparisonQuery(tripId: string, runId: string | null) {
  return useQuery({
    queryKey: ['trips', tripId, 'run-comparison', runId],
    queryFn: () => fetchRunComparison(tripId, runId ?? ''),
    enabled: tripId !== '' && runId !== null,
    staleTime: 0,
  })
}
