import { expandPackages } from '@/domain/cargo'
import type { OnboardCargo, PickupContext, PickupRouteStop } from '@/domain/pickup'
import type { GeoPoint } from '@/domain/routing'
import { advanceTracking } from './db-tracking'
import type { DbContext } from './db-context'
import { MockDbError } from './errors'
import { leftOutIds } from './operations'
import type { PickupRequest } from './pickup-model'
import { planNumberOf } from './plan-stops'
import { stopsWithoutCoordinates } from './trip-route'
import type { Trip } from './types'
import { withTypeLimits } from './vehicle-limits'

/**
 * Dựng ngữ cảnh mười luật nhận hàng dọc đường (FE-7-03) từ chuyến Đang vận chuyển: xe và giới hạn của loại xe, vị trí xe lúc này, các
 * điểm của tuyến kèm tiến độ giao, vùng và kiện còn trên xe của **phương án kho đã xếp** (`Trip.loading.revisionId`), dòng kiện của
 * chuyến và lý do vượt luật phân tách hàng. Chỉ đọc — ngoài việc ghi bù vị trí xe tới giờ hiện tại.
 *
 * Điểm đã chèn lúc đang chạy (điểm nhận, điểm giao mới) không có trong phương án: `number` là 0 — không khớp vùng nào — và không có
 * kiện nào của phương án; kiện nhận của yêu cầu đã duyệt chưa giao chỉ tính vào `onboardCount` của điểm giao (điểm được bảo vệ), chưa
 * có hộp 3D nên không vào `onboard`: luật tải trọng và trọng tâm của yêu cầu thứ hai chưa tính kiện của yêu cầu thứ nhất (P2).
 */
export function buildPickupContext(ctx: DbContext, trip: Trip, request: PickupRequest, at: string = ctx.nowIso()): PickupContext {
  const { vehicles, vehicleTypes, vehicleTypeOf, revisions, pickups } = ctx.state
  const missing = stopsWithoutCoordinates(trip.stops)
  if (missing.length > 0) throw new MockDbError('PICKUP_ROUTE_UNAVAILABLE', { tripId: trip.id, stopNumbers: missing.map((stop) => stop.number) })
  const stored = vehicles.get(trip.vehicleId)
  if (!stored) throw new MockDbError('NOT_FOUND', { collection: 'vehicles', id: trip.vehicleId })
  const vehicle = withTypeLimits(stored, vehicleTypes.get(vehicleTypeOf.get(trip.vehicleId) ?? ''))
  const last = advanceTracking(ctx, trip)?.points.at(-1)
  const position: GeoPoint = last ?? { lat: trip.depot.lat, lng: trip.depot.lng }

  const plan = revisions.get(trip.loading?.revisionId ?? '')
  const { instances } = plan ? expandPackages(plan.request.packages) : { instances: [] }
  const instanceById = new Map(instances.map((instance) => [instance.packageInstanceId, instance]))
  const progress = trip.delivery?.stops ?? []
  const unloaded = new Set(progress.flatMap((stop) => stop.unloadedIds))
  const gone = new Set([...unloaded, ...leftOutIds(trip)])
  const onboardPlaced = (plan?.result.placements ?? []).filter((placement) => !gone.has(placement.packageInstanceId))

  const waitingPickup = [...pickups.values()].filter((item) => item.tripId === trip.id && (item.status === 'APPROVED' || item.status === 'LOADED'))
  const pickupCount = (stopId: string) => waitingPickup
    .filter((item) => item.deliveryStopId === stopId)
    .reduce((sum, item) => sum + (item.packageIds ?? []).filter((id) => ctx.state.packages.get(id)?.status !== 'DELIVERED').length, 0)

  const stops: PickupRouteStop[] = trip.stops.map((stop, index) => {
    const number = planNumberOf(trip.stops, index)
    const state = progress.find((item) => item.number === index + 1)
    const planned = number === null ? 0 : onboardPlaced.filter((placement) => instanceById.get(placement.packageInstanceId)?.deliveryStop === number).length
    return {
      stopId: stop.id,
      number: number ?? 0,
      location: { lat: stop.lat as number, lng: stop.lng as number },
      ...(stop.deadline === undefined ? {} : { deadline: stop.deadline }),
      completed: state?.completedAt !== undefined,
      onboardCount: planned + pickupCount(stop.id),
      ...(state?.arrivedAt === undefined ? {} : { arrivedAt: state.arrivedAt }),
    }
  })

  const onboard: OnboardCargo[] = onboardPlaced.map((placement) => ({
    xCm: placement.xCm, yCm: placement.yCm, zCm: placement.zCm,
    lengthCm: placement.placedLengthCm, widthCm: placement.placedWidthCm, heightCm: placement.placedHeightCm,
    weightKg: instanceById.get(placement.packageInstanceId)?.weightKg ?? 0,
  }))

  return {
    request: {
      pickup: { lat: request.pickup.lat, lng: request.pickup.lng },
      delivery: { lat: request.delivery.lat, lng: request.delivery.lng },
      ...(request.deadline === undefined ? {} : { deadline: request.deadline }),
      packages: request.packages,
    },
    vehicle,
    position,
    at,
    stops,
    zones: plan?.result.stopZones ?? [],
    onboard,
    tripCargo: trip.packages.map(({ id, quantity, handlingClass }) => ({ id, quantity, ...(handlingClass === undefined ? {} : { handlingClass }) })),
    ...(trip.overrideReason === undefined ? {} : { overrideReason: trip.overrideReason }),
  }
}
