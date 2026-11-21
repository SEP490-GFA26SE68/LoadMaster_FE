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

import type { PayrollRate } from './payroll-api'
import { percentIssue, type PayrollRateFormInput, type PayrollRateFormValues } from './payroll-rate-form'
import { PAYROLL_VERSION_PAGE_SIZE, PayrollDialogPager, usePagedPayrollItems } from './payroll-dialog-pager'
import { PayrollVersionLockButton, PayrollVersionStatusBadge, payrollVersionMonth } from './payroll-version-row'

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
  versionsOpen?: boolean
  onVersionsOpenChange?: (open: boolean) => void
  onLockVersion?: (period: string) => void
  onUnlockVersion?: (period: string) => void
  versionActionPending?: boolean
}

export function PayrollRateSettings({
  form, onSubmit, pending, error, rates, loading, loadError, minMonth, onSelectRate,
  versionsOpen, onVersionsOpenChange, onLockVersion, onUnlockVersion, versionActionPending,
}: PayrollRateSettingsProps) {
  const t = useT()
  const format = useFormat()
  const [internalVersionsOpen, setInternalVersionsOpen] = useState(false)
  const open = versionsOpen ?? internalVersionsOpen
  const setOpen = onVersionsOpenChange ?? setInternalVersionsOpen
  const { register, formState: { errors, isDirty } } = form
  const values = form.watch()
  const amountMessage = (name: 'baseSalaryVnd' | 'rateVndPerKg' | 'handlingFeeVndPerKg'): string | undefined =>
    !errors[name] ? undefined : String(values[name] ?? '').trim() === '' ? t('payroll.rate.required') : t('payroll.rate.invalidAmount')
  const percentMessage = (name: 'commissionPercent' | 'handlingDriverPercent'): string | undefined => {
    if (!errors[name]) return undefined
    const issue = percentIssue(String(values[name] ?? ''))
    return issue === 'required' ? t('payroll.rate.required') : issue === 'range' ? t('payroll.rate.percentRange') : t('payroll.rate.percentDecimals')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t('payroll.rate.title')}</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-5">
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <Input label={t('payroll.rate.effectiveFrom')} type="month" min={minMonth} required error={errors.effectiveFrom ? t('payroll.rate.invalidMonth') : undefined} {...register('effectiveFrom')} />
          <Input label={t('payroll.rate.baseSalary')} type="number" min="0" step="1" inputMode="decimal" required suffix={t('payroll.vnd')} error={amountMessage('baseSalaryVnd')} {...register('baseSalaryVnd')} />
          <Input label={t('payroll.rate.perKg')} type="number" min="0" step="0.01" inputMode="decimal" required suffix={t('payroll.rate.perKgUnit')} error={amountMessage('rateVndPerKg')} {...register('rateVndPerKg')} />
          <Input label={t('payroll.rate.commissionPercent')} type="number" min="0" max="100" step="0.01" inputMode="decimal" required suffix="%" error={percentMessage('commissionPercent')} {...register('commissionPercent')} />
          <Input label={t('payroll.rate.handlingFee')} type="number" min="0" step="0.01" inputMode="decimal" required suffix={t('payroll.rate.perKgUnit')} error={amountMessage('handlingFeeVndPerKg')} {...register('handlingFeeVndPerKg')} />
          <Input label={t('payroll.rate.handlingDriverPercent')} type="number" min="0" max="100" step="0.01" inputMode="decimal" required suffix="%" error={percentMessage('handlingDriverPercent')} {...register('handlingDriverPercent')} />
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
          <DriverRateVersionsDialog
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

function DriverRateVersionsDialog({
  rates,
  pending,
  onSelect,
  onLockVersion,
  onUnlockVersion,
}: {
  rates: readonly PayrollRate[]
  pending?: boolean
  onSelect: (rate: PayrollRate) => void
  onLockVersion?: (period: string) => void
  onUnlockVersion?: (period: string) => void
}) {
  const t = useT()
  const format = useFormat()
  const page = usePagedPayrollItems(rates, PAYROLL_VERSION_PAGE_SIZE)
  return (
    <DialogContent className="w-[min(48rem,calc(100vw-3rem))]">
      <DialogHeader icon={History} title={t('payroll.rate.versions')} description={t('payroll.rate.versionsDescription')} />
      <ul className="m-0 flex list-none flex-col divide-y divide-line-soft px-7 py-3">
        {page.items.map((rate) => {
          const period = payrollVersionMonth(rate.effectiveFrom)
          return (
            <li key={rate.id} className="flex items-center gap-2 py-1">
              <button
                type="button"
                onClick={() => onSelect(rate)}
                aria-label={t('payroll.rate.selectVersion', { period })}
                className="grid min-w-0 flex-1 grid-cols-2 gap-2 rounded-md p-2 text-left text-small transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:grid-cols-4"
                title={t('payroll.rate.clickToEdit')}
              >
                <span className="font-semibold text-ink-strong">{period}</span>
                <span>{t('payroll.rate.baseShort')}: {format.currency(rate.baseSalaryVnd)}</span>
                <span>{format.currency(rate.rateVndPerKg)} {t('payroll.rate.perKgUnit')}</span>
                <span>{t('payroll.rate.commissionShort')}: {rate.commissionPercent}%</span>
              </button>
              <PayrollVersionStatusBadge status={rate.periodStatus} />
              {onLockVersion && onUnlockVersion ? (
                <PayrollVersionLockButton
                  period={period}
                  status={rate.periodStatus}
                  pending={pending}
                  onLock={onLockVersion}
                  onUnlock={onUnlockVersion}
                />
              ) : null}
            </li>
          )
        })}
      </ul>
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
