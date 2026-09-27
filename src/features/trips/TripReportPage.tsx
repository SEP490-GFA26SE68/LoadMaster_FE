import { FileText } from 'lucide-react'
import { useParams } from 'react-router'
import { ScreenShell } from '@/components/ScreenShell'
import { useT } from '@/lib/i18n'
import { useTripReportQuery } from './useTripExtrasQuery'

/**
 * Báo cáo chuyến `/chuyen/:tripId/bao-cao` (luồng 5, LM-104). Khung màn: tóm tắt kiện đã giao / kiện trong phương án và số sự cố từ
 * tiến độ thật của chuyến; bảng điểm giao, thời gian và seal dựng tiếp.
 */
export function TripReportPage() {
  const t = useT()
  const { tripId = '' } = useParams()
  const query = useTripReportQuery(tripId)
  const report = query.data?.report
  return (
    <ScreenShell
      title={t('tripReport.title')}
      meta={tripId}
      description={t('pageHero.tripReport')}
      icon={FileText}
      loading={query.isPending}
      error={query.error}
      summary={
        report === undefined ? undefined
          : report.completed ? t('tripReport.summary', { delivered: report.packages.delivered, planned: report.packages.planned, issues: report.issues.length })
            : t('tripReport.notCompleted')
      }
    />
  )
}
