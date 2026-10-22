import { z } from 'zod'
import type { MessageKey } from '@/lib/i18n'
import {
  ALGORITHM_TIERS,
  PLAN_TIERS,
  TIER_ALGORITHM,
  type AlgorithmTier,
  type PlanTier,
  type SubscriptionPlan,
} from '@/lib/mock-db/billing-model'
import type { CreatePlanInput, UpdatePlanInput } from './subscription-plans-api'

/**
 * Form gói cước (FE-8-02). Hỗ trợ đầy đủ các trường của SubscriptionPlan backend:
 * mã gói, tên gói, tier, chu kỳ thanh toán, giá, credit, thuật toán, số xe tối đa, số chuyến tối đa, tính năng, và cờ active.
 */
export const PLAN_NAME_MAX = 150
export const NAME_REQUIRED = 'platform.form.errors.nameRequired' satisfies MessageKey
export const NAME_TOO_LONG = 'platform.form.errors.nameTooLong' satisfies MessageKey
export const TIER_REQUIRED = 'platform.form.errors.tier' satisfies MessageKey
export const PRICE_INVALID = 'platform.form.errors.price' satisfies MessageKey
export const CREDITS_INVALID = 'platform.form.errors.credits' satisfies MessageKey

export const planFormSchema = z
  .object({
    planCode: z.string().trim().max(50, 'Mã gói tối đa 50 ký tự').optional(),
    name: z.string().trim().min(1, NAME_REQUIRED).max(PLAN_NAME_MAX, NAME_TOO_LONG),
    tier: z.enum(PLAN_TIERS, { error: TIER_REQUIRED }),
    billingCycle: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
    priceVnd: z.number({ error: PRICE_INVALID }).int(PRICE_INVALID).min(0, PRICE_INVALID),
    unlimited: z.boolean(),
    monthlyCredits: z.union([z.number(), z.nan()]),
    algorithmTier: z.enum(ALGORITHM_TIERS).optional(),
    maxVehicles: z.union([z.number().int().min(1, 'Số xe phải lớn hơn 0'), z.nan()]).optional(),
    maxMonthlyJobs: z.union([z.number().int().min(1, 'Số chuyến phải lớn hơn 0'), z.nan()]).optional(),
    features: z.string().optional(),
    active: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (!values.unlimited && !(Number.isInteger(values.monthlyCredits) && values.monthlyCredits > 0)) {
      ctx.addIssue({ code: 'custom', path: ['monthlyCredits'], message: CREDITS_INVALID })
    }
  })

export type PlanFormInput = z.input<typeof planFormSchema>
export type PlanFormValues = z.output<typeof planFormSchema>

/** Hạng đầu tiên chưa có gói đang bán (mở form thêm gói đã chọn sẵn); hết chỗ thì hạng đầu — kho từ chối nếu vẫn mở bán. */
export function firstFreeTier(plans: readonly Pick<SubscriptionPlan, 'tier' | 'active'>[]): PlanTier {
  return PLAN_TIERS.find((tier) => !plans.some((plan) => plan.active && plan.tier === tier)) ?? PLAN_TIERS[0]
}

export function emptyPlanForm(tier: PlanTier): PlanFormInput {
  return {
    planCode: `PLAN-${tier}`,
    name: '',
    tier,
    billingCycle: 'MONTHLY',
    priceVnd: Number.NaN,
    unlimited: false,
    monthlyCredits: Number.NaN,
    algorithmTier: TIER_ALGORITHM[tier] ?? 'EP_DBLF',
    maxVehicles: Number.NaN,
    maxMonthlyJobs: Number.NaN,
    features: '',
    active: true,
  }
}

export function toPlanForm(plan: SubscriptionPlan): PlanFormInput {
  return {
    planCode: plan.planCode ?? plan.id,
    name: plan.name,
    tier: plan.tier,
    billingCycle: plan.billingCycle ?? 'MONTHLY',
    priceVnd: plan.priceVnd,
    unlimited: plan.monthlyCredits === null,
    monthlyCredits: plan.monthlyCredits ?? Number.NaN,
    algorithmTier: plan.algorithmTier ?? TIER_ALGORITHM[plan.tier],
    maxVehicles: plan.maxVehicles ?? Number.NaN,
    maxMonthlyJobs: plan.maxMonthlyJobs ?? Number.NaN,
    features: Array.isArray(plan.features) ? plan.features.map((f) => `- ${f}`).join('\n') : (plan.features ?? ''),
    active: plan.active,
  }
}

const creditsOf = (values: PlanFormValues) => (values.unlimited ? null : values.monthlyCredits)

export function toPlanInput(values: PlanFormValues): CreatePlanInput {
  return {
    planCode: values.planCode || `PLAN-${values.tier}-${Date.now().toString().slice(-4)}`,
    name: values.name,
    tier: values.tier,
    billingCycle: values.billingCycle,
    priceVnd: values.priceVnd,
    monthlyCredits: creditsOf(values),
    algorithmTier: values.algorithmTier ?? TIER_ALGORITHM[values.tier],
    maxVehicles: values.maxVehicles !== undefined && !Number.isNaN(values.maxVehicles) ? values.maxVehicles : undefined,
    maxMonthlyJobs: values.maxMonthlyJobs !== undefined && !Number.isNaN(values.maxMonthlyJobs) ? values.maxMonthlyJobs : undefined,
    features: values.features ? values.features.trim() : undefined,
    active: values.active,
  }
}

export function toPlanPatch(values: PlanFormValues): UpdatePlanInput {
  return {
    planCode: values.planCode,
    name: values.name,
    tier: values.tier,
    billingCycle: values.billingCycle,
    priceVnd: values.priceVnd,
    monthlyCredits: creditsOf(values),
    algorithmTier: values.algorithmTier ?? TIER_ALGORITHM[values.tier],
    maxVehicles: values.maxVehicles !== undefined && !Number.isNaN(values.maxVehicles) ? values.maxVehicles : undefined,
    maxMonthlyJobs: values.maxMonthlyJobs !== undefined && !Number.isNaN(values.maxMonthlyJobs) ? values.maxMonthlyJobs : undefined,
    features: values.features ? values.features.trim() : undefined,
    active: values.active,
  }
}
