import type { FormEventHandler } from 'react'
import { useState } from 'react'
import { History } from 'lucide-react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { useFormat, useT } from '@/lib/i18n'

import type { DispatcherPayrollRate } from './dispatcher-payroll-api'
import { daysPerMonthIssue, hoursPerDayIssue, type DispatcherPayrollRateFormInput, type DispatcherPayrollRateFormValues } from './dispatcher-payroll-rate-form'
import { PAYROLL_VERSION_PAGE_SIZE, PayrollDialogPager, usePagedPayrollItems } from './payroll-dialog-pager'
import { PayrollVersionLockButton, PayrollVersionStatusBadge, payrollVersionMonth } from './payroll-version-row'

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
  versionsOpen?: boolean
  onVersionsOpenChange?: (open: boolean) => void
  onLockVersion?: (period: string) => void
  onUnlockVersion?: (period: string) => void
  versionActionPending?: boolean
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
  versionsOpen,
  onVersionsOpenChange,
  onLockVersion,
  onUnlockVersion,
  versionActionPending,
}: DispatcherPayrollRateSettingsProps) {
  const t = useT()
  const format = useFormat()
  const [internalVersionsOpen, setInternalVersionsOpen] = useState(false)
  const open = versionsOpen ?? internalVersionsOpen
  const setOpen = onVersionsOpenChange ?? setInternalVersionsOpen
  const { register, formState: { errors, isDirty } } = form
  const values = form.watch()
  const amountMessage = (name: 'baseSalaryVnd' | 'overtimeVndPerHour' | 'kpiAmountVnd'): string | undefined =>
    !errors[name] ? undefined : String(values[name] ?? '').trim() === '' ? t('payroll.rate.required') : t('payroll.rate.invalidAmount')
  const hoursMessage = (): string | undefined => {
    if (!errors.overtimeHoursPerDay) return undefined
    const issue = hoursPerDayIssue(String(values.overtimeHoursPerDay ?? ''))
    return issue === 'required' ? t('payroll.rate.required') : issue === 'range' ? t('payroll.dispatcher.hoursRange') : t('payroll.rate.invalidAmount')
  }
  const daysMessage = (): string | undefined => {
    if (!errors.overtimeDaysPerMonth) return undefined
    const issue = daysPerMonthIssue(String(values.overtimeDaysPerMonth ?? ''))
    return issue === 'required' ? t('payroll.rate.required') : issue === 'range' ? t('payroll.dispatcher.daysRange') : t('payroll.rate.invalidAmount')
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
          <Input label={t('payroll.dispatcher.overtimeDaysPerMonth')} type="number" min="0" max="31" step="1" inputMode="numeric" required suffix={t('payroll.dispatcher.daysUnit')} error={daysMessage()} {...register('overtimeDaysPerMonth')} />
          <Input label={t('payroll.dispatcher.kpiBonus')} type="number" min="0" step="1" inputMode="decimal" required suffix={t('payroll.vnd')} error={amountMessage('kpiAmountVnd')} {...register('kpiAmountVnd')} />
          {error ? <p role="alert" className="text-small text-danger">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={pending} disabled={!isDirty || pending}>{t('payroll.rate.save')}</Button>
            {loading ? (
              <div role="status" aria-label={t('payroll.loading')} className="flex items-center px-2"><Spinner /></div>
            ) : loadError ? (
              <p role="alert" className="self-center text-small text-danger">{loadError}</p>
            ) : rates.length === 0 ? (
              <p className="self-center text-small text-ink-2">{t('payroll.rate.noVersions')}</p>
            ) : (
              <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
                {t('payroll.rate.openVersions')}
              </Button>
            )}
          </div>
        </form>
      </CardBody>

      <Dialog open={open} onOpenChange={setOpen}>
        {open ? (
          <DispatcherRateVersionsDialog
            rates={rates}
            pending={versionActionPending}
            onSelect={(rate) => {
              onSelectRate?.(rate)
              setOpen(false)
            }}
            onLockVersion={onLockVersion}
            onUnlockVersion={onUnlockVersion}
          />
        ) : null}
      </Dialog>
    </Card>
  )
}

function DispatcherRateVersionsDialog({
  rates,
  pending,
  onSelect,
  onLockVersion,
  onUnlockVersion,
}: {
  rates: readonly DispatcherPayrollRate[]
  pending?: boolean
  onSelect: (rate: DispatcherPayrollRate) => void
  onLockVersion?: (period: string) => void
  onUnlockVersion?: (period: string) => void
}) {
  const t = useT()
  const format = useFormat()
  const page = usePagedPayrollItems(rates, PAYROLL_VERSION_PAGE_SIZE)
  return (
    <DialogContent className="w-[min(72rem,calc(100vw-2rem))]">
      <DialogHeader icon={History} title={t('payroll.rate.versions')} description={t('payroll.rate.versionsDescription')} />
      <div className="overflow-x-auto px-7 py-3">
        <table className="w-full min-w-[52rem] border-collapse text-left text-small">
          <thead>
            <tr className="border-b border-line-strong text-ink-2">
              <th className="whitespace-nowrap px-2 py-2 font-medium">{t('payroll.rate.month')}</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium">{t('payroll.rate.baseShort')}</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium">{t('payroll.dispatcher.overtimeHourUnit')}</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium">{t('payroll.rate.hoursShort')}</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium">{t('payroll.rate.daysShort')}</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium">{t('payroll.dispatcher.kpi')}</th>
              <th className="whitespace-nowrap px-2 py-2 font-medium">{t('payroll.rate.status')}</th>
              <th className="px-2 py-2"><span className="sr-only">{t('payroll.rate.editVersion')}</span></th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((rate) => {
              const period = payrollVersionMonth(rate.effectiveFrom)
              return (
                <tr key={rate.id} className="border-b border-line-soft">
                  <td className="whitespace-nowrap px-2 py-2.5 font-semibold text-ink-strong">{period}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{format.currency(rate.baseSalaryVnd)}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{format.currency(rate.overtimeVndPerHour)}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{rate.overtimeHoursPerDay}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{rate.overtimeDaysPerMonth}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{format.currency(rate.kpiAmountVnd ?? 0)}</td>
                  <td className="whitespace-nowrap px-2 py-2.5">
                    <PayrollVersionStatusBadge status={rate.periodStatus} />
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        aria-label={t('payroll.rate.editVersionOf', { period })}
                        onClick={() => onSelect(rate)}
                      >
                        {t('payroll.rate.editVersion')}
                      </Button>
                      {onLockVersion && onUnlockVersion ? (
                        <PayrollVersionLockButton
                          period={period}
                          status={rate.periodStatus}
                          pending={pending}
                          onLock={onLockVersion}
                          onUnlock={onUnlockVersion}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <PayrollDialogPager
        pageIndex={page.pageIndex}
        pageCount={page.pageCount}
        pageSize={page.pageSize}
        total={page.total}
        label={t('payroll.rate.versionsPagination')}
        onPageChange={page.setPageIndex}
      />
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">{t('payroll.close')}</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  )
}
