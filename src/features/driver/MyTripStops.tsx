import { CircleCheck } from 'lucide-react'
import { StopDot } from '@/components/StopChip'
import { useT } from '@/lib/i18n'
import type { MyTripStop } from './my-trips'

/**
 * Các điểm của chuyến trong thẻ "Chuyến của tôi" (V2.3 đợt 6; chỉ nhóm Đang vận chuyển và Xếp xong — chờ xuất phát): mỗi điểm một dòng
 * — số điểm trên màu điểm giao, tên, số kiện của phương án — và điểm đã hoàn tất có dấu kiểm kèm chữ cho trình đọc màn hình (trạng thái
 * không chỉ nằm ở màu hay hình). Điểm nhận dọc đường không có kiện của phương án nên ghi loại điểm thay cho số kiện.
 */
export function MyTripStops({ tripId, stops }: { tripId: string; stops: readonly MyTripStop[] }) {
  const t = useT()
  if (stops.length === 0) return null
  return (
    <ol aria-label={t('driver.list.stopsLabel', { tripId })} className="m-0 flex list-none flex-col border-t border-line-soft p-0">
      {stops.map((stop) => (
        <li key={stop.number} data-state={stop.done ? 'done' : 'waiting'} className="flex min-h-14 items-center gap-3 border-b border-line-soft py-2 last:border-b-0">
          <StopDot stop={stop.number} />
          <span className="min-w-0 flex-1 font-medium text-pretty text-ink-strong">
            <span className="sr-only">{t('common.stop', { number: stop.number })} · </span>
            {stop.name}
          </span>
          <span className="flex-none font-medium text-ink-2">
            {stop.kind === 'PICKUP' ? t('driver.stopKinds.PICKUP') : t('common.packageCount', { count: stop.packageCount })}
          </span>
          {stop.done ? (
            <span className="flex-none text-badge-success-fg">
              <CircleCheck className="size-5" strokeWidth={2} aria-hidden />
              <span className="sr-only">{t('driver.stopList.state.done')}</span>
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
