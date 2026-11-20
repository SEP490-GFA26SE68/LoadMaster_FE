import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'

import { nextMonthPeriod } from './payroll-api'
import type { DispatcherPayrollPeriod, DispatcherPayrollStatement, DispatcherPayrollSummary } from './dispatcher-payroll-api'
import { useSetDispatcherBaseSalaryMutation, useUpdateDispatcherPayrollLineMutation } from './useDispatcherPayrollQueries'

type DispatcherPayrollResultsProps = {
  period: DispatcherPayrollPeriod
  statement: DispatcherPayrollStatement | undefined
  statementLoading: boolean
  statementError: string | null
  selectedDispatcherId: string | null
  onSelectDispatcher: (dispatcherId: string | null) => void
}

export function DispatcherPayrollResults({
  period,
  statement,
  statementLoading,
  statementError,
  selectedDispatcherId,
  onSelectDispatcher,
}: DispatcherPayrollResultsProps) {
  const t = useT()
  const format = useFormat()
  const total = period.dispatchers.reduce((sum, dispatcher) => sum + dispatcher.totalSalaryVnd, 0)
  const locked = period.status === 'LOCKED'

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card>
        <CardHeader className="justify-between">
          <CardTitle as="h2" id="dispatcher-payroll-period-title">{t('payroll.results.title', { period: period.period })}</CardTitle>
          <span className={locked ? 'rounded-full bg-cyan-50 px-3 py-1 text-small font-semibold text-cyan-800' : 'rounded-full bg-amber-50 px-3 py-1 text-small font-semibold text-amber-800'}>
            {t(locked ? 'payroll.statusLocked' : 'payroll.statusDraft')}
          </span>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label={t('payroll.results.total')} value={format.currency(total)} />
            <Metric label={t('payroll.dispatcher.dispatchers')} value={format.integer(period.dispatchers.length)} />
          </div>
          {period.dispatchers.length === 0 ? <p className="text-small text-ink-2">{t('payroll.dispatcher.noDispatchers')}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-small">
                <thead><tr className="border-b border-line-strong text-ink-2">
                  <th className="px-3 py-2">{t('payroll.dispatcher.person')}</th>
                  <th className="px-3 py-2 text-right">{t('payroll.rate.baseShort')}</th>
                  <th className="px-3 py-2 text-right">{t('payroll.dispatcher.overtimeDays')}</th>
                  <th className="px-3 py-2 text-right">{t('payroll.dispatcher.overtimeAmount')}</th>
                  <th className="px-3 py-2 text-right">{t('payroll.dispatcher.kpi')}</th>
                  <th className="px-3 py-2 text-right">{t('payroll.results.total')}</th>
                </tr></thead>
                <tbody>
                  {period.dispatchers.map((dispatcher) => (
                    <DispatcherPayrollRow
                      key={dispatcher.dispatcherId}
                      period={period.period}
                      dispatcher={dispatcher}
                      locked={locked}
                      selected={selectedDispatcherId === String(dispatcher.dispatcherId)}
                      onSelect={() => onSelectDispatcher(selectedDispatcherId === String(dispatcher.dispatcherId) ? null : String(dispatcher.dispatcherId))}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {selectedDispatcherId === null ? null : statementLoading ? (
        <div role="status" aria-label={t('payroll.loading')} className="flex justify-center py-8"><Spinner /></div>
      ) : statementError ? (
        <p role="alert" className="text-small text-danger">{statementError}</p>
      ) : statement?.calculated ? (
        <Card>
          <CardHeader><CardTitle as="h2">{t('payroll.statement.title', { name: statement.dispatcherName })}</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Metric label={t('payroll.statement.baseSalary')} value={format.currency(statement.baseSalaryVnd)} />
              <Metric label={t('payroll.dispatcher.overtimeHour')} value={`${format.currency(statement.overtimeVndPerHour)} ${t('payroll.dispatcher.overtimeHourUnit')}`} />
              <Metric label={t('payroll.dispatcher.overtimeHoursPerDay')} value={`${statement.overtimeHoursPerDay} ${t('payroll.dispatcher.hoursUnit')}`} />
              <Metric label={t('payroll.dispatcher.overtimeDays')} value={format.integer(statement.overtimeDays)} />
              <Metric label={t('payroll.dispatcher.overtimeAmount')} value={format.currency(statement.overtimeAmountVnd)} />
              <Metric label={t('payroll.dispatcher.kpi')} value={format.currency(statement.kpiAmountVnd)} />
              <Metric label={t('payroll.statement.totalSalary')} value={format.currency(statement.totalSalaryVnd)} />
            </div>
            <p className="text-small text-ink-2">
              {t('payroll.dispatcher.overtimeFormula', {
                rate: format.currency(statement.overtimeVndPerHour),
                hours: String(statement.overtimeHoursPerDay),
                days: format.integer(statement.overtimeDays),
              })}
            </p>
            {locked ? null : (
              <DispatcherBaseSalaryAdjustment dispatcherId={statement.dispatcherId} currentBaseSalary={statement.baseSalaryVnd} />
            )}
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}

function DispatcherPayrollRow({
  period,
  dispatcher,
  locked,
  selected,
  onSelect,
}: {
  period: string
  dispatcher: DispatcherPayrollSummary
  locked: boolean
  selected: boolean
  onSelect: () => void
}) {
  const t = useT()
  const format = useFormat()
  const update = useUpdateDispatcherPayrollLineMutation()
  const [overtimeDays, setOvertimeDays] = useState(String(dispatcher.overtimeDays))
  const [kpiAmountVnd, setKpiAmountVnd] = useState(String(dispatcher.kpiAmountVnd))

  useEffect(() => {
    setOvertimeDays(String(dispatcher.overtimeDays))
    setKpiAmountVnd(String(dispatcher.kpiAmountVnd))
  }, [dispatcher.overtimeDays, dispatcher.kpiAmountVnd])

  function save(nextDays = overtimeDays, nextKpi = kpiAmountVnd) {
    const days = Number(nextDays)
    const kpi = Number(nextKpi)
    if (!Number.isInteger(days) || days < 0 || Number.isNaN(kpi) || kpi < 0) return
    if (days === dispatcher.overtimeDays && kpi === dispatcher.kpiAmountVnd) return
    update.mutate({ period, dispatcherId: dispatcher.dispatcherId, input: { overtimeDays: days, kpiAmountVnd: kpi } })
  }

  return (
    <tr className="border-b border-line-soft">
      <td className="px-3 py-2">
        <button
          type="button"
          className="text-left font-semibold text-primary underline-offset-2 hover:underline"
          aria-pressed={selected}
          onClick={onSelect}>
          {dispatcher.dispatcherName}
        </button>
      </td>
      <td className="px-3 py-2 text-right">{format.currency(dispatcher.baseSalaryVnd)}</td>
      <td className="px-3 py-2 text-right">
        <input
          aria-label={t('payroll.dispatcher.overtimeDaysOf', { name: dispatcher.dispatcherName })}
          type="number"
          min="0"
          max="31"
          step="1"
          className="w-20 rounded-md border border-line-soft bg-surface px-2 py-1 text-right disabled:opacity-60"
          disabled={locked || update.isPending}
          value={overtimeDays}
          onChange={(event) => setOvertimeDays(event.currentTarget.value)}
          onBlur={() => save()}
        />
      </td>
      <td className="px-3 py-2 text-right">{format.currency(dispatcher.overtimeAmountVnd)}</td>
      <td className="px-3 py-2 text-right">
        <input
          aria-label={t('payroll.dispatcher.kpiOf', { name: dispatcher.dispatcherName })}
          type="number"
          min="0"
          step="1"
          className="w-28 rounded-md border border-line-soft bg-surface px-2 py-1 text-right disabled:opacity-60"
          disabled={locked || update.isPending}
          value={kpiAmountVnd}
          onChange={(event) => setKpiAmountVnd(event.currentTarget.value)}
          onBlur={() => save()}
        />
      </td>
      <td className="px-3 py-2 text-right font-semibold">{format.currency(dispatcher.totalSalaryVnd)}</td>
    </tr>
  )
}

function DispatcherBaseSalaryAdjustment({
  dispatcherId,
  currentBaseSalary,
}: {
  dispatcherId: number
  currentBaseSalary: number
}) {
  const t = useT()
  const nextMonth = nextMonthPeriod()
  const [amount, setAmount] = useState('')
  const [saved, setSaved] = useState(false)
  const mutation = useSetDispatcherBaseSalaryMutation()

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const numericAmount = Number(amount)
    if (isNaN(numericAmount) || numericAmount < 0) return
    mutation.mutate(
      {
        dispatcherId,
        effectiveFrom: `${nextMonth}-01`,
        baseSalaryVnd: numericAmount,
      },
      {
        onSuccess: () => {
          setSaved(true)
          toast.success(t('payroll.dispatcher.baseSalarySaved'))
        },
      },
    )
  }

  return (
    <section className="rounded-md border border-line-soft p-4" aria-label={t('payroll.statement.editBaseSalary')}>
      <h3 className="font-semibold">{t('payroll.statement.editBaseSalary')}</h3>
      <p className="mt-1 text-small text-ink-2">
        {t('payroll.dispatcher.baseSalaryOverrideHelp')} ({t('payroll.statement.effectiveFromNextMonth', { month: nextMonth })})
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
            onChange={(event) => {
              setSaved(false)
              setAmount(event.currentTarget.value)
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
      {saved ? <p className="mt-2 text-small text-cyan-800">{t('payroll.dispatcher.baseSalarySaved')}</p> : null}
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
