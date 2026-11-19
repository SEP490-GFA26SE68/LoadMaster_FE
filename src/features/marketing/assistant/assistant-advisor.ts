import { BILLING_CONSTANTS } from '@/lib/mock-db/billing-model'
import type { SubscriptionPlan } from '@/lib/mock-db'

/**
 * Tính gói theo số lần chạy tối ưu mỗi tháng (thuần): credit cần = số lần × credit một lần chạy (`BILLING_CONSTANTS.optimizationCost`);
 * gói gợi ý là gói đang bán rẻ nhất có credit tháng đủ dùng (`null` là không giới hạn). Không nói tiết kiệm hay lợi ích nào khác.
 */
export const MAX_RUNS = 100_000
export const QUICK_RUNS = [20, 100, 500] as const

export type PlanAdvice = {
  readonly runs: number
  readonly cost: number
  readonly credits: number
  /** `null` khi không gói đang bán nào đủ credit. */
  readonly plan: SubscriptionPlan | null
}

export function creditsFor(runs: number, cost: number = BILLING_CONSTANTS.optimizationCost): number {
  return runs * cost
}

const covers = (plan: SubscriptionPlan, credits: number) => plan.monthlyCredits === null || plan.monthlyCredits >= credits

/** Gói đang bán rẻ nhất đủ `credits` mỗi tháng; cùng giá thì gói ít credit hơn (gói có giới hạn) đứng trước. */
export function pickPlan(plans: readonly SubscriptionPlan[], credits: number): SubscriptionPlan | null {
  const candidates = plans
    .filter((plan) => plan.active && covers(plan, credits))
    .toSorted(
      (a, b) =>
        a.priceVnd - b.priceVnd || (a.monthlyCredits ?? Number.POSITIVE_INFINITY) - (b.monthlyCredits ?? Number.POSITIVE_INFINITY),
    )
  return candidates[0] ?? null
}

export function advise(runs: number, plans: readonly SubscriptionPlan[], cost: number = BILLING_CONSTANTS.optimizationCost): PlanAdvice {
  const credits = creditsFor(runs, cost)
  return { runs, cost, credits, plan: pickPlan(plans, credits) }
}

export function isValidRuns(runs: number): boolean {
  return Number.isInteger(runs) && runs >= 1 && runs <= MAX_RUNS
}

/**
 * Số lần chạy trong câu khách gõ khi trợ lý vừa hỏi ("khoảng 300 lần", "1.000", "1,000 runs"): số đầu tiên của câu, bỏ dấu ngăn nghìn
 * (chấm, phẩy, khoảng trắng). Không có số, hoặc ngoài 1 → `MAX_RUNS`, thì `null` — câu được hỏi như một câu thường.
 */
export function parseRuns(text: string): number | null {
  const match = /\d(?:[\d.,\s]*\d)?/.exec(text)
  if (!match) return null
  const runs = Number(match[0].replace(/[.,\s]/g, ''))
  return isValidRuns(runs) ? runs : null
}
