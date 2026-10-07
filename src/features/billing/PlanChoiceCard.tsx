import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { useFormat, useT } from '@/lib/i18n'
import type { SubscriptionPlan } from '@/lib/mock-db'

/**
 * Chọn gói để đăng ký (FE-8-03) — chỉ hiện khi công ty chưa có gói hoặc gói đã hết hạn. Mỗi gói đang bán một dòng: tên, hạng, giá,
 * credit mỗi tháng, nhãn "Giá trị tạm" khi gói mang cờ tạm, và nút Đăng ký (secondary: nút chính của màn là Nạp credit). Đăng ký chỉ tạo
 * thanh toán chờ — gói kích hoạt khi thanh toán thành công.
 */
export function PlanChoiceCard({ plans, pendingId, onSubscribe }: {
  plans: SubscriptionPlan[]
  /** Gói đang gửi đăng ký. */
  pendingId: string | null
  onSubscribe: (plan: SubscriptionPlan) => void
}) {
  const t = useT()
  const format = useFormat()
  return (
    <Card role="region" aria-labelledby="billing-choose">
      <CardHeader>
        <CardTitle as="h2" id="billing-choose">{t('billing.choose.title')}</CardTitle>
      </CardHeader>
      {plans.length === 0 ? (
        <p className="m-0 p-4.5 text-ink-2">{t('billing.choose.none')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-line-soft p-0">
          {plans.map((plan) => (
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
              <Button
                variant="secondary"
                loading={pendingId === plan.id}
                disabled={pendingId !== null && pendingId !== plan.id}
                aria-label={t('billing.choose.subscribeTo', { name: plan.name })}
                onClick={() => onSubscribe(plan)}
              >
                {t('billing.choose.subscribe')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
