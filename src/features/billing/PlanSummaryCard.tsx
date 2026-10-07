import type { ReactNode } from 'react'
import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardActions, CardHeader, CardTitle } from '@/components/ui/Card'
import { useFormat, useT } from '@/lib/i18n'
import type { CurrentSubscription, SubscriptionStatus } from '@/lib/mock-db'

/** Gói đang dùng là xanh lá, đã huỷ nhưng còn hiệu lực là hổ phách (sắp hết), đã hết hạn là đỏ (chặn chạy tối ưu). */
const STATUS_LOOK: Record<SubscriptionStatus, { tone: BadgeTone; dot: BadgeDot }> = {
  ACTIVE: { tone: 'success', dot: 'solid' },
  CANCELLED: { tone: 'warning', dot: 'ring' },
  EXPIRED: { tone: 'danger', dot: 'solid' },
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-small text-ink-3">{label}</dt>
      <dd className="m-0 font-medium text-ink-strong tabular-nums">{children}</dd>
    </div>
  )
}

/**
 * Gói hiện tại của công ty (FE-8-03): tên, hạng, nhãn "Giá trị tạm" khi gói mang cờ tạm, trạng thái, ngày bắt đầu và hết hạn, tự gia hạn,
 * giá và credit mỗi tháng. Gói đang dùng có nút Huỷ gói (secondary — nút chính của màn là Nạp credit); gói đã huỷ hay hết hạn nói rõ
 * hệ quả bằng một dòng.
 */
export function PlanSummaryCard({ current, onCancel }: { current: CurrentSubscription; onCancel: () => void }) {
  const t = useT()
  const format = useFormat()
  const { subscription, plan } = current
  const look = STATUS_LOOK[subscription.status]
  return (
    <Card role="region" aria-labelledby="billing-plan">
      <CardHeader>
        <CardTitle as="h2" id="billing-plan">{t('billing.plan.title')}</CardTitle>
        <CardActions>
          <Badge tone={look.tone} dot={look.dot}>{t(`billing.plan.status.${subscription.status}`)}</Badge>
        </CardActions>
      </CardHeader>
      <div className="flex flex-col gap-4 p-4.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-h2 leading-7 font-bold text-ink-strong font-stretch-112%">{plan.name}</span>
          <Badge tone="cyan" shape="tag">{t(`common.planTiers.${plan.tier}`)}</Badge>
          {plan.provisional ? <Badge shape="tag" tone="warning" outlined>{t('common.provisionalPlan')}</Badge> : null}
        </div>
        <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <Field label={t('billing.plan.started')}>{format.date(subscription.startedAt)}</Field>
          <Field label={t('billing.plan.expires')}>{format.date(subscription.expiresAt)}</Field>
          <Field label={t('billing.plan.autoRenew')}>{subscription.autoRenew ? t('billing.plan.autoRenewOn') : t('billing.plan.autoRenewOff')}</Field>
          <Field label={t('billing.plan.price')}>{format.currency(plan.priceVnd)}</Field>
          <Field label={t('billing.plan.credits')}>{plan.monthlyCredits === null ? t('common.unlimitedCredits') : format.integer(plan.monthlyCredits)}</Field>
        </dl>
        {subscription.status === 'CANCELLED' ? <p className="m-0 text-small text-ink-2">{t('billing.plan.cancelledNote', { date: format.date(subscription.expiresAt) })}</p> : null}
        {subscription.status === 'EXPIRED' ? <p className="m-0 text-small text-ink-2">{t('billing.plan.expiredNote')}</p> : null}
        {subscription.status === 'ACTIVE' ? (
          <div>
            <Button variant="secondary" onClick={onCancel}>{t('billing.plan.cancel')}</Button>
          </div>
        ) : null}
      </div>
    </Card>
  )
}
