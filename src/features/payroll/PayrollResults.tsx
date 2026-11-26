import { Wallet } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'

import { nextMonthPeriod, type PayrollDriverStatement, type PayrollPeriod } from './payroll-api'
import { PAYROLL_TABLE_PAGE_SIZE, PayrollDialogPager, usePagedPayrollItems } from './payroll-dialog-pager'
import { useSetDriverBaseSalaryMutation } from './usePayrollQueries'

type PayrollResultsProps = {
  period: PayrollPeriod
  hasKpi: boolean
  statement: PayrollDriverStatement | undefined
  statementLoading: boolean
  statementError: string | null
  selectedDriverId: string | null
  onSelectDriver: (driverId: string | null) => void
}

export function PayrollResults({ period, hasKpi, statement, statementLoading, statementError, selectedDriverId, onSelectDriver }: PayrollResultsProps) {
  const t = useT()
  const format = useFormat()
  const total = period.drivers.reduce((sum, driver) => sum + driver.totalSalaryVnd, 0)
  const page = usePagedPayrollItems(period.drivers, PAYROLL_TABLE_PAGE_SIZE)

  useEffect(() => {
    if (selectedDriverId === null) return
    const index = period.drivers.findIndex((driver) => String(driver.driverId) === selectedDriverId)
    if (index < 0) return
    const nextPage = Math.floor(index / PAYROLL_TABLE_PAGE_SIZE)
    if (nextPage !== page.pageIndex) page.setPageIndex(nextPage)
  }, [selectedDriverId, period.drivers])

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
              <table className="w-full min-w-[760px] border-collapse text-left text-small">
                <thead><tr className="border-b border-line-strong text-ink-2">
                  <th className="px-3 py-2">{t('payroll.results.driver')}</th>
                  <th className="px-3 py-2 text-right">{t('payroll.rate.baseShort')}</th>
                  <th className="px-3 py-2 text-right">{t('payroll.results.totalKg')}</th>
                  <th className="px-3 py-2 text-right">{t('payroll.results.kgAmount')}</th>
                  <th className="px-3 py-2 text-right">{t('payroll.results.handling')}</th>
                  {hasKpi ? <th className="px-3 py-2 text-right">{t('payroll.results.kpiBonus')}</th> : null}
                  <th className="px-3 py-2 text-right">{t('payroll.results.total')}</th>
                </tr></thead>
                <tbody>
                  {page.items.map((driver) => (
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
                      <td className="px-3 py-2 text-right">{format.currency(driver.kgAmountVnd)}</td>
                      <td className="px-3 py-2 text-right">{format.currency(driver.handlingAmountVnd)}</td>
                      {hasKpi ? (
                        <td className="px-3 py-2 text-right">
                          {driver.kpiAchieved
                            ? `${t('payroll.results.kpiAchieved')}: ${format.currency(driver.kpiAmountVnd)}`
                            : <span className="text-ink-3">{t('payroll.results.kpiMissed')}</span>}
                        </td>
                      ) : null}
                      <td className="px-3 py-2 text-right font-semibold">{format.currency(driver.totalSalaryVnd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {period.drivers.length === 0 ? null : (
            <PayrollDialogPager
              pageIndex={page.pageIndex}
              pageCount={page.pageCount}
              pageSize={page.pageSize}
              total={page.total}
              label={t('payroll.results.tablePagination')}
              onPageChange={page.setPageIndex}
              className="px-0"
            />
          )}
        </CardBody>
      </Card>

      <Dialog open={selectedDriverId !== null} onOpenChange={(open) => { if (!open) onSelectDriver(null) }}>
        {selectedDriverId === null ? null : (
          <DialogContent className="flex max-h-[min(90dvh,52rem)] w-[min(48rem,calc(100vw-3rem))] flex-col">
            {statementLoading ? (
              <div role="status" aria-label={t('payroll.loading')} className="flex justify-center px-7 py-16"><Spinner /></div>
            ) : statementError ? (
              <>
                <DialogHeader icon={Wallet} title={t('payroll.statement.title', { name: t('payroll.results.driver') })} />
                <p role="alert" className="px-7 py-5 text-small text-danger">{statementError}</p>
              </>
            ) : statement?.calculated ? (
              <>
                <DialogHeader icon={Wallet} title={t('payroll.statement.title', { name: statement.driverName })} />
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-7 py-5">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <Metric label={t('payroll.statement.baseSalary')} value={format.currency(statement.baseSalaryVnd)} />
                    <Metric label={t('payroll.statement.kgRate')} value={`${format.currency(statement.rateVndPerKg)} ${t('payroll.rate.perKgUnit')}`} />
                    <Metric label={t('payroll.statement.kgAmount')} value={format.currency(statement.kgAmountVnd)} />
                    <Metric label={t('payroll.statement.commissionRate')} value={`${statement.commissionPercent}%`} />
                    <Metric label={t('payroll.statement.handlingRate')} value={`${format.currency(statement.handlingFeeVndPerKg)} ${t('payroll.rate.perKgUnit')} · ${statement.handlingDriverPercent}%`} />
                    <Metric label={t('payroll.statement.handlingAmount')} value={format.currency(statement.handlingAmountVnd)} />
                    <Metric label={t('payroll.statement.totalSalary')} value={format.currency(statement.totalSalaryVnd)} />
                  </div>
                  <DriverBaseSalaryAdjustment period={statement.period} driverId={statement.driverId} currentBaseSalary={statement.baseSalaryVnd} />
                  {statement.trips.map((trip) => (
                    <PayrollTripSummary key={trip.tripId} trip={trip} driverName={statement.driverName} />
                  ))}
                  {statement.trips.length === 0 ? <p className="text-small text-ink-2">{t('payroll.statement.noTrips')}</p> : null}
                </div>
              </>
            ) : (
              <div role="status" aria-label={t('payroll.loading')} className="flex justify-center px-7 py-16"><Spinner /></div>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">{t('payroll.close')}</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

function PayrollTripSummary({
  trip,
  driverName,
}: {
  trip: PayrollDriverStatement['trips'][number]
  driverName: string
}) {
  const t = useT()
  const format = useFormat()

  return (
    <section className="rounded-md border border-line-soft p-4" aria-label={t('payroll.statement.trip', { code: trip.tripCode })}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{trip.tripCode}</h3>
        <span className="text-small text-ink-2">
          {`${driverName} · ${format.percent(trip.sharePercent)}`}
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric label={t('payroll.statement.planKg')} value={format.weight(trip.planKg)} />
        <Metric label={t('payroll.statement.allocatedKg')} value={format.weight(trip.allocatedKg)} />
        <Metric label={t('payroll.statement.kgAmount')} value={format.currency(trip.kgAmountVnd)} />
        <Metric label={t('payroll.statement.handlingAmount')} value={format.currency(trip.handlingAmountVnd)} />
        <Metric label={t('payroll.statement.tripTotal')} value={format.currency(trip.totalAmountVnd)} />
      </div>
    </section>
  )
}

function DriverBaseSalaryAdjustment({
  period,
  driverId,
  currentBaseSalary,
}: {
  period: string
  driverId: number
  currentBaseSalary: number
}) {
  const t = useT()
  const year = Number(period.slice(0, 4))
  const month = Number(period.slice(5, 7))
  const nextMonthAfterSelectedPeriod = nextMonthPeriod(new Date(year, month - 1, 1))
  const nextMonthAfterCurrentPeriod = nextMonthPeriod()
  const effectiveMonth = nextMonthAfterSelectedPeriod > nextMonthAfterCurrentPeriod
    ? nextMonthAfterSelectedPeriod
    : nextMonthAfterCurrentPeriod
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
        effectiveFrom: `${effectiveMonth}-01`,
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
        {t('payroll.statement.baseSalaryOverrideHelp')} ({t('payroll.statement.effectiveFromNextMonth', { month: effectiveMonth })})
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
