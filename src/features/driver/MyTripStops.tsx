import { CircleCheck } from 'lucide-react'
import { StopDot } from '@/components/StopChip'
import { useT } from '@/lib/i18n'
import type { MyTripRow } from './my-trips'
import { stopListTimings } from './stop-timing'
import { EtaSourceLine, StopListTime } from './StopTimingParts'
import { useDriverTripMonitoringQuery } from './useDriverQueries'

/**
 * Các điểm của chuyến trong thẻ "Chuyến của tôi" (V2.3 đợt 6; chỉ nhóm Đang vận chuyển và Xếp xong — chờ xuất phát): mỗi điểm một dòng
 * — số điểm trên màu điểm giao, tên, số kiện của phương án — và điểm đã hoàn tất có dấu kiểm kèm chữ cho trình đọc màn hình (trạng thái
 * không chỉ nằm ở màu hay hình). Điểm nhận dọc đường không có kiện của phương án nên ghi loại điểm thay cho số kiện.
 *
 * Điểm chưa hoàn tất có thêm dòng giờ dưới tên (`stopListTimings`, cùng luật với thẻ liên hệ của màn điểm giao): "Dự kiến HH:mm" — chuyến Đang
 * vận chuyển tính từ vị trí xe, đọc lại theo nhịp kho trả; chuyến xếp xong theo tuyến đã tối ưu — hoặc "Đã đến HH:mm", kèm mức hạn bằng chữ khi
 * điểm có hạn. Dưới danh sách một dòng nguồn kèm MOCK RESULT. Chuyến chưa tối ưu tuyến thì không có giờ nào.
 */
export function MyTripStops({ row }: { row: Pick<MyTripRow, 'id' | 'status' | 'stops' | 'schedule'> }) {
  const t = useT()
  const delivering = row.status === 'IN_TRANSIT'
  const live = useDriverTripMonitoringQuery(row.id, delivering && row.schedule.routePlan !== undefined)
  const { byStop, sources } = stopListTimings(row.schedule, delivering ? live.data : undefined)
  return (
    <>
      <ol aria-label={t('driver.list.stopsLabel', { tripId: row.id })} className="m-0 flex list-none flex-col border-t border-line-soft p-0">
        {row.stops.map((stop) => {
          const timing = byStop.get(stop.number)
          return (
            <li
              key={stop.number}
              data-state={stop.done ? 'done' : 'waiting'}
              className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-line-soft py-2 last:border-b-0"
            >
              <StopDot stop={stop.number} />
              <span className="min-w-0 font-medium text-pretty text-ink-strong">
                <span className="sr-only">{t('common.stop', { number: stop.number })} · </span>
                {stop.name}
              </span>
              <span className="flex items-center gap-3 font-medium text-ink-2">
                {stop.kind === 'PICKUP' ? t('driver.stopKinds.PICKUP') : t('common.packageCount', { count: stop.packageCount })}
                {stop.done ? (
                  <span className="text-badge-success-fg">
                    <CircleCheck className="size-5" strokeWidth={2} aria-hidden />
                    <span className="sr-only">{t('driver.stopList.state.done')}</span>
                  </span>
                ) : null}
              </span>
              {timing ? <StopListTime timing={timing} className="col-start-2 col-end-4" /> : null}
            </li>
          )
        })}
      </ol>
      <EtaSourceLine sources={sources} />
    </>
  )
}
