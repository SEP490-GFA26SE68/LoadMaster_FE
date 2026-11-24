import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'

import { WAREHOUSE_PAYROLL_CAPABILITIES } from './warehouse-payroll-api'
import { Metric, WarehousePayrollStatementDetails } from './WarehousePayrollStatementDetails'
import { useOwnWarehousePayrollQuery } from './useWarehousePayrollQueries'

/** Chữ 16 px cho nhãn, gợi ý và lỗi của ô nhập ở màn cảm ứng (mặc định 13 / 12,5 px). */
const TOUCH_FIELD = '[&_label]:text-body-lg [&_span]:text-body-lg [&_input]:h-14 [&_input]:text-body-lg'

function currentMonth(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Phiếu lương của chính nhân viên kho (`/phieu-luong`, `payroll.viewOwn`). Máy chủ chỉ trả đủ số (kg đã xếp, tiền theo kg, KPI, từng
 * chuyến) khi bảng lương tháng đã chốt; chưa chốt thì chỉ có lương cứng, nên màn nói rõ phần còn lại chờ quản lý chốt. Nhân viên kho
 * dùng máy tính bảng: ô nhập 56 px, chữ từ 16 px, nút về màn kho trên dải trời.
 */
export function WarehousePayslipPage() {
  const t = useT()
  const format = useFormat()
  const [period, setPeriod] = useState(currentMonth)
  const statement = useOwnWarehousePayrollQuery(period)
  const data = statement.data

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        title={t('payroll.own.title')}
        description={t('pageHero.warehousePayroll')}
        actions={(
          <Button variant="glass" size="touch" asChild>
            <Link to="/kho"><ArrowLeft strokeWidth={1.5} />{t('payroll.warehouse.backToWarehouse')}</Link>
          </Button>
        )}
      />
      {!WAREHOUSE_PAYROLL_CAPABILITIES.server ? (
        <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto px-shell py-6 text-body-lg">
          <EmptyState mascot="empty" title={t('payroll.unavailableTitle')} description={t('payroll.unavailableDescription')} />
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-shell py-6 text-body-lg max-sm:px-4">
          <div className={`w-64 ${TOUCH_FIELD}`}>
            <Input type="month" label={t('payroll.periodLabel')} value={period} onChange={(event) => setPeriod(event.currentTarget.value)} />
          </div>
          {statement.isPending ? (
            <div role="status" aria-label={t('payroll.loading')} className="flex justify-center py-16"><Spinner /></div>
          ) : statement.isError ? (
            <EmptyState
              mascot="error"
              title={t('payroll.loadErrorTitle')}
              description={dataErrorMessage(statement.error, t)}
              action={<Button variant="secondary" size="touch" onClick={() => void statement.refetch()}>{t('payroll.retry')}</Button>}
            />
          ) : data?.calculated ? (
            <Card>
              <CardHeader className="justify-between">
                <CardTitle as="h2">{t('payroll.statement.title', { name: data.workerName })}</CardTitle>
                <span className="rounded-full bg-cyan-50 px-3 py-1 text-body-lg font-semibold text-cyan-800">{t('payroll.statusLocked')}</span>
              </CardHeader>
              <CardBody>
                <WarehousePayrollStatementDetails statement={data} touch />
              </CardBody>
            </Card>
          ) : data && data.baseSalaryVnd != null ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{t('payroll.statement.title', { name: data.workerName })}</CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-4">
                <p className="text-body-lg text-amber-800">{t('payroll.warehouse.unlockedNotice')}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Metric touch label={t('payroll.statement.baseSalary')} value={format.currency(data.baseSalaryVnd)} />
                </div>
              </CardBody>
            </Card>
          ) : (
            <EmptyState mascot="empty" title={t('payroll.noPeriodTitle')} description={t('payroll.warehouse.ownNoPeriodDescription')} />
          )}
        </main>
      )}
    </div>
  )
}
