import { z } from 'zod'
import type { TFunction } from '@/lib/i18n'
import type { BackendTripChanges } from './trip-edit-backend-api'
import { createTripFormSchema, departureAtOf, depotFormValues, driverIdOf, UNASSIGNED, type TripFormValues } from './trip-form.schema'
import type { TripDetailApiResponse } from './trips-api'

/**
 * Luật thuần của form sửa chuyến bản máy chủ (`/chuyen/:id/sua` khi nhóm `trips` nối backend). Máy chủ chỉ sửa chuyến Nháp và Đã lập
 * kế hoạch (`TRIP_NOT_EDITABLE`), và ở hai trạng thái đó sửa được mọi trường của khung chuyến — tên, ngày giờ xuất phát, xe, tài xế, kho
 * xuất phát — nên form không khoá ô nào; trạng thái khác không mở form.
 */

export const isBackendTripEditable = (status: TripDetailApiResponse['status']) => status === 'DRAFT' || status === 'PLANNED'

/**
 * Schema của form chuyến, trừ kho xuất phát: máy chủ không trả mã kho của chuyến, ô kho chỉ đọc tên, địa chỉ, toạ độ của chuyến và
 * chỉ gửi khi người dùng chọn một kho khác — toạ độ máy chủ để trống không được chặn việc sửa các ô còn lại.
 */
export function backendTripEditSchema(t: TFunction) {
  return createTripFormSchema(t).extend({
    depot: z.object({ name: z.string(), address: z.string(), coordinates: z.object({ lat: z.string(), lng: z.string() }) }),
  })
}

function finite(value: number | string | null | undefined): number | null {
  const number = typeof value === 'number' ? value : Number(value ?? Number.NaN)
  return Number.isFinite(number) ? number : null
}

/** Giá trị ban đầu: giờ xuất phát của máy chủ là `LocalDateTime` giờ Việt Nam (ngăn bằng `T` hay dấu cách), đọc thẳng ngày và giờ. */
export function backendTripFormDefaults(trip: TripDetailApiResponse): TripFormValues {
  const local = trip.departureTime.replace(' ', 'T')
  const lat = finite(trip.originLatitude)
  const lng = finite(trip.originLongitude)
  const depot = depotFormValues(lat === null || lng === null ? null : { name: trip.originName, address: trip.originAddress ?? '', lat, lng })
  return {
    name: trip.tripName,
    scheduledDate: local.slice(0, 10),
    departureTime: local.slice(11, 16),
    vehicleId: String(trip.vehicleId),
    driverId: trip.driverId === null ? UNASSIGNED : String(trip.driverId),
    depot: { ...depot, name: trip.originName, address: trip.originAddress ?? '' },
    stops: [],
  }
}

/**
 * Chỉ trường người dùng đã đổi — máy chủ bỏ tuyến khi giờ hay kho xuất phát đổi, nên gửi lại giá trị cũ là có hại. `warehouseId` rỗng là
 * giữ kho hiện tại. Không đổi gì thì `null`.
 */
export function backendTripChanges(initial: TripFormValues, values: TripFormValues, warehouseId: string): BackendTripChanges | null {
  const changes: { -readonly [K in keyof BackendTripChanges]: BackendTripChanges[K] } = {}
  if (values.name.trim() !== initial.name.trim()) changes.name = values.name.trim()
  if (values.scheduledDate !== initial.scheduledDate || values.departureTime !== initial.departureTime) changes.departureAt = departureAtOf(values)
  if (values.vehicleId !== initial.vehicleId) changes.vehicleId = values.vehicleId
  if (values.driverId !== initial.driverId) changes.driverId = driverIdOf(values.driverId)
  if (warehouseId !== '') changes.originWarehouseId = warehouseId
  return Object.keys(changes).length === 0 ? null : changes
}
