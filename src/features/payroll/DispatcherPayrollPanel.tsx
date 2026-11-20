import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useT } from '@/lib/i18n'

import { DispatcherPayrollRateSettings } from './DispatcherPayrollRateSettings'
import { DispatcherPayrollResults } from './DispatcherPayrollResults'
import { nextMonthPeriod } from './payroll-api'
import type { DispatcherPayrollRate } from './dispatcher-payroll-api'
import {
  dispatcherPayrollRateFormSchema,
  type DispatcherPayrollRateFormInput,
  type DispatcherPayrollRateFormValues,
} from './dispatcher-payroll-rate-form'
import {
  useCalculateDispatcherPayrollPeriodMutation,
  useCreateDispatcherPayrollRateMutation,
  useDeleteDraftDispatcherPayrollPeriodMutation,
  useDispatcherPayrollPeriodQuery,
  useDispatcherPayrollRatesQuery,
  useDispatcherPayrollStatementQuery,
  useLockDispatcherPayrollPeriodMutation,
} from './useDispatcherPayrollQueries'

function currentMonth(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function DispatcherPayrollPanel() {
  const t = useT()
  const [period, setPeriod] = useState(currentMonth)
  const [selectedDispatcherId, setSelectedDispatcherId] = useState<string | null>(null)
  const [confirmLockOpen, setConfirmLockOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const rates = useDispatcherPayrollRatesQuery()
  const payroll = useDispatcherPayrollPeriodQuery(period)
  const statement = useDispatcherPayrollStatementQuery(period, selectedDispatcherId)
  const createRate = useCreateDispatcherPayrollRateMutation()
  const calculate = useCalculateDispatcherPayrollPeriodMutation()
  const lock = useLockDispatcherPayrollPeriodMutation()
  const deleteDraft = useDeleteDraftDispatcherPayrollPeriodMutation()
  const hasRates = (rates.data?.length ?? 0) > 0
  const minMonth = hasRates ? nextMonthPeriod() : currentMonth()
  const rateForm = useForm<DispatcherPayrollRateFormInput, unknown, DispatcherPayrollRateFormValues>({
    resolver: zodResolver(dispatcherPayrollRateFormSchema),
    defaultValues: { effectiveFrom: minMonth, baseSalaryVnd: '', overtimeVndPerHour: '', overtimeHoursPerDay: '' },
  })
  const { isDirty } = rateForm.formState

  const currentFormMonth = rateForm.watch('effectiveFrom')
  const isExistingMonth = rates.data?.some((rate) => rate.effectiveFrom.startsWith(currentFormMonth))
  const minMonthForInput = isExistingMonth ? currentFormMonth : minMonth

  useEffect(() => {
    if (rates.data && !isDirty) {
      rateForm.setValue('effectiveFrom', minMonth)
    }
  }, [hasRates, minMonth])

  function handleSelectRate(rate: DispatcherPayrollRate) {
    rateForm.reset({
      effectiveFrom: rate.effectiveFrom.slice(0, 7),
      baseSalaryVnd: String(rate.baseSalaryVnd),
      overtimeVndPerHour: String(rate.overtimeVndPerHour),
      overtimeHoursPerDay: String(rate.overtimeHoursPerDay),
    })
  }

  function saveRate(values: DispatcherPayrollRateFormValues) {
    createRate.mutate(
      { ...values, effectiveFrom: `${values.effectiveFrom}-01` },
      {
        onSuccess: () => {
          toast.success(t('payroll.rateSaved'))
          rateForm.reset({
            effectiveFrom: values.effectiveFrom,
            baseSalaryVnd: String(values.baseSalaryVnd),
            overtimeVndPerHour: String(values.overtimeVndPerHour),
            overtimeHoursPerDay: String(values.overtimeHoursPerDay),
          })
        },
      },
    )
  }

  return (
    <>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
        <DispatcherPayrollRateSettings
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

        <section className="flex min-w-0 flex-col gap-4" aria-labelledby="dispatcher-payroll-period-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="w-56">
              <Input
                type="month"
                label={t('payroll.periodLabel')}
                value={period}
                onChange={(event) => {
                  setPeriod(event.currentTarget.value)
                  setSelectedDispatcherId(null)
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
            <EmptyState mascot="empty" title={t('payroll.noPeriodTitle')} description={t('payroll.dispatcher.noPeriodDescription')} />
          ) : (
            <DispatcherPayrollResults
              period={payroll.data}
              statement={statement.data}
              statementLoading={statement.isPending && selectedDispatcherId !== null}
              statementError={statement.error ? dataErrorMessage(statement.error, t) : null}
              selectedDispatcherId={selectedDispatcherId}
              onSelectDispatcher={setSelectedDispatcherId}
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
              setSelectedDispatcherId(null)
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
    </>
  )
}
