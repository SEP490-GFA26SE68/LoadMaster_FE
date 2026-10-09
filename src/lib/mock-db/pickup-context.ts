import { expandPackages } from '@/domain/cargo'
import type { PackagePlacement } from '@/domain/models'
import { currentStopIndex, freedZones, insertPickupStops, type OnboardCargo, type PickupContext, type PickupRouteStop } from '@/domain/pickup'
import type { GeoPoint } from '@/domain/routing'
import { reoptimizeFreedZone } from '@/services/optimization'
import { advanceTracking } from './db-tracking'
import type { DbContext } from './db-context'
import { MockDbError } from './errors'
import { leftOutIds } from './operations'
import { cargoFromPackage } from './package-type-cargo'
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
 * kiện nào của phương án; kiện nhận của yêu cầu đã duyệt chưa giao tính vào `onboardCount` của điểm giao (điểm được bảo vệ).
 *
 * Kiện nhận của yêu cầu **đã duyệt trước** (`APPROVED`, `LOADED`) là hàng đang chở như kiện của phương án: có chỗ (`layout`) thì vào
 * `onboard` và là vật cản của lần xếp này, chưa có chỗ thì chỉ tính khối lượng (`looseKg`). Rồi kho chạy mock tái tối ưu vùng trống
 * (`reoptimizeFreedZone`) cho kiện của yêu cầu này — kết quả là `packing`, nguồn của luật 4–7 và 10. Điểm giao của mọi kiện được đánh
 * số lại theo **thứ tự tuyến sau khi chèn** (kiểm LIFO so sánh thứ tự giao, không so số điểm của phương án).
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

  // Thứ tự giao sau khi chèn: kiện nhận giao ngay sau điểm hiện tại
  const inserted = insertPickupStops(stops, { pickupStopId: '$pickup', deliveryStopId: '$delivery' }, request.delivery)
  const rankOf = new Map((inserted?.orderedStopIds ?? stops.map((stop) => stop.stopId)).map((stopId, index) => [stopId, index + 1]))
  const stopIdOfNumber = new Map(stops.filter((stop) => stop.number > 0).map((stop) => [stop.number, stop.stopId]))
  const planRank = (planStop: number) => rankOf.get(stopIdOfNumber.get(planStop) ?? '') ?? planStop
  const deliveryRank = inserted === null ? stops.length + 1 : (rankOf.get(inserted.deliveryStopId) ?? stops.length + 1)
  const current = currentStopIndex(stops)

  const rows = (plan?.request.packages ?? []).map((row) => ({ ...row, deliveryStop: planRank(row.deliveryStop) }))
  const placements: PackagePlacement[] = onboardPlaced
  let looseKg = 0
  for (const earlier of waitingPickup) {
    if (earlier.id === request.id) continue
    const rank = rankOf.get(earlier.deliveryStopId ?? '') ?? stops.length + 1
    ;(earlier.packageIds ?? []).forEach((packageId, index) => {
      const pkg = ctx.state.packages.get(packageId)
      if (pkg === undefined || pkg.status === 'DELIVERED' || pkg.status === 'RETURNED') return
      const spot = earlier.layout?.placements.find((item) => item.packageIndex === index)
      if (spot === undefined) {
        looseKg += pkg.weightKg
        return
      }
      rows.push(cargoFromPackage(pkg, undefined, { id: pkg.id, quantity: 1, deliveryStop: rank }))
      placements.push({
        packageInstanceId: `${pkg.id}-01`, orientation: spot.orientation, xCm: spot.xCm, yCm: spot.yCm, zCm: spot.zCm,
        placedLengthCm: spot.placedLengthCm, placedWidthCm: spot.placedWidthCm, placedHeightCm: spot.placedHeightCm,
        loadingOrder: placements.length + 1, unloadingOrder: placements.length + 1, supportRatio: 1, constraintWarnings: [],
      })
      onboard.push({ xCm: spot.xCm, yCm: spot.yCm, zCm: spot.zCm, lengthCm: spot.placedLengthCm, widthCm: spot.placedWidthCm, heightCm: spot.placedHeightCm, weightKg: pkg.weightKg })
    })
  }
  const pickupRows = request.packages.map((pkg, index) => {
    const id = `PICKUP-${index + 1}`
    return cargoFromPackage({ id, ...pkg }, undefined, { id, quantity: 1, deliveryStop: deliveryRank })
  })
  const freed = freedZones({
    vehicle, zones: plan?.result.stopZones ?? [], stops,
    onboardKg: onboard.reduce((sum, item) => sum + item.weightKg, 0) + looseKg,
  })
  const packing = reoptimizeFreedZone({ vehicle, freed, packages: rows, onboard: placements, pickups: pickupRows, loadedAfterStop: current < 0 ? stops.length : current + 1 })

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
    ...(looseKg > 0 ? { looseKg } : {}),
    packing,
    tripCargo: trip.packages.map(({ id, quantity, handlingClass }) => ({ id, quantity, ...(handlingClass === undefined ? {} : { handlingClass }) })),
    ...(trip.overrideReason === undefined ? {} : { overrideReason: trip.overrideReason }),
  }
}
