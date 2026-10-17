import { z } from 'zod'
import { UNLIMITED_TIER } from '@/lib/billing-backend-api'
import type { MessageKey } from '@/lib/i18n'
import { PLAN_TIERS, type PlanInput, type PlanPatch, type PlanTier, type SubscriptionPlan } from '@/lib/mock-db'

/**
 * Form gói cước (FE-8-02). Message của schema là key từ điển nên lỗi đổi theo ngôn ngữ. Giá là đồng nguyên, không âm; credit tháng là
 * số nguyên dương hoặc "không giới hạn" (công tắc `unlimited`, kho lưu `null`). Ô số đọc bằng `valueAsNumber`: ô trống là `NaN`.
 * Nối backend thì không có công tắc: hạng Ultimate luôn không giới hạn, hạng khác bắt buộc có số (`unlimitedByTier`).
 */
export const PLAN_NAME_MAX = 60
export const NAME_REQUIRED = 'platform.form.errors.nameRequired' satisfies MessageKey
export const NAME_TOO_LONG = 'platform.form.errors.nameTooLong' satisfies MessageKey
export const TIER_REQUIRED = 'platform.form.errors.tier' satisfies MessageKey
export const PRICE_INVALID = 'platform.form.errors.price' satisfies MessageKey
export const CREDITS_INVALID = 'platform.form.errors.credits' satisfies MessageKey
export const CREDITS_POSITIVE = 'platform.form.errors.creditsPositive' satisfies MessageKey

/** Luật credit của form theo nguồn dữ liệu (`PLAN_CATALOG_CAPABILITIES.unlimitedByTier`). */
export type PlanFormRules = { readonly unlimitedByTier: boolean }

const planFormBase = z.object({
  name: z.string().trim().min(1, NAME_REQUIRED).max(PLAN_NAME_MAX, NAME_TOO_LONG),
  tier: z.enum(PLAN_TIERS, { error: TIER_REQUIRED }),
  priceVnd: z.number({ error: PRICE_INVALID }).int(PRICE_INVALID).min(0, PRICE_INVALID),
  unlimited: z.boolean(),
  monthlyCredits: z.union([z.number(), z.nan()]),
  active: z.boolean(),
})

/** Gói không giới hạn credit: theo công tắc, hoặc theo hạng khi `unlimitedByTier`. */
export function isUnlimitedForm(values: { readonly tier: PlanTier; readonly unlimited: boolean }, rules: PlanFormRules): boolean {
  return rules.unlimitedByTier ? values.tier === UNLIMITED_TIER : values.unlimited
}

export function planFormSchemaFor(rules: PlanFormRules) {
  return planFormBase.superRefine((values, ctx) => {
    if (!isUnlimitedForm(values, rules) && !(Number.isInteger(values.monthlyCredits) && values.monthlyCredits > 0)) {
      ctx.addIssue({ code: 'custom', path: ['monthlyCredits'], message: rules.unlimitedByTier ? CREDITS_POSITIVE : CREDITS_INVALID })
    }
  })
}

export const planFormSchema = planFormSchemaFor({ unlimitedByTier: false })

export type PlanFormInput = z.input<typeof planFormSchema>
export type PlanFormValues = z.output<typeof planFormSchema>

/** Hạng đầu tiên chưa có gói đang bán (mở form thêm gói đã chọn sẵn); hết chỗ thì hạng đầu — kho từ chối nếu vẫn mở bán. */
export function firstFreeTier(plans: readonly Pick<SubscriptionPlan, 'tier' | 'active'>[]): PlanTier {
  return freeTiers(plans)[0] ?? PLAN_TIERS[0]
}

/** Hạng chưa có gói đang bán, theo thứ tự hạng. */
export function freeTiers(plans: readonly Pick<SubscriptionPlan, 'tier' | 'active'>[]): PlanTier[] {
  return PLAN_TIERS.filter((tier) => !plans.some((plan) => plan.active && plan.tier === tier))
}

export function emptyPlanForm(tier: PlanTier): PlanFormInput {
  return { name: '', tier, priceVnd: Number.NaN, unlimited: false, monthlyCredits: Number.NaN, active: true }
}

export function toPlanForm(plan: SubscriptionPlan): PlanFormInput {
  return {
    name: plan.name,
    tier: plan.tier,
    priceVnd: plan.priceVnd,
    unlimited: plan.monthlyCredits === null,
    monthlyCredits: plan.monthlyCredits ?? Number.NaN,
    active: plan.active,
  }
}

const creditsOf = (values: PlanFormValues, rules: PlanFormRules) => (isUnlimitedForm(values, rules) ? null : values.monthlyCredits)

export function toPlanInput(values: PlanFormValues, rules: PlanFormRules = { unlimitedByTier: false }): PlanInput {
  return { name: values.name, tier: values.tier, priceVnd: values.priceVnd, monthlyCredits: creditsOf(values, rules), active: values.active }
}

/** Sửa gói: hạng và cờ đang bán không đổi qua form (cờ bán là công tắc ở danh sách). */
export function toPlanPatch(values: PlanFormValues, rules: PlanFormRules = { unlimitedByTier: false }): PlanPatch {
  return { name: values.name, priceVnd: values.priceVnd, monthlyCredits: creditsOf(values, rules) }
}
