import { MapPin, PackagePlus } from 'lucide-react'
import { StopDot } from '@/components/StopChip'
import { useT } from '@/lib/i18n'
import type { Trip } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import type { StopDelivery } from './driver-plan'
import { stopListTimings } from './stop-timing'
import { EtaSourceLine, StopListTime } from './StopTimingParts'
import { useDriverTripMonitoringQuery } from './useDriverQueries'

/**
 * Danh sách các điểm của chuyến trên màn tài xế (FE-7-05): mỗi điểm một dòng gồm số điểm có màu điểm giao, **biểu tượng và chữ** nói loại
 * điểm — điểm nhận dọc đường dùng biểu tượng gói hàng và chữ "Điểm nhận hàng", điểm giao dùng ghim và chữ "Điểm giao hàng" —, tên điểm
 * và trạng thái (đã xong / đang ở điểm này / chưa tới). Thu gọn sẵn trong một dòng 56px để không chiếm màn; mở ra khi cần xem cả tuyến. Màn chỉ
 * vẽ nó khi chuyến có điểm nhận dọc đường — chuyến chỉ có điểm giao không cần thêm một danh sách nữa. Điểm chưa xong có dòng giờ như thẻ
 * "Chuyến của tôi" ("Dự kiến HH:mm" hoặc "Đã đến HH:mm", mức hạn bằng chữ — `stopListTimings`), cuối danh sách một dòng nguồn kèm MOCK RESULT.
 */
export function DriverStopList({ trip, delivering, stops, currentNumber, completedStops }: {
  trip: Pick<Trip, 'id' | 'stops' | 'routePlan' | 'delivery'>
  /** Chuyến Đang vận chuyển: giờ đến dự kiến tính từ vị trí xe. */
  delivering: boolean
  stops: readonly StopDelivery[]
  currentNumber: number
  completedStops: ReadonlySet<number>
}) {
  const t = useT()
  const live = useDriverTripMonitoringQuery(trip.id, delivering && trip.routePlan !== undefined)
  const { byStop, sources } = stopListTimings(trip, delivering ? live.data : undefined)
  return (
    <details className="group flex-none rounded-lg border border-border bg-bg shadow-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 rounded-lg px-4 font-display font-[650] text-ink-strong outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        {t('driver.stopList.summary', { count: stops.length })}
      </summary>
      <ol aria-label={t('driver.stopList.label')} className="m-0 flex list-none flex-col border-t border-line-soft p-0">
        {stops.map((stop) => {
          const pickup = stop.kind === 'PICKUP'
          const Icon = pickup ? PackagePlus : MapPin
          const state = completedStops.has(stop.number) ? 'done' : stop.number === currentNumber ? 'current' : 'waiting'
          const timing = byStop.get(stop.number)
          return (
            <li
              key={stop.number}
              data-stop-kind={stop.kind ?? 'DELIVERY'}
              data-state={state}
              className={cn('grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-line-soft px-4 py-2 last:border-b-0', state === 'current' && 'bg-cyan-50')}
            >
              <StopDot stop={stop.number} />
              <div className="flex min-w-0 flex-col">
                <span className="text-body-lg font-medium text-ink-strong">{stop.name}</span>
                <span className="inline-flex items-center gap-1.5 text-body-lg text-ink-2">
                  <Icon className="size-4 flex-none" strokeWidth={2} aria-hidden />
                  {t(`driver.stopKinds.${stop.kind ?? 'DELIVERY'}`)}
                </span>
              </div>
              <span className="text-body-lg text-ink-3">{t(`driver.stopList.state.${state}`)}</span>
              {timing ? <StopListTime timing={timing} className="col-start-2 col-end-4" /> : null}
            </li>
          )
        })}
      </ol>
      <EtaSourceLine sources={sources} className="border-t border-line-soft px-4 py-3" />
    </details>
  )
}
