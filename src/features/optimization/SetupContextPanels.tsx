import { AlertCircle, Package, Truck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { disabledClass, fieldBoxClass, fieldLabelClass, focusClass } from '@/components/ui/field-styles'
import { VehicleStatusBadge } from '@/features/fleet/VehicleStatusBadge'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { OptimizationSetup } from './optimization-api'
import { useChangeVehicleMutation } from './useOptimizationSetup'

export const SETUP_LINK = 'inline-flex items-center gap-1.5 self-start rounded-sm text-body font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

/** `id` của ô chọn xe: nút "Đổi xe" ở danh sách kiểm tra đưa con trỏ về đây. */
export const VEHICLE_SELECT_ID = 'toi-uu-xe'

/**
 * Phần "Kiểm tra đầu vào" của Thiết lập tối ưu (V2.3 `ThietLapToiUu.jpg`): ba số lớn của hàng (kiện, khối lượng, điểm giao — từ chuyến),
 * xe chở chuyến đổi được tại chỗ, ô thông số của xe đang chọn kèm chip trạng thái xe, rồi hai liên kết sửa. Xe bảo dưỡng hiện kèm lý do
 * nhưng không chọn được (D-53); chuyến đã khoá (`locked`, D-45) thì không đổi xe. `payloadError`: tải tối đa tô đỏ khi riêng kiện bắt
 * buộc đã vượt (lỗi chặn tối ưu ở mục Tải trọng).
 */
export function SetupContextPanels({ tripId, setup, locked = false, payloadError = false }: {
  tripId: string
  setup: OptimizationSetup
  locked?: boolean
  payloadError?: boolean
}) {
  const t = useT()
  const format = useFormat()
  const changeVehicle = useChangeVehicleMutation(tripId)
  const { vehicle, trip } = setup
  const instances = trip.packages.reduce((sum, pkg) => sum + pkg.quantity, 0)
  const weightKg = trip.packages.reduce((sum, pkg) => sum + pkg.weightKg * pkg.quantity, 0)
  const first = trip.stops[0]
  const last = trip.stops.at(-1)
  const route = first && last && trip.stops.length > 1 ? t('optimization.stats.route', { first: first.name, last: last.name }) : first?.name
  const stats = [
    { label: t('optimization.stats.packages'), value: format.integer(instances), unit: t('optimization.stats.packagesUnit', { lines: format.integer(trip.packages.length) }) },
    // Số lớn làm tròn kg như ô số liệu của bảng điều khiển; khối lượng chính xác nằm ở panel "Hai giới hạn"
    { label: t('optimization.stats.weight'), value: format.integer(Math.round(weightKg)), unit: 'kg' },
    { label: t('optimization.stats.stops'), value: format.integer(trip.stops.length), unit: route },
  ]
  const status = setup.vehicleStatus[vehicle.id]

  function handleVehicleChange(vehicleId: string) {
    changeVehicle.mutate(vehicleId, { onError: (error) => toast.error(dataErrorMessage(error, t)) })
  }

  return (
    <div className="flex flex-col">
      <dl className="m-0 grid grid-cols-3 border-b border-line-soft pb-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex min-w-0 flex-col gap-1.5 border-l border-line-soft px-5 first:border-l-0 first:pl-0">
            <dt className="text-small text-ink-3">{stat.label}</dt>
            <dd className="m-0 flex min-w-0 items-baseline font-display text-[28px] leading-none font-bold tracking-[-0.4px] text-ink-strong tabular-nums font-stretch-108%">
              {stat.value}
              {/* Khoảng trắng thật thay cho lề: tên truy cập đọc "192 / 7 dòng", không dính "192/" */}
              {stat.unit ? <>{' '}<span className="ml-1 truncate font-sans text-body font-normal tracking-normal text-ink-3 font-stretch-100%" title={stat.unit}>{stat.unit}</span></> : null}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 grid grid-cols-12 gap-x-4">
        <label className={cn('col-span-6 flex flex-col gap-1.5 max-md:col-span-12', fieldLabelClass)}>
          {t('optimization.vehicle')}
          <select
            id={VEHICLE_SELECT_ID}
            value={vehicle.id}
            disabled={locked || changeVehicle.isPending}
            onChange={(event) => handleVehicleChange(event.target.value)}
            className={cn('h-10 px-3 font-normal', fieldBoxClass(false), focusClass, disabledClass)}
          >
            {setup.vehicles.map((item) => {
              const maintenance = setup.vehicleStatus[item.id] === 'maintenance'
              return (
                <option key={item.id} value={item.id} disabled={maintenance && item.id !== vehicle.id}>
                  {maintenance ? t('trips.create.vehicleMaintenance', { name: item.name }) : item.name}
                </option>
              )
            })}
          </select>
        </label>
      </div>

      <dl className={cn('m-0 mt-3 flex flex-wrap items-center gap-x-7.5 gap-y-2 rounded-md border px-4 py-2.75', locked ? 'border-border bg-n-50' : 'border-cyan-100 bg-cyan-50')}>
        <Readout label={t('optimization.readout.space')}>{format.dimensions(vehicle.innerLengthCm, vehicle.innerWidthCm, vehicle.innerHeightCm)}</Readout>
        <Readout label={t('optimization.readout.payload')} danger={payloadError}>
          {payloadError ? <AlertCircle aria-hidden className="mr-1 inline size-4 align-[-2px]" strokeWidth={1.75} /> : null}
          {format.weight(vehicle.maxPayloadKg)}
        </Readout>
        <Readout label={t('optimization.readout.door')}>{format.widthByHeight(vehicle.doorWidthCm, vehicle.doorHeightCm)}</Readout>
        <Readout label={t('optimization.readout.obstacles')}>{format.integer(vehicle.obstacles.length)}</Readout>
        {status ? <div className="ml-auto"><VehicleStatusBadge status={status} /></div> : null}
      </dl>

      <div className="mt-3.5 flex flex-wrap gap-x-5.5 gap-y-1">
        <Link to={`/doi-xe/${vehicle.id}`} className={SETUP_LINK}><Truck aria-hidden className="size-4" strokeWidth={1.75} />{t('optimization.editVehicle')}</Link>
        <Link to={`/chuyen/${tripId}`} className={SETUP_LINK}><Package aria-hidden className="size-4" strokeWidth={1.75} />{t('optimization.editPackages')}</Link>
      </div>
    </div>
  )
}

/** Một thông số của xe: nhãn 12,5px, giá trị Archivo 600 15px. */
function Readout({ label, danger = false, children }: { label: string; danger?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.75">
      <dt className="text-fine text-ink-3">{label}</dt>
      <dd className={cn('m-0 font-display text-[15px] leading-5 font-semibold whitespace-nowrap tabular-nums', danger ? 'text-danger' : 'text-ink-strong')}>{children}</dd>
    </div>
  )
}
