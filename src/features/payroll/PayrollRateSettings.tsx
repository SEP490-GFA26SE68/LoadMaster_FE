import type { FormEventHandler } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { useFormat, useT } from '@/lib/i18n'

import type { PayrollRate } from './payroll-api'
import type { PayrollRateFormInput, PayrollRateFormValues } from './payroll-rate-form'

type PayrollRateForm = ReturnType<typeof useForm<PayrollRateFormInput, unknown, PayrollRateFormValues>>

type PayrollRateSettingsProps = {
  form: PayrollRateForm
  onSubmit: FormEventHandler<HTMLFormElement>
  pending: boolean
  error: string | null
  rates: readonly PayrollRate[]
  loading: boolean
  loadError: string | null
  minMonth?: string
  onSelectRate?: (rate: PayrollRate) => void
}

export function PayrollRateSettings({ form, onSubmit, pending, error, rates, loading, loadError, minMonth, onSelectRate }: PayrollRateSettingsProps) {
  const t = useT()
  const format = useFormat()
  const { register, formState: { errors, isDirty } } = form
  const amountError = t('payroll.rate.invalidAmount')

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t('payroll.rate.title')}</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-5">
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <Input label={t('payroll.rate.effectiveFrom')} type="month" min={minMonth} required error={errors.effectiveFrom ? t('payroll.rate.invalidMonth') : undefined} {...register('effectiveFrom')} />
          <Input label={t('payroll.rate.baseSalary')} type="number" min="0" step="1" inputMode="decimal" required suffix={t('payroll.vnd')} error={errors.baseSalaryVnd ? amountError : undefined} {...register('baseSalaryVnd')} />
          <Input label={t('payroll.rate.perKg')} type="number" min="0" step="0.01" inputMode="decimal" required suffix={t('payroll.rate.perKgUnit')} error={errors.rateVndPerKg ? amountError : undefined} {...register('rateVndPerKg')} />
          <Input label={t('payroll.rate.perKm')} type="number" min="0" step="0.01" inputMode="decimal" required suffix={t('payroll.rate.perKmUnit')} error={errors.rateVndPerKm ? amountError : undefined} {...register('rateVndPerKm')} />
          {error ? <p role="alert" className="text-small text-danger">{error}</p> : null}
          <Button type="submit" loading={pending} disabled={!isDirty || pending}>{t('payroll.rate.save')}</Button>
        </form>

        <div className="border-t border-line-soft pt-4">
          <h3 className="mb-3 text-label font-semibold">{t('payroll.rate.versions')}</h3>
          {loading ? (
            <div role="status" aria-label={t('payroll.loading')} className="flex justify-center py-5"><Spinner /></div>
          ) : loadError ? (
            <p role="alert" className="text-small text-danger">{loadError}</p>
          ) : rates.length === 0 ? (
            <p className="text-small text-ink-2">{t('payroll.rate.noVersions')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line-soft">
              {rates.map((rate) => (
                <li key={rate.id} className="py-1">
                  <button
                    type="button"
                    onClick={() => onSelectRate?.(rate)}
                    className="grid w-full grid-cols-2 gap-2 rounded-md p-2 text-left text-small transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:grid-cols-4"
                    title={t('payroll.rate.clickToEdit')}
                  >
                    <span className="font-semibold text-ink-strong">{rate.effectiveFrom.slice(0, 7)}</span>
                    <span>{t('payroll.rate.baseShort')}: {format.currency(rate.baseSalaryVnd)}</span>
                    <span>{format.currency(rate.rateVndPerKg)} {t('payroll.rate.perKgUnit')}</span>
                    <span>{format.currency(rate.rateVndPerKm)} {t('payroll.rate.perKmUnit')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
