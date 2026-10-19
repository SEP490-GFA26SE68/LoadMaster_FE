/**
 * Quản lý danh mục gói cước `/nen-tang/goi`: gọi backend API qua `api()`.
 *   listSubscriptionPlans  → GET /api/subscription/plans?paged=true&...
 *   createSubscriptionPlan → POST /api/subscription/plans
 *   updateSubscriptionPlan → PUT /api/subscription/plans/{id}
 *   deleteSubscriptionPlan → DELETE /api/subscription/plans/{id}
 *   setSubscriptionPlanActive → PUT /api/subscription/plans/{id}
 */

import { api, type QueryValue } from '@/lib/api-client'
import {
  TIER_ALGORITHM,
  type AlgorithmTier,
  type PlanInput,
  type PlanPatch,
  type PlanTier,
  type SubscriptionPlan,
} from '@/lib/mock-db/billing-model'
import { parseFeatures } from '@/features/marketing/pricing-api'

export type SubscriptionPlanResponse = {
  id: number
  planCode: string
  name: string
  priceVnd: number
  tier: PlanTier
  monthlyCredits: number | null
  algorithmTier: AlgorithmTier
  features: string | null
  billingCycle?: 'MONTHLY' | 'YEARLY'
  maxVehicles?: number
  maxMonthlyJobs?: number
  active: boolean
  activeCompanyCount?: number
}

export type PageResponse<T> = {
  success: boolean
  message?: string
  data: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

/** Một dòng của danh mục: gói kèm số công ty đang gắn với nó. */
export type PlanRow = {
  readonly plan: SubscriptionPlan
  readonly companies: number
}

export type ListPlansParams = {
  page?: number
  size?: number
  search?: string
  active?: boolean
  tier?: PlanTier
}

export type ListPlansResult = {
  rows: PlanRow[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export type CreatePlanInput = {
  planCode: string
  name: string
  priceVnd: number
  tier: PlanTier
  monthlyCredits: number | null
  algorithmTier?: AlgorithmTier
  features?: string | string[] | null
  billingCycle?: 'MONTHLY' | 'YEARLY'
  maxVehicles?: number
  maxMonthlyJobs?: number
  active?: boolean
}

export type UpdatePlanInput = {
  planCode?: string
  name: string
  priceVnd: number
  tier: PlanTier
  monthlyCredits: number | null
  algorithmTier?: AlgorithmTier
  features?: string | string[] | null
  billingCycle?: 'MONTHLY' | 'YEARLY'
  maxVehicles?: number
  maxMonthlyJobs?: number
  active?: boolean
}

export function toSubscriptionPlan(res: SubscriptionPlanResponse): SubscriptionPlan {
  return {
    id: String(res.id),
    name: res.name,
    tier: res.tier,
    priceVnd: Number(res.priceVnd),
    monthlyCredits: res.monthlyCredits,
    algorithmTier: res.algorithmTier ?? TIER_ALGORITHM[res.tier] ?? 'EP_DBLF',
    features: parseFeatures(res.features, res.tier),
    active: Boolean(res.active),
    provisional: false,
    billingCycle: res.billingCycle ?? 'MONTHLY',
    maxVehicles: res.maxVehicles,
    maxMonthlyJobs: res.maxMonthlyJobs,
    planCode: res.planCode,
    activeCompanyCount: res.activeCompanyCount,
  }
}

export function toPlanRow(res: SubscriptionPlanResponse): PlanRow {
  return {
    plan: toSubscriptionPlan(res),
    companies: Number(res.activeCompanyCount ?? 0),
  }
}

/** Danh mục gói theo thứ tự hạng, mỗi gói kèm số công ty dùng. */
// GET /api/subscription/plans
export async function listSubscriptionPlans(params: ListPlansParams = {}): Promise<ListPlansResult> {
  if (import.meta.env.MODE === 'test' && !('mock' in (api as unknown as Record<string, unknown>))) {
    const db = (await import('@/lib/mock-db')).getMockDb()
    const [plans, companies] = await Promise.all([db.listSubscriptionPlans(), db.countPlanCompanies()])
    const rows = plans.map((plan) => ({ plan, companies: companies[plan.id] ?? 0 }))
    return {
      rows,
      page: 0,
      size: rows.length || 10,
      totalElements: rows.length,
      totalPages: 1,
      last: true,
    }
  }

  const query: Record<string, QueryValue> = { paged: true }
  if (params.page !== undefined) query.page = params.page
  if (params.size !== undefined) query.size = params.size
  if (params.search) query.search = params.search
  if (params.active !== undefined) query.active = params.active
  if (params.tier) query.tier = params.tier

  const res = await api().get<PageResponse<SubscriptionPlanResponse>>('/api/subscription/plans', { query })
  const data = Array.isArray(res) ? res : (res.data ?? [])
  const rows = data.map(toPlanRow)
  return {
    rows,
    page: res.page ?? 0,
    size: res.size ?? (params.size ?? 10),
    totalElements: res.totalElements ?? rows.length,
    totalPages: res.totalPages ?? 1,
    last: res.last ?? true,
  }
}

/** Thêm gói mới */
// POST /api/subscription/plans
export async function createSubscriptionPlan(input: CreatePlanInput | PlanInput): Promise<SubscriptionPlan> {
  if (import.meta.env.MODE === 'test' && !('mock' in (api as unknown as Record<string, unknown>))) {
    const db = (await import('@/lib/mock-db')).getMockDb()
    return db.createSubscriptionPlan(input as PlanInput)
  }

  const tier = input.tier
  const features = typeof input.features === 'string'
    ? input.features.trim() || null
    : Array.isArray(input.features)
      ? input.features.map((f) => `- ${f}`).join('\n')
      : null

  const body = {
    planCode: 'planCode' in input && input.planCode ? input.planCode : `PLAN-${tier}-${Date.now().toString().slice(-4)}`,
    name: input.name,
    priceVnd: input.priceVnd,
    tier,
    monthlyCredits: input.monthlyCredits ?? 0,
    algorithmTier: input.algorithmTier ?? TIER_ALGORITHM[tier] ?? 'EP_DBLF',
    features,
    billingCycle: input.billingCycle ?? 'MONTHLY',
    maxVehicles: input.maxVehicles,
    maxMonthlyJobs: input.maxMonthlyJobs,
    active: input.active !== undefined ? input.active : true,
  }

  const res = await api().post<SubscriptionPlanResponse>('/api/subscription/plans', { body })
  return toSubscriptionPlan(res)
}

/** Sửa gói */
// PUT /api/subscription/plans/{id}
export async function updateSubscriptionPlan(planId: string, patch: UpdatePlanInput | PlanPatch): Promise<SubscriptionPlan> {
  if (import.meta.env.MODE === 'test' && !('mock' in (api as unknown as Record<string, unknown>))) {
    const db = (await import('@/lib/mock-db')).getMockDb()
    return db.updateSubscriptionPlan(planId, patch as PlanPatch)
  }

  const tier = patch.tier ?? 'BASIC'
  const features = patch.features !== undefined
    ? (typeof patch.features === 'string'
        ? patch.features.trim() || null
        : Array.isArray(patch.features)
          ? patch.features.map((f) => `- ${f}`).join('\n')
          : null)
    : undefined

  const body = {
    ...patch,
    planCode: patch.planCode,
    name: patch.name,
    priceVnd: patch.priceVnd,
    tier,
    monthlyCredits: patch.monthlyCredits,
    algorithmTier: patch.algorithmTier,
    features,
    billingCycle: patch.billingCycle,
    maxVehicles: patch.maxVehicles,
    maxMonthlyJobs: patch.maxMonthlyJobs,
    active: patch.active,
  }

  const res = await api().put<SubscriptionPlanResponse>(`/api/subscription/plans/${planId}`, { body })
  return toSubscriptionPlan(res)
}

/** Bật / tắt bán */
// PUT /api/subscription/plans/{id}
export async function setSubscriptionPlanActive(
  planId: string,
  active: boolean,
  existingPlan?: Partial<UpdatePlanInput>,
): Promise<SubscriptionPlan> {
  if (import.meta.env.MODE === 'test' && !('mock' in (api as unknown as Record<string, unknown>))) {
    const db = (await import('@/lib/mock-db')).getMockDb()
    return db.setSubscriptionPlanActive(planId, active)
  }

  const body = {
    ...existingPlan,
    name: existingPlan?.name ?? 'Subscription Plan',
    priceVnd: existingPlan?.priceVnd ?? 0,
    tier: existingPlan?.tier ?? 'BASIC',
    monthlyCredits: existingPlan?.monthlyCredits ?? 0,
    active,
  }

  const res = await api().put<SubscriptionPlanResponse>(`/api/subscription/plans/${planId}`, { body })
  return toSubscriptionPlan(res)
}

/** Xoá gói */
// DELETE /api/subscription/plans/{id}
export async function deleteSubscriptionPlan(planId: string): Promise<void> {
  if (import.meta.env.MODE === 'test' && !('mock' in (api as unknown as Record<string, unknown>))) {
    const db = (await import('@/lib/mock-db')).getMockDb()
    return db.deleteSubscriptionPlan(planId)
  }

  await api().delete(`/api/subscription/plans/${planId}`)
}
