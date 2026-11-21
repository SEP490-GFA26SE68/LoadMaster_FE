import { Card, CardBody, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { formatCoordinate } from '@/components/map'
import { useFormat, useT } from '@/lib/i18n'
import { SourceTag } from './monitoring-chips'
import { MONITORING_HISTORY_PAGE_SIZE } from './monitoring-view'
import { MonitoringPager, usePagedItems } from './MonitoringPager'
import { useLocationHistoryQuery } from './useMonitoringQuery'

/**
 * Lịch sử vị trí của chuyến đang chọn (FE-6-10): các điểm vị trí kho đã ghi — giờ, toạ độ, tốc độ, nguồn — mới nhất trước, sáu điểm mỗi
 * trang cho khung cao bằng card sự cố cạnh nó.
 */
export function LocationHistory({ tripId }: { tripId: string }) {
  const t = useT()
  const format = useFormat()
  const points = useLocationHistoryQuery(tripId).data ?? []
  const newestFirst = points.toReversed()
  const page = usePagedItems(newestFirst, MONITORING_HISTORY_PAGE_SIZE)
  return (
    <Card className="flex h-full min-h-0 min-w-0 flex-col">
      <CardHeader>
        <CardTitle>{t('monitoring.panel.history.title')}</CardTitle>
        <CardMeta>{t('monitoring.panel.history.count', { count: points.length })}</CardMeta>
      </CardHeader>
      <CardBody className="flex min-h-0 flex-1 flex-col">
        {page.items.length === 0 ? (
          <p className="m-0 text-small text-ink-3">{t('monitoring.panel.history.empty')}</p>
        ) : (
          <table className="w-full border-collapse text-small">
            <caption className="pb-2 text-left text-note text-ink-3">{t('monitoring.panel.history.latest')}</caption>
            <thead>
              <tr className="border-b border-border text-left text-caption text-ink-2">
                <th scope="col" className="py-1.5 pr-2 font-semibold">{t('monitoring.panel.history.columns.time')}</th>
                <th scope="col" className="px-2 py-1.5 font-semibold">{t('monitoring.panel.history.columns.position')}</th>
                <th scope="col" className="px-2 py-1.5 text-right font-semibold">{t('monitoring.panel.history.columns.speed')}</th>
                <th scope="col" className="py-1.5 pl-2 font-semibold">{t('monitoring.panel.history.columns.source')}</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((point) => (
                <tr key={`${point.recordedAt}:${point.source}`} className="border-b border-line-soft last:border-b-0">
                  <td className="py-1.5 pr-2 font-mono text-ink-1 tabular-nums">{format.time(point.recordedAt)}</td>
                  <td className="px-2 py-1.5 font-mono text-ink-1 tabular-nums">{formatCoordinate(point.lat)}, {formatCoordinate(point.lng)}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-ink-1 tabular-nums">{t('monitoring.panel.history.speed', { speed: format.integer(point.speedKmh) })}</td>
                  <td className="py-1.5 pl-2"><SourceTag source={point.source} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardBody>
      <MonitoringPager
        pageIndex={page.pageIndex}
        pageCount={page.pageCount}
        pageSize={page.pageSize}
        total={page.total}
        label={t('monitoring.panel.history.pagination')}
        onPageChange={page.setPageIndex}
      />
    </Card>
  )
}
