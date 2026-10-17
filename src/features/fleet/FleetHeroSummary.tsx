
import type { Vehicle } from './vehicles-api'
import { useT } from '@/lib/i18n'

/**
 * Thống kê đội xe.
 * Dữ liệu lấy từ Vehicle API thật.
 *
 * Tạm thời chỉ hiển thị tổng số xe.
 * Thống kê tải trọng và kích thước sẽ bổ sung
 * khi kết nối dữ liệu VehicleType.
 */
export function FleetHeroSummary({
  vehicles,
  totalElements,
}: {
  vehicles: readonly Vehicle[]
  totalElements?: number
}) {
  const t = useT()

  const count = totalElements ?? vehicles.length

  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span>
        {t('fleet.hero.count', { count })}
      </span>
    </span>
  )
}
