import { ArrowLeft, Send } from 'lucide-react'
import { Controller, type UseFormReturn } from 'react-hook-form'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { Textarea } from '@/components/ui/Textarea'
import { PUBLIC_TOUCH } from '@/features/marketing/public-chrome'
import { taxCodeInput, type TrialInfoValues } from '@/features/registration/company-info-form'
import { RegistrationField } from '@/features/registration/RegistrationField'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** Bước 1 của đăng ký dùng thử: thông tin công ty, người đại diện và gói Basic cố định. */
export function TrialInfoStep({
  form,
  loading,
  planName,
  onSubmit,
}: {
  form: UseFormReturn<TrialInfoValues>
  loading: boolean
  planName: string | undefined
  onSubmit: (values: TrialInfoValues) => void
}) {
  const t = useT()
  const { errors } = form.formState
  const inputClass = (invalid: unknown) => cn(PUBLIC_TOUCH, Boolean(invalid) && 'border-danger')

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <CardHeader>
        <CardTitle as="h2" className="text-h2">{t('trialRegistration.step1.title')}</CardTitle>
        <p className="text-small text-ink-2">{t('trialRegistration.step1.description')}</p>
      </CardHeader>

      <div className="flex flex-col gap-5 p-6 pt-0">
        <div className="grid gap-4 sm:grid-cols-2">
          <RegistrationField id="companyName" label={t('trialRegistration.step1.companyName')} required error={errors.companyName?.message} className="sm:col-span-2">
            <Input
              id="companyName"
              placeholder={t('trialRegistration.step1.companyNamePlaceholder')}
              disabled={loading}
              aria-required
              className={inputClass(errors.companyName)}
              {...form.register('companyName')}
            />
          </RegistrationField>

          <RegistrationField id="taxCode" label={t('trialRegistration.step1.taxCode')} required error={errors.taxCode?.message} hint={t('trialRegistration.step1.taxCodeHint')}>
            <Controller
              control={form.control}
              name="taxCode"
              render={({ field }) => (
                <Input
                  id="taxCode"
                  inputMode="numeric"
                  placeholder={t('trialRegistration.step1.taxCodePlaceholder')}
                  disabled={loading}
                  aria-required
                  className={inputClass(errors.taxCode)}
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(event) => field.onChange(taxCodeInput(event.target.value))}
                />
              )}
            />
          </RegistrationField>

          <div className="flex flex-col gap-1.5">
            <span className="text-small font-medium text-ink-strong">{t('trialRegistration.step1.interestedPlan')}</span>
            <div className="flex h-10 w-full items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-small">
              <span className="font-semibold text-ink-strong">{planName ?? t('trialRegistration.step1.fixedPlanName')}</span>
              <span className="rounded-full bg-primary-bg px-2.5 py-0.5 text-caption font-medium text-primary">
                {t('trialRegistration.step1.fixedPlanBadge')}
              </span>
            </div>
            <span className="text-caption text-ink-3">{t('trialRegistration.step1.fixedPlanHint')}</span>
          </div>

          <RegistrationField id="companyAddress" label={t('trialRegistration.step1.companyAddress')} className="sm:col-span-2">
            <Input
              id="companyAddress"
              placeholder={t('trialRegistration.step1.companyAddressPlaceholder')}
              disabled={loading}
              className={PUBLIC_TOUCH}
              {...form.register('companyAddress')}
            />
          </RegistrationField>

          <RegistrationField id="fullName" label={t('trialRegistration.step1.fullName')} required error={errors.fullName?.message} className="sm:col-span-2">
            <Input
              id="fullName"
              placeholder={t('trialRegistration.step1.fullNamePlaceholder')}
              disabled={loading}
              aria-required
              className={inputClass(errors.fullName)}
              {...form.register('fullName')}
            />
          </RegistrationField>

          <RegistrationField id="email" label={t('trialRegistration.step1.email')} required error={errors.email?.message} hint={t('trialRegistration.step1.emailHint')}>
            <Input
              id="email"
              type="email"
              placeholder={t('trialRegistration.step1.emailPlaceholder')}
              disabled={loading}
              aria-required
              className={inputClass(errors.email)}
              {...form.register('email')}
            />
          </RegistrationField>

          <RegistrationField id="phoneNumber" label={t('trialRegistration.step1.phoneNumber')} required error={errors.phone?.number?.message}>
            <Controller
              control={form.control}
              name="phone"
              render={({ field }) => (
                <PhoneInput
                  id="phoneNumber"
                  country={field.value.country}
                  onCountryChange={(country) => field.onChange({ ...field.value, country })}
                  value={field.value.number}
                  onChange={(number) => field.onChange({ ...field.value, number })}
                  disabled={loading}
                  invalid={Boolean(errors.phone?.number)}
                  className={PUBLIC_TOUCH}
                />
              )}
            />
          </RegistrationField>

          <RegistrationField id="note" label={t('trialRegistration.step1.note')} className="sm:col-span-2">
            <Textarea id="note" placeholder={t('trialRegistration.step1.notePlaceholder')} disabled={loading} rows={3} {...form.register('note')} />
          </RegistrationField>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button asChild variant="ghost">
            <Link to="/bang-gia">
              <ArrowLeft className="mr-1.5 size-4" /> {t('trialRegistration.step1.backToPricing')}
            </Link>
          </Button>
          <Button type="submit" variant="primary" loading={loading} disabled={loading} className={cn('min-w-44', PUBLIC_TOUCH)}>
            {!loading && <Send className="mr-1.5 size-4" />}
            {loading ? t('trialRegistration.step1.submitting') : t('trialRegistration.step1.submit')}
          </Button>
        </div>
      </div>
    </form>
  )
}
