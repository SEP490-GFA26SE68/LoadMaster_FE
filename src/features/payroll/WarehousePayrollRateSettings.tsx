import type { FormEventHandler } from 'react'
import { History } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'

import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { useFormat, useT } from '@/lib/i18n'

import { PAYROLL_VERSION_PAGE_SIZE, PayrollDialogPager, usePagedPayrollItems } from './payroll-dialog-pager'
import { kpiBonusIssue, kpiTargetIssue } from './payroll-rate-form'
import { PayrollVersionLockButton, PayrollVersionStatusBadge, payrollVersionMonth } from './payroll-version-row'
import type { WarehousePayrollRate } from './warehouse-payroll-api'
import type { WarehousePayrollRateFormInput, WarehousePayrollRateFormValues } from './warehouse-payroll-rate-form'

type WarehousePayrollRateForm = ReturnType<typeof useForm<WarehousePayrollRateFormInput, unknown, WarehousePayrollRateFormValues>>

type VersionActions = {
  readonly onSelectRate: (rate: WarehousePayrollRate) => void
  readonly onLockVersion: (period: string) => void
  readonly onUnlockVersion: (period: string) => void
  readonly versionActionPending: boolean
}

type WarehousePayrollRateSettingsProps = VersionActions & {
  form: WarehousePayrollRateForm
  onSubmit: FormEventHandler<HTMLFormElement>
  pending: boolean
  error: string | null
  rates: readonly WarehousePayrollRate[]
  loading: boolean
  loadError: string | null
  minMonth: string
  versionsOpen: boolean
  onVersionsOpenChange: (open: boolean) => void
}

/** Form mức lương kho (lương cứng, tiền mỗi kg đã xếp, KPI tuỳ chọn) và hộp các phiên bản đã lưu — cùng bố cục với tab Tài xế. */
export function WarehousePayrollRateSettings({
  form, onSubmit, pending, error, rates, loading, loadError, minMonth, versionsOpen, onVersionsOpenChange, ...actions
}: WarehousePayrollRateSettingsProps) {
  const t = useT()
  const { register, formState: { errors, isDirty } } = form
  const values = useWatch({ control: form.control })
  const amountMessage = (name: 'baseSalaryVnd' | 'rateVndPerKg'): string | undefined =>
    !errors[name] ? undefined : String(values[name] ?? '').trim() === '' ? t('payroll.rate.required') : t('payroll.rate.invalidAmount')
  const kpiTargetValue = String(values.kpiTargetKg ?? '')
  const targetIssue = kpiTargetIssue(kpiTargetValue)
  const showKpiBonus = kpiTargetValue.trim() !== '' && targetIssue === null
  const bonusIssue = kpiBonusIssue(String(values.kpiBonusVnd ?? ''))
  const kpiTargetMessage = errors.kpiTargetKg
    ? t(targetIssue === 'decimals' ? 'payroll.rate.kpiTargetDecimals' : 'payroll.rate.kpiTargetPositive')
    : undefined
  const kpiBonusMessage = errors.kpiBonusVnd
    ? t(bonusIssue === 'required' ? 'payroll.rate.kpiBonusRequired' : bonusIssue === 'decimals' ? 'payroll.rate.kpiBonusDecimals' : 'payroll.rate.kpiBonusPositive')
    : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t('payroll.warehouse.rateTitle')}</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-5">
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <Input label={t('payroll.rate.effectiveFrom')} type="month" min={minMonth} required error={errors.effectiveFrom ? t('payroll.rate.invalidMonth') : undefined} {...register('effectiveFrom')} />
          <Input label={t('payroll.warehouse.baseSalary')} type="number" min="0" step="1" inputMode="decimal" required suffix={t('payroll.vnd')} error={amountMessage('baseSalaryVnd')} {...register('baseSalaryVnd')} />
          <Input label={t('payroll.warehouse.perKg')} type="number" min="0" step="0.01" inputMode="decimal" required suffix={t('payroll.rate.perKgUnit')} error={amountMessage('rateVndPerKg')} {...register('rateVndPerKg')} />
          <Input label={t('payroll.warehouse.kpiTarget')} type="number" min="0" step="0.01" inputMode="decimal" hint={t('payroll.warehouse.kpiHelp')} error={kpiTargetMessage} {...register('kpiTargetKg')} />
          {showKpiBonus ? (
            <Input label={t('payroll.rate.kpiBonus')} type="number" min="0" step="0.01" inputMode="decimal" required suffix={t('payroll.vnd')} error={kpiBonusMessage} {...register('kpiBonusVnd')} />
          ) : null}
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
              <Button type="button" variant="secondary" onClick={() => onVersionsOpenChange(true)}>{t('payroll.rate.openVersions')}</Button>
            )}
          </div>
        </form>
      </CardBody>

      <Dialog open={versionsOpen} onOpenChange={onVersionsOpenChange}>
        {versionsOpen ? (
          <WarehouseRateVersionsDialog
            rates={rates}
            {...actions}
            onSelectRate={(rate) => {
              actions.onSelectRate(rate)
              onVersionsOpenChange(false)
            }}
          />
        ) : null}
      </Dialog>
    </Card>
  )
}

function WarehouseRateVersionsDialog({ rates, onSelectRate, onLockVersion, onUnlockVersion, versionActionPending }: VersionActions & {
  rates: readonly WarehousePayrollRate[]
}) {
  const t = useT()
  const format = useFormat()
  const page = usePagedPayrollItems(rates, PAYROLL_VERSION_PAGE_SIZE)
  const head = 'whitespace-nowrap px-2 py-2 font-medium'
  const cell = 'whitespace-nowrap px-2 py-2.5'
  return (
    <DialogContent className="w-[min(62rem,calc(100vw-2rem))]">
      <DialogHeader icon={History} title={t('payroll.rate.versions')} description={t('payroll.rate.versionsDescription')} />
      <div className="overflow-x-auto px-7 py-3">
        <table className="w-full min-w-[44rem] border-collapse text-left text-small">
          <thead>
            <tr className="border-b border-line-strong text-ink-2">
              <th className={head}>{t('payroll.rate.month')}</th>
              <th className={`${head} text-right`}>{t('payroll.rate.baseShort')}</th>
              <th className={`${head} text-right`}>{t('payroll.warehouse.perKgShort')}</th>
              <th className={`${head} text-right`}>{t('payroll.rate.kpiTargetShort')}</th>
              <th className={`${head} text-right`}>{t('payroll.rate.kpiBonusShort')}</th>
              <th className={head}>{t('payroll.rate.status')}</th>
              <th className="px-2 py-2"><span className="sr-only">{t('payroll.rate.editVersion')}</span></th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((rate) => {
              const period = payrollVersionMonth(rate.effectiveFrom)
              const usesKpi = rate.kpiTargetKg != null
              return (
                <tr key={rate.id} className="border-b border-line-soft">
                  <td className={`${cell} font-semibold text-ink-strong`}>{period}</td>
                  <td className={`${cell} text-right tabular-nums`}>{format.currency(rate.baseSalaryVnd)}</td>
                  <td className={`${cell} text-right tabular-nums`}>{format.currency(rate.rateVndPerKg)}</td>
                  <td className={`${cell} text-right tabular-nums`}>{usesKpi ? format.weight(rate.kpiTargetKg ?? 0) : '—'}</td>
                  <td className={`${cell} text-right tabular-nums`}>{usesKpi ? format.currency(rate.kpiBonusVnd) : '—'}</td>
                  <td className={cell}><PayrollVersionStatusBadge status={rate.periodStatus} /></td>
                  <td className={cell}>
                    <div className="flex items-center justify-end gap-2">
                      <Button type="button" variant="secondary" size="sm" aria-label={t('payroll.rate.editVersionOf', { period })} onClick={() => onSelectRate(rate)}>
                        {t('payroll.rate.editVersion')}
                      </Button>
                      <PayrollVersionLockButton period={period} status={rate.periodStatus} pending={versionActionPending} onLock={onLockVersion} onUnlock={onUnlockVersion} />
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
