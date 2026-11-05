import { PLAN_TIERS, type PlanTier, type SubscriptionPlan, type SubscriptionStatus } from '@/lib/mock-db'

/**
 * Hỗ trợ khách hàng đổi gói cho công ty khách (`assignCompanyPlan`): gói đang dùng thì chỉ nâng lên hạng cao hơn; chưa có gói, gói đã huỷ
 * hay đã hết hạn thì chọn gói nào cũng được. Dùng chung cho khung công ty của `/ho-tro` và hộp thoại đổi gói.
 */
type CurrentPlan = { readonly id: string; readonly tier: PlanTier } | null

function floorRank(current: CurrentPlan, status: SubscriptionStatus | null): number {
  return current !== null && status === 'ACTIVE' ? PLAN_TIERS.indexOf(current.tier) : -1
}

export function planLocked(plan: Pick<SubscriptionPlan, 'tier'>, current: CurrentPlan, status: SubscriptionStatus | null): boolean {
  return PLAN_TIERS.indexOf(plan.tier) <= floorRank(current, status)
}

/** Gói chọn sẵn: hạng kế tiếp khi đang dùng, không thì gói hiện tại, không thì gói đầu danh sách. */
export function defaultPlanChoice(plans: readonly SubscriptionPlan[], current: CurrentPlan, status: SubscriptionStatus | null): string {
  const floor = floorRank(current, status)
  if (floor >= 0) return plans.find((plan) => PLAN_TIERS.indexOf(plan.tier) > floor)?.id ?? ''
  return current !== null && plans.some((plan) => plan.id === current.id) ? current.id : (plans[0]?.id ?? '')
}
