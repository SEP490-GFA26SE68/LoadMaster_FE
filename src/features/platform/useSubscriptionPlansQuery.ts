import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PlanInput, PlanPatch } from '@/lib/mock-db'
import {
  createSubscriptionPlan,
  deleteSubscriptionPlan,
  listSubscriptionPlans,
  setSubscriptionPlanActive,
  updateSubscriptionPlan,
  type CreatePlanInput,
  type ListPlansParams,
  type UpdatePlanInput,
} from './subscription-plans-api'

/**
 * Hook Query của danh mục gói (FE-8-02). Khoá `['billing', 'plans']` dưới `['billing']` như mọi dữ liệu gói cước: gói đổi thì màn gói của
 * công ty (gói đang theo, danh sách gói đang bán) và thẻ Credit của Thiết lập tối ưu đọc lại. `staleTime: 0` — số công ty dùng đổi ở màn
 * khác.
 */
export function useSubscriptionPlansQuery(params: ListPlansParams = {}) {
  return useQuery({
    queryKey: ['billing', 'plans', params],
    queryFn: () => listSubscriptionPlans(params),
    staleTime: 0,
  })
}

function useRefreshBilling() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: ['billing'] })
}

export function useCreatePlanMutation() {
  const refresh = useRefreshBilling()
  return useMutation({
    mutationFn: (input: CreatePlanInput | PlanInput) => createSubscriptionPlan(input),
    onSuccess: refresh,
  })
}

export function useUpdatePlanMutation() {
  const refresh = useRefreshBilling()
  return useMutation({
    mutationFn: ({ planId, patch }: { planId: string; patch: UpdatePlanInput | PlanPatch }) =>
      updateSubscriptionPlan(planId, patch),
    onSuccess: refresh,
  })
}

export function useSetPlanActiveMutation() {
  const refresh = useRefreshBilling()
  return useMutation({
    mutationFn: ({
      planId,
      active,
      existingPlan,
    }: {
      planId: string
      active: boolean
      existingPlan?: Partial<UpdatePlanInput>
    }) => setSubscriptionPlanActive(planId, active, existingPlan),
    onSuccess: refresh,
  })
}

export function useDeletePlanMutation() {
  const refresh = useRefreshBilling()
  return useMutation({
    mutationFn: (planId: string) => deleteSubscriptionPlan(planId),
    onSuccess: refresh,
  })
}
