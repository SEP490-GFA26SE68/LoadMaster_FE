/**
 * Bảng giá công khai `/bang-gia`: gọi API GET /api/subscription/plans.
 * Trang công khai: gọi được khi chưa đăng nhập (guest).
 */

import { api } from '@/lib/api-client'
import { TIER_FEATURES, type AlgorithmTier, type PlanTier, type SubscriptionPlan } from '@/lib/mock-db/billing-model'

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

export function parseFeatures(features: string | string[] | null | undefined, _tier?: PlanTier): string[] {
  if (!features) return []
  if (Array.isArray(features)) {
    return features.map((f) => String(f).trim()).filter(Boolean)
  }
  if (typeof features !== 'string') return []
  const text = features.trim()
  if (!text) return []

  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean)
      }
    } catch {
      // fall through to text parsing
    }
  }

  // Normalize literal '/n' and '\\n' into real newlines
  const normalized = text.replace(/\/n/g, '\n').replace(/\\n/g, '\n')
  const lines = normalized.split(/\r?\n/)
  const result: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    const cleaned = line.replace(/^[-•*]\s*/, '').trim()
    if (cleaned) {
      result.push(cleaned)
    }
  }

  if (result.length === 1 && result[0] && result[0].includes(',') && !result[0].startsWith('-')) {
    return result[0].split(',').map((f) => f.trim()).filter(Boolean)
  }

  return result
}

export function toSubscriptionPlan(res: SubscriptionPlanResponse): SubscriptionPlan {
  return {
    id: String(res.id),
    name: res.name,
    tier: res.tier,
    priceVnd: Number(res.priceVnd),
    monthlyCredits: res.monthlyCredits,
    algorithmTier: res.algorithmTier,
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

/** Gói đang bán theo thứ tự hạng Basic, Pro, Ultimate — bảng giá công khai và ô "Gói quan tâm" của form liên hệ. */
// GET /api/subscription/plans
export async function listPublicPlans(): Promise<SubscriptionPlan[]> {
  if (import.meta.env.MODE === 'test') {
    // If api is not mocked by vitest, use mock-db for dom test suite
    if (!('mock' in (api as unknown as Record<string, unknown>))) {
      const { getMockDb } = await import('@/lib/mock-db')
      return (await getMockDb().listSubscriptionPlans()).filter((p) => p.active)
    }
  }
  const data = await api().get<SubscriptionPlanResponse[]>('/api/subscription/plans')
  const plans = (Array.isArray(data) ? data : []).filter((p) => p.active)
  return plans.map(toSubscriptionPlan)
}
