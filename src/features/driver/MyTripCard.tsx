import { Clock } from 'lucide-react'
import { Link } from 'react-router'
import { StatusBadge, TripSubStatusTag } from '@/components/StatusBadge'
import { Button } from '@/components/ui/Button'
import { calendarDate } from '@/lib/calendar-date'
import { useFormat, useT } from '@/lib/i18n'
import { isPreparing, type MyTripRow } from './my-trips'

/** Mở một chuyến ở màn điểm giao (hoặc tổng kết nếu đã hoàn thành). */
export function driverTripPath(tripId: string): string {
  return `/tai-xe/diem-giao?chuyen=${encodeURIComponent(tripId)}`
}

/**
 * Một chuyến ở "Chuyến của tôi" (LM-087): mã chuyến, trạng thái, tuyến, ngày chạy, xe, số điểm và số kiện. Chuyến sẵn sàng giao và
 * chuyến đã hoàn thành có nút 56px; chuyến kho đang chuẩn bị không bấm được và nói lý do. Chữ 16px, badge 16px (mục 10).
 */
export function MyTripCard({ row, primary = false }: { row: MyTripRow; primary?: boolean }) {
  const t = useT()
  const format = useFormat()
  const preparing = isPreparing(row)

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border bg-bg p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h3 className="font-mono text-[22px] leading-7 font-semibold">{row.id}</h3>
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge status={row.status} className="h-8 px-3 text-body-lg" />
          <TripSubStatusTag sub={row.sub} className="h-8 px-3 text-body-lg" />
        </span>
      </div>
      <p className="m-0 text-pretty">{row.name}</p>
      <p className="m-0 text-text-2">
        {format.date(calendarDate(row.scheduledDate))} · {t('driver.list.stops', { count: row.stopCount })} ·{' '}
        {t('common.packageCount', { count: row.packageCount })}
      </p>
      {/* Tên xe có biển số: dòng riêng để biển số không bị ngắt ở dấu gạch trên điện thoại */}
      <p className="m-0 text-text-2">{row.vehicleName}</p>

      {row.status === 'IN_TRANSIT' && row.currentStop !== undefined ? (
        <p className="m-0 font-medium">{t('driver.list.atStop', { number: row.currentStop, total: row.stopCount })}</p>
      ) : null}
      {preparing ? (
        <p className="m-0 flex items-start gap-2 rounded-md border border-border bg-surface px-3 py-2 text-text-2">
          <Clock className="mt-0.5 size-5 flex-none" strokeWidth={1.5} aria-hidden />
          {row.sub?.kind === 'loading'
            ? t('driver.list.waitingLoading')
            : t('driver.list.waitingApproved')}
        </p>
      ) : null}
      {row.status === 'DELIVERED' && row.completedAt ? (
        <p className="m-0 text-text-2">
          {t('driver.list.completed', { time: format.time(row.completedAt), date: format.date(row.completedAt) })}
          {row.issueCount > 0 ? <span className="font-medium text-badge-warning-fg"> · {t('driver.list.issues', { count: row.issueCount })}</span> : null}
        </p>
      ) : null}

      {preparing ? null : (
        <Button asChild variant={primary ? 'primary' : 'secondary'} size="touch" className="mt-1 self-start">
          <Link to={driverTripPath(row.id)}>
            {row.status === 'IN_TRANSIT' ? t('driver.list.resume') : row.status === 'DELIVERED' ? t('driver.list.viewSummary') : t('driver.list.open')}
          </Link>
        </Button>
      )}
    </li>
  )
}
