import { Coins, FileSignature, LifeBuoy, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { TabCount, Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useListUrlState } from '@/components/useListUrlState'
import { isAuthenticated } from '@/features/auth/auth-api'
import { SupportTicketDialog } from '@/features/support/SupportTicketDialog'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { PaymentTransaction } from '@/lib/mock-db'
import { BalanceCard } from './BalanceCard'
import { CreditLedgerTable } from './CreditLedgerTable'
import { PaymentsTable } from './PaymentsTable'
import { paymentPath } from './payment-path'
import { PlanChoiceCard } from './PlanChoiceCard'
import { PlanSummaryCard } from './PlanSummaryCard'
import { SignAgreementDialog } from './SignAgreementDialog'
import { TopUpDialog } from './TopUpDialog'
import { TrialAgreementBanner } from './TrialAgreementBanner'
import { ViewAgreementDialog } from './ViewAgreementDialog'
import { useMyAgreementQuery, useSignAgreementMutation } from './useAgreementQuery'
import {
  useCancelSubscriptionMutation,
  useCreditBalanceQuery,
  useCreditTransactionsQuery,
  usePaymentsQuery,
  usePlansOnSaleQuery,
  useSubscribeMutation,
  useSubscriptionQuery,
  useTopUpMutation,
} from './useBillingQuery'

/** Tab lịch sử trên URL (`?lich-su=thanh-toan`); vắng là lịch sử credit. */
const HISTORY_TAB = 'lich-su'
const PAYMENTS_TAB = 'thanh-toan'

/** Thanh toán của gói đang chờ trả: gia hạn trước (gói sắp hết hạn), rồi đăng ký dở. Nạp credit chờ không có banner — mỗi lần bấm Nạp là một giao dịch mới. */
function pendingPlanPayment(payments: readonly PaymentTransaction[]): PaymentTransaction | undefined {
  return payments.find((item) => item.status === 'PENDING' && item.purpose === 'RENEWAL') ?? payments.find((item) => item.status === 'PENDING' && item.purpose === 'SUBSCRIBE')
}

/**
 * Gói cước và credit của công ty `/goi-cuoc` (FE-8-03, D-89, D-94) — màn của quản trị công ty (`billing.manage`). Gói hiện tại và trạng
 * thái, số dư (gói không giới hạn: "Không giới hạn"), lịch sử credit và thanh toán phân trang; đăng ký (chỉ khi chưa có gói hoặc gói
 * hết hạn), huỷ gói, nạp credit 50 / 500. Đăng ký và nạp chỉ tạo thanh toán chờ rồi mở trang thanh toán giả lập (FE-8-04); thanh toán
 * gia hạn đang chờ có banner kèm nút Trả. Một nút chính: Nạp credit.
 */
export function BillingPage() {
  const t = useT()
  const format = useFormat()
  const navigate = useNavigate()
  const subscription = useSubscriptionQuery()
  const balance = useCreditBalanceQuery()
  const plans = usePlansOnSaleQuery()
  const transactions = useCreditTransactionsQuery()
  const payments = usePaymentsQuery()
  const subscribe = useSubscribeMutation()
  const topUp = useTopUpMutation()
  const cancel = useCancelSubscriptionMutation()
  const agreementQuery = useMyAgreementQuery()
  const signAgreementMutation = useSignAgreementMutation()
  const list = useListUrlState<typeof HISTORY_TAB>({ filters: [HISTORY_TAB] })
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [signAgreementOpen, setSignAgreementOpen] = useState(false)
  const [viewAgreementOpen, setViewAgreementOpen] = useState(false)
  const isMockSession = import.meta.env.MODE === 'test' && typeof sessionStorage !== 'undefined' && Boolean(sessionStorage.getItem('loadmaster.phien'))

  const current = subscription.data
  const canSubscribe = current !== undefined && (current === null || current.subscription.status === 'EXPIRED')
  const pending = pendingPlanPayment(payments.data ?? [])
  const pendingPlan = pending === undefined ? '' : (pending.purpose === 'RENEWAL' ? current?.plan.name : plans.data?.find((plan) => plan.id === pending.planId)?.name) ?? (pending.planId ?? '')
  const failed = subscription.isError || balance.isError
  const loading = !failed && (subscription.isPending || balance.isPending)
  const tab = list.filters[HISTORY_TAB] === PAYMENTS_TAB ? 'payments' : 'credit'
  const pagination = { pageIndex: list.pageIndex, pageSize: list.pageSize, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }

  function showError(error: unknown) {
    toast.error(dataErrorMessage(error, t))
  }

  function handleSubscribe(planId: string) {
    subscribe.mutate(planId, { onSuccess: (payment) => void navigate(paymentPath(payment.id)), onError: showError })
  }

  function handleTopUp(credits: number) {
    topUp.mutate(credits, { onSuccess: (payment) => void navigate(paymentPath(payment.id)), onError: showError })
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
              <Button variant="secondary" onClick={() => setSupportOpen(true)}>
                <LifeBuoy strokeWidth={1.5} />
                {t('nav.supportRequests')}
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
            <TrialAgreementBanner
              agreement={agreementQuery.data}
              onOpenSignDialog={() => setSignAgreementOpen(true)}
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              {current ? (
                <PlanSummaryCard
                  current={current}
                  onCancel={() => setCancelOpen(true)}
                  onRenew={isAuthenticated() ? () => handleSubscribe(current.plan.id) : undefined}
                  renewPending={subscribe.isPending}
                />
              ) : (
                <Card><EmptyState compact mascot="empty" title={t('billing.noPlan.title')} description={t('billing.noPlan.description')} /></Card>
              )}
              <div className="flex flex-col gap-4">
                <BalanceCard credit={balance.data} />
                {agreementQuery.data && (
                  <Card className="flex flex-col justify-between p-4 border border-line-soft bg-surface/50 shadow-2xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`flex size-9 items-center justify-center rounded-lg ${
                          agreementQuery.data.status === 'SIGNED' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                        }`}>
                          <FileSignature className="size-4.5" />
                        </div>
                        <div className="flex flex-col">
                          <h4 className="text-small font-bold text-ink-strong">Thỏa thuận dịch vụ</h4>
                          <span className="font-mono text-fine text-ink-3">#{agreementQuery.data.agreementCode}</span>
                        </div>
                      </div>
                      {agreementQuery.data.status === 'SIGNED' ? (
                        <Badge tone="success" dot="solid">Đã ký</Badge>
                      ) : agreementQuery.data.isExpired ? (
                        <Badge tone="danger" dot="solid">Quá hạn</Badge>
                      ) : (
                        <Badge tone="warning" dot="ring">Chờ ký ({agreementQuery.data.hoursRemaining}h)</Badge>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-line-soft pt-2.5 text-caption text-ink-2">
                      <span className="truncate">
                        {agreementQuery.data.status === 'SIGNED'
                          ? `Ký bởi: ${agreementQuery.data.signerName || 'Đại diện'}`
                          : `Hạn: ${agreementQuery.data.deadlineAt ? format.date(agreementQuery.data.deadlineAt) : '3 ngày'}`}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {agreementQuery.data.status === 'PENDING' && !agreementQuery.data.isExpired && (
                          <Button size="sm" variant="primary" onClick={() => setSignAgreementOpen(true)} className="h-7 text-caption">
                            Ký ngay
                          </Button>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => setViewAgreementOpen(true)} className="h-7 text-caption">
                          Xem văn bản
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            </div>
            {(isMockSession ? canSubscribe : (canSubscribe || (isAuthenticated() && current !== null && current.subscription.status !== 'CANCELLED'))) ? (
              <PlanChoiceCard
                plans={
                  isAuthenticated() && current !== null && current.subscription.status !== 'EXPIRED' && !isMockSession
                    ? (plans.data ?? []).filter((plan) => plan.id === current.plan.id || plan.priceVnd > current.plan.priceVnd)
                    : (plans.data ?? [])
                }
                pendingId={subscribe.isPending ? (subscribe.variables ?? null) : null}
                currentPlanId={!isMockSession && isAuthenticated() && current !== null && current.subscription.status !== 'EXPIRED' ? current.plan.id : null}
                currentPlanTier={!isMockSession && isAuthenticated() && current !== null && current.subscription.status !== 'EXPIRED' ? current.plan.tier : null}
                onSubscribe={(plan) => handleSubscribe(plan.id)}
                onRequestUpgrade={!isMockSession && isAuthenticated() && current !== null && current.subscription.status !== 'EXPIRED' ? () => setSupportOpen(true) : undefined}
              />
            ) : null}
            <Card role="region" aria-labelledby="billing-history" className="relative flex-none overflow-hidden">
              <CardHeader className="border-b-0 pb-0">
                <CardTitle as="h2" id="billing-history">{t('billing.history.title')}</CardTitle>
              </CardHeader>
              <Tabs value={tab} onValueChange={(value) => list.setFilter(HISTORY_TAB, value === 'payments' ? PAYMENTS_TAB : '')}>
                <TabsList aria-label={t('billing.history.title')}>
                  <TabsTrigger value="credit">{t('billing.history.tabs.credit')}<TabCount>{transactions.data?.length ?? 0}</TabCount></TabsTrigger>
                  <TabsTrigger value="payments">{t('billing.history.tabs.payments')}<TabCount>{payments.data?.length ?? 0}</TabCount></TabsTrigger>
                </TabsList>
              </Tabs>
              {transactions.isPending || payments.isPending ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : tab === 'credit' ? (
                <CreditLedgerTable rows={transactions.data ?? []} pagination={pagination} />
              ) : (
                <PaymentsTable rows={payments.data ?? []} pagination={pagination} />
              )}
            </Card>
          </>
        )}
      </div>

      <TopUpDialog
        open={topUpOpen}
        onOpenChange={setTopUpOpen}
        pending={topUp.isPending}
        onConfirm={handleTopUp}
        tier={isMockSession ? undefined : (isAuthenticated() ? (current?.plan.tier ?? 'BASIC') : undefined)}
        currentBalance={isMockSession ? undefined : (isAuthenticated() ? (balance.data?.balance ?? 0) : undefined)}
      />
      {supportOpen ? <SupportTicketDialog onClose={() => setSupportOpen(false)} /> : null}
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
      <SignAgreementDialog
        agreement={agreementQuery.data ?? null}
        open={signAgreementOpen}
        onClose={() => setSignAgreementOpen(false)}
        onSign={async (data) => {
          try {
            await signAgreementMutation.mutateAsync(data)
            setSignAgreementOpen(false)
            toast.success('Ký thỏa thuận dịch vụ thành công!')
          } catch (err: any) {
            toast.error(err?.message || 'Không thể ký thỏa thuận. Vui lòng thử lại.')
          }
        }}
        isSigning={signAgreementMutation.isPending}
      />
      <ViewAgreementDialog
        agreement={agreementQuery.data ?? null}
        open={viewAgreementOpen}
        onClose={() => setViewAgreementOpen(false)}
      />
    </div>
  )
}
