import { Clock, MapPin, PackageCheck, TriangleAlert, Truck } from 'lucide-react'
import { KpiTile } from '@/components/KpiTile'
import { useFormat, useT } from '@/lib/i18n'
import type { TripReport } from '@/lib/mock-db'
import { formatDuration, formatTimeRange } from './trip-report-format'

/**
 * Năm ô số liệu của báo cáo chuyến (LM-104): điểm giao đã xong, kiện đã giao, sự cố, thời gian xếp, thời gian giao. Mỗi ô một dòng
 * nói số đến từ đâu (mục 6 "Không bịa số"); thời lượng thiếu mốc hiện "—" kèm lý do.
 */
export function TripReportKpis({ report }: { report: TripReport }) {
  const t = useT()
  const format = useFormat()
  const doneStops = report.stops.filter((stop) => stop.completedAt !== null).length
  const { times, durations, packages } = report
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 print:grid-cols-5">
      <KpiTile
        icon={MapPin}
        tone="blue"
        label={t('tripReport.kpi.stops')}
        value={`${format.integer(doneStops)} / ${format.integer(report.stops.length)}`}
        note={t('tripReport.kpi.stopsNote')}
      />
      <KpiTile
        icon={PackageCheck}
        tone="green"
        label={t('tripReport.kpi.delivered')}
        value={`${format.integer(packages.delivered)} / ${format.integer(packages.planned - packages.missing)}`}
        note={t('tripReport.kpi.deliveredNote')}
      />
      <KpiTile
        icon={TriangleAlert}
        tone="amber"
        label={t('tripReport.kpi.issues')}
        value={format.integer(report.issues.length)}
        note={t('tripReport.kpi.issuesNote', { count: packages.withIssue })}
      />
      <KpiTile
        icon={Clock}
        tone="slate"
        label={t('tripReport.kpi.loadingTime')}
        value={formatDuration(durations.loadingMs, t, format)}
        note={formatTimeRange(times.loadingStartedAt, times.loadingCompletedAt, t, format)}
      />
      <KpiTile
        icon={Truck}
        tone="slate"
        label={t('tripReport.kpi.deliveryTime')}
        value={formatDuration(durations.deliveryMs, t, format)}
        note={formatTimeRange(times.deliveryStartedAt, times.deliveryCompletedAt, t, format)}
      />
    </div>
  )
}
