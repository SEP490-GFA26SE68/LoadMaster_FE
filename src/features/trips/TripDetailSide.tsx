import type { VehicleConfig } from '@/domain/models'
import type { Trip } from '@/lib/mock-db'
import { useT } from '@/lib/i18n'
import type { User } from '@/types/user'
import { CargoSummaryCard } from './CargoSummaryCard'
import { FragileNote } from './FragileNote'
import type { CargoSummary } from './trip-summary'
import { TripDetailIssues } from './TripDetailIssues'
import { VehicleCard } from './VehicleCard'

/**
 * Cột phải của Chi tiết chuyến (V2.3): một card nhiều mục ngăn bằng đường mảnh — sự cố (kiện thiếu ở kho, sự cố giao), "Tóm tắt hàng
 * hoá" (tải trọng và thể tích sử dụng, ghi chú hàng dễ vỡ) rồi "Phương tiện". Khi chuyến đang giao hoặc đã hoàn thành, tóm tắt hàng
 * nhường chỗ cho tiến độ giao ở sơ đồ tuyến (`ChiTietChuyenDangGiao.jpg`, `ChiTietChuyenHoanThanh.jpg`).
 */
export function TripDetailSide({ trip, vehicle, driver, summary, editable }: {
  trip: Trip
  vehicle: VehicleConfig
  driver: Pick<User, 'fullName' | 'phone'> | null
  summary: CargoSummary
  editable: boolean
}) {
  const t = useT()
  const delivered = trip.phase === 'delivering' || trip.phase === 'completed'
  return (
    <aside aria-label={t('trips.cargoSummary')} className="overflow-hidden rounded-lg border border-border bg-bg shadow-card">
      <TripDetailIssues trip={trip} />
      {delivered ? null : (
        <section className="flex flex-col gap-3 border-b border-line-soft px-4.5 py-4">
          <h3 className="font-display text-body-lg leading-5 font-[650] text-ink-strong font-stretch-106%">{t('trips.cargoSummary')}</h3>
          <CargoSummaryCard summary={summary} vehicle={vehicle} />
          <FragileNote packages={trip.packages} />
        </section>
      )}
      <div className="px-4.5 py-4">
        <VehicleCard vehicle={vehicle} tripId={trip.id} driverId={trip.driverId} driver={driver} canChange={editable} />
      </div>
    </aside>
  )
}
