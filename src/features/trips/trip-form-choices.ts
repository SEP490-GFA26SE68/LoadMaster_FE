import type { SelectOption } from '@/components/ui/SelectField'
import type { TFunction } from '@/lib/i18n'
import { compareText } from '@/lib/list-filter'
import type { Trip } from '@/lib/mock-db'
import { UNASSIGNED } from './trip-form.schema'
import type { TripFormOptions } from './trips-api'

/**
 * Lựa chọn của hai ô chọn trong form chuyến. Xe bảo dưỡng vẫn hiện, kèm lý do, nhưng không chọn được (D-53) — trừ xe chuyến đang
 * dùng, để form sửa không mất giá trị. Tài xế: người dùng vai trò tài xế đang hoạt động; tài xế đang gán mà tài khoản đã khoá vẫn
 * hiện, không chọn lại được.
 */
export function tripFormChoices(data: TripFormOptions | undefined, existing: Pick<Trip, 'vehicleId' | 'driverId'> | undefined, t: TFunction) {
  const vehicles: SelectOption[] = (data?.vehicles ?? []).map(({ vehicle, status }) => {
    const maintenance = status === 'maintenance'
    return {
      value: vehicle.id,
      label: maintenance ? t('trips.create.vehicleMaintenance', { name: vehicle.name }) : vehicle.name,
      disabled: maintenance && vehicle.id !== existing?.vehicleId,
    }
  })
  const drivers: SelectOption[] = (data?.drivers ?? [])
    .filter((user) => user.status === 'active' || user.id === existing?.driverId)
    .toSorted((a, b) => compareText(a.fullName, b.fullName))
    .map((user) => user.status === 'active'
      ? { value: user.id, label: user.fullName }
      : { value: user.id, label: t('trips.create.driverSuspended', { name: user.fullName }), disabled: true })
  return { vehicles, drivers: [{ value: UNASSIGNED, label: t('trips.create.unassigned') }, ...drivers] }
}
