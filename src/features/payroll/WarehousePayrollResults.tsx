import { Wallet } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'

import { nextMonthPeriod } from './payroll-api'
import { PAYROLL_TABLE_PAGE_SIZE, PayrollDialogPager, usePagedPayrollItems } from './payroll-dialog-pager'
import type { WarehousePayrollPeriod, WarehousePayrollStatement } from './warehouse-payroll-api'
import { Metric, WarehousePayrollStatementDetails } from './WarehousePayrollStatementDetails'
import { useSetWarehouseBaseSalaryMutation } from './useWarehousePayrollQueries'

type WarehousePayrollResultsProps = {
  period: WarehousePayrollPeriod
  hasKpi: boolean
  statement: WarehousePayrollStatement | undefined
  statementLoading: boolean
  statementError: string | null
  selectedWorkerId: string | null
  onSelectWorker: (workerId: string | null) => void
}

/** Bảng lương kho của một tháng (một dòng mỗi nhân viên) và hộp chi tiết của người đang chọn — như bảng lương tài xế. */
export function WarehousePayrollResults({
  period, hasKpi, statement, statementLoading, statementError, selectedWorkerId, onSelectWorker,
}: WarehousePayrollResultsProps) {
  const t = useT()
  const format = useFormat()
  const total = period.workers.reduce((sum, worker) => sum + worker.totalSalaryVnd, 0)
  const locked = period.status === 'LOCKED'
  const page = usePagedPayrollItems(period.workers, PAYROLL_TABLE_PAGE_SIZE)

  useEffect(() => {
    if (selectedWorkerId === null) return
    const index = period.workers.findIndex((worker) => worker.workerId === selectedWorkerId)
    if (index < 0) return
    const nextPage = Math.floor(index / PAYROLL_TABLE_PAGE_SIZE)
    if (nextPage !== page.pageIndex) page.setPageIndex(nextPage)
  }, [selectedWorkerId, period.workers])

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card>
        <CardHeader className="justify-between">
          <CardTitle as="h2" id="warehouse-payroll-period-title">{t('payroll.results.title', { period: period.period })}</CardTitle>
          <span className={locked ? 'rounded-full bg-cyan-50 px-3 py-1 text-small font-semibold text-cyan-800' : 'rounded-full bg-amber-50 px-3 py-1 text-small font-semibold text-amber-800'}>
            {t(locked ? 'payroll.statusLocked' : 'payroll.statusDraft')}
          </span>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label={t('payroll.results.total')} value={format.currency(total)} />
            <Metric label={t('payroll.warehouse.workers')} value={format.integer(period.workers.length)} />
          </div>
          {period.workers.length === 0 ? <p className="text-small text-ink-2">{t('payroll.warehouse.noWorkers')}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-small">
                <thead><tr className="border-b border-line-strong text-ink-2">
                  <th className="px-3 py-2">{t('payroll.warehouse.person')}</th>
                  <th className="px-3 py-2 text-right">{t('payroll.rate.baseShort')}</th>
                  <th className="px-3 py-2 text-right">{t('payroll.warehouse.loadedPackages')}</th>
                  <th className="px-3 py-2 text-right">{t('payroll.warehouse.loadedKg')}</th>
                  <th className="px-3 py-2 text-right">{t('payroll.warehouse.loadedAmount')}</th>
                  {hasKpi ? <th className="px-3 py-2 text-right">{t('payroll.results.kpiBonus')}</th> : null}
                  <th className="px-3 py-2 text-right">{t('payroll.results.total')}</th>
                </tr></thead>
                <tbody>
                  {page.items.map((worker) => (
                    <tr key={worker.workerId} className="border-b border-line-soft">
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-left font-semibold text-primary underline-offset-2 hover:underline"
                          aria-pressed={selectedWorkerId === worker.workerId}
                          onClick={() => onSelectWorker(selectedWorkerId === worker.workerId ? null : worker.workerId)}>
                          {worker.workerName}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right">{format.currency(worker.baseSalaryVnd)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{format.integer(worker.loadedPackages)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{format.weight(worker.loadedKg)}</td>
                      <td className="px-3 py-2 text-right">{format.currency(worker.loadedAmountVnd)}</td>
                      {hasKpi ? (
                        <td className="px-3 py-2 text-right">
                          {worker.kpiAchieved
                            ? `${t('payroll.results.kpiAchieved')}: ${format.currency(worker.kpiBonusVnd)}`
                            : <span className="text-ink-3">{t('payroll.results.kpiMissed')}</span>}
                        </td>
                      ) : null}
                      <td className="px-3 py-2 text-right font-semibold">{format.currency(worker.totalSalaryVnd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {period.workers.length === 0 ? null : (
            <PayrollDialogPager
              pageIndex={page.pageIndex}
              pageCount={page.pageCount}
              pageSize={page.pageSize}
              total={page.total}
              label={t('payroll.warehouse.tablePagination')}
              onPageChange={page.setPageIndex}
              className="px-0"
            />
          )}
        </CardBody>
      </Card>

      <Dialog open={selectedWorkerId !== null} onOpenChange={(open) => { if (!open) onSelectWorker(null) }}>
        {selectedWorkerId === null ? null : (
          <DialogContent className="flex max-h-[min(90dvh,52rem)] w-[min(48rem,calc(100vw-3rem))] flex-col">
            {statementLoading ? (
              <div role="status" aria-label={t('payroll.loading')} className="flex justify-center px-7 py-16"><Spinner /></div>
            ) : statementError ? (
              <>
                <DialogHeader icon={Wallet} title={t('payroll.statement.title', { name: t('payroll.warehouse.person') })} />
                <p role="alert" className="px-7 py-5 text-small text-danger">{statementError}</p>
              </>
            ) : statement?.calculated ? (
              <>
                <DialogHeader icon={Wallet} title={t('payroll.statement.title', { name: statement.workerName })} />
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-7 py-5">
                  <WarehousePayrollStatementDetails statement={statement} />
                  <WarehouseBaseSalaryAdjustment workerId={statement.workerId} currentBaseSalary={statement.baseSalaryVnd} />
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

/** Mức lương cứng riêng của một nhân viên kho, áp dụng từ đầu tháng sau (máy chủ lấy số lớn hơn giữa mức riêng và mức chung). */
function WarehouseBaseSalaryAdjustment({ workerId, currentBaseSalary }: { workerId: string; currentBaseSalary: number }) {
  const t = useT()
  const nextMonth = nextMonthPeriod()
  const [amount, setAmount] = useState('')
  const [saved, setSaved] = useState(false)
  const mutation = useSetWarehouseBaseSalaryMutation()
  const valid = amount !== '' && !isNaN(Number(amount)) && Number(amount) >= 0

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid) return
    mutation.mutate(
      { workerId, effectiveFrom: `${nextMonth}-01`, baseSalaryVnd: Number(amount) },
      {
        onSuccess: () => {
          setSaved(true)
          toast.success(t('payroll.warehouse.baseSalarySaved'))
        },
      },
    )
  }

  return (
    <section className="rounded-md border border-line-soft p-4" aria-label={t('payroll.statement.editBaseSalary')}>
      <h3 className="font-semibold">{t('payroll.statement.editBaseSalary')}</h3>
      <p className="mt-1 text-small text-ink-2">
        {t('payroll.warehouse.baseSalaryOverrideHelp')} ({t('payroll.statement.effectiveFromNextMonth', { month: nextMonth })})
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
        <Button type="submit" variant="secondary" size="sm" loading={mutation.isPending} disabled={!valid || mutation.isPending}>
          {t('payroll.statement.saveBaseSalary')}
        </Button>
      </form>
      {saved ? <p className="mt-2 text-small text-cyan-800">{t('payroll.warehouse.baseSalarySaved')}</p> : null}
      {mutation.error ? <p role="alert" className="mt-2 text-small text-danger">{dataErrorMessage(mutation.error, t)}</p> : null}
    </section>
  )
}
