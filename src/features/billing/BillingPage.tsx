import { Coins, RotateCcw } from 'lucide-react'
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
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { PaymentTransaction, SubscriptionPlan } from '@/lib/mock-db'
import { BalanceCard } from './BalanceCard'
import { BillingHistoryCard } from './BillingHistoryCard'
import { paymentPath } from './payment-path'
import { PlanChoiceCard } from './PlanChoiceCard'
import { PlanSummaryCard } from './PlanSummaryCard'
import { TopUpDialog } from './TopUpDialog'
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

/**
 * Gói cước và credit của công ty `/goi-cuoc` (FE-8-03, D-89, D-94) — màn của quản trị công ty (`billing.manage`). Gói hiện tại và trạng
 * thái, số dư (gói không giới hạn: "Không giới hạn"), lịch sử phân trang (`BillingHistoryCard`); đăng ký (chỉ khi chưa có gói hoặc gói
 * hết hạn), huỷ gói, nạp credit 50 / 500. Đăng ký và nạp chỉ tạo thanh toán chờ rồi mở trang thanh toán (`useOpenPayment`: giả lập
 * với kho mẫu, trang xác nhận khi nối backend); thanh toán gia hạn đang chờ của kho mẫu có banner kèm nút Trả. Một nút chính: Nạp credit.
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

  const view = subscription.data
  const current = view?.current
  const canSubscribe = current !== undefined && (current === null || current.subscription.status === 'EXPIRED')
  const pending = pendingPlanPayment(payments.data ?? [])
  const pendingPlan = pending === undefined ? '' : (pending.purpose === 'RENEWAL' ? current?.plan.name : plans.data?.find((plan) => plan.id === pending.planId)?.name) ?? (pending.planId ?? '')
  const failed = subscription.isError || balance.isError
  const loading = !failed && (subscription.isPending || balance.isPending)

  function showError(error: unknown) {
    toast.error(dataErrorMessage(error, t))
  }

  function handleSubscribe(plan: SubscriptionPlan) {
    subscribe.mutate(plan.id, { onSuccess: (start) => openPayment(start, plan.name), onError: showError })
  }

  function handleTopUp(credits: number) {
    topUp.mutate(credits, { onSuccess: (start) => openPayment(start), onError: showError })
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
            <Button variant="primary" onClick={() => setTopUpOpen(true)}>
              <Coins strokeWidth={1.5} />
              {t('billing.topUp')}
            </Button>
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
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              {current ? (
                <PlanSummaryCard current={current} onCancel={() => setCancelOpen(true)} />
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
              <BalanceCard credit={balance.data} />
            </div>
            {canSubscribe ? (
              <PlanChoiceCard
                plans={plans.data ?? []}
                pendingId={subscribe.isPending ? (subscribe.variables ?? null) : null}
                onSubscribe={handleSubscribe}
              />
            ) : null}
            <BillingHistoryCard />
          </>
        )}
      </div>

      <TopUpDialog open={topUpOpen} onOpenChange={setTopUpOpen} pending={topUp.isPending} onConfirm={handleTopUp} />
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
