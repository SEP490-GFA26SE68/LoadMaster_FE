import { isAuthenticated } from '@/features/auth/auth-api'
import { apiFetch } from '@/lib/api-client'
import { mapSubscriptionPlanApi, type SubscriptionPlanApi } from '@/features/billing/billing-api'
import {
  getMockDb,
  type PlanInput,
  type PlanPatch,
  type SubscriptionPlan,
} from '@/lib/mock-db'
import { TIER_ALGORITHM, TIER_FEATURES } from '@/lib/mock-db/billing-model'

/** Một dòng của danh mục: gói kèm số công ty đang gắn với nó. */
export type PlanRow = { readonly plan: SubscriptionPlan; readonly companies: number }

// GET /api/subscription/plans
export async function listSubscriptionPlans(): Promise<PlanRow[]> {
  if (!isAuthenticated()) {
    const db = getMockDb()
    const [plans, companies] = await Promise.all([db.listSubscriptionPlans(), db.countPlanCompanies()])
    return plans.map((plan) => ({ plan, companies: companies[plan.id] ?? 0 }))
  }

  const items = await apiFetch<SubscriptionPlanApi[]>('/api/subscription/plans')
  return items.map((item) => ({
    plan: mapSubscriptionPlanApi(item),
    companies: Number(item.activeCompanyCount ?? 0),
  }))
}

// POST /api/subscription/plans
export async function createSubscriptionPlan(input: PlanInput): Promise<SubscriptionPlan> {
  if (!isAuthenticated()) {
    return getMockDb().createSubscriptionPlan(input)
  }

  const created = await apiFetch<SubscriptionPlanApi>('/api/subscription/plans', {
    method: 'POST',
    body: JSON.stringify({
      planCode: `${input.tier}_${Date.now()}`,
      name: input.name.trim(),
      priceVnd: input.priceVnd,
      tier: input.tier,
      monthlyCredits: input.monthlyCredits,
      algorithmTier: TIER_ALGORITHM[input.tier],
      features: TIER_FEATURES[input.tier].join(','),
      billingCycle: 'MONTHLY',
      active: input.active ?? true,
    }),
  })
  return mapSubscriptionPlanApi(created)
}

// PUT /api/subscription/plans/{id}
export async function updateSubscriptionPlan(
  planId: string,
  patch: PlanPatch,
): Promise<SubscriptionPlan> {
  if (!isAuthenticated()) {
    return getMockDb().updateSubscriptionPlan(planId, patch)
  }

  const current = await apiFetch<SubscriptionPlanApi>(`/api/subscription/plans/${planId}`)
  const updated = await apiFetch<SubscriptionPlanApi>(`/api/subscription/plans/${planId}`, {
    method: 'PUT',
    body: JSON.stringify({
      planCode: current.planCode,
      name: patch.name?.trim() ?? current.name,
      priceVnd: patch.priceVnd ?? current.priceVnd,
      tier: current.tier,
      monthlyCredits:
        patch.monthlyCredits === undefined ? current.monthlyCredits : patch.monthlyCredits,
      algorithmTier: current.algorithmTier,
      features: patch.features ? patch.features.join(',') : current.features,
      billingCycle: current.billingCycle ?? 'MONTHLY',
      active: current.active ?? true,
    }),
  })
  return mapSubscriptionPlanApi(updated)
}

// PUT /api/subscription/plans/{id} với cờ `active`
export async function setSubscriptionPlanActive(
  planId: string,
  active: boolean,
): Promise<SubscriptionPlan> {
  if (!isAuthenticated()) {
    return getMockDb().setSubscriptionPlanActive(planId, active)
  }

  const current = await apiFetch<SubscriptionPlanApi>(`/api/subscription/plans/${planId}`)
  const updated = await apiFetch<SubscriptionPlanApi>(`/api/subscription/plans/${planId}`, {
    method: 'PUT',
    body: JSON.stringify({
      planCode: current.planCode,
      name: current.name,
      priceVnd: current.priceVnd,
      tier: current.tier,
      monthlyCredits: current.monthlyCredits,
      algorithmTier: current.algorithmTier,
      features: current.features,
      billingCycle: current.billingCycle ?? 'MONTHLY',
      active,
    }),
  })
  return mapSubscriptionPlanApi(updated)
}

// DELETE /api/subscription/plans/{id}
export async function deleteSubscriptionPlan(planId: string): Promise<void> {
  if (!isAuthenticated()) {
    return getMockDb().deleteSubscriptionPlan(planId)
  }

  await apiFetch<void>(`/api/subscription/plans/${planId}`, {
    method: 'DELETE',
  })
}
