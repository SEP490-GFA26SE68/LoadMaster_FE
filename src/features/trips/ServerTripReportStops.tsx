import { createColumnHelper } from '@tanstack/react-table'
import { useMemo } from 'react'
import { DataTable, type BaseTableFeatures, type ColumnMeta } from '@/components/DataTable'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Card, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import type { DeadlineStatus } from '@/domain/routing'
import type { Formatter } from '@/lib/format'
import { useFormat, useT, type MessageKey, type TFunction } from '@/lib/i18n'
import { stopColor, stopForeground } from '@/lib/stops'
import type { ServerReportStop } from './server-trip-report-api'

const helper = createColumnHelper<BaseTableFeatures, ServerReportStop>()
const mono = 'font-mono text-caption text-ink-1 tabular-nums'
const DEADLINE_TONE: Readonly<Record<DeadlineStatus, BadgeTone>> = { OK: 'success', AT_RISK: 'warning', MISSED: 'danger' }

function StopCell({ stop }: { stop: ServerReportStop }) {
  const t = useT()
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {/* Màu điểm giao luôn kèm số (mục 10) */}
      <span
        aria-hidden
        className="grid size-6 flex-none place-items-center rounded-sm font-mono text-caption font-semibold"
        style={{ background: stopColor(stop.number), color: stopForeground(stop.number) }}
      >
        {stop.number}
      </span>
      <span className="flex min-w-0 flex-col whitespace-normal">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="line-clamp-2 font-medium text-ink-strong print:line-clamp-none">{stop.name}</span>
          {stop.pickup ? <Badge shape="tag">{t('trips.route.pickupTag')}</Badge> : null}
        </span>
        <span className="line-clamp-1 text-caption text-ink-3 print:line-clamp-none">{stop.address}</span>
      </span>
    </span>
  )
}

function DeadlineCell({ stop }: { stop: ServerReportStop }) {
  const t = useT()
  const format = useFormat()
  if (stop.deadline === null) return <span className="text-caption text-ink-3">{t('tripReport.stops.noDeadline')}</span>
  return (
    <span className="flex flex-col items-end gap-1">
      <span className={mono}>{format.time(stop.deadline)} · {format.dayMonth(stop.deadline)}</span>
      {stop.arrivedOnTime !== null ? (
        <Badge shape="tag" tone={stop.arrivedOnTime ? 'success' : 'danger'}>{t(stop.arrivedOnTime ? 'common.arrivalStatuses.onTime' : 'common.arrivalStatuses.late')}</Badge>
      ) : stop.plannedStatus !== null ? (
        <Badge shape="tag" tone={DEADLINE_TONE[stop.plannedStatus]}>{t(`common.deadlineStatuses.${stop.plannedStatus}`)}</Badge>
      ) : null}
    </span>
  )
}

function columns(t: TFunction, format: Formatter) {
  const count = (id: 'planned' | 'unloaded' | 'returned' | 'issues', header: MessageKey) =>
    helper.accessor(id, {
      header: t(header),
      meta: { align: 'right', width: '84px' } satisfies ColumnMeta,
      cell: (info) => <span className={mono}>{format.integer(info.getValue())}</span>,
    })
  const moment = (id: 'plannedEta' | 'arrivedAt', header: MessageKey, missing: MessageKey) =>
    helper.accessor(id, {
      header: t(header),
      meta: { align: 'right', width: '124px' } satisfies ColumnMeta,
      cell: (info) => {
        const value = info.getValue()
        return value === null
          ? <span className="text-caption text-ink-3">{t(missing)}</span>
          : <span className={mono}>{format.time(value)} · {format.dayMonth(value)}</span>
      },
    })
  return helper.columns([
    helper.display({ id: 'stop', header: t('tripReport.stops.stop'), cell: (info) => <StopCell stop={info.row.original} /> }),
    count('planned', 'tripReport.stops.planned'),
    count('unloaded', 'tripReport.stops.unloaded'),
    count('returned', 'tripReport.stops.returned'),
    count('issues', 'tripReport.stops.issues'),
    moment('plannedEta', 'tripReport.stops.plannedEta', 'tripReport.stops.noEta'),
    moment('arrivedAt', 'tripReport.stops.arrivedAt', 'tripReport.stops.notArrived'),
    helper.display({
      id: 'deadline',
      header: t('tripReport.stops.deadline'),
      meta: { align: 'right', width: '136px' } satisfies ColumnMeta,
      cell: (info) => <DeadlineCell stop={info.row.original} />,
    }),
    // Máy chủ chỉ trả điểm đã hoàn tất hay chưa, không trả giờ hoàn tất
    helper.accessor('completed', {
      header: t('tripReport.stops.completedAt'),
      meta: { align: 'right', width: '104px' } satisfies ColumnMeta,
      cell: (info) => (
        <span className={info.getValue() ? 'text-caption text-ink-1' : 'text-caption text-ink-3'}>
          {t(info.getValue() ? 'tripReport.server.stopDone' : 'tripReport.stops.notCompleted')}
        </span>
      ),
    }),
  ])
}

/** Bảng theo điểm của báo cáo máy chủ: như bản kho mẫu, cột Hoàn tất ghi đã xong hay chưa (máy chủ không trả giờ hoàn tất). */
export function ServerTripReportStops({ stops }: { stops: readonly ServerReportStop[] }) {
  const t = useT()
  const format = useFormat()
  const cols = useMemo(() => columns(t, format), [t, format])
  return (
    <Card className="flex-none overflow-hidden print:break-inside-avoid print:shadow-none">
      <CardHeader>
        <CardTitle as="h2">{t('tripReport.stops.title')}</CardTitle>
        <CardMeta>{format.integer(stops.length)}</CardMeta>
      </CardHeader>
      <div className="relative overflow-x-auto print:overflow-visible">
        <div className="min-w-245 print:min-w-0">
          <DataTable data={[...stops]} columns={cols} getRowId={(stop) => stop.id} density="spacious" appearance="paper" />
        </div>
      </div>
    </Card>
  )
}
