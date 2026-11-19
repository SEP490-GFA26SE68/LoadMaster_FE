import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'

import { nextMonthPeriod, type PayrollDriverStatement, type PayrollPeriod } from './payroll-api'
import { useSetDriverBaseSalaryMutation, useSetTripPayrollDriversMutation, useTripPayrollDriversQuery } from './usePayrollQueries'

type PayrollResultsProps = {
  period: PayrollPeriod
  statement: PayrollDriverStatement | undefined
  statementLoading: boolean
  statementError: string | null
  selectedDriverId: string | null
  onSelectDriver: (driverId: string | null) => void
}

export function PayrollResults({ period, statement, statementLoading, statementError, selectedDriverId, onSelectDriver }: PayrollResultsProps) {
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
                  <th className="px-3 py-2 text-right">{t('payroll.results.handling')}</th>
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
                      <td className="px-3 py-2 text-right">{format.currency(driver.handlingAmountVnd)}</td>
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
              <Metric label={t('payroll.statement.commissionRate')} value={`${statement.commissionPercent}%`} />
              <Metric label={t('payroll.statement.handlingRate')} value={`${format.currency(statement.handlingFeeVndPerKg)} ${t('payroll.rate.perKgUnit')} · ${statement.handlingDriverPercent}%`} />
              <Metric label={t('payroll.statement.handlingAmount')} value={format.currency(statement.handlingAmountVnd)} />
              <Metric label={t('payroll.statement.totalSalary')} value={format.currency(statement.totalSalaryVnd)} />
            </div>
            <DriverBaseSalaryAdjustment driverId={statement.driverId} currentBaseSalary={statement.baseSalaryVnd} />
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
        <Metric label={t('payroll.statement.planKg')} value={format.weight(trip.planKg)} />
        <Metric label={t('payroll.statement.allocatedKg')} value={format.weight(trip.allocatedKg)} />
        <Metric label={t('payroll.statement.kgAmount')} value={format.currency(trip.kgAmountVnd)} />
        <Metric label={t('payroll.statement.handlingAmount')} value={format.currency(trip.handlingAmountVnd)} />
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

function DriverBaseSalaryAdjustment({
  driverId,
  currentBaseSalary,
}: {
  driverId: number
  currentBaseSalary: number
}) {
  const t = useT()
  const nextMonth = nextMonthPeriod()
  const [amount, setAmount] = useState('')
  const [saved, setSaved] = useState(false)
  const mutation = useSetDriverBaseSalaryMutation()

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const numericAmount = Number(amount)
    if (isNaN(numericAmount) || numericAmount < 0) return
    mutation.mutate(
      {
        driverId,
        effectiveFrom: `${nextMonth}-01`,
        baseSalaryVnd: numericAmount,
      },
      {
        onSuccess: () => {
          setSaved(true)
          toast.success(t('payroll.statement.baseSalarySaved'))
        },
      },
    )
  }

  return (
    <section className="rounded-md border border-line-soft p-4" aria-label={t('payroll.statement.editBaseSalary')}>
      <h3 className="font-semibold">{t('payroll.statement.editBaseSalary')}</h3>
      <p className="mt-1 text-small text-ink-2">
        {t('payroll.statement.baseSalaryOverrideHelp')} ({t('payroll.statement.effectiveFromNextMonth', { month: nextMonth })})
      </p>
      <form onSubmit={handleSave} className="mt-3 flex flex-wrap items-end gap-3">
        <div className="w-56">
          <Input
            label={t('payroll.statement.newBaseSalary')}
            type="number"
            min="0"
            step="1"
            placeholder={String(currentBaseSalary)}
            value={amount}
            onChange={(e) => {
              setSaved(false)
              setAmount(e.currentTarget.value)
            }}
            required
            suffix={t('payroll.vnd')}
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          loading={mutation.isPending}
          disabled={!amount || isNaN(Number(amount)) || Number(amount) < 0 || mutation.isPending}
        >
          {t('payroll.statement.saveBaseSalary')}
        </Button>
      </form>
      {saved ? <p className="mt-2 text-small text-cyan-800">{t('payroll.statement.baseSalarySaved')}</p> : null}
      {mutation.error ? <p role="alert" className="mt-2 text-small text-danger">{dataErrorMessage(mutation.error, t)}</p> : null}
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
