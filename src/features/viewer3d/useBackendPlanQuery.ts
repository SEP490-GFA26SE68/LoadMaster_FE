import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { approveBackendLoadPlan, fetchBackendPlanSource } from './viewer-backend-api'

/** Nguồn của Planner bản máy chủ, dưới khoá của chuyến: duyệt, sửa chuyến hay chạy lại tối ưu đều làm mới nó. */
export function useBackendPlanQuery(tripCode: string, planId: string | undefined) {
  return useQuery({
    queryKey: ['trips', tripCode, 'backend-plan', planId ?? 'current'],
    queryFn: () => fetchBackendPlanSource(tripCode, planId),
    enabled: tripCode !== '',
    staleTime: 0,
  })
}

export function useApproveBackendPlanMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (planId: string) => approveBackendLoadPlan(planId),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: ['trips'] }),
      client.invalidateQueries({ queryKey: ['dashboard'] }),
    ]),
  })
}
