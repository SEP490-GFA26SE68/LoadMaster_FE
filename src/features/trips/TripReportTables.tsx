import { createColumnHelper } from '@tanstack/react-table'
import { useMemo } from 'react'
import { DataTable, type BaseTableFeatures, type ColumnMeta } from '@/components/DataTable'
import { Card, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import type { DeadlineStatus } from '@/domain/routing'
import type { Formatter } from '@/lib/format'
import { useFormat, useT, type MessageKey, type TFunction } from '@/lib/i18n'
import type { DeliveryIssue, TripReport, TripReportStop } from '@/lib/mock-db'
import { stopColor, stopForeground } from '@/lib/stops'

const stopHelper = createColumnHelper<BaseTableFeatures, TripReportStop>()
const issueHelper = createColumnHelper<BaseTableFeatures, IssueRow>()
const mono = 'font-mono text-caption text-ink-1 tabular-nums'
const DEADLINE_TONE: Readonly<Record<DeadlineStatus, BadgeTone>> = { OK: 'success', AT_RISK: 'warning', MISSED: 'danger' }

type IssueRow = DeliveryIssue & { readonly packageName: string; readonly stopName: string }

function StopCell({ stop }: { stop: TripReportStop }) {
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
        <span className="line-clamp-2 font-medium text-ink-strong print:line-clamp-none">{stop.name}</span>
        <span className="line-clamp-1 text-caption text-ink-3 print:line-clamp-none">{stop.address}</span>
      </span>
    </span>
  )
}

/** Hạn giao của điểm kèm mức hạn: đã đến thì so giờ đến thật với hạn, chưa đến thì mức hạn theo giờ đến dự kiến của tuyến. */
function DeadlineCell({ stop }: { stop: TripReportStop }) {
  const t = useT()
  const format = useFormat()
  if (stop.deadline === null) return <span className="text-caption text-ink-3">{t('tripReport.stops.noDeadline')}</span>
  return (
    <span className="flex flex-col items-end gap-1">
      <span className={mono}>{format.time(stop.deadline)} · {format.dayMonth(stop.deadline)}</span>
      {stop.arrivedOnTime !== null ? (
        <Badge shape="tag" tone={stop.arrivedOnTime ? 'success' : 'danger'}>{t(stop.arrivedOnTime ? 'tripReport.stops.onTime' : 'tripReport.stops.late')}</Badge>
      ) : stop.plannedStatus !== null ? (
        <Badge shape="tag" tone={DEADLINE_TONE[stop.plannedStatus]}>{t(`common.deadlineStatuses.${stop.plannedStatus}`)}</Badge>
      ) : null}
    </span>
  )
}

function stopColumns(t: TFunction, format: Formatter) {
  const count = (id: 'planned' | 'unloaded' | 'returned' | 'issues', header: MessageKey) =>
    stopHelper.accessor(id, {
      header: t(header),
      meta: { align: 'right', width: '84px' } satisfies ColumnMeta,
      cell: (info) => <span className={mono}>{format.integer(info.getValue())}</span>,
    })
  const moment = (id: 'plannedEta' | 'arrivedAt' | 'completedAt', header: MessageKey, missing: MessageKey) =>
    stopHelper.accessor(id, {
      header: t(header),
      meta: { align: 'right', width: '124px' } satisfies ColumnMeta,
      cell: (info) => {
        const value = info.getValue()
        return value === null
          ? <span className="text-caption text-ink-3">{t(missing)}</span>
          : <span className={mono}>{format.time(value)} · {format.dayMonth(value)}</span>
      },
    })
  return stopHelper.columns([
    stopHelper.display({ id: 'stop', header: t('tripReport.stops.stop'), cell: (info) => <StopCell stop={info.row.original} /> }),
    count('planned', 'tripReport.stops.planned'),
    count('unloaded', 'tripReport.stops.unloaded'),
    count('returned', 'tripReport.stops.returned'),
    count('issues', 'tripReport.stops.issues'),
    moment('plannedEta', 'tripReport.stops.plannedEta', 'tripReport.stops.noEta'),
    moment('arrivedAt', 'tripReport.stops.arrivedAt', 'tripReport.stops.notArrived'),
    stopHelper.display({
      id: 'deadline',
      header: t('tripReport.stops.deadline'),
      meta: { align: 'right', width: '136px' } satisfies ColumnMeta,
      cell: (info) => <DeadlineCell stop={info.row.original} />,
    }),
    moment('completedAt', 'tripReport.stops.completedAt', 'tripReport.stops.notCompleted'),
  ])
}

function issueColumns(t: TFunction, format: Formatter) {
  return issueHelper.columns([
    issueHelper.accessor('kind', {
      header: t('tripReport.issues.kind'),
      meta: { width: '150px' } satisfies ColumnMeta,
      cell: (info) => <Badge tone="warning">{t(`common.deliveryIssueKinds.${info.getValue()}`)}</Badge>,
    }),
    issueHelper.display({
      id: 'package',
      header: t('tripReport.issues.package'),
      cell: (info) => {
        const issue = info.row.original
        return issue.packageInstanceId === undefined
          ? <span className="text-ink-2">{t('tripReport.issues.wholeStop')}</span>
          : (
            <span className="flex min-w-0 flex-col whitespace-normal">
              <span className="font-mono text-caption font-semibold text-ink-strong">{issue.packageInstanceId}</span>
              <span className="line-clamp-1 text-caption text-ink-3 print:line-clamp-none">{issue.packageName}</span>
            </span>
          )
      },
    }),
    issueHelper.accessor('stopNumber', {
      header: t('tripReport.issues.stop'),
      cell: (info) => <span className="line-clamp-2 whitespace-normal print:line-clamp-none">{t('common.stop', { number: info.getValue() })} · {info.row.original.stopName}</span>,
    }),
    issueHelper.accessor('note', {
      header: t('tripReport.issues.note'),
      cell: (info) => <span className="line-clamp-2 whitespace-normal text-ink-2 print:line-clamp-none">{info.getValue()}</span>,
    }),
    issueHelper.accessor('at', {
      header: t('tripReport.issues.at'),
      meta: { align: 'right', width: '130px' } satisfies ColumnMeta,
      cell: (info) => <span className={mono}>{format.time(info.getValue())} · {format.dayMonth(info.getValue())}</span>,
    }),
  ])
}

/**
 * Bảng theo điểm giao của báo cáo chuyến (LM-104, FE-6-14): kế hoạch / đã dỡ / hoàn trả / sự cố, giờ đến dự kiến của tuyến và giờ đến
 * thật, hạn giao kèm mức hạn, giờ hoàn tất — đọc từ tuyến đã tối ưu và tiến độ giao. Bảng rộng hơn thẻ thì cuộn ngang trong thẻ.
 */
export function TripReportStops({ report }: { report: TripReport }) {
  const t = useT()
  const format = useFormat()
  const columns = useMemo(() => stopColumns(t, format), [t, format])
  return (
    <Card className="flex-none overflow-hidden print:break-inside-avoid print:shadow-none">
      <CardHeader>
        <CardTitle as="h2">{t('tripReport.stops.title')}</CardTitle>
        <CardMeta>{format.integer(report.stops.length)}</CardMeta>
      </CardHeader>
      <div className="relative overflow-x-auto print:overflow-visible">
        <div className="min-w-245 print:min-w-0">
          <DataTable data={report.stops} columns={columns} getRowId={(stop) => String(stop.number)} density="spacious" appearance="paper" />
        </div>
      </div>
    </Card>
  )
}

/** Sự cố tài xế báo trong chuyến: loại, kiện, điểm giao, ghi chú (giữ nguyên chữ người nhập), giờ ghi. */
export function TripReportIssues({ report, packageName }: { report: TripReport; packageName: (instanceId: string) => string }) {
  const t = useT()
  const format = useFormat()
  const columns = useMemo(() => issueColumns(t, format), [t, format])
  const rows = useMemo(
    () => report.issues.map((issue): IssueRow => ({
      ...issue,
      packageName: issue.packageInstanceId === undefined ? '' : packageName(issue.packageInstanceId),
      stopName: report.stops.find((stop) => stop.number === issue.stopNumber)?.name ?? '',
    })),
    [report, packageName],
  )
  return (
    <Card className="flex-none overflow-hidden print:break-inside-avoid print:shadow-none">
      <CardHeader>
        <CardTitle as="h2">{t('tripReport.issues.title')}</CardTitle>
        <CardMeta>{format.integer(rows.length)}</CardMeta>
      </CardHeader>
      <DataTable data={rows} columns={columns} getRowId={(issue) => issue.id} density="roomy" appearance="paper" emptyMessage={t('tripReport.issues.none')} />
    </Card>
  )
}
