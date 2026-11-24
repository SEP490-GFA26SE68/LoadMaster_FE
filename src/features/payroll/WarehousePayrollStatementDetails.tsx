import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

import type { WarehousePayrollStatement } from './warehouse-payroll-api'

type CalculatedStatement = Extract<WarehousePayrollStatement, { calculated: true }>

/**
 * Phần số của một phiếu lương kho đã tính: lương cứng, kg đã xếp × tiền mỗi kg, KPI (khi công ty dùng), tổng, rồi từng chuyến đã xếp.
 * Dùng chung cho hộp chi tiết của quản lý và phiếu lương của chính nhân viên kho (`touch`: chữ 16 px trên máy tính bảng ở kho).
 */
export function WarehousePayrollStatementDetails({ statement, touch = false }: { statement: CalculatedStatement; touch?: boolean }) {
  const t = useT()
  const format = useFormat()
  const usesKpi = statement.kpiTargetKg != null
  return (
    <div className={cn('flex flex-col gap-4', touch && 'text-body-lg')}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric touch={touch} label={t('payroll.statement.baseSalary')} value={format.currency(statement.baseSalaryVnd)} />
        <Metric touch={touch} label={t('payroll.warehouse.loadedPackages')} value={format.integer(statement.loadedPackages)} />
        <Metric touch={touch} label={t('payroll.warehouse.loadedKg')} value={format.weight(statement.loadedKg)} />
        <Metric touch={touch} label={t('payroll.warehouse.perKg')} value={`${format.currency(statement.rateVndPerKg)} ${t('payroll.rate.perKgUnit')}`} />
        <Metric touch={touch} label={t('payroll.warehouse.loadedAmount')} value={format.currency(statement.loadedAmountVnd)} />
        {usesKpi ? (
          <Metric
            touch={touch}
            label={t('payroll.warehouse.kpiOf', { target: format.weight(statement.kpiTargetKg ?? 0) })}
            value={statement.kpiAchieved ? format.currency(statement.kpiBonusVnd) : t('payroll.results.kpiMissed')}
          />
        ) : null}
        <Metric touch={touch} label={t('payroll.statement.totalSalary')} value={format.currency(statement.totalSalaryVnd)} />
      </div>
      <p className={cn('text-ink-2', touch ? 'text-body-lg' : 'text-small')}>
        {t('payroll.warehouse.formula', { rate: format.currency(statement.rateVndPerKg), kg: format.weight(statement.loadedKg) })}
      </p>
      <section aria-labelledby="warehouse-payroll-trips" className="flex flex-col gap-2">
        <h3 id="warehouse-payroll-trips" className="font-semibold text-ink-strong">{t('payroll.warehouse.tripsTitle')}</h3>
        {statement.trips.length === 0 ? (
          <p className={cn('text-ink-2', touch ? 'text-body-lg' : 'text-small')}>{t('payroll.warehouse.noTrips')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={cn('w-full min-w-[28rem] border-collapse text-left', touch ? 'text-body-lg' : 'text-small')}>
              <thead>
                <tr className="border-b border-line-strong text-ink-2">
                  <th className="px-3 py-2 font-medium">{t('payroll.warehouse.trip')}</th>
                  <th className="px-3 py-2 font-medium">{t('payroll.warehouse.loadedDate')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('payroll.warehouse.loadedPackages')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('payroll.warehouse.loadedKg')}</th>
                </tr>
              </thead>
              <tbody>
                {statement.trips.map((trip) => (
                  <tr key={trip.tripId} className={cn('border-b border-line-soft', touch && 'h-14')}>
                    <td className="px-3 py-2 font-mono">{trip.tripCode}</td>
                    <td className="px-3 py-2">{format.date(trip.loadedAt)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{format.integer(trip.loadedPackages)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{format.weight(trip.loadedKg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export function Metric({ label, value, touch = false }: { label: string; value: string; touch?: boolean }) {
  return (
    <div className="rounded-md bg-surface-2 p-3">
      <p className={cn('text-ink-2', touch ? 'text-body-lg' : 'text-small')}>{label}</p>
      <p className="mt-1 font-display text-h3 font-bold text-ink-strong">{value}</p>
    </div>
  )
}
