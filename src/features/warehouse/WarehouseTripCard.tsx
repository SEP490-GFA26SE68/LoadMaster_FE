import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { StatusBadge, TripSubStatusTag } from '@/components/StatusBadge'
import { Button } from '@/components/ui/Button'
import { calendarDate } from '@/lib/calendar-date'
import { useFormat, useT } from '@/lib/i18n'
import { loadingSessionPath, type WarehouseTripRow } from './warehouse-trips'

/**
 * Một chuyến ở danh sách kho: mã chuyến, tuyến, ngày chạy, xe, số kiện, tiến độ và một nút 56px "Bắt đầu xếp" / "Tiếp tục (x/y)".
 * Bản duyệt lỗi thời thì thay nút bằng cảnh báo — kho không xếp theo phương án đã lệch dữ liệu (D-31).
 */
export function WarehouseTripCard({ row, primary }: { row: WarehouseTripRow; primary: boolean }) {
  const t = useT()
  const format = useFormat()
  const percent = row.total === 0 ? 0 : Math.round((row.recorded / row.total) * 100)
  const progress = `${format.integer(row.recorded)}/${format.integer(row.total)}`

  return (
    <li className="flex flex-col gap-3 rounded-md border border-border bg-bg p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="font-mono text-[22px] leading-7 font-semibold">{row.id}</h2>
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge status={row.status} className="h-8 px-3 text-body-lg" />
          <TripSubStatusTag sub={row.sub} className="h-8 px-3 text-body-lg" />
        </span>
      </div>
      <p className="text-pretty">{row.name}</p>
      <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-[1fr_1.7fr_0.8fr_1fr]">
        <Fact label={t('warehouse.list.date')}>{format.date(calendarDate(row.scheduledDate))}</Fact>
        <Fact label={t('warehouse.list.vehicle')}>{row.vehicleName}</Fact>
        <Fact label={t('warehouse.list.packages')}><span className="font-mono">{format.integer(row.total)}</span></Fact>
        <Fact label={t('warehouse.list.progress')}>
          <span className="font-mono">{progress}</span>
          {row.missing > 0 ? <span className="text-badge-warning-fg"> · {t('warehouse.list.missing', { count: row.missing })}</span> : null}
        </Fact>
      </dl>
      {row.stage === 'loading' ? (
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('warehouse.list.progressLabel', { tripId: row.id })}
          className="h-2.5 overflow-hidden rounded-full border border-border bg-surface"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
      ) : null}
      {row.stage === 'stale' ? (
        <p className="m-0 flex items-start gap-3 rounded-md border border-badge-warning-border bg-badge-warning-bg px-4 py-3 font-medium text-badge-warning-fg">
          <TriangleAlert className="mt-0.5 size-5 flex-none" strokeWidth={2} aria-hidden />
          {t('warehouse.list.stale')}
        </p>
      ) : (
        <Button asChild variant={primary ? 'primary' : 'secondary'} size="touch" className="self-start">
          <Link to={loadingSessionPath(row.id)}>
            {row.stage === 'loading'
              ? t('warehouse.list.resume', { done: format.integer(row.recorded), total: format.integer(row.total) })
              : t('warehouse.list.start')}
          </Link>
        </Button>
      )}
    </li>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-text-3">{label}</dt>
      <dd className="m-0 font-medium">{children}</dd>
    </div>
  )
}
