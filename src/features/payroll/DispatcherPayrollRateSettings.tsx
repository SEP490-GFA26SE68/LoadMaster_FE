import type { FormEventHandler } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { useFormat, useT } from '@/lib/i18n'

import type { DispatcherPayrollRate } from './dispatcher-payroll-api'
import { hoursPerDayIssue, type DispatcherPayrollRateFormInput, type DispatcherPayrollRateFormValues } from './dispatcher-payroll-rate-form'

type DispatcherPayrollRateForm = ReturnType<typeof useForm<DispatcherPayrollRateFormInput, unknown, DispatcherPayrollRateFormValues>>

type DispatcherPayrollRateSettingsProps = {
  form: DispatcherPayrollRateForm
  onSubmit: FormEventHandler<HTMLFormElement>
  pending: boolean
  error: string | null
  rates: readonly DispatcherPayrollRate[]
  loading: boolean
  loadError: string | null
  minMonth?: string
  onSelectRate?: (rate: DispatcherPayrollRate) => void
}

export function DispatcherPayrollRateSettings({
  form,
  onSubmit,
  pending,
  error,
  rates,
  loading,
  loadError,
  minMonth,
  onSelectRate,
}: DispatcherPayrollRateSettingsProps) {
  const t = useT()
  const format = useFormat()
  const { register, formState: { errors, isDirty } } = form
  const values = form.watch()
  const amountMessage = (name: 'baseSalaryVnd' | 'overtimeVndPerHour'): string | undefined =>
    !errors[name] ? undefined : String(values[name] ?? '').trim() === '' ? t('payroll.rate.required') : t('payroll.rate.invalidAmount')
  const hoursMessage = (): string | undefined => {
    if (!errors.overtimeHoursPerDay) return undefined
    const issue = hoursPerDayIssue(String(values.overtimeHoursPerDay ?? ''))
    return issue === 'required' ? t('payroll.rate.required') : issue === 'range' ? t('payroll.dispatcher.hoursRange') : t('payroll.rate.invalidAmount')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t('payroll.dispatcher.rateTitle')}</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-5">
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <Input label={t('payroll.rate.effectiveFrom')} type="month" min={minMonth} required error={errors.effectiveFrom ? t('payroll.rate.invalidMonth') : undefined} {...register('effectiveFrom')} />
          <Input label={t('payroll.dispatcher.baseSalary')} type="number" min="0" step="1" inputMode="decimal" required suffix={t('payroll.vnd')} error={amountMessage('baseSalaryVnd')} {...register('baseSalaryVnd')} />
          <Input label={t('payroll.dispatcher.overtimeHour')} type="number" min="0" step="0.01" inputMode="decimal" required suffix={t('payroll.dispatcher.overtimeHourUnit')} error={amountMessage('overtimeVndPerHour')} {...register('overtimeVndPerHour')} />
          <Input label={t('payroll.dispatcher.overtimeHoursPerDay')} type="number" min="0" max="24" step="0.01" inputMode="decimal" required suffix={t('payroll.dispatcher.hoursUnit')} error={hoursMessage()} {...register('overtimeHoursPerDay')} />
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
                    <span>{format.currency(rate.overtimeVndPerHour)} {t('payroll.dispatcher.overtimeHourUnit')}</span>
                    <span>{rate.overtimeHoursPerDay} {t('payroll.dispatcher.hoursUnit')}</span>
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
