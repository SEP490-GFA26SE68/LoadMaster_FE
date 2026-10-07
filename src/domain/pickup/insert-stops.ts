import { haversineKm, type GeoPoint } from '@/domain/routing'
import { currentStopIndex, protectedStopIndex } from './route-path'
import { PICKUP_CONSTANTS, type PickupRouteStop } from './types'

export type PickupInsertion = {
  /** Mọi điểm của chuyến theo thứ tự mới: thứ tự các điểm cũ giữ nguyên, điểm mới chen vào ngay sau điểm hiện tại. */
  orderedStopIds: string[]
  pickupStopId: string
  /** Mã điểm giao: điểm mới, hoặc điểm có sẵn khi `deliveryReused`. */
  deliveryStopId: string
  /** Điểm giao trùng một điểm có sẵn (thường là điểm được bảo vệ): không thêm điểm giao mới. */
  deliveryReused: boolean
}

/**
 * Chèn điểm nhận và điểm giao của một yêu cầu nhận dọc đường vào tuyến (FE-7-02, PRD v2 mục 8.7): cả hai đặt **ngay sau điểm hiện tại**,
 * điểm nhận trước điểm giao; không điểm cũ nào bị đổi chỗ. Điểm giao trùng (trong `SAME_PLACE_KM`) một điểm có sẵn nằm sau điểm hiện
 * tại và không quá điểm được bảo vệ thì dùng lại điểm đó, không thêm điểm giao mới. Không còn điểm nào chưa hoàn tất: `null`.
 * Hàm chỉ sắp thứ tự — điểm giao có hợp lệ không là việc của luật 2.
 */
export function insertPickupStops(
  stops: readonly PickupRouteStop[],
  ids: { pickupStopId: string; deliveryStopId: string },
  deliveryLocation: GeoPoint,
): PickupInsertion | null {
  const current = currentStopIndex(stops)
  if (current < 0) return null
  const protectedIndex = protectedStopIndex(stops, current)
  const reachable = stops.slice(current + 1, protectedIndex < 0 ? undefined : protectedIndex + 1)
  const reused = reachable.find((stop) => haversineKm(stop.location, deliveryLocation) <= PICKUP_CONSTANTS.SAME_PLACE_KM)

  const before = stops.slice(0, current + 1).map((stop) => stop.stopId)
  const after = stops.slice(current + 1).map((stop) => stop.stopId)
  return {
    orderedStopIds: [...before, ids.pickupStopId, ...(reused === undefined ? [ids.deliveryStopId] : []), ...after],
    pickupStopId: ids.pickupStopId,
    deliveryStopId: reused?.stopId ?? ids.deliveryStopId,
    deliveryReused: reused !== undefined,
  }
}
