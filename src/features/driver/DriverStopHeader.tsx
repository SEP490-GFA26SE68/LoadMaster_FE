import { LanguageSwitch } from '@/components/LanguageSwitch'
import { StopDot } from '@/components/StopChip'
import { TouchTopBar } from '@/components/TouchTopBar'
import { ExitIconButton } from '@/features/auth/ExitControl'
import { useT } from '@/lib/i18n'
import { stopColor } from '@/lib/stops'
import { cn } from '@/lib/utils'
import type { StopDelivery } from './driver-plan'

/** Đường dẫn các màn trong một chuyến của tài xế: khác màn chính `/tai-xe` nên tài xế thoát là về danh sách (`exitAction`). */
export const DRIVER_TRIP_SCREEN = '/tai-xe/diem-giao'

/**
 * Thanh trên của màn điểm giao (dải trời, điều khiển đặc — V2.3 đợt 6): lối về danh sách chuyến (56px), số điểm có màu điểm giao kèm số
 * (mục 10), nút chuyển ngôn ngữ, và dải tiến độ theo điểm nằm trong dải trời — điểm đã hoàn tất màu cyan, điểm hiện tại màu của điểm,
 * điểm chưa tới nền tối. Dải chỉ để nhìn (`aria-hidden`): chữ "Điểm n / N" nói đủ.
 */
export function DriverStopHeader({ stop, stops, completedStops }: {
  stop: Pick<StopDelivery, 'number'>
  stops: readonly Pick<StopDelivery, 'number'>[]
  completedStops: ReadonlySet<number>
}) {
  const t = useT()
  return (
    <TouchTopBar
      leading={<ExitIconButton tone="sky" screenHome={DRIVER_TRIP_SCREEN} contextual="/tai-xe" label={t('driver.toTrips')} iconClassName="size-7" />}
      trailing={<LanguageSwitch size="touch" tone="sky" className="flex-none [&>svg]:hidden min-[400px]:[&>svg]:block" />}
      below={
        <div className="flex gap-1.5" aria-hidden>
          {stops.map(({ number }) => (
            <span
              key={number}
              className={cn('h-2 flex-1 rounded-full', completedStops.has(number) ? 'bg-cyan-300' : number !== stop.number && 'bg-white/20')}
              style={number === stop.number && !completedStops.has(number) ? { background: stopColor(number) } : undefined}
            />
          ))}
        </div>
      }
    >
      <StopDot stop={stop.number} className="size-9 text-h3" />
      <h1 className="min-w-0 font-display text-h2 leading-7 font-bold whitespace-nowrap text-sky-text font-stretch-106%">{t('driver.stopTitle', { number: stop.number, total: stops.length })}</h1>
    </TouchTopBar>
  )
}
