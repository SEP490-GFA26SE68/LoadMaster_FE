import { Lock, Wrench } from 'lucide-react'
import { Link } from 'react-router'
import { Banner } from '@/components/Banner'
import { useFormat, useT } from '@/lib/i18n'
import type { VehicleState } from '@/lib/mock-db'

/**
 * Thông báo trạng thái ở trang cấu hình xe (LM-089, V2.3 `Banner`): xe đang chạy chuyến thì nói chuyến nào và vì sao form bị khoá
 * (liên kết tới chuyến dồn phải); xe bảo dưỡng thì nói từ lúc nào và ghi chú. Xe sẵn sàng không có thông báo.
 */
export function VehicleStateBanner({ state }: { state: VehicleState }) {
  const t = useT()
  const format = useFormat()

  if (state.status === 'in_use' && state.tripId) {
    return (
      <Banner
        tone="info"
        icon={Lock}
        action={(
          <Link to={`/chuyen/${state.tripId}`} className="rounded-sm hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {t('fleet.banner.openTrip', { tripId: state.tripId })}
          </Link>
        )}
      >
        <p>{t('fleet.banner.inUse', { tripId: state.tripId })}</p>
      </Banner>
    )
  }

  if (state.status === 'maintenance' && state.maintenance) {
    const { since, note } = state.maintenance
    return (
      <Banner tone="warning" icon={Wrench}>
        <p>{t('fleet.banner.maintenance', { time: format.time(since), date: format.date(since) })}</p>
        {note ? <p className="mt-1 text-ink-2">{t('fleet.banner.maintenanceNote', { note })}</p> : null}
      </Banner>
    )
  }

  return null
}
