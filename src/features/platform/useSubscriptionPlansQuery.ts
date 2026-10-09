import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PlanInput, PlanPatch } from '@/lib/mock-db'
import {
  createSubscriptionPlan,
  deleteSubscriptionPlan,
  listSubscriptionPlans,
  setSubscriptionPlanActive,
  updateSubscriptionPlan,
} from './subscription-plans-api'

/**
 * Hook Query của danh mục gói (FE-8-02). Khoá `['billing', 'plans']` dưới `['billing']` như mọi dữ liệu gói cước: gói đổi thì màn gói của
 * công ty (gói đang theo, danh sách gói đang bán) và thẻ Credit của Thiết lập tối ưu đọc lại. `staleTime: 0` — số công ty dùng đổi ở màn
 * khác.
 */
const KEY = ['billing', 'plans'] as const

export function useSubscriptionPlansQuery() {
  return useQuery({ queryKey: KEY, queryFn: listSubscriptionPlans, staleTime: 0 })
}

function useRefreshBilling() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: ['billing'] })
}

export function useCreatePlanMutation() {
  const refresh = useRefreshBilling()
  return useMutation({ mutationFn: (input: PlanInput) => createSubscriptionPlan(input), onSuccess: refresh })
}

export function useUpdatePlanMutation() {
  const refresh = useRefreshBilling()
  return useMutation({ mutationFn: ({ planId, patch }: { planId: string; patch: PlanPatch }) => updateSubscriptionPlan(planId, patch), onSuccess: refresh })
}

export function useSetPlanActiveMutation() {
  const refresh = useRefreshBilling()
  return useMutation({ mutationFn: ({ planId, active }: { planId: string; active: boolean }) => setSubscriptionPlanActive(planId, active), onSuccess: refresh })
}

export function useDeletePlanMutation() {
  const refresh = useRefreshBilling()
  return useMutation({ mutationFn: (planId: string) => deleteSubscriptionPlan(planId), onSuccess: refresh })
}
