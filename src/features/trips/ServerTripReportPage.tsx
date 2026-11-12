import { MapPin, PackageCheck, Printer, RotateCcw, TriangleAlert, Clock, Truck } from 'lucide-react'
import { useParams } from 'react-router'
import { Banner } from '@/components/Banner'
import { Logo } from '@/components/brand/Logo'
import { EmptyState } from '@/components/EmptyState'
import { KpiTile } from '@/components/KpiTile'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { ServerTripReport } from './server-trip-report-api'
import { ServerTripReportIncidents, ServerTripReportInfo, ServerTripReportManualConfirms, ServerTripReportVerifications } from './ServerTripReportSections'
import { ServerTripReportStops } from './ServerTripReportStops'
import { formatDuration, formatTimeRange } from './trip-report-format'
import { TripReportPrint, usePrinting } from './TripReportPrint'
import { useServerTripReportQuery } from './useTripExtrasQuery'

/**
 * Báo cáo chuyến khi nhóm `trips` nối backend (`GET /api/trips/{mã chuyến}/report`): cùng bố cục với bản kho mẫu (`TripReportPage`) —
 * ô số liệu, bảng theo điểm, thông tin chuyến, đối chiếu, sự cố cấp chuyến, xác nhận tay — nhưng chỉ phần máy chủ trả và không MOCK
 * RESULT. Ô "Thời gian giao" chỉ khi máy chủ tính được (`deliveryMinutes`; chuyến cũ không ghi giờ xe rời kho thì không có ô). Chuyến
 * chưa có báo cáo (chưa giao, huỷ trước khi xe chạy) là câu lỗi `TRIP_REPORT_NOT_AVAILABLE` của máy chủ.
 */
export function ServerTripReportPage() {
  const t = useT()
  const { tripId = '' } = useParams()
  const query = useServerTripReportQuery(tripId)
  const printing = usePrinting()

  let body
  if (query.isPending) {
    body = <div role="status" aria-label={t('tripReport.loading')} className="flex justify-center py-16"><Spinner /></div>
  } else if (query.isError) {
    body = (
      <EmptyState
        mascot="error"
        title={dataErrorMessage(query.error, t)}
        action={
          <Button variant="secondary" onClick={() => void query.refetch()} loading={query.isFetching}>
            <RotateCcw strokeWidth={1.5} />
            {t('tripReport.retry')}
          </Button>
        }
      />
    )
  } else {
    body = <ReportBody report={query.data} />
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap={query.isSuccess}
        title={t('tripReport.title')}
        meta={tripId}
        description={t('pageHero.tripReport')}
        back={{ to: `/chuyen/${encodeURIComponent(tripId)}`, label: t('tripReport.back') }}
        actions={query.isSuccess ? (
          <Button variant="primary" onClick={() => window.print()}>
            <Printer strokeWidth={1.5} />
            {t('tripReport.print')}
          </Button>
        ) : null}
      />
      <div className={query.isSuccess ? 'sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6' : 'min-h-0 flex-1 overflow-auto px-shell py-6'}>
        {body}
      </div>
      {printing && query.isSuccess ? (
        <TripReportPrint>
          <PrintHeading report={query.data} />
          <ReportBody report={query.data} />
        </TripReportPrint>
      ) : null}
    </div>
  )
}

function ReportBody({ report }: { report: ServerTripReport }) {
  const t = useT()
  const { cancellation } = report
  return (
    <div className="flex flex-col gap-4">
      <ReportKpis report={report} />
      {cancellation ? (
        <Banner tone="warning">
          {t(cancellation.inTransit ? 'tripReport.server.cancelledInTransit' : 'tripReport.server.cancelled', { reason: cancellation.reason || '—' })}
          {cancellation.returned === null ? null : <> {t('trips.server.cancelReturned', { count: cancellation.returned })}</>}
        </Banner>
      ) : null}
      <ServerTripReportStops stops={report.stops} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] print:grid-cols-1">
        <div className="flex min-w-0 flex-col gap-4">
          <ServerTripReportInfo report={report} />
          <ServerTripReportVerifications report={report} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <ServerTripReportIncidents report={report} />
          <ServerTripReportManualConfirms report={report} />
        </div>
      </div>
      <p className="m-0 text-caption text-ink-3">{t('tripReport.server.source')}</p>
    </div>
  )
}

/** Ô số liệu: điểm đã xong, kiện đã giao trên kiện đã xếp, sự cố giao, thời gian xếp, thời gian giao. Thiếu số thì bỏ ô, không vẽ 0. */
function ReportKpis({ report }: { report: ServerTripReport }) {
  const t = useT()
  const format = useFormat()
  const done = report.stops.filter((stop) => stop.completed).length
  const issues = report.stops.reduce((sum, stop) => sum + stop.issues, 0)
  const { packages, loading } = report
  const loadingMs = loading?.startedAt && loading.completedAt ? Date.parse(loading.completedAt) - Date.parse(loading.startedAt) : null
  const five = report.deliveryMinutes !== null
  return (
    <div className={five ? 'grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 print:grid-cols-5' : 'grid grid-cols-2 gap-3 md:grid-cols-4 print:grid-cols-4'}>
      <KpiTile icon={MapPin} tone="blue" label={t('tripReport.kpi.stops')} value={`${format.integer(done)} / ${format.integer(report.stops.length)}`} note={t('tripReport.kpi.stopsNote')} />
      {packages ? (
        <KpiTile
          icon={PackageCheck}
          tone="green"
          label={t('tripReport.kpi.delivered')}
          value={`${format.integer(packages.delivered)} / ${format.integer(packages.loaded)}`}
          note={t('tripReport.kpi.deliveredNote')}
        />
      ) : null}
      <KpiTile
        icon={TriangleAlert}
        tone="amber"
        label={t('tripReport.kpi.issues')}
        value={format.integer(issues)}
        note={packages ? t('tripReport.kpi.issuesNote', { count: packages.withIssue }) : t('tripReport.server.issuesNote')}
      />
      <KpiTile
        icon={Clock}
        tone="slate"
        label={t('tripReport.kpi.loadingTime')}
        value={formatDuration(loadingMs, t, format)}
        note={formatTimeRange(loading?.startedAt ?? null, loading?.completedAt ?? null, t, format)}
      />
      {report.deliveryMinutes === null ? null : (
        <KpiTile
          icon={Truck}
          tone="slate"
          label={t('tripReport.kpi.deliveryTime')}
          value={formatDuration(report.deliveryMinutes * 60_000, t, format)}
          note={t('tripReport.server.deliveryTimeNote')}
        />
      )}
    </div>
  )
}

function PrintHeading({ report }: { report: ServerTripReport }) {
  const t = useT()
  const format = useFormat()
  const now = new Date()
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-3">
      <div className="flex items-center justify-between gap-4">
        <Logo tone="mono" size="sm" tagline className="text-ink-strong" />
        <p className="m-0 text-caption text-ink-3">{t('tripReport.printedAt', { time: format.time(now), date: format.date(now) })}</p>
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-h1 font-bold">{t('tripReport.title')} <span className="font-mono">{report.tripCode}</span></h1>
        <p className="m-0 text-body text-ink-2">{report.tripName}</p>
      </div>
    </header>
  )
}
