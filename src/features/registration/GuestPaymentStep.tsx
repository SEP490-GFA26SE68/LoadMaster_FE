import { ArrowLeft, CreditCard } from 'lucide-react'
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { CardHeader, CardTitle } from '@/components/ui/Card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup'
import { PUBLIC_TOUCH } from '@/features/marketing/public-chrome'
import { useFormat, useT } from '@/lib/i18n'
import type { SubscriptionPlan } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import type { PaymentValues } from './payment-form'

/** Kỳ thanh toán đang chọn: nút phụ viền cyan — màn chỉ có một nút chính (Thanh toán). */
const SELECTED_CYCLE = 'border-primary bg-primary-bg text-primary hover:bg-primary-bg'

/** Bước 4 của đăng ký trả phí: chọn gói, kỳ thanh toán và thanh toán. */
export function GuestPaymentStep({
  form,
  plans,
  loading,
  onBack,
  onSubmit,
}: {
  form: UseFormReturn<PaymentValues>
  plans: SubscriptionPlan[]
  loading: boolean
  onBack: () => void
  onSubmit: (values: PaymentValues) => void
}) {
  const t = useT()
  const format = useFormat()
  const [planId, billingCycle] = useWatch({ control: form.control, name: ['planId', 'billingCycle'] })
  const selectedPlan = plans.find((p) => String(p.id) === planId)
  const basePrice = selectedPlan?.priceVnd ?? 0
  const totalPrice = billingCycle === 'YEARLY' ? basePrice * 12 : basePrice

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <CardHeader>
        <CardTitle as="h2" className="text-h2">{t('guestRegistration.step4.title')}</CardTitle>
        <p className="text-small text-ink-2">{t('guestRegistration.step4.description')}</p>
      </CardHeader>

      <div className="flex flex-col gap-6 p-6 pt-0">
        <div className="flex flex-col gap-3">
          <span className="text-body font-semibold text-ink-strong">{t('guestRegistration.step4.choosePlan')}</span>
          <Controller
            control={form.control}
            name="planId"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-3 sm:grid-cols-3">
                {plans.map((p) => (
                  <label
                    key={p.id}
                    htmlFor={`plan-${p.id}`}
                    className={cn(
                      'flex cursor-pointer flex-col justify-between rounded-lg border p-4 transition-all',
                      field.value === String(p.id) ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:bg-surface',
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-ink-strong">{p.name}</span>
                        <RadioGroupItem value={String(p.id)} id={`plan-${p.id}`} />
                      </div>
                      <div className="mt-2 font-display text-h3 font-bold text-primary">
                        {format.currency(p.priceVnd)}
                        <span className="text-caption font-normal text-ink-2">{t('guestRegistration.step4.perMonth')}</span>
                      </div>
                    </div>
                    <div className="mt-3 border-t border-border/50 pt-2 text-caption text-ink-2">
                      {p.monthlyCredits
                        ? t('guestRegistration.step4.creditsPerMonth', { count: p.monthlyCredits })
                        : t('guestRegistration.step4.unlimitedCredits')}
                    </div>
                  </label>
                ))}
              </RadioGroup>
            )}
          />
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-body font-semibold text-ink-strong">{t('guestRegistration.step4.billingCycle')}</span>
          <Controller
            control={form.control}
            name="billingCycle"
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-3">
                {(['MONTHLY', 'YEARLY'] as const).map((cycle) => (
                  <Button
                    key={cycle}
                    type="button"
                    variant="secondary"
                    aria-pressed={field.value === cycle}
                    onClick={() => field.onChange(cycle)}
                    className={cn('h-12', field.value === cycle && SELECTED_CYCLE)}
                  >
                    {cycle === 'MONTHLY' ? t('guestRegistration.step4.oneMonth') : t('guestRegistration.step4.oneYear')}
                  </Button>
                ))}
              </div>
            )}
          />
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-baseline justify-between border-b border-border/50 pb-2">
            <span className="text-body text-ink-2">{t('guestRegistration.step4.selectedPlanLabel')}</span>
            <strong className="text-body text-ink-strong">{selectedPlan?.name ?? '—'}</strong>
          </div>
          <div className="flex items-baseline justify-between pt-3">
            <span className="text-h3 font-semibold text-ink-strong">{t('guestRegistration.step4.totalAmountLabel')}</span>
            <span className="font-display text-h2 font-bold tabular-nums text-primary">{format.currency(totalPrice)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" onClick={onBack} disabled={loading}>
            <ArrowLeft className="mr-1.5 size-4" /> {t('guestRegistration.step4.backToStep3')}
          </Button>
          <Button type="submit" variant="primary" loading={loading} disabled={loading || !planId} className={cn('min-w-56', PUBLIC_TOUCH)}>
            {!loading && <CreditCard className="mr-2 size-5" />}
            {loading ? t('guestRegistration.step4.submitting') : t('guestRegistration.step4.payVnPay')}
          </Button>
        </div>
      </div>
    </form>
  )
}
