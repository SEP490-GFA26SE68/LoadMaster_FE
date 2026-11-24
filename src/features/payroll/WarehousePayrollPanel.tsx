import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useT } from '@/lib/i18n'

import { nextMonthPeriod } from './payroll-api'
import { lockedPayrollMonth } from './payroll-version-row'
import type { WarehousePayrollRate } from './warehouse-payroll-api'
import {
  EMPTY_WAREHOUSE_RATE_FORM,
  warehousePayrollRateFormSchema,
  warehouseRateFormValues,
  type WarehousePayrollRateFormInput,
  type WarehousePayrollRateFormValues,
} from './warehouse-payroll-rate-form'
import { WarehousePayrollConfirmDialogs, type WarehouseConfirm } from './WarehousePayrollConfirmDialogs'
import { WarehousePayrollRateSettings } from './WarehousePayrollRateSettings'
import { WarehousePayrollResults } from './WarehousePayrollResults'
import {
  useCalculateWarehousePayrollPeriodMutation,
  useCreateWarehousePayrollRateMutation,
  useDeleteDraftWarehousePayrollPeriodMutation,
  useLockWarehousePayrollPeriodMutation,
  useUnlockWarehousePayrollPeriodMutation,
  useWarehousePayrollPeriodQuery,
  useWarehousePayrollRatesQuery,
  useWarehousePayrollStatementQuery,
} from './useWarehousePayrollQueries'

function currentMonth(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Tab "Kho" của `/bang-luong`: mức lương nhân viên kho (lương cứng, tiền mỗi kg đã xếp, KPI tuỳ chọn), tính / chốt / mở chốt / xoá bản
 * nháp theo tháng, bảng một dòng mỗi nhân viên và phiếu lương từng người kèm các chuyến đã xếp. Bố cục và luồng như tab Tài xế.
 */
export function WarehousePayrollPanel() {
  const t = useT()
  const [period, setPeriod] = useState(currentMonth)
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [confirm, setConfirm] = useState<WarehouseConfirm | null>(null)
  const rates = useWarehousePayrollRatesQuery()
  const payroll = useWarehousePayrollPeriodQuery(period)
  const lockedMonth = lockedPayrollMonth(rates.data ?? [], period, payroll.data?.status)
  const lockedBoard = useWarehousePayrollPeriodQuery(lockedMonth ?? period, lockedMonth != null)
  const board = lockedBoard.data?.status === 'LOCKED' ? lockedBoard.data : null
  const statement = useWarehousePayrollStatementQuery(board?.period ?? period, selectedWorkerId)
  const createRate = useCreateWarehousePayrollRateMutation()
  const calculate = useCalculateWarehousePayrollPeriodMutation()
  const lock = useLockWarehousePayrollPeriodMutation()
  const unlock = useUnlockWarehousePayrollPeriodMutation()
  const deleteDraft = useDeleteDraftWarehousePayrollPeriodMutation()
  const busy = calculate.isPending || lock.isPending || deleteDraft.isPending
  const hasRates = (rates.data?.length ?? 0) > 0
  const minMonth = hasRates ? nextMonthPeriod() : currentMonth()
  const rateForm = useForm<WarehousePayrollRateFormInput, unknown, WarehousePayrollRateFormValues>({
    resolver: zodResolver(warehousePayrollRateFormSchema),
    defaultValues: { effectiveFrom: minMonth, ...EMPTY_WAREHOUSE_RATE_FORM },
  })
  const { isDirty } = rateForm.formState
  const formMonth = useWatch({ control: rateForm.control, name: 'effectiveFrom' })
  const isExistingMonth = rates.data?.some((rate) => rate.effectiveFrom.startsWith(formMonth))
  const rateForPeriod = rates.data?.reduce<WarehousePayrollRate | null>((latest, rate) => {
    if (rate.effectiveFrom.slice(0, 7) > (board?.period ?? period)) return latest
    return latest === null || rate.effectiveFrom > latest.effectiveFrom ? rate : latest
  }, null)
  const hasKpi = rateForPeriod?.kpiTargetKg != null || board?.workers.some((worker) => worker.kpiAchieved) === true

  useEffect(() => {
    if (rates.data && !isDirty) rateForm.setValue('effectiveFrom', minMonth)
  }, [hasRates, minMonth])

  function saveRate(values: WarehousePayrollRateFormValues) {
    createRate.mutate(
      { ...values, effectiveFrom: `${values.effectiveFrom}-01` },
      {
        onSuccess: () => {
          toast.success(t('payroll.rateSaved'))
          rateForm.reset(warehouseRateFormValues(values.effectiveFrom, values))
        },
      },
    )
  }

  function showPeriod(next: string) {
    setPeriod(next)
    setSelectedWorkerId(null)
  }

  return (
    <>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
        <WarehousePayrollRateSettings
          form={rateForm}
          onSubmit={rateForm.handleSubmit(saveRate)}
          pending={createRate.isPending}
          error={createRate.error ? dataErrorMessage(createRate.error, t) : null}
          rates={rates.data ?? []}
          loading={rates.isPending}
          loadError={rates.isError ? dataErrorMessage(rates.error, t) : null}
          minMonth={isExistingMonth ? formMonth : minMonth}
          onSelectRate={(rate) => rateForm.reset(warehouseRateFormValues(rate.effectiveFrom, rate))}
          versionsOpen={versionsOpen}
          onVersionsOpenChange={setVersionsOpen}
          onLockVersion={(version) => setConfirm({ kind: 'lockVersion', period: version })}
          onUnlockVersion={(version) => setConfirm({ kind: 'unlockVersion', period: version })}
          versionActionPending={calculate.isPending || lock.isPending || unlock.isPending}
        />

        <section className="flex min-w-0 flex-col gap-4" aria-labelledby="warehouse-payroll-period-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="w-56">
              <Input type="month" label={t('payroll.periodLabel')} value={period} onChange={(event) => showPeriod(event.currentTarget.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                loading={calculate.isPending}
                disabled={period.length !== 7 || payroll.data?.status === 'LOCKED' || busy || createRate.isPending}
                onClick={() => calculate.mutate(period, { onSuccess: () => toast.success(t('payroll.calculated')) })}>
                {t(payroll.data ? 'payroll.recalculate' : 'payroll.calculate')}
              </Button>
              {payroll.data?.status === 'DRAFT' ? (
                <>
                  <Button variant="danger" loading={deleteDraft.isPending} disabled={busy} onClick={() => setConfirm({ kind: 'delete', period })}>
                    {t('payroll.deleteDraft')}
                  </Button>
                  <Button variant="primary" loading={lock.isPending} disabled={busy} onClick={() => setConfirm({ kind: 'lock', period })}>
                    {t('payroll.lockPeriod')}
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          {calculate.error || lock.error || unlock.error || deleteDraft.error ? (
            <p role="alert" className="text-small text-danger">{dataErrorMessage(calculate.error ?? lock.error ?? unlock.error ?? deleteDraft.error, t)}</p>
          ) : null}
          {rates.isPending || payroll.isPending || (lockedMonth != null && lockedBoard.isPending) ? (
            <div role="status" aria-label={t('payroll.loading')} className="flex justify-center py-16"><Spinner /></div>
          ) : payroll.isError || lockedBoard.isError ? (
            <EmptyState
              mascot="error"
              title={t('payroll.loadErrorTitle')}
              description={dataErrorMessage(payroll.error ?? lockedBoard.error, t)}
              action={<Button variant="secondary" onClick={() => void (lockedBoard.isError ? lockedBoard.refetch() : payroll.refetch())}>{t('payroll.retry')}</Button>}
            />
          ) : board ? (
            <WarehousePayrollResults
              period={board}
              hasKpi={hasKpi}
              statement={statement.data}
              statementLoading={statement.isPending && selectedWorkerId !== null}
              statementError={statement.error ? dataErrorMessage(statement.error, t) : null}
              selectedWorkerId={selectedWorkerId}
              onSelectWorker={setSelectedWorkerId}
            />
          ) : hasRates ? (
            <EmptyState mascot="empty" title={t('payroll.selectVersionToLockTitle')} description={t('payroll.selectVersionToLock')} />
          ) : (
            <EmptyState mascot="empty" title={t('payroll.noPeriodTitle')} description={t('payroll.warehouse.noPeriodDescription')} />
          )}
        </section>
      </div>

      <WarehousePayrollConfirmDialogs
        confirm={confirm}
        rates={rates.data ?? []}
        onClose={() => setConfirm(null)}
        onDone={(done) => {
          if (done.kind === 'delete') {
            setSelectedWorkerId(null)
            createRate.reset()
          } else if (done.kind !== 'lock') {
            showPeriod(done.period)
            setVersionsOpen(false)
          }
        }}
        mutations={{ calculate, lock, unlock, deleteDraft }}
      />
    </>
  )
}
