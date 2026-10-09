import { Navigation, Phone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { StopDelivery } from './driver-plan'

/**
 * Điểm giao đang tới (V2.3 đợt 6): tên (Archivo), địa chỉ, người nhận và số điện thoại; dưới là hai nút phụ 56px **icon kèm chữ** — "Gọi"
 * (`tel:`, chỉ khi điểm có số — D-46) và "Chỉ đường" (mở bản đồ). Tên truy cập của nút vẫn đủ ("Gọi {tên}", "Chỉ đường tới {điểm}"). Cả hai
 * secondary: nút primary duy nhất của màn là hành động ở chân màn (mục 5).
 */
export function StopContactCard({ stop }: { stop: StopDelivery }) {
  const t = useT()
  return (
    <div className="flex flex-none flex-col gap-3 rounded-lg border border-border bg-bg p-4 shadow-card">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-display text-h2 leading-6.5 font-bold text-ink-strong font-stretch-106%">{stop.name}</span>
        <span className="leading-5.5 text-pretty text-ink-2">{stop.address}</span>
        {stop.phone ? (
          <span className="leading-5.5 text-ink-2">
            {stop.contactName ? t('driver.contact', { name: stop.contactName, phone: stop.phone }) : stop.phone}
          </span>
        ) : null}
      </div>
      <div className={cn('grid gap-2', stop.phone ? 'grid-cols-2' : 'grid-cols-1')}>
        {stop.phone ? (
          <Button variant="secondary" size="touch" aria-label={t('driver.call', { name: stop.contactName ?? stop.name })} asChild>
            <a href={`tel:${stop.phone.replace(/\s+/g, '')}`}>
              <Phone strokeWidth={2} />
              {t('driver.callLabel')}
            </a>
          </Button>
        ) : null}
        <Button variant="secondary" size="touch" aria-label={t('driver.directions', { name: stop.name })} asChild>
          <a href={`https://maps.google.com/?q=${encodeURIComponent(stop.address)}`} target="_blank" rel="noreferrer">
            <Navigation strokeWidth={2} />
            {t('driver.directionsLabel')}
          </a>
        </Button>
      </div>
    </div>
  )
}
