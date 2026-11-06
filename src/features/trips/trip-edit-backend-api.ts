/**
 * Lệnh ghi của Chi tiết chuyến khi nhóm `trips` nối backend. Hàm → endpoint:
 *   updateBackendTrip           → PATCH /api/trips/{id}
 *   cancelBackendTrip           → POST /api/trips/{id}/cancel
 *   removeBackendRequirement    → DELETE /api/trips/{tripId}/delivery-requirements/{requirementId}
 * `tripId` là mã số của máy chủ. Máy chủ chỉ sửa chuyến Nháp / Đã lập kế hoạch (`TRIP_NOT_EDITABLE`), đổi xe mà xe không chở được
 * hàng của chuyến là 409 `VEHICLE_CANNOT_CARRY_CARGO`.
 */

import { api } from '@/lib/api-client'
import { backendLocalDateTime } from '@/lib/backend-time'

/** Phần sửa của chuyến; trường vắng là giữ nguyên. `driverId: null` là bỏ tài xế. */
export type BackendTripChanges = {
  readonly name?: string
  /** ISO 8601. */
  readonly departureAt?: string
  readonly vehicleId?: string
  readonly driverId?: string | null
  readonly originWarehouseId?: string
}

const tripPath = (tripId: string) => `/api/trips/${encodeURIComponent(tripId)}`

const idOf = (value: string) => Number(value)

/**
 * Đổi giờ xuất phát hoặc kho xuất phát thì máy chủ bỏ tuyến, chuyến về Nháp; đổi xe thì mọi phương án của chuyến thôi duyệt.
 */
// PATCH /api/trips/{id}
export async function updateBackendTrip(tripId: string, changes: BackendTripChanges): Promise<void> {
  const body = {
    ...(changes.name === undefined ? {} : { tripName: changes.name.trim() }),
    ...(changes.departureAt === undefined ? {} : { departureTime: backendLocalDateTime(changes.departureAt) }),
    ...(changes.vehicleId === undefined ? {} : { vehicleId: idOf(changes.vehicleId) }),
    ...(changes.driverId === undefined ? {} : changes.driverId === null ? { unassignDriver: true } : { driverId: idOf(changes.driverId) }),
    ...(changes.originWarehouseId === undefined ? {} : { originWarehouseId: idOf(changes.originWarehouseId) }),
  }
  await api().patch<unknown>(tripPath(tripId), { body })
}

/** Huỷ chuyến Nháp / Đã lập kế hoạch / Đang xếp hàng; yêu cầu giao và kiện về Chờ xử lý. */
// POST /api/trips/{id}/cancel
export async function cancelBackendTrip(tripId: string, reason: string): Promise<void> {
  await api().post<unknown>(`${tripPath(tripId)}/cancel`, { body: { reason: reason.trim() } })
}

/** Gỡ yêu cầu giao khỏi chuyến Nháp / Đã lập kế hoạch: điểm giao của nó mất, tuyến bị bỏ (chuyến về Nháp). */
// DELETE /api/trips/{tripId}/delivery-requirements/{requirementId}
export async function removeBackendRequirement(tripId: string, requirementId: string): Promise<void> {
  await api().delete<unknown>(`${tripPath(tripId)}/delivery-requirements/${encodeURIComponent(requirementId)}`)
}
