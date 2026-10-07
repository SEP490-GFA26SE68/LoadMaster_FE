import { insertPickupStops, type PickupRouteStop } from '@/domain/pickup'
import { put, type DbContext } from './db-context'
import { refreshLiveEta } from './db-tracking'
import { MockDbError } from './errors'
import { planNumberOf } from './plan-stops'
import type { PickupRequest } from './pickup-model'
import { routePlanOf } from './trip-route'
import { nextStopId } from './trip-stops'
import type { DeliveryStop, StopProgress, Trip } from './types'

/**
 * Chèn điểm nhận và điểm giao của một yêu cầu nhận hàng dọc đường đã duyệt vào chuyến **đang vận chuyển** (FE-7-04, D-88, PRD v2 mục
 * 7.1). Đây là **ngoại lệ duy nhất** của `TRIP_LOCKED` khi chuyến đã rời kho: chỉ hàm này ghi `Trip.stops` của chuyến đang chạy, và chỉ
 * qua `approvePickupRequest`; `updateTrip`, `changeTripVehicle`, tối ưu tuyến… vẫn từ chối.
 *
 * Hai điểm mới nằm **ngay sau điểm hiện tại** (`insertPickupStops` của domain), điểm nhận trước; thứ tự các điểm cũ không đổi. Số điểm là
 * vị trí + 1 nên các điểm sau lệch số: kho đánh số lại mọi thứ khoá theo số điểm — tiến độ giao, sự cố giao, lần đối chiếu, dòng kiện
 * của chuyến, sự cố cấp chuyến và tuyến thay thế, cảnh báo trễ hạn — và ghi `DeliveryStop.planNumber` (số của điểm trong phương án đã
 * duyệt, `plan-stops.ts`) để phương án vẫn đọc đúng. **Không** tăng `inputVersion` và **không** bỏ `routePlan` như `withFreshRoute`
 * (thêm điểm làm chuyến về Nháp ở pha lập kế hoạch): phương án đã xếp là thứ kho và tài xế đang làm theo, chuyến vẫn Đang vận chuyển;
 * giờ đến và mức hạn tính lại theo thứ tự mới (`routePlanOf`), ETA trực tiếp tính lại từ vị trí xe (`refreshLiveEta`).
 */
export type PickupInsertion = { trip: Trip; pickupStopId: string; deliveryStopId: string; deliveryReused: boolean }

export function insertPickupIntoTrip(ctx: DbContext, trip: Trip, request: PickupRequest, routeStops: readonly PickupRouteStop[]): PickupInsertion {
  const pickupStopId = nextStopId(trip.stops)
  const deliveryStopId = nextStopId([...trip.stops, { id: pickupStopId }])
  const placed = insertPickupStops(routeStops, { pickupStopId, deliveryStopId }, request.delivery)
  if (placed === null) throw new MockDbError('PICKUP_ROUTE_UNAVAILABLE', { tripId: trip.id, stopNumbers: [] })

  const own = new Map<string, DeliveryStop>(trip.stops.map((stop, index) => [stop.id, { ...stop, planNumber: planNumberOf(trip.stops, index) }]))
  own.set(pickupStopId, { id: pickupStopId, name: request.pickup.name, address: request.pickup.address, kind: 'PICKUP', lat: request.pickup.lat, lng: request.pickup.lng, planNumber: null })
  if (placed.deliveryReused) {
    // Điểm giao dùng lại: hạn của điểm là hạn sớm nhất của những gì giao ở đó
    const reused = own.get(placed.deliveryStopId)
    if (reused && request.deadline !== undefined && (reused.deadline === undefined || Date.parse(request.deadline) < Date.parse(reused.deadline))) own.set(reused.id, { ...reused, deadline: request.deadline })
  } else {
    own.set(deliveryStopId, {
      id: deliveryStopId, name: request.delivery.name, address: request.delivery.address, lat: request.delivery.lat, lng: request.delivery.lng,
      ...(request.deadline === undefined ? {} : { deadline: request.deadline }), planNumber: null,
    })
  }
  const stops = placed.orderedStopIds.map((id) => own.get(id) as DeliveryStop)

  // Số điểm cũ → số điểm mới
  const renumbered = new Map(trip.stops.map((stop, index) => [index + 1, stops.findIndex((item) => item.id === stop.id) + 1]))
  const renumber = (number: number) => renumbered.get(number) ?? number

  const delivery = trip.delivery && {
    ...trip.delivery,
    stops: stops.map((stop, index): StopProgress => {
      const before = trip.stops.findIndex((item) => item.id === stop.id)
      const progress = before === -1 ? undefined : trip.delivery?.stops.find((item) => item.number === before + 1)
      return { ...(progress ?? { unloadedIds: [] }), number: index + 1 }
    }),
    issues: trip.delivery.issues.map((issue) => ({ ...issue, stopNumber: renumber(issue.stopNumber) })),
  }
  const { routePlan, ...rest } = trip
  const next: Trip = {
    ...rest,
    stops,
    packages: trip.packages.map((pkg) => ({ ...pkg, deliveryStop: renumber(pkg.deliveryStop) })),
    ...(delivery === undefined ? {} : { delivery }),
    ...(trip.verifications === undefined ? {} : { verifications: trip.verifications.map((entry) => (entry.stopNumber === undefined ? entry : { ...entry, stopNumber: renumber(entry.stopNumber) })) }),
  }
  const stored = put(ctx.state.trips, routePlan === undefined ? next : { ...next, routePlan: routePlanOf(next, routePlan) })

  // Dữ liệu của chuyến giữ ngoài `Trip` cũng khoá theo số điểm
  const incidents = ctx.state.exceptions.get(trip.id)
  for (const exception of incidents?.exceptions ?? []) if (exception.stopNumber !== undefined) exception.stopNumber = renumber(exception.stopNumber)
  for (const reroute of incidents?.reroutes ?? []) reroute.stopNumber = renumber(reroute.stopNumber)
  if (incidents?.proposal) incidents.proposal.stopNumber = renumber(incidents.proposal.stopNumber)
  for (const alert of ctx.state.tracking.get(trip.id)?.alerts ?? []) alert.stopNumber = renumber(alert.stopNumber)

  refreshLiveEta(ctx, stored)
  return { trip: stored, pickupStopId, deliveryStopId: placed.deliveryStopId, deliveryReused: placed.deliveryReused }
}
