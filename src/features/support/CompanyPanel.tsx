import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'
import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardActions, CardHeader, CardTitle } from '@/components/ui/Card'
import { FieldLabel, fieldBoxClass, focusClass } from '@/components/ui/field-styles'
import { Spinner } from '@/components/ui/Spinner'
import { isAuthenticated } from '@/features/auth/auth-api'
import { usePlansOnSaleQuery } from '@/features/billing/useBillingQuery'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { Formatter } from '@/lib/format'
import type { CreditTransactionType, PlanTier, SubscriptionPlan, SubscriptionStatus } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import { useAssignCompanyPlanMutation, useCompanyPanelQuery } from './useSupportQuery'

const TIER_RANK: Record<PlanTier, number> = {
  BASIC: 1,
  PRO: 2,
  ULTIMATE: 3,
}

/** Cùng nghĩa với thẻ gói của màn gói cước: đang dùng xanh lá, đã huỷ nhưng còn hiệu lực hổ phách, hết hạn đỏ. */
const STATUS_LOOK: Record<SubscriptionStatus, { tone: BadgeTone; dot: BadgeDot }> = {
  ACTIVE: { tone: 'success', dot: 'solid' },
  CANCELLED: { tone: 'warning', dot: 'ring' },
  EXPIRED: { tone: 'danger', dot: 'solid' },
}

/** Số có dấu: cấp, mua, hoàn là "+N"; dùng là "-N" (gói không giới hạn: 0). */
function signed(format: Formatter, amount: number): string {
  if (amount > 0) return `+${format.integer(amount)}`
  return amount < 0 ? `-${format.integer(-amount)}` : format.integer(0)
}

const TYPE_KEY: Record<CreditTransactionType, `billing.ledger.types.${CreditTransactionType}`> = {
  MONTHLY_GRANT: 'billing.ledger.types.MONTHLY_GRANT',
  PURCHASE: 'billing.ledger.types.PURCHASE',
  USAGE: 'billing.ledger.types.USAGE',
  REFUND: 'billing.ledger.types.REFUND',
}

/**
 * Khung công ty bên cạnh màn hỗ trợ (FE-8-07): hiển thị gói và trạng thái gói, số dư credit, và các giao dịch credit gần nhất.
 * Khi kết nối Backend thật (`isAuthenticated()`), cho phép `SystemSupporter` đổi/nâng cấp gói cho công ty khách hàng ngay lập tức.
 */
export function CompanyPanel({ companyId, ticketClosed = false }: { companyId: string; ticketClosed?: boolean }) {
  const t = useT()
  const format = useFormat()
  const planFieldId = useId()
  const authed = isAuthenticated()
  const query = useCompanyPanelQuery(companyId)
  const plansQuery = usePlansOnSaleQuery()
  const assignPlan = useAssignCompanyPlanMutation()
  const panel = query.data
  const [selectedPlanId, setSelectedPlanId] = useState('')

  const isActiveSub = panel?.planStatus === 'ACTIVE' && Boolean(panel?.current?.plan.tier)
  const currentRank = isActiveSub && panel?.current?.plan.tier ? TIER_RANK[panel.current.plan.tier] : 0

  function isPlanDisabled(plan: SubscriptionPlan): boolean {
    return isActiveSub && TIER_RANK[plan.tier] <= currentRank
  }

  useEffect(() => {
    setSelectedPlanId('')
  }, [companyId])

  useEffect(() => {
    if (selectedPlanId) return
    const plansList = plansQuery.data ?? []
    if (isActiveSub && plansList.length > 0) {
      const nextUpgrade = plansList.find((p) => TIER_RANK[p.tier] > currentRank)
      if (nextUpgrade) {
        setSelectedPlanId(nextUpgrade.id)
        return
      }
    }
    if (panel?.current?.plan.id) {
      setSelectedPlanId(panel.current.plan.id)
    } else if (plansList.length > 0) {
      setSelectedPlanId(plansList[0]?.id ?? '')
    }
  }, [selectedPlanId, isActiveSub, currentRank, panel?.current?.plan.id, plansQuery.data])

  const selectedPlanObj = (plansQuery.data ?? []).find((p) => p.id === selectedPlanId)
  const selectedIsBlocked = selectedPlanObj ? isPlanDisabled(selectedPlanObj) : false

  async function handleQuickPlanUpdate() {
    if (!selectedPlanId || ticketClosed || selectedIsBlocked) return
    try {
      const updated = await assignPlan.mutateAsync({ companyId, planId: selectedPlanId })
      toast.success(`Đã cập nhật gói ${updated.planName ?? ''} cho ${panel?.company.name ?? 'khách hàng'}!`)
    } catch (error) {
      toast.error(dataErrorMessage(error, t))
    }
  }

  return (
    <Card role="region" aria-label={t('support.page.panel.title')}>
      <CardHeader>
        <CardTitle as="h2">{t('support.page.panel.title')}</CardTitle>
        <CardActions><Badge shape="tag">{t('support.page.panel.readOnly')}</Badge></CardActions>
      </CardHeader>
      {query.isPending ? (
        <div role="status" aria-label={t('support.page.panel.loading')} className="flex justify-center py-8"><Spinner /></div>
      ) : query.isError || !panel ? (
        <p className="m-0 p-4.5 text-body text-ink-2">{dataErrorMessage(query.error, t)}</p>
      ) : (
        <div className="flex flex-col gap-4 p-4.5">
          <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3">
            <div className="col-span-2 flex min-w-0 flex-col gap-0.5">
              <dt className="text-small text-ink-3">{t('support.page.panel.company')}</dt>
              <dd className="m-0 font-medium text-ink-strong">{panel.company.name}</dd>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-small text-ink-3">{t('support.page.panel.plan')}</dt>
              <dd className="m-0 font-medium text-ink-strong">
                {panel.current ? `${panel.current.plan.name} · ${t(`common.planTiers.${panel.current.plan.tier}`)}` : t('support.page.panel.noPlan')}
              </dd>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-small text-ink-3">{t('support.page.panel.planStatus')}</dt>
              <dd className="m-0">
                {panel.planStatus ? <Badge tone={STATUS_LOOK[panel.planStatus].tone} dot={STATUS_LOOK[panel.planStatus].dot}>{t(`billing.plan.status.${panel.planStatus}`)}</Badge> : '—'}
              </dd>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-small text-ink-3">{t('support.page.panel.balance')}</dt>
              <dd className="m-0 font-display text-h2 leading-7 font-bold text-ink-strong tabular-nums">
                {panel.credit.unlimited ? t('common.unlimitedCredits') : format.integer(panel.credit.balance)}
              </dd>
            </div>
          </dl>

          {authed ? (
            <div className="flex flex-col gap-2.5 rounded-md border border-line-soft bg-surface p-3">
              <FieldLabel htmlFor={planFieldId}>Đổi gói nhanh</FieldLabel>
              <select
                id={planFieldId}
                value={selectedPlanId}
                disabled={ticketClosed}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className={cn(fieldBoxClass(false), focusClass, 'h-9 px-2.5 text-small text-ink-strong')}
              >
                {(plansQuery.data ?? []).map((plan) => (
                  <option key={plan.id} value={plan.id} disabled={isPlanDisabled(plan)}>
                    {plan.name} — {format.currency(plan.priceVnd)}/tháng
                  </option>
                ))}
              </select>
              {ticketClosed ? (
                <p className="m-0 text-fine text-danger">
                  Yêu cầu hỗ trợ đã đóng. Vui lòng mở lại yêu cầu trước khi đổi gói.
                </p>
              ) : null}
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={assignPlan.isPending}
                disabled={!selectedPlanId || ticketClosed || selectedIsBlocked}
                onClick={() => void handleQuickPlanUpdate()}
              >
                Cập nhật gói ngay
              </Button>
            </div>
          ) : null}

          <section aria-label={t('support.page.panel.recent')} className="flex flex-col gap-2">
            <h3 className="m-0 text-small font-semibold text-ink-2">{t('support.page.panel.recent')}</h3>
            {panel.transactions.length === 0 ? (
              <p className="m-0 text-small text-ink-3">{t('support.page.panel.noTransactions')}</p>
            ) : (
              <ul className="m-0 flex max-h-72 list-none flex-col overflow-y-auto p-0">
                {panel.transactions.map((item) => (
                  <li key={item.id} className="flex items-baseline gap-3 border-b border-line-soft py-1.5 last:border-b-0">
                    <span className="min-w-0 flex-1 text-small text-ink-1">{t(TYPE_KEY[item.type])}</span>
                    <time dateTime={item.createdAt} className="flex-none text-fine text-ink-3 tabular-nums">{format.date(item.createdAt)} {format.time(item.createdAt)}</time>
                    <span className="w-14 flex-none text-right font-mono text-caption text-ink-1 tabular-nums">{signed(format, item.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Card>
  )
}

