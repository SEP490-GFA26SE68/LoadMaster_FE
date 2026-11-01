import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { useFormat, useT } from '@/lib/i18n'
import type { PlanTier, SubscriptionPlan } from '@/lib/mock-db'

const TIER_RANK: Record<PlanTier, number> = {
  BASIC: 1,
  PRO: 2,
  ULTIMATE: 3,
}

/**
 * Chọn gói để đăng ký (FE-8-03) — chỉ hiện khi công ty chưa có gói, gói đã hết hạn, hoặc đang dùng gói.
 * - Gói bằng hoặc thấp hơn hạng gói hiện tại (khi hết hạn): cho phép tự gia hạn / đăng ký trực tiếp.
 * - Gói cao hơn hạng gói hiện tại: mở hộp thoại gửi ticket nâng cấp.
 */
export function PlanChoiceCard({
  plans,
  pendingId,
  currentPlanId,
  currentPlanTier,
  onSubscribe,
  onRequestUpgrade,
}: {
  plans: SubscriptionPlan[]
  /** Gói đang gửi đăng ký. */
  pendingId: string | null
  currentPlanId?: string | null
  currentPlanTier?: PlanTier | null
  onSubscribe: (plan: SubscriptionPlan) => void
  onRequestUpgrade?: (plan: SubscriptionPlan) => void
}) {
  const t = useT()
  const format = useFormat()
  const hasContractPlan = Boolean(currentPlanId && onRequestUpgrade)
  const resolvedTier = currentPlanTier ?? plans.find((p) => p.id === currentPlanId)?.tier ?? null
  const currentRank = resolvedTier ? TIER_RANK[resolvedTier] : 0

  return (
    <Card role="region" aria-labelledby="billing-choose">
      <CardHeader>
        <CardTitle as="h2" id="billing-choose">{t('billing.choose.title')}</CardTitle>
      </CardHeader>
      {plans.length === 0 ? (
        <p className="m-0 p-4.5 text-ink-2">{t('billing.choose.none')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-line-soft p-0">
          {plans.map((plan) => {
            const isCurrentPlan = hasContractPlan && plan.id === currentPlanId
            const isUpgradePlan =
              hasContractPlan &&
              !isCurrentPlan &&
              (currentRank > 0 ? TIER_RANK[plan.tier] > currentRank : true)
            return (
              <li key={plan.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4.5 py-3.5">
                <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-h3 leading-5.5 font-[650] text-ink-strong">{plan.name}</span>
                    <Badge tone="cyan" shape="tag">{t(`common.planTiers.${plan.tier}`)}</Badge>
                    {plan.provisional ? <Badge shape="tag" tone="warning" outlined>{t('common.provisionalPlan')}</Badge> : null}
                  </span>
                  <span className="text-small text-ink-2 tabular-nums">
                    {t('platform.perMonth', { price: format.currency(plan.priceVnd) })} · {plan.monthlyCredits === null
                      ? t('common.unlimitedCredits')
                      : t('billing.choose.credits', { credits: format.integer(plan.monthlyCredits) })}
                  </span>
                </span>
                {isUpgradePlan && onRequestUpgrade ? (
                  <Button
                    variant="secondary"
                    aria-label={`Gửi yêu cầu nâng cấp gói ${plan.name}`}
                    onClick={() => onRequestUpgrade(plan)}
                  >
                    Gửi ticket nâng cấp
                  </Button>
                ) : (
                  <Button
                    variant={isCurrentPlan ? 'primary' : 'secondary'}
                    loading={pendingId === plan.id}
                    disabled={pendingId !== null && pendingId !== plan.id}
                    aria-label={isCurrentPlan ? `Gia hạn gói ${plan.name}` : t('billing.choose.subscribeTo', { name: plan.name })}
                    onClick={() => onSubscribe(plan)}
                  >
                    {isCurrentPlan ? 'Gia hạn thêm 1 tháng' : t('billing.choose.subscribe')}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

