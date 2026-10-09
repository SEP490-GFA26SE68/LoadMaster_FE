import { useQuery } from '@tanstack/react-query'
import { fetchRunHistory } from './optimization-api'

/**
 * Bảng lần chạy của Thiết lập tối ưu: lần chạy ghép người chạy, thiết lập, số của revision và việc duyệt phương án đó. Duyệt ghi ở
 * màn khác (Planner) nên đọc lại mỗi lần mở màn.
 */
export function useRunHistoryQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'run-history'], queryFn: () => fetchRunHistory(tripId), enabled: tripId !== '', staleTime: 0 })
}
