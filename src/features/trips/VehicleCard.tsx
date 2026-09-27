import { useId } from 'react'
import { Link } from 'react-router'
import type { VehicleConfig } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'
import type { User } from '@/types/user'

/**
 * Mục "Phương tiện" ở cột phải Chi tiết chuyến (LM-088; V2.3 `ChiTietChuyen*.jpg`): danh sách khoá — giá trị gồm xe kèm biển số,
 * tài xế kèm số điện thoại, lòng thùng, cửa, số vật cản. "Đổi xe" chỉ khi chuyến còn sửa được.
 */
export function VehicleCard({ vehicle, tripId, driverId = null, driver = null, canChange = true }: {
  vehicle: VehicleConfig
  tripId: string
  driverId?: string | null
  /** Tài khoản của `driverId`; `null` khi chưa gán hoặc tài khoản không còn trong kho (khi đó hiện mã). */
  driver?: Pick<User, 'fullName' | 'phone'> | null
  canChange?: boolean
}) {
  const t = useT()
  const format = useFormat()
  const titleId = useId()
  const cut = vehicle.name.lastIndexOf(' · ')
  const driverText = driverId === null
    ? t('trips.vehicleCard.unassigned')
    : driver?.phone ? t('trips.vehicleCard.driverPhone', { name: driver.fullName, phone: driver.phone }) : driver?.fullName ?? driverId
  const rows = [
    {
      label: t('trips.vehicleCard.vehicle'),
      value: cut === -1 ? vehicle.name : <>{vehicle.name.slice(0, cut)} · <span className="font-mono text-caption text-ink-2">{vehicle.name.slice(cut + 3)}</span></>,
    },
    { label: t('trips.vehicleCard.driver'), value: driverText },
    { label: t('trips.vehicleCard.cargoSpace'), value: format.dimensions(vehicle.innerLengthCm, vehicle.innerWidthCm, vehicle.innerHeightCm) },
    { label: t('trips.vehicleCard.door'), value: format.widthByHeight(vehicle.doorWidthCm, vehicle.doorHeightCm) },
    { label: t('trips.vehicleCard.obstacles'), value: format.integer(vehicle.obstacles.length) },
  ]

  return (
    <section className="flex flex-col gap-2.5" aria-labelledby={titleId}>
      <div className="flex items-center justify-between gap-3">
        <h3 id={titleId} className="font-display text-body-lg leading-5 font-[650] text-ink-strong font-stretch-106%">{t('trips.vehicle')}</h3>
        {canChange ? (
          <Link to={`/chuyen/${tripId}/sua`} className="rounded-sm text-small font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {t('trips.changeVehicle')}
          </Link>
        ) : null}
      </div>
      <dl className="m-0 flex flex-col gap-2 text-body">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-3">{row.label}</dt>
            <dd className="m-0 text-right font-medium text-ink-strong tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
