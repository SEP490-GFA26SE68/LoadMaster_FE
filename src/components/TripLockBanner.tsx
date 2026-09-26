import { Lock } from 'lucide-react'
import { Banner } from '@/components/Banner'
import type { Trip } from '@/lib/mock-db'
import { useFormat, useT } from '@/lib/i18n'

/**
 * Lý do chuyến không sửa được (D-45, LM-088): từ lúc kho bắt đầu xếp, xe, điểm giao và kiện bị khoá; chuyến đã huỷ nói thời điểm và
 * lý do huỷ. Pha lập kế hoạch không hiện gì. Dùng ở Chi tiết chuyến và Thiết lập tối ưu.
 */
export function TripLockBanner({ trip }: { trip: Pick<Trip, 'phase' | 'cancellation'> }) {
  const t = useT()
  const format = useFormat()
  const { phase, cancellation } = trip
  if (phase === 'planning') return null
  const cancelled = phase === 'cancelled'
  let text: string
  if (phase === 'cancelled') {
    text = cancellation
      ? t('trips.detail.locked.cancelled', { time: format.time(cancellation.at), date: format.date(cancellation.at), reason: cancellation.reason })
      : t('trips.detail.locked.completed')
  } else {
    text = t(`trips.detail.locked.${phase}`)
  }
  return (
    <Banner tone={cancelled ? 'danger' : 'info'} icon={cancelled ? undefined : Lock}>
      {text}
    </Banner>
  )
}
