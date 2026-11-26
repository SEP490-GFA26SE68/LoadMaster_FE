import type { Formatter } from '@/lib/format'
import type { TFunction } from '@/lib/i18n'

/**
 * Thời gian thật ước tính viết bằng chữ, làm tròn tới giây: "45 giây", "3 phút 20 giây", "1 giờ 5 phút" (bỏ giây khi đã quá một giờ —
 * số ước tính không đáng tin tới từng giây ở mức đó).
 */
export function formatDuration(seconds: number, t: TFunction, format: Pick<Formatter, 'integer'>): string {
  const total = Math.max(0, Math.round(seconds))
  if (total < 60) return t('plannerPhysics.duration.seconds', { seconds: format.integer(total) })
  if (total < 3600) {
    const minutes = format.integer(Math.floor(total / 60)), rest = total % 60
    return rest ? t('plannerPhysics.duration.minutesSeconds', { minutes, seconds: format.integer(rest) })
      : t('plannerPhysics.duration.minutes', { minutes })
  }
  const roundedMinutes = Math.round(total / 60)
  return t('plannerPhysics.duration.hoursMinutes', {
    hours: format.integer(Math.floor(roundedMinutes / 60)), minutes: format.integer(roundedMinutes % 60),
  })
}
