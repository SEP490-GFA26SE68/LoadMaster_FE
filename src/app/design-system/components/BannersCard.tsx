import { Lock } from 'lucide-react'
import { Link } from 'react-router'
import { Banner } from '@/components/Banner'
import type { TripRow } from '@/features/trips/trip-list'
import { useFormat, useT } from '@/lib/i18n'
import type { SheetSample } from '../design-system-api'
import { SheetCard } from '../SheetLayout'

/**
 * Bốn tông `Banner` với câu thật của các màn: khoá khi kho đã xếp (form chuyến), phương án lỗi thời (Planner, kèm liên kết tới
 * Thiết lập tối ưu của chuyến đang "Cần xem lại" trong kho), chuyến đã huỷ (giờ và lý do lấy từ chuyến huỷ trong kho), chỉ xem.
 */
export function BannersCard({ sample, rows }: { sample: SheetSample | undefined; rows: readonly TripRow[] | undefined }) {
  const t = useT()
  const format = useFormat()
  const stale = rows?.find((row) => row.status === 'can_xem_lai')
  const cancellation = sample?.cancellation

  return (
    <SheetCard title={t('designSystem.components.banners.title')}>
      <Banner tone="info" icon={Lock}>{t('trips.create.lockedHint')}</Banner>
      <Banner
        tone="warning"
        action={stale ? (
          <Link to={`/chuyen/${stale.id}/toi-uu`} className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {t('viewer.plan.toSetup')}
          </Link>
        ) : null}
      >
        {t('viewer.plan.staleBanner')}
      </Banner>
      {cancellation ? (
        <Banner tone="danger">
          {t('trips.detail.locked.cancelled', {
            time: format.time(cancellation.at),
            date: format.date(cancellation.at),
            reason: cancellation.reason,
          })}
        </Banner>
      ) : null}
      <Banner tone="neutral">{t('viewer.lock.readOnly')}</Banner>
    </SheetCard>
  )
}
