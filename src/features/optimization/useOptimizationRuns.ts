import { useQuery } from '@tanstack/react-query'
import { fetchOptimizationRuns } from './optimization-api'

/**
 * Lịch sử lần chạy tối ưu của chuyến (luồng 3 Review 1, LM-104). Khoá nằm dưới `['trips', tripId]` nên lần chạy mới (hook
 * `useOptimizationRun` làm mới khoá đó) tự hiện ở đây.
 */
export function useOptimizationRunsQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'runs'], queryFn: () => fetchOptimizationRuns(tripId), enabled: tripId !== '', staleTime: 0 })
}
