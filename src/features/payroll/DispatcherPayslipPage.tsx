import { useState } from 'react'

import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'

import { DISPATCHER_PAYROLL_CAPABILITIES } from './dispatcher-payroll-api'
import { useOwnDispatcherPayrollQuery } from './useDispatcherPayrollQueries'

function currentMonth(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function DispatcherPayslipPage() {
  const t = useT()
  const format = useFormat()
  const [period, setPeriod] = useState(currentMonth)
  const statement = useOwnDispatcherPayrollQuery(period)

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero title={t('payroll.own.title')} description={t('pageHero.dispatcherPayroll')} />
      {!DISPATCHER_PAYROLL_CAPABILITIES.server ? (
        <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto px-shell py-6">
          <EmptyState mascot="empty" title={t('payroll.unavailableTitle')} description={t('payroll.unavailableDescription')} />
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-shell py-6 max-sm:px-4">
          <div className="w-56">
            <Input type="month" label={t('payroll.periodLabel')} value={period} onChange={(event) => setPeriod(event.currentTarget.value)} />
          </div>
          {statement.isPending ? (
            <div role="status" aria-label={t('payroll.loading')} className="flex justify-center py-16"><Spinner /></div>
          ) : statement.isError ? (
            <EmptyState
              mascot="error"
              title={t('payroll.loadErrorTitle')}
              description={dataErrorMessage(statement.error, t)}
              action={<Button variant="secondary" onClick={() => void statement.refetch()}>{t('payroll.retry')}</Button>}
            />
          ) : !statement.data?.calculated ? (
            <EmptyState mascot="empty" title={t('payroll.noPeriodTitle')} description={t('payroll.own.noPeriodDescription')} />
          ) : (
            <Card>
              <CardHeader className="justify-between">
                <CardTitle as="h2">{t('payroll.statement.title', { name: statement.data.dispatcherName })}</CardTitle>
                <span className={statement.data.status === 'LOCKED' ? 'rounded-full bg-cyan-50 px-3 py-1 text-small font-semibold text-cyan-800' : 'rounded-full bg-amber-50 px-3 py-1 text-small font-semibold text-amber-800'}>
                  {t(statement.data.status === 'LOCKED' ? 'payroll.statusLocked' : 'payroll.statusDraft')}
                </span>
              </CardHeader>
              <CardBody className="flex flex-col gap-4">
                {statement.data.status === 'DRAFT' ? <p className="text-small text-amber-800">{t('payroll.own.draftNotice')}</p> : null}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <Metric label={t('payroll.statement.baseSalary')} value={format.currency(statement.data.baseSalaryVnd)} />
                  <Metric label={t('payroll.dispatcher.overtimeHour')} value={`${format.currency(statement.data.overtimeVndPerHour)} ${t('payroll.dispatcher.overtimeHourUnit')}`} />
                  <Metric label={t('payroll.dispatcher.overtimeHoursPerDay')} value={`${statement.data.overtimeHoursPerDay} ${t('payroll.dispatcher.hoursUnit')}`} />
                  <Metric label={t('payroll.dispatcher.overtimeDays')} value={format.integer(statement.data.overtimeDays)} />
                  <Metric label={t('payroll.dispatcher.overtimeAmount')} value={format.currency(statement.data.overtimeAmountVnd)} />
                  <Metric label={t('payroll.dispatcher.kpi')} value={format.currency(statement.data.kpiAmountVnd)} />
                  <Metric label={t('payroll.statement.totalSalary')} value={format.currency(statement.data.totalSalaryVnd)} />
                </div>
                <p className="text-small text-ink-2">
                  {t('payroll.dispatcher.overtimeFormula', {
                    rate: format.currency(statement.data.overtimeVndPerHour),
                    hours: String(statement.data.overtimeHoursPerDay),
                    days: format.integer(statement.data.overtimeDays),
                  })}
                </p>
              </CardBody>
            </Card>
          )}
        </main>
      )}
    </div>
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
