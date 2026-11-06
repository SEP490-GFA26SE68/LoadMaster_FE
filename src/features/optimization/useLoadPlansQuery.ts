import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchJobPlans, fetchOptimizationJob, fetchTripLoadPlans, startLoadingOptimization } from './load-plans-backend-api'

/** Nhịp đọc lại trạng thái job đang chạy. Máy chủ không đẩy tiến trình nên màn hỏi lại tới khi job kết thúc. */
export const JOB_POLL_MS = 2000

/** Phương án của chuyến (máy chủ), dưới khoá của chuyến để mọi lệnh ghi của chuyến làm mới chúng. `tripId` là mã số của máy chủ. */
export function useTripLoadPlansQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'load-plans'], queryFn: () => fetchTripLoadPlans(tripId), staleTime: 0, enabled: tripId !== '' })
}

/** Một lần chạy: gửi rồi trả mã job; credit do máy chủ giữ và trừ. */
export function useStartLoadingOptimizationMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (keepPinsFromPlanId?: string) => startLoadingOptimization(tripId, keepPinsFromPlanId),
    onSuccess: () => client.invalidateQueries({ queryKey: ['billing'] }),
  })
}

/** Trạng thái job, đọc lại mỗi `JOB_POLL_MS` (`refetchInterval` của Query, không hẹn giờ riêng) tới khi job kết thúc. */
export function useOptimizationJobQuery(jobId: string | null) {
  return useQuery({
    queryKey: ['optimization-job', jobId],
    queryFn: () => fetchOptimizationJob(jobId ?? ''),
    enabled: jobId !== null,
    refetchInterval: (query) => (query.state.data?.finished || query.state.status === 'error' ? false : JOB_POLL_MS),
    staleTime: 0,
  })
}

/** Ba phương án của một lần chạy (màn So sánh theo lần chạy). `tripParam` là mã trên URL. */
export function useJobPlansQuery(tripParam: string, jobId: string) {
  return useQuery({
    queryKey: ['trips', tripParam, 'run-comparison', jobId],
    queryFn: () => fetchJobPlans(jobId),
    enabled: jobId !== '',
    staleTime: 0,
  })
}
