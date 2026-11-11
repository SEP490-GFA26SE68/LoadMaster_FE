import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { useFormat, useT } from '@/lib/i18n'
import { PLAN_TIERS, type PlanTier, type SubscriptionPlan } from '@/lib/mock-db'
import { tierBesideName } from '@/lib/plan-tier'

/**
 * Chọn gói để đăng ký (FE-8-03) — chỉ hiện khi công ty chưa có gói hoặc gói đã hết hạn. Mỗi gói đang bán một dòng: tên, hạng, giá,
 * credit mỗi tháng, nhãn "Giá trị tạm" khi gói mang cờ tạm, và nút Đăng ký (secondary: nút chính của màn là Nạp credit). Đăng ký chỉ tạo
 * thanh toán chờ — gói kích hoạt khi thanh toán thành công.
 *
 * Nối backend, gói còn hiệu lực (`current`, `BILLING_CAPABILITIES.contractRenewal`): thẻ chỉ còn các gói hạng cao hơn, mỗi gói một nút
 * "Gửi yêu cầu nâng cấp" (`onRequestUpgrade`) — backend chỉ cho đổi gói qua yêu cầu hỗ trợ; gia hạn gói đang dùng ở thẻ Gói hiện tại.
 */
export function PlanChoiceCard({ plans, pendingId, onSubscribe, current = null }: {
  plans: SubscriptionPlan[]
  /** Gói đang gửi đăng ký. */
  pendingId: string | null
  onSubscribe: (plan: SubscriptionPlan) => void
  /** Gói còn hiệu lực theo hợp đồng (chỉ khi nối backend). */
  current?: { readonly tier: PlanTier } | null
}) {
  const t = useT()
  const format = useFormat()
  const rank = (tier: PlanTier) => PLAN_TIERS.indexOf(tier)
  const shown = current === null ? plans : plans.filter((plan) => rank(plan.tier) > rank(current.tier))
  // Đã ở hạng cao nhất: không còn gói nào để nâng cấp
  if (current !== null && shown.length === 0) return null
  return (
    <Card role="region" aria-labelledby="billing-choose">
      <CardHeader>
        <CardTitle as="h2" id="billing-choose">{t('billing.choose.title')}</CardTitle>
      </CardHeader>
      {shown.length === 0 ? (
        <p className="m-0 p-4.5 text-ink-2">{t('billing.choose.none')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-line-soft p-0">
          {shown.map((plan) => (
            <li key={plan.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4.5 py-3.5">
              <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-h3 leading-5.5 font-[650] text-ink-strong">{plan.name}</span>
                  {tierBesideName(plan.name, t(`common.planTiers.${plan.tier}`)) === null
                    ? null
                    : <Badge tone="cyan" shape="tag">{t(`common.planTiers.${plan.tier}`)}</Badge>}
                  {plan.provisional ? <Badge shape="tag" tone="warning" outlined>{t('common.provisionalPlan')}</Badge> : null}
                </span>
                <span className="text-small text-ink-2 tabular-nums">
                  {t('platform.perMonth', { price: format.currency(plan.priceVnd) })} · {plan.monthlyCredits === null
                    ? t('common.unlimitedCredits')
                    : t('billing.choose.credits', { credits: format.integer(plan.monthlyCredits) })}
                </span>
              </span>
              <Button
                variant="secondary"
                loading={pendingId === plan.id}
                disabled={pendingId !== null && pendingId !== plan.id}
                aria-label={t(current !== null ? 'billing.choose.upgradeTo' : 'billing.choose.subscribeTo', { name: plan.name })}
                onClick={() => onSubscribe(plan)}
              >
                {t(current !== null ? 'billing.choose.upgrade' : 'billing.choose.subscribe')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
