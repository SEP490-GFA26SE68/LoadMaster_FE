import { RotateCcw } from 'lucide-react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { BILLING_CAPABILITIES } from './billing-api'
import { CheckoutRow } from './CheckoutRow'
import { PAYMENT_KIND_PARAM, PAYMENT_REFERENCE_PARAM, paymentPurposeOf } from './payment-path'
import type { ServerPaymentPurpose } from './server-payment-api'
import { useConfirmServerPaymentMutation } from './useBillingQuery'

/**
 * Xác nhận thanh toán qua backend `/thanh-toan/ket-qua?ma=<mã giao dịch>&loai=goi|credit` (nhóm `billing`). Cổng thử của backend không
 * có trang riêng nên người dùng xác nhận ở đây; xác nhận gọi cổng thử rồi **đọc lại kết quả từ máy chủ** — không tin tham số trên URL.
 * Thành công: về `/goi-cuoc` kèm toast nói đúng điều máy chủ ghi. Máy chủ chưa ghi nhận: nói tại chỗ, gói và số dư không đổi. Huỷ: chưa
 * trả gì (backend chưa có lệnh huỷ giao dịch), về gói cước. Với kho mẫu trang không dùng (thanh toán ở trang giả lập) nên về gói cước.
 */
export function PaymentResultPage() {
  return BILLING_CAPABILITIES.serverPayment ? <PaymentResult /> : <Navigate to="/goi-cuoc" replace />
}

function PaymentResult() {
  const t = useT()
  const format = useFormat()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const reference = params.get(PAYMENT_REFERENCE_PARAM) ?? ''
  const purpose = paymentPurposeOf(params.get(PAYMENT_KIND_PARAM))
  const confirm = useConfirmServerPaymentMutation()
  const outcome = confirm.data

  function handleConfirm(target: ServerPaymentPurpose) {
    confirm.mutate({ reference, purpose: target }, {
      onSuccess: (result) => {
        if (result.status !== 'SUCCESS') return
        toast.success(result.purpose === 'SUBSCRIBE'
          ? t('payment.toasts.SUBSCRIBE', { plan: result.planName })
          : t('payment.toasts.TOPUP', { credits: format.integer(result.credits) }))
        void navigate('/goi-cuoc')
      },
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  function handleCancel() {
    toast(t('payment.server.cancelled'))
    void navigate('/goi-cuoc')
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero title={t('payment.server.title')} description={t('pageHero.paymentResult')} back={{ to: '/goi-cuoc', label: t('payment.toBilling') }} />
      <div className="min-h-0 flex-1 overflow-auto px-shell py-6">
        {reference === '' || purpose === null ? (
          <EmptyState
            mascot="notFound"
            title={t('payment.notFound.title')}
            description={t('payment.server.notFound')}
            action={<Button variant="secondary" onClick={() => void navigate('/goi-cuoc')}>{t('payment.toBilling')}</Button>}
          />
        ) : (
          <Card className="mx-auto w-full max-w-130">
            <CardBody className="flex flex-col gap-5">
              <Banner tone="info">{t('payment.server.notice')}</Banner>
              <dl className="m-0 flex flex-col">
                <CheckoutRow label={t('payment.description')}>{t(`payment.server.purposes.${purpose}`)}</CheckoutRow>
                <CheckoutRow label={t('payment.code')}><span className="font-mono text-body break-all tabular-nums">{reference}</span></CheckoutRow>
              </dl>
              <div role="status" aria-live="polite">
                {confirm.isPending ? <span className="sr-only">{t('payment.server.loading')}</span> : null}
                {outcome?.status === 'NOT_CONFIRMED' ? <Banner tone="danger">{t('payment.server.notConfirmed', { code: outcome.gatewayCode ?? '—' })}</Banner> : null}
              </div>
              {outcome?.status === 'NOT_CONFIRMED' ? (
                <div className="flex flex-wrap justify-end gap-2.5">
                  <Button variant="secondary" disabled={confirm.isPending} onClick={() => handleConfirm(purpose)}>
                    <RotateCcw strokeWidth={1.5} />
                    {t('payment.server.retry')}
                  </Button>
                  <Button variant="primary" onClick={() => void navigate('/goi-cuoc')}>{t('payment.toBilling')}</Button>
                </div>
              ) : (
                <>
                  <p className="m-0 text-small text-ink-2">{t('payment.server.hint')}</p>
                  <div className="flex flex-wrap justify-end gap-2.5">
                    <Button variant="ghost" disabled={confirm.isPending} onClick={handleCancel}>{t('payment.server.cancel')}</Button>
                    <Button variant="primary" loading={confirm.isPending} onClick={() => handleConfirm(purpose)}>{t('payment.server.confirm')}</Button>
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}
