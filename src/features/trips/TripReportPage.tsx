import { Printer, RotateCcw } from 'lucide-react'
import { useMemo } from 'react'
import { useParams } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { Banner } from '@/components/Banner'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { TripReportData } from './trip-extras-api'
import { packageNames } from './trip-report-format'
import { TripReportIncidents, TripReportManualConfirms, TripReportVerifications } from './TripReportFlow'
import { TripReportInfo } from './TripReportInfo'
import { TripReportKpis } from './TripReportKpis'
import { TripReportPrint, usePrinting } from './TripReportPrint'
import { TripReportIssues, TripReportStops } from './TripReportTables'
import { useTripReportQuery } from './useTripExtrasQuery'

/**
 * Báo cáo chuyến `/chuyen/:tripId/bao-cao` (luồng 5 Review 1, LM-104; luồng mới FE-6-14) cho điều phối viên và quản lý công ty. Mọi
 * số suy từ tiến độ kho và giao hàng ghi trong kho (`tripReport`): năm ô số liệu, bảng theo điểm giao (giờ đến dự kiến và thật, mức
 * hạn, kiện hoàn trả), thông tin chuyến (xe, tài xế, số seal, lý do chở chung khác loại hàng, mốc giờ), cách đối chiếu kiện, sự cố cấp
 * chuyến và tuyến đã đổi, xác nhận tay kèm người duyệt, sự cố giao hàng. Chuyến chưa hoàn thành vẫn mở được, kèm banner nói báo cáo
 * chưa đủ; chuyến đã huỷ có banner nói lúc huỷ và lý do. "In báo cáo" in một bản phẳng không có khung ứng dụng (`TripReportPrint`).
 */
export function TripReportPage() {
  const t = useT()
  const { tripId = '' } = useParams()
  const query = useTripReportQuery(tripId)
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
    body = <TripReportBody data={query.data} />
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap={query.isSuccess}
        title={t('tripReport.title')}
        meta={tripId}
        description={t('pageHero.tripReport')}
        back={{ to: `/chuyen/${tripId}`, label: t('tripReport.back') }}
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
          <PrintHeading tripId={tripId} tripName={query.data.trip.name} />
          <TripReportBody data={query.data} />
        </TripReportPrint>
      ) : null}
    </div>
  )
}

function TripReportBody({ data }: { data: TripReportData }) {
  const t = useT()
  const format = useFormat()
  const packageName = useMemo(() => packageNames(data.trip.packages), [data.trip.packages])
  const { report, userNames } = data
  const { cancellation } = report
  return (
    <div className="flex flex-col gap-4">
      <TripReportKpis report={report} />
      {cancellation ? (
        <Banner tone="warning">
          {t(cancellation.fromPhase === 'delivering' ? 'tripReport.cancelledInTransit' : 'tripReport.cancelled', {
            time: format.time(cancellation.at), date: format.date(cancellation.at), reason: cancellation.reason,
          })}
        </Banner>
      ) : report.completed ? null : <Banner tone="info">{t('tripReport.notCompleted')}</Banner>}
      <TripReportStops report={report} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] print:grid-cols-1">
        <div className="flex min-w-0 flex-col gap-4">
          <TripReportInfo data={data} />
          <TripReportVerifications report={report} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <TripReportIncidents report={report} userNames={userNames} />
          <TripReportManualConfirms report={report} userNames={userNames} packageName={packageName} />
          <TripReportIssues report={report} packageName={packageName} />
        </div>
      </div>
      <p className="m-0 text-caption text-ink-3">{t('tripReport.mock')}</p>
    </div>
  )
}

/** Đầu trang in: tiêu đề, mã và tên chuyến, giờ in. */
function PrintHeading({ tripId, tripName }: { tripId: string; tripName: string }) {
  const t = useT()
  const format = useFormat()
  const now = new Date()
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-3">
      {/* Logo một màu đầu trang in (LM-105): in đen trắng vẫn rõ */}
      <div className="flex items-center justify-between gap-4">
        <Logo tone="mono" size="sm" tagline className="text-ink-strong" />
        <p className="m-0 text-caption text-ink-3">{t('tripReport.printedAt', { time: format.time(now), date: format.date(now) })}</p>
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-h1 font-bold">{t('tripReport.title')} <span className="font-mono">{tripId}</span></h1>
        <p className="m-0 text-body text-ink-2">{tripName}</p>
      </div>
    </header>
  )
}
