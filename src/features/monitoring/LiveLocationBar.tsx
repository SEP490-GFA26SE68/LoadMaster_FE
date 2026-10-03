import { Badge } from '@/components/ui/Badge'
import { useFormat, useT } from '@/lib/i18n'
import type { LocationPoint } from '@/lib/mock-db'

/**
 * Dòng nói xe đang ở đâu, đứng ngay trên bản đồ tuyến của chuyến Đang vận chuyển (FE-6-08, FE-6-09): nguồn của vị trí — **"Mô phỏng"**
 * khi là xe mô phỏng của kho, "GPS" khi là vị trí thật — giờ của điểm vị trí, xe đang chạy hay đứng, và nhãn **MOCK RESULT** vì giờ đến
 * tính từ vị trí là kết quả của công thức mock. Chỉ hiện số kho ghi ở điểm vị trí.
 */
export function LiveLocationBar({ location, isMockResult }: { location: LocationPoint; isMockResult: boolean }) {
  const t = useT()
  const format = useFormat()
  const time = format.time(location.recordedAt)
  return (
    <div role="status" aria-label={t('monitoring.location.title')} className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 px-1.5 pb-2.5 text-small text-ink-2">
      <span className="font-semibold text-ink-strong">{t('monitoring.location.title')}</span>
      <Badge shape="tag" tone={location.source === 'GPS' ? 'success' : 'neutral'}>{t(`monitoring.location.sources.${location.source}`)}</Badge>
      <span className="tabular-nums">
        {location.speedKmh > 0
          ? t('monitoring.location.moving', { time, speed: format.integer(location.speedKmh) })
          : t('monitoring.location.standing', { time })}
      </span>
      {isMockResult ? <Badge shape="tag" tone="mock">MOCK RESULT</Badge> : null}
      <p className="basis-full text-note text-ink-3">{t('monitoring.location.basis')}</p>
    </div>
  )
}
