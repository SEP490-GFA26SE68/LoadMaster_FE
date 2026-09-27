import { createColumnHelper } from '@tanstack/react-table'
import { useId, useMemo } from 'react'
import { Box } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { DataTable, type BaseTableFeatures, type ColumnMeta } from '@/components/DataTable'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/Button'
import { VehicleName } from '@/components/VehicleName'
import type { Formatter } from '@/lib/format'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import { plannerPath } from '@/lib/planner-path'
import { cn } from '@/lib/utils'
import type { DashboardTripRow } from './dashboard-summary'

/** Số chuyến hiện trong bảng; báo cáo .xlsx có đủ mọi chuyến của kỳ. */
export const RECENT_TRIP_LIMIT = 10

const helper = createColumnHelper<BaseTableFeatures, DashboardTripRow>()
const mono = 'font-mono text-caption'
const LINK_FOCUS = 'rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

/** Dòng cũng mở chi tiết khi bấm: liên kết trong ô chặn nổi bọt để không đẩy hai mục lịch sử. */
function stop(event: { stopPropagation: () => void }) {
  event.stopPropagation()
}

/** Tiêu đề, nhãn trạng thái và số theo ngôn ngữ đang chọn, nên dựng trong component. */
function createColumns(t: TFunction, format: Formatter) {
  return helper.columns([
    // V2: tên tuyến đậm, mã chuyến mono ngay dưới — cả hai là một liên kết tới chi tiết chuyến (mở được bằng bàn phím)
    helper.accessor('name', {
      header: t('manager.recent.trip'),
      cell: (info) => (
        <Link
          to={`/chuyen/${encodeURIComponent(info.row.original.id)}`}
          onClick={stop}
          className={cn('flex min-w-0 flex-col whitespace-normal text-ink-strong hover:text-primary', LINK_FOCUS)}
        >
          <span className="line-clamp-1 font-medium">{info.getValue()}</span>{' '}
          <span className={cn(mono, 'text-ink-3')}>{info.row.original.id}</span>
        </Link>
      ),
    }),
    helper.accessor('scheduledDate', {
      header: t('manager.recent.date'),
      meta: { width: '112px' } satisfies ColumnMeta,
      cell: (info) => <span className={cn(mono, 'text-ink-2')}>{format.date(info.getValue())}</span>,
    }),
    // Tên xe xuống dòng trước biển số thay vì cắt bằng dấu ba chấm ở 1.366 px (LM-095)
    helper.accessor('vehicleName', {
      header: t('manager.recent.vehicle'),
      meta: { width: '200px' } satisfies ColumnMeta,
      cell: (info) => <VehicleName name={info.getValue()} className="line-clamp-2 whitespace-normal text-ink-1" />,
    }),
    helper.accessor('status', {
      header: t('manager.recent.status'),
      meta: { width: '148px' } satisfies ColumnMeta,
      cell: (info) => <StatusBadge status={info.getValue()} />,
    }),
    helper.accessor('packageCount', {
      header: t('manager.recent.packages'),
      meta: { align: 'right', width: '80px' } satisfies ColumnMeta,
      cell: (info) => <span className={mono}>{format.integer(info.getValue())}</span>,
    }),
    helper.accessor('volumePercent', {
      header: t('manager.recent.volume'),
      meta: { align: 'right', width: '92px' } satisfies ColumnMeta,
      cell: (info) => {
        const value = info.getValue()
        return <span className={mono}>{value === null ? t('manager.noValue') : format.percent(value)}</span>
      },
    }),
    helper.accessor('deliveredWeightKg', {
      header: t('manager.recent.delivered'),
      meta: { align: 'right', width: '112px' } satisfies ColumnMeta,
      cell: (info) => <span className={mono}>{info.getValue() > 0 ? format.weight(info.getValue()) : t('manager.noValue')}</span>,
    }),
    helper.accessor('plan', {
      header: t('manager.recent.plan'),
      meta: { width: '164px' } satisfies ColumnMeta,
      cell: (info) => {
        const plan = info.getValue()
        // Nút phụ cỡ nhỏ (V2.3 .btn-sm) có icon khối 3D như "Xem phương án 3D": là hành động mở màn khác, không phải chữ liên kết
        return plan ? (
          <Button variant="secondary" size="sm" asChild>
            <Link to={plannerPath(plan)} onClick={stop} aria-label={t('manager.recent.openPlanFor', { name: info.row.original.name })}>
              <Box strokeWidth={1.75} aria-hidden />
              {t('manager.recent.openPlan')}
            </Link>
          </Button>
        ) : null
      },
    }),
  ])
}

/**
 * Chuyến có ngày chạy gần nhất trong kỳ (V2): một thẻ gồm tiêu đề, số chuyến của kỳ và bảng kiểu `paper`. Bấm dòng hay tên mở chi
 * tiết chuyến, cột cuối mở phương án trong Planner.
 */
export function RecentTripsTable({ trips }: { trips: readonly DashboardTripRow[] }) {
  const t = useT()
  const format = useFormat()
  const navigate = useNavigate()
  const titleId = useId()
  const columns = useMemo(() => createColumns(t, format), [t, format])
  const rows = useMemo(() => trips.slice(0, RECENT_TRIP_LIMIT), [trips])

  return (
    // flex-none: con overflow-hidden của cột flex bị co về 0 (AGENTS mục 5, "Cuộn trong khung ứng dụng")
    <section aria-labelledby={titleId} className="relative flex flex-none flex-col overflow-hidden rounded-lg border border-border bg-bg">
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={titleId} className="text-h3 font-semibold text-ink-strong">{t('manager.recent.title')}</h2>
          <p className="text-caption text-ink-3">{t('manager.recent.subtitle', { count: RECENT_TRIP_LIMIT })}</p>
        </div>
        <span className="flex-none text-body text-ink-2 tabular-nums">{t('manager.recent.count', { count: trips.length })}</span>
      </div>
      {/* Khung hẹp hơn bảng (tablet) thì cuộn ngang trong khung, không bóp cột */}
      <div className="relative overflow-x-auto border-t border-border">
        <div className="min-w-240">
          <DataTable
            data={rows}
            columns={columns}
            getRowId={(row) => row.id}
            density="roomy"
            appearance="paper"
            onRowClick={(trip) => void navigate(`/chuyen/${encodeURIComponent(trip.id)}`)}
          />
        </div>
      </div>
    </section>
  )
}
