import { ArrowLeft, Send } from 'lucide-react'
import { Controller, type UseFormReturn } from 'react-hook-form'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { PUBLIC_TOUCH } from '@/features/marketing/public-chrome'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { taxCodeInput, type GuestInfoValues } from './company-info-form'
import { RegistrationField } from './RegistrationField'

/** Bước 1 của đăng ký trả phí: thông tin công ty (kèm mã công ty viết hoa) và người đại diện. */
export function GuestInfoStep({
  form,
  loading,
  onSubmit,
}: {
  form: UseFormReturn<GuestInfoValues>
  loading: boolean
  onSubmit: (values: GuestInfoValues) => void
}) {
  const t = useT()
  const { errors } = form.formState
  const inputClass = (invalid: unknown) => cn(PUBLIC_TOUCH, Boolean(invalid) && 'border-danger')

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <CardHeader>
        <CardTitle as="h2" className="text-h2">{t('guestRegistration.step1.title')}</CardTitle>
        <p className="text-small text-ink-2">{t('guestRegistration.step1.description')}</p>
      </CardHeader>

      <div className="flex flex-col gap-5 p-6 pt-0">
        <div className="grid gap-4 sm:grid-cols-2">
          <RegistrationField id="companyName" label={t('guestRegistration.step1.companyName')} required error={errors.companyName?.message} className="sm:col-span-2">
            <Input
              id="companyName"
              placeholder={t('guestRegistration.step1.companyNamePlaceholder')}
              aria-required
              className={inputClass(errors.companyName)}
              {...form.register('companyName')}
            />
          </RegistrationField>

          <RegistrationField id="companyCode" label={t('guestRegistration.step1.companyCode')} required error={errors.companyCode?.message} hint={t('guestRegistration.step1.companyCodeHint')}>
            <Controller
              control={form.control}
              name="companyCode"
              render={({ field }) => (
                <Input
                  id="companyCode"
                  placeholder={t('guestRegistration.step1.companyCodePlaceholder')}
                  aria-required
                  className={cn(inputClass(errors.companyCode), 'font-mono uppercase')}
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                />
              )}
            />
          </RegistrationField>

          <RegistrationField id="taxCode" label={t('guestRegistration.step1.taxCode')} required error={errors.taxCode?.message} hint={t('guestRegistration.step1.taxCodeHint')}>
            <Controller
              control={form.control}
              name="taxCode"
              render={({ field }) => (
                <Input
                  id="taxCode"
                  inputMode="numeric"
                  placeholder={t('guestRegistration.step1.taxCodePlaceholder')}
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

          <RegistrationField id="companyAddress" label={t('guestRegistration.step1.companyAddress')} className="sm:col-span-2">
            <Input
              id="companyAddress"
              placeholder={t('guestRegistration.step1.companyAddressPlaceholder')}
              className={PUBLIC_TOUCH}
              {...form.register('companyAddress')}
            />
          </RegistrationField>

          <RegistrationField id="fullName" label={t('guestRegistration.step1.fullName')} required error={errors.fullName?.message} className="sm:col-span-2">
            <Input
              id="fullName"
              placeholder={t('guestRegistration.step1.fullNamePlaceholder')}
              aria-required
              className={inputClass(errors.fullName)}
              {...form.register('fullName')}
            />
          </RegistrationField>

          <RegistrationField id="email" label={t('guestRegistration.step1.email')} required error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              placeholder={t('guestRegistration.step1.emailPlaceholder')}
              aria-required
              className={inputClass(errors.email)}
              {...form.register('email')}
            />
          </RegistrationField>

          <RegistrationField id="phoneNumber" label={t('guestRegistration.step1.phoneNumber')} required error={errors.phone?.number?.message}>
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
                  invalid={Boolean(errors.phone?.number)}
                  className={PUBLIC_TOUCH}
                />
              )}
            />
          </RegistrationField>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button asChild variant="ghost">
            <Link to="/bang-gia">
              <ArrowLeft className="mr-1.5 size-4" /> {t('guestRegistration.step1.backToPricing')}
            </Link>
          </Button>
          <Button type="submit" variant="primary" loading={loading} disabled={loading} className={cn('min-w-44', PUBLIC_TOUCH)}>
            {!loading && <Send className="mr-1.5 size-4" />}
            {loading ? t('guestRegistration.step1.submitting') : t('guestRegistration.step1.submit')}
          </Button>
        </div>
      </div>
    </form>
  )
}
