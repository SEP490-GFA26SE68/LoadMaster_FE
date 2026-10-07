import { MapPin, PackagePlus } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { stopColor, stopForeground } from '@/lib/stops'
import { cn } from '@/lib/utils'
import type { StopDelivery } from './driver-plan'

/**
 * Danh sách các điểm của chuyến trên màn tài xế (FE-7-05): mỗi điểm một dòng gồm số điểm có màu điểm giao, **biểu tượng và chữ** nói loại
 * điểm — điểm nhận dọc đường dùng biểu tượng gói hàng và chữ "Điểm nhận hàng", điểm giao dùng ghim và chữ "Điểm giao hàng" —, tên điểm
 * và trạng thái (đã xong / đang ở điểm này / chưa tới). Thu gọn sẵn trong một dòng 56px để không chiếm màn; mở ra khi cần xem cả tuyến. Màn chỉ
 * vẽ nó khi chuyến có điểm nhận dọc đường — chuyến chỉ có điểm giao không cần thêm một danh sách nữa.
 */
export function DriverStopList({ stops, currentNumber, completedStops }: {
  stops: readonly StopDelivery[]
  currentNumber: number
  completedStops: ReadonlySet<number>
}) {
  const t = useT()
  return (
    <details className="group flex-none rounded-md border border-border bg-bg">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 rounded-md px-4 font-medium outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        {t('driver.stopList.summary', { count: stops.length })}
      </summary>
      <ol aria-label={t('driver.stopList.label')} className="m-0 flex list-none flex-col border-t border-border p-0">
        {stops.map((stop) => {
          const pickup = stop.kind === 'PICKUP'
          const Icon = pickup ? PackagePlus : MapPin
          const state = completedStops.has(stop.number) ? 'done' : stop.number === currentNumber ? 'current' : 'waiting'
          return (
            <li key={stop.number} data-stop-kind={stop.kind ?? 'DELIVERY'} data-state={state} className={cn('flex min-h-14 items-center gap-3 border-b border-border px-4 py-2 last:border-b-0', state === 'current' && 'bg-primary-bg')}>
              <span
                className="grid size-8 flex-none place-items-center rounded-full font-mono text-body-lg font-semibold leading-none"
                style={{ background: stopColor(stop.number), color: stopForeground(stop.number) }}
              >
                {stop.number}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-body-lg font-medium text-text">{stop.name}</span>
                <span className="inline-flex items-center gap-1.5 text-body-lg text-text-2">
                  <Icon className="size-4 flex-none" strokeWidth={2} aria-hidden />
                  {t(`driver.stopKinds.${stop.kind ?? 'DELIVERY'}`)}
                </span>
              </div>
              <span className="flex-none text-body-lg text-text-3">{t(`driver.stopList.state.${state}`)}</span>
            </li>
          )
        })}
      </ol>
    </details>
  )
}
