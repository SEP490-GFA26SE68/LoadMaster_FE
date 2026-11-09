import { Coins, LifeBuoy, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { SupportTicketDialog } from '@/features/support/SupportTicketDialog'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { PaymentTransaction, SubscriptionPlan } from '@/lib/mock-db'
import { AgreementCard } from './AgreementCard'
import { BalanceCard } from './BalanceCard'
import { BILLING_CAPABILITIES, topUpTerms } from './billing-api'
import { BillingHistoryCard } from './BillingHistoryCard'
import { paymentPath } from './payment-path'
import { PlanChoiceCard } from './PlanChoiceCard'
import { PlanSummaryCard, purchasedMonthsOf } from './PlanSummaryCard'
import { SignAgreementDialog } from './SignAgreementDialog'
import { TopUpDialog } from './TopUpDialog'
import { TrialAgreementBanner } from './TrialAgreementBanner'
import type { SignAgreementRequest } from './agreements-api'
import { useMyAgreementQuery, useSignAgreementMutation } from './useAgreementQuery'
import { ViewAgreementDialog } from './ViewAgreementDialog'
import {
  useCancelSubscriptionMutation,
  useCreditBalanceQuery,
  usePaymentsQuery,
  usePlansOnSaleQuery,
  useSubscribeMutation,
  useSubscriptionQuery,
  useTopUpMutation,
} from './useBillingQuery'
import { useOpenPayment } from './useOpenPayment'

/** Thanh toán của gói đang chờ trả: gia hạn trước (gói sắp hết hạn), rồi đăng ký dở. Nạp credit chờ không có banner — mỗi lần bấm Nạp là một giao dịch mới. */
function pendingPlanPayment(payments: readonly PaymentTransaction[]): PaymentTransaction | undefined {
  return payments.find((item) => item.status === 'PENDING' && item.purpose === 'RENEWAL') ?? payments.find((item) => item.status === 'PENDING' && item.purpose === 'SUBSCRIBE')
}

function remainingMonthsOf(startedAt: string, expiresAt: string): number {
  const end = new Date(expiresAt)
  const nowMs = Date.now()
  if (Number.isNaN(end.getTime()) || end.getTime() <= nowMs) return 0
  const now = new Date(nowMs)
  const monthsFromNow = (end.getUTCFullYear() - now.getUTCFullYear()) * 12 + (end.getUTCMonth() - now.getUTCMonth())
  if (monthsFromNow > 0) return monthsFromNow
  const start = new Date(startedAt)
  if (!Number.isNaN(start.getTime())) {
    const totalMonths = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth())
    if (totalMonths > 0) return totalMonths
  }
  return Math.max(1, Math.ceil((end.getTime() - nowMs) / (30 * 86_400_000)))
}

/**
 * Gói cước và credit của công ty `/goi-cuoc` (FE-8-03, D-89, D-94) — màn của quản trị công ty (`billing.manage`). Gói hiện tại và trạng
 * thái, số dư (gói không giới hạn: "Không giới hạn"), lịch sử phân trang (`BillingHistoryCard`); đăng ký (chỉ khi chưa có gói hoặc gói
 * hết hạn), huỷ gói, nạp credit 50 / 500. Đăng ký và nạp chỉ tạo thanh toán chờ rồi mở trang thanh toán (`useOpenPayment`: giả lập
 * với kho mẫu, trang xác nhận khi nối backend); thanh toán gia hạn đang chờ của kho mẫu có banner kèm nút Trả. Một nút chính: Nạp credit.
 * Nối backend (`BILLING_CAPABILITIES`): gói còn hiệu lực tự gia hạn ở thẻ Gói hiện tại, lên hạng cao hơn bằng yêu cầu hỗ trợ; công ty dùng
 * thử có banner, thẻ và hộp ký thoả thuận dịch vụ. Nút phụ "Yêu cầu hỗ trợ" trên dải tiêu đề mở hộp yêu cầu hỗ trợ.
 */
export function BillingPage() {
  const t = useT()
  const format = useFormat()
  const openPayment = useOpenPayment()
  const subscription = useSubscriptionQuery()
  const balance = useCreditBalanceQuery()
  const plans = usePlansOnSaleQuery()
  const payments = usePaymentsQuery()
  const subscribe = useSubscribeMutation()
  const topUp = useTopUpMutation()
  const cancel = useCancelSubscriptionMutation()
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [upgradePlan, setUpgradePlan] = useState<SubscriptionPlan | null>(null)
  const [upgradeCycle, setUpgradeCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY')
  const [agreementDialog, setAgreementDialog] = useState<'sign' | 'view' | null>(null)
  const agreement = useMyAgreementQuery().data ?? null
  const sign = useSignAgreementMutation()

  const view = subscription.data
  const current = view?.current
  const canSubscribe = current !== undefined && (current === null || current.subscription.status === 'EXPIRED')
  // Backend: gói còn hiệu lực gia hạn đúng gói đó; gói hạng cao hơn qua yêu cầu hỗ trợ
  const contract = BILLING_CAPABILITIES.contractRenewal && current?.subscription.status === 'ACTIVE' ? current : null
  const pending = pendingPlanPayment(payments.data ?? [])
  const pendingPlan = pending === undefined ? '' : (pending.purpose === 'RENEWAL' ? current?.plan.name : plans.data?.find((plan) => plan.id === pending.planId)?.name) ?? (pending.planId ?? '')
  const failed = subscription.isError || balance.isError
  const loading = !failed && (subscription.isPending || balance.isPending)

  function showError(error: unknown) {
    toast.error(dataErrorMessage(error, t))
  }

  function handleSubscribe(plan: SubscriptionPlan, billingCycle?: 'MONTHLY' | 'YEARLY') {
    const arg = billingCycle === 'YEARLY' ? { planId: plan.id, billingCycle: 'YEARLY' as const } : plan.id
    const months =
      billingCycle === 'YEARLY'
        ? contract !== null && contract.plan.id === plan.id
          ? Math.max(1, 12 - purchasedMonthsOf(contract.subscription.startedAt, contract.subscription.expiresAt))
          : 12
        : 1
    const amountVnd = plan.priceVnd * months
    subscribe.mutate(arg, { onSuccess: (start) => openPayment(start, plan.name, amountVnd), onError: showError })
  }

  function handleChoosePlan(plan: SubscriptionPlan) {
    if (contract !== null) {
      setUpgradeCycle('MONTHLY')
      setUpgradePlan(plan)
      return
    }
    handleSubscribe(plan)
  }

  function handleConfirmUpgrade() {
    if (!upgradePlan) return
    const target = upgradePlan
    const arg = upgradeCycle === 'YEARLY' ? { planId: target.id, billingCycle: 'YEARLY' as const } : target.id
    const amountVnd = upgradeCycle === 'YEARLY' ? target.priceVnd * 12 : target.priceVnd
    subscribe.mutate(arg, {
      onSuccess: (start) => {
        setUpgradePlan(null)
        openPayment(start, target.name, amountVnd)
      },
      onError: (error) => {
        setUpgradePlan(null)
        showError(error)
      },
    })
  }

  function handleTopUp(credits: number) {
    const amountVnd = credits * topUpTerms(current?.plan.tier ?? null).priceVnd
    topUp.mutate(credits, { onSuccess: (start) => openPayment(start, '', amountVnd), onError: showError })
  }

  function handleSign(request: SignAgreementRequest) {
    sign.mutate(request, {
      onSuccess: () => {
        setAgreementDialog(null)
        toast.success(t('billing.agreementSigned'))
      },
      onError: showError,
    })
  }

  function handleCancel() {
    cancel.mutate(undefined, {
      onSuccess: (cancelled) => {
        setCancelOpen(false)
        toast.success(t('billing.cancelled', { plan: current?.plan.name ?? '', date: format.date(cancelled.expiresAt) }))
      },
      onError: (error) => {
        setCancelOpen(false)
        showError(error)
      },
    })
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap={!failed && !loading}
        title={t('billing.title')}
        description={t('pageHero.billing')}
        actions={
          failed || loading ? null : (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="glass" onClick={() => setSupportOpen(true)}>
                <LifeBuoy strokeWidth={1.5} />
                {t('billing.support')}
              </Button>
              <Button variant="primary" onClick={() => setTopUpOpen(true)}>
                <Coins strokeWidth={1.5} />
                {t('billing.topUp')}
              </Button>
            </div>
          )
        }
      />
      <div className={failed || loading ? 'min-h-0 flex-1 overflow-auto px-shell py-6' : 'sky-overlap flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-shell pb-6'}>
        {failed ? (
          <EmptyState
            mascot="error"
            title={dataErrorMessage(subscription.error ?? balance.error, t)}
            action={<Button variant="secondary" onClick={() => void Promise.all([subscription.refetch(), balance.refetch()])}><RotateCcw strokeWidth={1.5} />{t('billing.retry')}</Button>}
          />
        ) : loading || balance.data === undefined || current === undefined ? (
          <div role="status" aria-label={t('billing.loading')} className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <>
            {pending ? (
              <Banner
                tone="warning"
                action={
                  <Button variant="secondary" size="sm" asChild>
                    <Link to={paymentPath(pending.id)}>{t('billing.pay')}</Link>
                  </Button>
                }
              >
                {t(`billing.pending.${pending.purpose === 'RENEWAL' ? 'RENEWAL' : 'SUBSCRIBE'}`, {
                  plan: pendingPlan,
                  amount: format.currency(pending.amountVnd),
                  date: current ? format.date(current.subscription.expiresAt) : '',
                })}
              </Banner>
            ) : null}
            <TrialAgreementBanner agreement={agreement} onOpenSignDialog={() => setAgreementDialog('sign')} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              {current ? (
                <PlanSummaryCard
                  current={current}
                  onCancel={() => setCancelOpen(true)}
                  onRenew={BILLING_CAPABILITIES.contractRenewal ? () => handleSubscribe(current.plan, 'MONTHLY') : undefined}
                  renewPending={
                    subscribe.isPending &&
                    (subscribe.variables === current.plan.id ||
                      (typeof subscribe.variables === 'object' &&
                        subscribe.variables !== null &&
                        subscribe.variables.planId === current.plan.id &&
                        subscribe.variables.billingCycle !== 'YEARLY'))
                  }
                  onRenewYear={BILLING_CAPABILITIES.contractRenewal ? () => handleSubscribe(current.plan, 'YEARLY') : undefined}
                  renewYearPending={
                    subscribe.isPending &&
                    typeof subscribe.variables === 'object' &&
                    subscribe.variables !== null &&
                    subscribe.variables.planId === current.plan.id &&
                    subscribe.variables.billingCycle === 'YEARLY'
                  }
                />
              ) : (
                <Card>
                  <EmptyState
                    compact
                    mascot="empty"
                    title={t(view?.lapsed ? 'billing.noPlan.lapsedTitle' : 'billing.noPlan.title')}
                    description={t(view?.lapsed ? 'billing.noPlan.lapsedDescription' : 'billing.noPlan.description')}
                  />
                </Card>
              )}
              <div className="flex flex-col gap-4">
                <BalanceCard credit={balance.data} />
                {agreement ? <AgreementCard agreement={agreement} onSign={() => setAgreementDialog('sign')} onView={() => setAgreementDialog('view')} /> : null}
              </div>
            </div>
            {canSubscribe || contract ? (
              <PlanChoiceCard
                plans={plans.data ?? []}
                pendingId={
                  subscribe.isPending
                    ? typeof subscribe.variables === 'string'
                      ? subscribe.variables
                      : (subscribe.variables?.planId ?? null)
                    : null
                }
                onSubscribe={handleChoosePlan}
                current={contract ? { tier: contract.plan.tier } : null}
              />
            ) : null}
            <BillingHistoryCard />
          </>
        )}
      </div>

      <TopUpDialog
        open={topUpOpen}
        onOpenChange={setTopUpOpen}
        pending={topUp.isPending}
        onConfirm={handleTopUp}
        tier={current?.plan.tier ?? null}
        balance={balance.data?.balance ?? 0}
      />
      {supportOpen ? <SupportTicketDialog onClose={() => setSupportOpen(false)} /> : null}
      <SignAgreementDialog agreement={agreement} open={agreementDialog === 'sign'} onClose={() => setAgreementDialog(null)} onSign={handleSign} isSigning={sign.isPending} />
      <ViewAgreementDialog agreement={agreement} open={agreementDialog === 'view'} onClose={() => setAgreementDialog(null)} />
      <ConfirmDialog
        open={upgradePlan !== null}
        onOpenChange={(open) => { if (!open) setUpgradePlan(null) }}
        title={t('billing.upgradeDialog.title', { plan: upgradePlan?.name ?? '' })}
        description={t('billing.upgradeDialog.description', {
          plan: upgradePlan?.name ?? '',
          currentPlan: current?.plan.name ?? '',
          months: current ? remainingMonthsOf(current.subscription.startedAt, current.subscription.expiresAt) : 0,
        })}
        cancelLabel={t('billing.upgradeDialog.cancel')}
        confirmLabel={t('billing.upgradeDialog.confirm')}
        pending={subscribe.isPending}
        onConfirm={handleConfirmUpgrade}
      >
        {upgradePlan ? (
          <div className="flex flex-col gap-3 px-6 pb-5">
            <div className="flex flex-col gap-1.5">
              <span className="text-small font-medium text-ink-2">{t('billing.upgradeDialog.cycleLabel')}</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setUpgradeCycle('MONTHLY')}
                  className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition ${
                    upgradeCycle === 'MONTHLY'
                      ? 'border-cyan-500 bg-cyan-50/60 text-ink-strong ring-1 ring-cyan-500'
                      : 'border-line bg-surface text-ink-2 hover:border-ink-3'
                  }`}
                >
                  <span className="text-small font-semibold">{t('billing.upgradeDialog.monthly')}</span>
                  <span className="text-caption text-ink-3 tabular-nums">{format.currency(upgradePlan.priceVnd)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUpgradeCycle('YEARLY')}
                  className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition ${
                    upgradeCycle === 'YEARLY'
                      ? 'border-cyan-500 bg-cyan-50/60 text-ink-strong ring-1 ring-cyan-500'
                      : 'border-line bg-surface text-ink-2 hover:border-ink-3'
                  }`}
                >
                  <span className="text-small font-semibold">{t('billing.upgradeDialog.yearly')}</span>
                  <span className="text-caption text-ink-3 tabular-nums">{format.currency(upgradePlan.priceVnd * 12)}</span>
                </button>
              </div>
            </div>
            <p className="m-0 text-small font-medium text-ink-strong tabular-nums">
              {t('billing.upgradeDialog.total', {
                amount: format.currency(upgradeCycle === 'YEARLY' ? upgradePlan.priceVnd * 12 : upgradePlan.priceVnd),
              })}
            </p>
          </div>
        ) : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={t('billing.cancelDialog.title', { plan: current?.plan.name ?? '' })}
        description={t('billing.cancelDialog.description', { date: current ? format.date(current.subscription.expiresAt) : '' })}
        cancelLabel={t('billing.cancelDialog.cancel')}
        confirmLabel={t('billing.cancelDialog.confirm')}
        danger
        pending={cancel.isPending}
        onConfirm={handleCancel}
      />
    </div>
  )
}
