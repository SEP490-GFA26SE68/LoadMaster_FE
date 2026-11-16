import { zodResolver } from '@hookform/resolvers/zod'
import { useState, type FormEventHandler } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'

import { PAYROLL_CAPABILITIES, type PayrollDriverStatement, type PayrollPeriod } from './payroll-api'
import { payrollRateFormSchema, type PayrollRateFormInput, type PayrollRateFormValues } from './payroll-rate-form'
import {
  useCalculatePayrollPeriodMutation,
  useCreatePayrollRateMutation,
  useLockPayrollPeriodMutation,
  usePayrollDriverStatementQuery,
  usePayrollPeriodQuery,
  usePayrollRatesQuery,
  useSetTripPayrollDriversMutation,
  useTripPayrollDriversQuery,
} from './usePayrollQueries'

function currentMonth(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function PayrollPage() {
  const t = useT()
  const [period, setPeriod] = useState(currentMonth)
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)
  const rates = usePayrollRatesQuery()
  const payroll = usePayrollPeriodQuery(period)
  const statement = usePayrollDriverStatementQuery(period, selectedDriverId)
  const createRate = useCreatePayrollRateMutation()
  const calculate = useCalculatePayrollPeriodMutation()
  const lock = useLockPayrollPeriodMutation()
  const rateForm = useForm<PayrollRateFormInput, unknown, PayrollRateFormValues>({
    resolver: zodResolver(payrollRateFormSchema),
    defaultValues: { effectiveFrom: currentMonth(), baseSalaryVnd: '', rateVndPerKg: '', rateVndPerKm: '' },
  })

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
            rateVndPerKm: String(values.rateVndPerKm),
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
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
            <RateSettings
              form={rateForm}
              onSubmit={rateForm.handleSubmit(saveRate)}
              pending={createRate.isPending}
              error={createRate.error ? dataErrorMessage(createRate.error, t) : null}
              rates={rates.data ?? []}
              loading={rates.isPending}
              loadError={rates.isError ? dataErrorMessage(rates.error, t) : null}
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
                      disabled={period.length !== 7 || payroll.data?.status === 'LOCKED' || calculate.isPending || lock.isPending}
                    onClick={() => calculate.mutate(period, { onSuccess: () => toast.success(t('payroll.calculated')) })}>
                    {t(payroll.data ? 'payroll.recalculate' : 'payroll.calculate')}
                  </Button>
                  {payroll.data?.status === 'DRAFT' ? (
                    <Button
                      variant="primary"
                      loading={lock.isPending}
                      disabled={calculate.isPending || lock.isPending}
                      onClick={() => lock.mutate(period, { onSuccess: () => toast.success(t('payroll.locked')) })}>
                      {t('payroll.lockPeriod')}
                    </Button>
                  ) : null}
                </div>
              </div>

              {calculate.error || lock.error ? (
                <p role="alert" className="text-small text-danger">{dataErrorMessage(calculate.error ?? lock.error, t)}</p>
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
        </main>
      )}
    </div>
  )
}

function RateSettings({
  form,
  onSubmit,
  pending,
  error,
  rates,
  loading,
  loadError,
}: {
  form: ReturnType<typeof useForm<PayrollRateFormInput, unknown, PayrollRateFormValues>>
  onSubmit: FormEventHandler<HTMLFormElement>
  pending: boolean
  error: string | null
  rates: readonly { readonly id: number; readonly effectiveFrom: string; readonly baseSalaryVnd: number; readonly rateVndPerKg: number; readonly rateVndPerKm: number }[]
  loading: boolean
  loadError: string | null
}) {
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
          <Input label={t('payroll.rate.effectiveFrom')} type="month" required error={errors.effectiveFrom ? t('payroll.rate.invalidMonth') : undefined} {...register('effectiveFrom')} />
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
                <li key={rate.id} className="grid grid-cols-2 gap-2 py-2 text-small sm:grid-cols-4">
                  <span>{rate.effectiveFrom.slice(0, 7)}</span>
                  <span>{t('payroll.rate.baseShort')}: {format.currency(rate.baseSalaryVnd)}</span>
                  <span>{format.currency(rate.rateVndPerKg)} {t('payroll.rate.perKgUnit')}</span>
                  <span>{format.currency(rate.rateVndPerKm)} {t('payroll.rate.perKmUnit')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

function PayrollResults({
  period,
  statement,
  statementLoading,
  statementError,
  selectedDriverId,
  onSelectDriver,
}: {
  period: PayrollPeriod
  statement: PayrollDriverStatement | undefined
  statementLoading: boolean
  statementError: string | null
  selectedDriverId: string | null
  onSelectDriver: (driverId: string | null) => void
}) {
  const t = useT()
  const format = useFormat()
  const total = period.drivers.reduce((sum, driver) => sum + driver.totalSalaryVnd, 0)
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card>
        <CardHeader className="justify-between">
          <CardTitle as="h2" id="payroll-period-title">{t('payroll.results.title', { period: period.period })}</CardTitle>
          <span className={period.status === 'LOCKED' ? 'rounded-full bg-cyan-50 px-3 py-1 text-small font-semibold text-cyan-800' : 'rounded-full bg-amber-50 px-3 py-1 text-small font-semibold text-amber-800'}>
            {t(period.status === 'LOCKED' ? 'payroll.statusLocked' : 'payroll.statusDraft')}
          </span>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label={t('payroll.results.total')} value={format.currency(total)} />
            <Metric label={t('payroll.results.drivers')} value={format.integer(period.drivers.length)} />
          </div>
          {period.drivers.length === 0 ? <p className="text-small text-ink-2">{t('payroll.results.noDrivers')}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left text-small">
                <thead><tr className="border-b border-line-strong text-ink-2">
                  <th className="px-3 py-2">{t('payroll.results.driver')}</th>
                  <th className="px-3 py-2 text-right">{t('payroll.rate.baseShort')}</th>
                  <th className="px-3 py-2 text-right">{t('payroll.results.totalKg')}</th>
                  <th className="px-3 py-2 text-right">{t('payroll.results.totalKm')}</th>
                  <th className="px-3 py-2 text-right">{t('payroll.results.total')}</th>
                </tr></thead>
                <tbody>
                  {period.drivers.map((driver) => (
                    <tr key={driver.driverId} className="border-b border-line-soft">
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-left font-semibold text-primary underline-offset-2 hover:underline"
                          aria-pressed={selectedDriverId === String(driver.driverId)}
                          onClick={() => onSelectDriver(selectedDriverId === String(driver.driverId) ? null : String(driver.driverId))}>
                          {driver.driverName}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right">{format.currency(driver.baseSalaryVnd)}</td>
                      <td className="px-3 py-2 text-right">{format.weight(driver.totalKg)}</td>
                      <td className="px-3 py-2 text-right">{format.ratio(driver.totalKm)} {t('payroll.rate.perKmUnit')}</td>
                      <td className="px-3 py-2 text-right font-semibold">{format.currency(driver.totalSalaryVnd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {selectedDriverId === null ? null : statementLoading ? (
        <div role="status" aria-label={t('payroll.loading')} className="flex justify-center py-8"><Spinner /></div>
      ) : statementError ? (
        <p role="alert" className="text-small text-danger">{statementError}</p>
      ) : statement?.calculated ? (
        <Card>
          <CardHeader><CardTitle as="h2">{t('payroll.statement.title', { name: statement.driverName })}</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Metric label={t('payroll.statement.baseSalary')} value={format.currency(statement.baseSalaryVnd)} />
              <Metric label={t('payroll.statement.kgRate')} value={`${format.currency(statement.rateVndPerKg)} ${t('payroll.rate.perKgUnit')}`} />
              <Metric label={t('payroll.statement.kgAmount')} value={format.currency(statement.kgAmountVnd)} />
              <Metric label={t('payroll.statement.kmRate')} value={`${format.currency(statement.rateVndPerKm)} ${t('payroll.rate.perKmUnit')}`} />
              <Metric label={t('payroll.statement.kmAmount')} value={format.currency(statement.kmAmountVnd)} />
              <Metric label={t('payroll.statement.totalSalary')} value={format.currency(statement.totalSalaryVnd)} />
            </div>
            {statement.trips.map((trip) => (
              <TripPayrollAssignment key={trip.tripId} trip={trip} drivers={period.drivers} locked={period.status === 'LOCKED'} />
            ))}
            {statement.trips.length === 0 ? <p className="text-small text-ink-2">{t('payroll.statement.noTrips')}</p> : null}
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}

function TripPayrollAssignment({
  trip,
  drivers,
  locked,
}: {
  trip: PayrollDriverStatement['trips'][number]
  drivers: PayrollPeriod['drivers']
  locked: boolean
}) {
  const t = useT()
  const format = useFormat()
  const query = useTripPayrollDriversQuery(trip.tripId)
  const update = useSetTripPayrollDriversMutation()
  const [selected, setSelected] = useState<number[] | null>(null)
  const [saved, setSaved] = useState(false)

  const currentIds = (query.data ?? []).map((driver) => driver.driverId).sort((a, b) => a - b)
  const selectedIds = selected ?? currentIds
  const sortedSelectedIds = [...selectedIds].sort((a, b) => a - b)
  const unchanged = currentIds.length === sortedSelectedIds.length && currentIds.every((id, index) => id === sortedSelectedIds[index])

  function toggle(driverId: number, checked: boolean) {
    setSaved(false)
    setSelected((current) => {
      const currentSelection = current ?? query.data?.map((driver) => driver.driverId) ?? []
      return checked ? [...new Set([...currentSelection, driverId])] : currentSelection.filter((id) => id !== driverId)
    })
  }

  return (
    <section className="rounded-md border border-line-soft p-4" aria-label={t('payroll.statement.trip', { code: trip.tripCode })}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{trip.tripCode}</h3>
        <span className="text-small text-ink-2">
          {query.isPending ? t('payroll.loading') : (query.data ?? []).map((driver) => `${driver.driverName} · ${format.percent(driver.sharePercent)}`).join(' / ')}
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric label={t('payroll.statement.planKg')} value={t('payroll.statement.kgValue', { value: format.weight(trip.planKg) })} />
        <Metric label={t('payroll.statement.allocatedKg')} value={t('payroll.statement.kgValue', { value: format.weight(trip.allocatedKg) })} />
        <Metric label={t('payroll.statement.kgAmount')} value={format.currency(trip.kgAmountVnd)} />
        <Metric label={t('payroll.statement.planKm')} value={t('payroll.statement.kmValue', { value: format.ratio(trip.planKm) })} />
        <Metric label={t('payroll.statement.allocatedKm')} value={t('payroll.statement.kmValue', { value: format.ratio(trip.allocatedKm) })} />
        <Metric label={t('payroll.statement.kmAmount')} value={format.currency(trip.kmAmountVnd)} />
        <Metric label={t('payroll.statement.tripTotal')} value={format.currency(trip.totalAmountVnd)} />
      </div>
      {query.isError ? <p role="alert" className="mt-2 text-small text-danger">{dataErrorMessage(query.error, t)}</p> : null}
      {query.data ? (
        <fieldset disabled={locked || update.isPending} className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          <legend className="mb-2 text-small text-ink-2">{t('payroll.statement.assignDrivers')}</legend>
          {drivers.map((driver) => (
            <label key={driver.driverId} className="inline-flex items-center gap-2 text-small">
              <input type="checkbox" checked={selectedIds.includes(driver.driverId)} onChange={(event) => toggle(driver.driverId, event.currentTarget.checked)} />
              {driver.driverName}
            </label>
          ))}
          <Button
            variant="secondary"
            size="sm"
            disabled={locked || selectedIds.length === 0 || update.isPending || unchanged}
            loading={update.isPending}
            onClick={() => update.mutate({ tripId: trip.tripId, driverIds: selectedIds }, {
              onSuccess: (shares) => {
                setSelected(shares.map((driver) => driver.driverId))
                setSaved(true)
              },
            })}>
            {t('payroll.statement.saveDrivers')}
          </Button>
        </fieldset>
      ) : null}
      {saved ? <p className="mt-2 text-small text-cyan-800">{t('payroll.statement.recalculateAfterChange')}</p> : null}
      {update.error ? <p role="alert" className="mt-2 text-small text-danger">{dataErrorMessage(update.error, t)}</p> : null}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-2 p-3">
      <p className="text-small text-ink-2">{label}</p>
      <p className="mt-1 font-display text-h3 font-bold text-ink-strong">{value}</p>
    </div>
  )
}
