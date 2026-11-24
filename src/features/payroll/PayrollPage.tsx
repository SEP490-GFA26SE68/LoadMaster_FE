import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { dataErrorMessage, useT } from '@/lib/i18n'

import { DispatcherPayrollPanel } from './DispatcherPayrollPanel'
import { nextMonthPeriod, PAYROLL_CAPABILITIES, type PayrollRate } from './payroll-api'
import { payrollRateFormSchema, type PayrollRateFormInput, type PayrollRateFormValues } from './payroll-rate-form'
import { PayrollRateSettings } from './PayrollRateSettings'
import { PayrollResults } from './PayrollResults'
import { lockedPayrollMonth } from './payroll-version-row'
import { WarehousePayrollPanel } from './WarehousePayrollPanel'
import {
  useCalculatePayrollPeriodMutation,
  useCreatePayrollRateMutation,
  useDeleteDraftPayrollPeriodMutation,
  useLockPayrollPeriodMutation,
  useUnlockPayrollPeriodMutation,
  usePayrollDriverStatementQuery,
  usePayrollPeriodQuery,
  usePayrollRatesQuery,
} from './usePayrollQueries'

function currentMonth(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function PayrollPage() {
  const t = useT()
  const [period, setPeriod] = useState(currentMonth)
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [confirmLockOpen, setConfirmLockOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [confirmVersionLock, setConfirmVersionLock] = useState<string | null>(null)
  const [confirmVersionUnlock, setConfirmVersionUnlock] = useState<string | null>(null)
  const rates = usePayrollRatesQuery()
  const payroll = usePayrollPeriodQuery(period)
  const lockedMonth = lockedPayrollMonth(rates.data ?? [], period, payroll.data?.status)
  const lockedBoard = usePayrollPeriodQuery(lockedMonth ?? period, lockedMonth != null)
  const board = lockedBoard.data?.status === 'LOCKED' ? lockedBoard.data : null
  const statement = usePayrollDriverStatementQuery(board?.period ?? period, selectedDriverId)
  const createRate = useCreatePayrollRateMutation()
  const calculate = useCalculatePayrollPeriodMutation()
  const lock = useLockPayrollPeriodMutation()
  const unlock = useUnlockPayrollPeriodMutation()
  const deleteDraft = useDeleteDraftPayrollPeriodMutation()
  const versionActionPending = calculate.isPending || lock.isPending || unlock.isPending
  const hasRates = (rates.data?.length ?? 0) > 0
  const minMonth = hasRates ? nextMonthPeriod() : currentMonth()
  const rateForm = useForm<PayrollRateFormInput, unknown, PayrollRateFormValues>({
    resolver: zodResolver(payrollRateFormSchema),
    defaultValues: { effectiveFrom: minMonth, baseSalaryVnd: '', rateVndPerKg: '', commissionPercent: '', handlingFeeVndPerKg: '', handlingDriverPercent: '', kpiTargetKg: '', kpiBonusVnd: '' },
  })
  const { isDirty } = rateForm.formState

  const currentFormMonth = useWatch({ control: rateForm.control, name: 'effectiveFrom' })
  const isExistingMonth = rates.data?.some((r) => r.effectiveFrom.startsWith(currentFormMonth))
  const minMonthForInput = isExistingMonth ? currentFormMonth : minMonth
  const rateForPeriod = rates.data?.reduce<PayrollRate | null>((latest, rate) => {
    if (rate.effectiveFrom.slice(0, 7) > (board?.period ?? period)) return latest
    return latest === null || rate.effectiveFrom > latest.effectiveFrom ? rate : latest
  }, null)
  const hasKpi = rateForPeriod?.kpiTargetKg != null || board?.drivers.some((driver) => driver.kpiAchieved) === true

  useEffect(() => {
    if (rates.data && !isDirty) {
      rateForm.setValue('effectiveFrom', minMonth)
    }
  }, [hasRates, minMonth])

  function handleSelectRate(rate: PayrollRate) {
    rateForm.reset({
      effectiveFrom: rate.effectiveFrom.slice(0, 7),
      baseSalaryVnd: String(rate.baseSalaryVnd),
      rateVndPerKg: String(rate.rateVndPerKg),
      commissionPercent: String(rate.commissionPercent),
      handlingFeeVndPerKg: String(rate.handlingFeeVndPerKg),
      handlingDriverPercent: String(rate.handlingDriverPercent),
      kpiTargetKg: rate.kpiTargetKg == null ? '' : String(rate.kpiTargetKg),
      kpiBonusVnd: rate.kpiTargetKg == null ? '' : String(rate.kpiBonusVnd),
    })
  }

  function saveRate(values: PayrollRateFormValues) {
    createRate.mutate(
      { ...values, effectiveFrom: `${values.effectiveFrom}-01` },
      {
        onSuccess: () => {
          toast.success(t('payroll.rateSaved'))
          rateForm.reset({
            effectiveFrom: values.effectiveFrom,
            baseSalaryVnd: String(values.baseSalaryVnd),
            rateVndPerKg: String(values.rateVndPerKg),
            commissionPercent: String(values.commissionPercent),
            handlingFeeVndPerKg: String(values.handlingFeeVndPerKg),
            handlingDriverPercent: String(values.handlingDriverPercent),
            kpiTargetKg: values.kpiTargetKg == null ? '' : String(values.kpiTargetKg),
            kpiBonusVnd: values.kpiBonusVnd == null ? '' : String(values.kpiBonusVnd),
          })
        },
      },
    )
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero title={t('payroll.title')} description={t('pageHero.payroll')} />
      {!PAYROLL_CAPABILITIES.server ? (
        <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto px-shell py-6">
          <EmptyState mascot="empty" title={t('payroll.unavailableTitle')} description={t('payroll.unavailableDescription')} />
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-shell py-6 max-sm:px-4">
          <Tabs defaultValue="drivers" className="flex min-w-0 flex-col gap-5">
            <TabsList aria-label={t('payroll.title')}>
              <TabsTrigger value="drivers">{t('payroll.tabs.drivers')}</TabsTrigger>
              <TabsTrigger value="dispatchers">{t('payroll.tabs.dispatchers')}</TabsTrigger>
              <TabsTrigger value="warehouse">{t('payroll.tabs.warehouse')}</TabsTrigger>
            </TabsList>
            <TabsContent value="drivers" className="flex min-w-0 flex-col gap-5">
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
            <PayrollRateSettings
              form={rateForm}
              onSubmit={rateForm.handleSubmit(saveRate)}
              pending={createRate.isPending}
              error={createRate.error ? dataErrorMessage(createRate.error, t) : null}
              rates={rates.data ?? []}
              loading={rates.isPending}
              loadError={rates.isError ? dataErrorMessage(rates.error, t) : null}
              minMonth={minMonthForInput}
              onSelectRate={handleSelectRate}
              versionsOpen={versionsOpen}
              onVersionsOpenChange={setVersionsOpen}
              onLockVersion={setConfirmVersionLock}
              onUnlockVersion={setConfirmVersionUnlock}
              versionActionPending={versionActionPending}
            />

            <section className="flex min-w-0 flex-col gap-4" aria-labelledby="payroll-period-title">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="w-56">
                  <Input
                    type="month"
                    label={t('payroll.periodLabel')}
                    value={period}
                    onChange={(event) => {
                      setPeriod(event.currentTarget.value)
                      setSelectedDriverId(null)
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    loading={calculate.isPending}
                    disabled={period.length !== 7 || payroll.data?.status === 'LOCKED' || calculate.isPending || createRate.isPending || lock.isPending || deleteDraft.isPending}
                    onClick={() => calculate.mutate(period, { onSuccess: () => toast.success(t('payroll.calculated')) })}>
                    {t(payroll.data ? 'payroll.recalculate' : 'payroll.calculate')}
                  </Button>
                  {payroll.data?.status === 'DRAFT' ? (
                    <>
                      <Button
                        variant="danger"
                        loading={deleteDraft.isPending}
                        disabled={calculate.isPending || lock.isPending || deleteDraft.isPending}
                        onClick={() => setConfirmDeleteOpen(true)}>
                        {t('payroll.deleteDraft')}
                      </Button>
                      <Button
                        variant="primary"
                        loading={lock.isPending}
                        disabled={calculate.isPending || lock.isPending || deleteDraft.isPending}
                        onClick={() => setConfirmLockOpen(true)}>
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
                <PayrollResults
                  period={board}
                  hasKpi={hasKpi}
                  statement={statement.data}
                  statementLoading={statement.isPending && selectedDriverId !== null}
                  statementError={statement.error ? dataErrorMessage(statement.error, t) : null}
                  selectedDriverId={selectedDriverId}
                  onSelectDriver={setSelectedDriverId}
                />
              ) : hasRates ? (
                <EmptyState
                  mascot="empty"
                  title={t('payroll.selectVersionToLockTitle')}
                  description={t('payroll.selectVersionToLock')}
                />
              ) : (
                <EmptyState mascot="empty" title={t('payroll.noPeriodTitle')} description={t('payroll.noPeriodDescription')} />
              )}
            </section>
          </div>

          <ConfirmDialog
            open={confirmDeleteOpen}
            onOpenChange={setConfirmDeleteOpen}
            title={t('payroll.deleteConfirmTitle', { period })}
            description={t('payroll.deleteConfirmDescription')}
            danger
            pending={deleteDraft.isPending}
            confirmLabel={t('payroll.deleteDraft')}
            cancelLabel={t('payroll.cancel')}
            onConfirm={() => {
              deleteDraft.mutate(period, {
                onSuccess: () => {
                  toast.success(t('payroll.deleted'))
                  setConfirmDeleteOpen(false)
                  setSelectedDriverId(null)
                  createRate.reset()
                },
              })
            }}
          />
          <ConfirmDialog
            open={confirmLockOpen}
            onOpenChange={setConfirmLockOpen}
            title={t('payroll.lockConfirmTitle', { period })}
            description={t('payroll.lockConfirmDescription')}
            danger
            pending={lock.isPending}
            confirmLabel={t('payroll.lockPeriod')}
            cancelLabel={t('payroll.cancel')}
            onConfirm={() => {
            lock.mutate(period, {
              onSuccess: () => {
                toast.success(t('payroll.locked'))
                setConfirmLockOpen(false)
              },
            })
          }}
        />
          <ConfirmDialog
            open={confirmVersionLock !== null}
            onOpenChange={(open) => { if (!open) setConfirmVersionLock(null) }}
            title={t('payroll.lockVersionConfirmTitle', { period: confirmVersionLock ?? '' })}
            description={t('payroll.lockVersionConfirmDescription')}
            pending={versionActionPending}
            confirmLabel={t('payroll.rate.lockVersion')}
            cancelLabel={t('payroll.cancel')}
            onConfirm={() => {
              const version = confirmVersionLock
              if (!version) return
              const rate = rates.data?.find((item) => item.effectiveFrom.startsWith(version))
              const run = rate?.periodStatus === 'DRAFT' || rate?.periodStatus === 'LOCKED'
                ? Promise.resolve()
                : calculate.mutateAsync(version)
              void run.then(() => lock.mutateAsync(version)).then(() => {
                toast.success(t('payroll.locked'))
                setPeriod(version)
                setSelectedDriverId(null)
                setConfirmVersionLock(null)
                setVersionsOpen(false)
              })
            }}
          />
          <ConfirmDialog
            open={confirmVersionUnlock !== null}
            onOpenChange={(open) => { if (!open) setConfirmVersionUnlock(null) }}
            title={t('payroll.unlockVersionConfirmTitle', { period: confirmVersionUnlock ?? '' })}
            description={t('payroll.unlockVersionConfirmDescription')}
            danger
            pending={unlock.isPending}
            confirmLabel={t('payroll.rate.unlockVersion')}
            cancelLabel={t('payroll.cancel')}
            onConfirm={() => {
              const version = confirmVersionUnlock
              if (!version) return
              unlock.mutate(version, {
                onSuccess: () => {
                  toast.success(t('payroll.unlocked'))
                  setPeriod(version)
                  setSelectedDriverId(null)
                  setConfirmVersionUnlock(null)
                  setVersionsOpen(false)
                },
              })
            }}
          />
            </TabsContent>
            <TabsContent value="dispatchers">
              <DispatcherPayrollPanel />
            </TabsContent>
            <TabsContent value="warehouse">
              <WarehousePayrollPanel />
            </TabsContent>
          </Tabs>
        </main>
      )}
    </div>
  )
}
