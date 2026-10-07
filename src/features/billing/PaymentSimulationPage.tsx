import { RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
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

/**
 * Thanh toán giả lập `/thanh-toan/gia-lap?giao-dich=<mã>` (FE-8-04, D-89) — thay cổng thanh toán thật khi chưa có backend; trung tính,
 * không mang tên, logo hay màu của cổng nào, và nói rõ đây là giả lập. Hiện số tiền, nội dung, mã giao dịch và ba nút Thành công /
 * Thất bại / Huỷ. Thành công kích hoạt gói hoặc cộng credit **đúng một lần** — việc đó do kho bảo đảm (`settlePayment` trả nguyên kết
 * quả cũ nếu giao dịch đã xử lý), trang không tự chặn thêm: giao dịch đã xử lý thì chỉ hiện kết quả, không còn nút. Xong thì về
 * `/goi-cuoc` kèm toast nói đúng điều đã xảy ra. Mã không có, hoặc của công ty khác: màn "Không tìm thấy giao dịch".
 */
export function PaymentSimulationPage() {
  const t = useT()
  const format = useFormat()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const paymentId = params.get(PAYMENT_PARAM) ?? ''
  const checkout = useCheckoutQuery(paymentId)
  const settle = useSettlePaymentMutation()

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
