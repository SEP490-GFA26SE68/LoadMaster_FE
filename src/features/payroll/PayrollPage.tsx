import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
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
import {
  useCalculatePayrollPeriodMutation,
  useCreatePayrollRateMutation,
  useDeleteDraftPayrollPeriodMutation,
  useLockPayrollPeriodMutation,
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
  const [confirmLockOpen, setConfirmLockOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const rates = usePayrollRatesQuery()
  const payroll = usePayrollPeriodQuery(period)
  const statement = usePayrollDriverStatementQuery(period, selectedDriverId)
  const createRate = useCreatePayrollRateMutation()
  const calculate = useCalculatePayrollPeriodMutation()
  const lock = useLockPayrollPeriodMutation()
  const deleteDraft = useDeleteDraftPayrollPeriodMutation()
  const hasRates = (rates.data?.length ?? 0) > 0
  const minMonth = hasRates ? nextMonthPeriod() : currentMonth()
  const rateForm = useForm<PayrollRateFormInput, unknown, PayrollRateFormValues>({
    resolver: zodResolver(payrollRateFormSchema),
    defaultValues: { effectiveFrom: minMonth, baseSalaryVnd: '', rateVndPerKg: '', commissionPercent: '', handlingFeeVndPerKg: '', handlingDriverPercent: '' },
  })
  const { isDirty } = rateForm.formState

  const currentFormMonth = rateForm.watch('effectiveFrom')
  const isExistingMonth = rates.data?.some((r) => r.effectiveFrom.startsWith(currentFormMonth))
  const minMonthForInput = isExistingMonth ? currentFormMonth : minMonth

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

              {calculate.error || lock.error || deleteDraft.error ? (
                <p role="alert" className="text-small text-danger">{dataErrorMessage(calculate.error ?? lock.error ?? deleteDraft.error, t)}</p>
              ) : null}
              {payroll.isPending ? (
                <div role="status" aria-label={t('payroll.loading')} className="flex justify-center py-16"><Spinner /></div>
              ) : payroll.isError ? (
                <EmptyState
                  mascot="error"
                  title={t('payroll.loadErrorTitle')}
                  description={dataErrorMessage(payroll.error, t)}
                  action={<Button variant="secondary" onClick={() => void payroll.refetch()}>{t('payroll.retry')}</Button>}
                />
              ) : payroll.data === null ? (
                <EmptyState mascot="empty" title={t('payroll.noPeriodTitle')} description={t('payroll.noPeriodDescription')} />
              ) : (
                <PayrollResults
                  period={payroll.data}
                  statement={statement.data}
                  statementLoading={statement.isPending && selectedDriverId !== null}
                  statementError={statement.error ? dataErrorMessage(statement.error, t) : null}
                  selectedDriverId={selectedDriverId}
                  onSelectDriver={setSelectedDriverId}
                />
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
            </TabsContent>
            <TabsContent value="dispatchers">
              <DispatcherPayrollPanel />
            </TabsContent>
          </Tabs>
        </main>
      )}
    </div>
  )
}
