import { RotateCcw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { isAuthenticated } from '@/features/auth/auth-api'
import { dataErrorMessage, useFormat, useT, type TFunction } from '@/lib/i18n'
import { MockDbError, type PaymentTransaction } from '@/lib/mock-db'
import type { Checkout } from './payment-api'
import { PAYMENT_PARAM } from './payment-path'
import { useCheckoutQuery, useSettlePaymentMutation } from './useBillingQuery'

type Choice = 'SUCCESS' | 'FAILED' | 'CANCELLED'

/** Câu của toast nói đúng điều đã xảy ra theo trạng thái kho trả về — không theo nút đã bấm: thanh toán đã xử lý ở nơi khác thì kết quả cuối mới là sự thật. */
function outcomeMessage(t: TFunction, format: ReturnType<typeof useFormat>, result: PaymentTransaction, planName: string | null, choice: Choice): string {
  if (result.status === 'SUCCESS') {
    return t(`payment.toasts.${result.purpose}`, { plan: planName ?? '', credits: format.integer(result.credits ?? 0) })
  }
  return t(choice === 'CANCELLED' && result.status === 'FAILED' ? 'payment.toasts.CANCELLED' : 'payment.toasts.FAILED')
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-line-soft py-3 last:border-b-0">
      <dt className="text-small text-ink-3">{label}</dt>
      <dd className="m-0 text-right font-medium text-ink-strong">{children}</dd>
    </div>
  )
}

export function PaymentSimulationPage() {
  const t = useT()
  const format = useFormat()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const paymentId = params.get(PAYMENT_PARAM) ?? ''
  const checkout = useCheckoutQuery(paymentId)
  const settle = useSettlePaymentMutation()

  const [cardNumber, setCardNumber] = useState('9704198526191432198')
  const [cardHolder, setCardHolder] = useState('NGUYEN VAN A')
  const [issueDate, setIssueDate] = useState('07/15')
  const [otp, setOtp] = useState('123456')

  function handleChoose(data: Checkout, choice: Choice) {
    settle.mutate({ paymentId: data.payment.id, outcome: choice === 'SUCCESS' ? 'SUCCESS' : 'FAILED' }, {
      onSuccess: (result) => {
        const show = result.status === 'SUCCESS' ? toast.success : toast.error
        show(outcomeMessage(t, format, result, data.planName, choice))
        void navigate('/goi-cuoc')
      },
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  function handleCardSubmit(data: Checkout) {
    const cleanCard = cardNumber.replace(/\s+/g, '')
    if (cleanCard !== '9704198526191432198' || otp.trim() !== '123456') {
      toast.error('Thông tin thẻ test NCB hoặc OTP không đúng (Số thẻ: 9704198526191432198, OTP: 123456)')
      return
    }
    handleChoose(data, 'SUCCESS')
  }

  const isMockSession = import.meta.env.MODE === 'test' && typeof sessionStorage !== 'undefined' && Boolean(sessionStorage.getItem('loadmaster.phien'))
  const notFound = paymentId === '' || (checkout.error instanceof MockDbError && checkout.error.code === 'NOT_FOUND')
  const data = checkout.data

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero title={t('payment.title')} description={t('pageHero.payment')} back={{ to: '/goi-cuoc', label: t('payment.toBilling') }} />
      <div className="min-h-0 flex-1 overflow-auto px-shell py-6">
        {notFound ? (
          <EmptyState
            mascot="notFound"
            title={t('payment.notFound.title')}
            description={t('payment.notFound.description')}
            action={<Button variant="secondary" onClick={() => void navigate('/goi-cuoc')}>{t('payment.toBilling')}</Button>}
          />
        ) : checkout.isError ? (
          <EmptyState
            mascot="error"
            title={t('payment.error')}
            action={<Button variant="secondary" onClick={() => void checkout.refetch()}><RotateCcw strokeWidth={1.5} />{t('payment.retry')}</Button>}
          />
        ) : data === undefined ? (
          <div role="status" aria-label={t('payment.loading')} className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <Card className="mx-auto w-full max-w-130">
            <CardBody className="flex flex-col gap-5">
              <Banner tone="info">{t('payment.notice')}</Banner>
              <p className="m-0 text-center font-display text-[40px] leading-12 font-bold text-ink-strong tabular-nums font-stretch-112%">
                {format.currency(data.payment.amountVnd)}
              </p>
              <dl className="m-0 flex flex-col">
                <Row label={t('payment.description')}>
                  {t(`payment.purposes.${data.payment.purpose}`, { plan: data.planName ?? '', credits: format.integer(data.payment.credits ?? 0) })}
                </Row>
                <Row label={t('payment.code')}><span className="font-mono text-body tabular-nums">{data.payment.id}</span></Row>
                {data.payment.status === 'PENDING' ? null : <Row label={t('payment.status')}>{t(`billing.payments.statuses.${data.payment.status}`)}</Row>}
              </dl>
              {data.payment.status === 'PENDING' ? (
                <>
                  {isAuthenticated() && !isMockSession ? (
                    <div className="flex flex-col gap-3 rounded-lg border border-line-soft bg-surface p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-ink-strong">Thẻ nội địa NCB (VNPay Sandbox)</span>
                        {data.paymentUrl?.startsWith('http') ? (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              window.location.href = data.paymentUrl!
                            }}
                          >
                            Mở trang sandbox.vnpayment.vn
                          </Button>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1 text-small text-ink-2 sm:col-span-2">
                          <span>Số thẻ (Ngân hàng NCB)</span>
                          <Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="9704198526191432198" />
                        </label>
                        <label className="flex flex-col gap-1 text-small text-ink-2">
                          <span>Tên chủ thẻ</span>
                          <Input value={cardHolder} onChange={(e) => setCardHolder(e.target.value)} placeholder="NGUYEN VAN A" />
                        </label>
                        <label className="flex flex-col gap-1 text-small text-ink-2">
                          <span>Ngày phát hành (MM/YY)</span>
                          <Input value={issueDate} onChange={(e) => setIssueDate(e.target.value)} placeholder="07/15" />
                        </label>
                        <label className="flex flex-col gap-1 text-small text-ink-2 sm:col-span-2">
                          <span>Mã OTP Sandbox</span>
                          <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" />
                        </label>
                      </div>
                      <Button variant="primary" loading={settle.isPending} onClick={() => handleCardSubmit(data)}>
                        Xác nhận thanh toán thẻ NCB
                      </Button>
                    </div>
                  ) : null}
                  <p className="m-0 text-small text-ink-2">{t('payment.hint')}</p>
                  <div className="flex flex-wrap justify-end gap-2.5">
                    <Button variant="ghost" disabled={settle.isPending} onClick={() => handleChoose(data, 'CANCELLED')}>{t('payment.cancel')}</Button>
                    <Button variant="secondary" disabled={settle.isPending} onClick={() => handleChoose(data, 'FAILED')}>{t('payment.failure')}</Button>
                    <Button variant="primary" loading={settle.isPending} onClick={() => handleChoose(data, 'SUCCESS')}>{t('payment.success')}</Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="m-0 font-semibold text-ink-strong">{t('payment.settled.title')}</p>
                  <p className="m-0 text-small text-ink-2">
                    {t('payment.settled.description', { code: data.payment.id, status: t(`billing.payments.statuses.${data.payment.status}`) })}
                  </p>
                  <div className="flex justify-end">
                    <Button variant="primary" onClick={() => void navigate('/goi-cuoc')}>{t('payment.toBilling')}</Button>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}
