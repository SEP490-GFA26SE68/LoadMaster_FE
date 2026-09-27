import { createColumnHelper } from '@tanstack/react-table'
import { useMemo } from 'react'
import { DataTable, type BaseTableFeatures, type ColumnMeta } from '@/components/DataTable'
import { Card, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { Formatter } from '@/lib/format'
import { useFormat, useT, type MessageKey, type TFunction } from '@/lib/i18n'
import type { DeliveryIssue, TripReport, TripReportStop } from '@/lib/mock-db'
import { stopColor, stopForeground } from '@/lib/stops'

const stopHelper = createColumnHelper<BaseTableFeatures, TripReportStop>()
const issueHelper = createColumnHelper<BaseTableFeatures, IssueRow>()
const mono = 'font-mono text-caption text-ink-1 tabular-nums'

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
        <span className="line-clamp-2 font-medium text-ink-strong">{stop.name}</span>
        <span className="line-clamp-1 text-caption text-ink-3">{stop.address}</span>
      </span>
    </span>
  )
}

function stopColumns(t: TFunction, format: Formatter) {
  const count = (id: 'planned' | 'unloaded' | 'qrConfirmed' | 'issues', header: MessageKey) =>
    stopHelper.accessor(id, {
      header: t(header),
      meta: { align: 'right', width: '96px' } satisfies ColumnMeta,
      cell: (info) => <span className={mono}>{format.integer(info.getValue())}</span>,
    })
  return stopHelper.columns([
    stopHelper.display({ id: 'stop', header: t('tripReport.stops.stop'), cell: (info) => <StopCell stop={info.row.original} /> }),
    count('planned', 'tripReport.stops.planned'),
    count('unloaded', 'tripReport.stops.unloaded'),
    count('qrConfirmed', 'tripReport.stops.qr'),
    count('issues', 'tripReport.stops.issues'),
    stopHelper.accessor('completedAt', {
      header: t('tripReport.stops.completedAt'),
      meta: { align: 'right', width: '150px' } satisfies ColumnMeta,
      cell: (info) => {
        const value = info.getValue()
        return value === null
          ? <span className="text-caption text-ink-3">{t('tripReport.stops.notCompleted')}</span>
          : <span className={mono}>{format.time(value)} · {format.dayMonth(value)}</span>
      },
    }),
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
              <span className="line-clamp-1 text-caption text-ink-3">{issue.packageName}</span>
            </span>
          )
      },
    }),
    issueHelper.accessor('stopNumber', {
      header: t('tripReport.issues.stop'),
      cell: (info) => <span className="line-clamp-2 whitespace-normal">{t('common.stop', { number: info.getValue() })} · {info.row.original.stopName}</span>,
    }),
    issueHelper.accessor('note', {
      header: t('tripReport.issues.note'),
      cell: (info) => <span className="line-clamp-2 whitespace-normal text-ink-2">{info.getValue()}</span>,
    }),
    issueHelper.accessor('at', {
      header: t('tripReport.issues.at'),
      meta: { align: 'right', width: '130px' } satisfies ColumnMeta,
      cell: (info) => <span className={mono}>{format.time(info.getValue())} · {format.dayMonth(info.getValue())}</span>,
    }),
  ])
}

/** Bảng theo điểm giao của báo cáo chuyến (LM-104): kế hoạch / đã dỡ / quét QR / sự cố / giờ hoàn tất, đọc từ tiến độ giao. */
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
      <DataTable data={report.stops} columns={columns} getRowId={(stop) => String(stop.number)} density="roomy" appearance="paper" />
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
