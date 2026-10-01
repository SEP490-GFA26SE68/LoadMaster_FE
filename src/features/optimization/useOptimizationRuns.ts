import { useQuery } from '@tanstack/react-query'
import { fetchOptimizationRuns, fetchRunHistory } from './optimization-api'

/**
 * Lịch sử lần chạy tối ưu của chuyến (luồng 3 Review 1, LM-104). Khoá nằm dưới `['trips', tripId]` nên lần chạy mới (hook
 * `useOptimizationRun` làm mới khoá đó) tự hiện ở đây.
 */
export function useOptimizationRunsQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'runs'], queryFn: () => fetchOptimizationRuns(tripId), enabled: tripId !== '', staleTime: 0 })
}

/**
 * Bảng lần chạy của Thiết lập tối ưu: lần chạy ghép người chạy, thiết lập, số của revision và việc duyệt phương án đó. Duyệt ghi ở
 * màn khác (Planner) nên đọc lại mỗi lần mở màn.
 */
export function useRunHistoryQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'run-history'], queryFn: () => fetchRunHistory(tripId), enabled: tripId !== '', staleTime: 0 })
}
