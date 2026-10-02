import { found, optionalText, put, type DbContext } from './db-context'
import type { Review1Db } from './db-api-review1'
import { movePackage } from './db-packages'
import { poolLines, setTripLinks, stopDemandsOf, tripLinks } from './db-trip-lines'
import { MockDbError } from './errors'
import type { Package } from './package-model'
import { isValidCoordinate } from './requirement-model'
import { nextStopId, pruneGeneratedStops, withStopDemands } from './trip-stops'
import type { DeliveryStop, Trip } from './types'

type TripPoolMethods = Pick<Review1Db, 'listTripPackages' | 'addTripPackages' | 'removeTripPackage'>

/**
 * Một kiện kho kiện đang ở trong chuyến: dòng kiện và điểm giao của nó, và đường nó vào chuyến — qua yêu cầu giao (`REQUIREMENT`), đưa
 * thẳng từ kho kiện (`POOL`), hay sinh ra khi thêm kiện ngay trong chuyến (`TRIP`).
 */
export type TripPoolPackage = {
  package: Package
  /** Dòng kiện của chuyến (`PKG-NNN`). */
  lineId: string
  /** Số điểm giao của dòng (1-based). */
  deliveryStop: number
  origin: 'REQUIREMENT' | 'POOL' | 'TRIP'
}

/** Điểm giao nhận kiện đưa thẳng vào chuyến: một điểm đang có của chuyến, hoặc một điểm tay mới thêm cuối tuyến. */
export type TripStopTarget = { stopId: string } | { newStop: Pick<DeliveryStop, 'name' | 'address' | 'lat' | 'lng' | 'phone' | 'contactName'> }

/**
 * Kiện kho kiện đưa **thẳng** vào chuyến (FE-4b-05, D-68 đường 2): điều phối viên chọn kiện Đã nhập chưa thuộc yêu cầu giao nào, gán
 * vào một điểm giao tay — không có hạn. Mỗi nhóm kiện giống nhau thành một dòng kiện của chuyến; liên kết dòng ↔ kiện ghi ở
 * `tripPackageLinks` với `fromPool`, nên sửa dòng về sau không ghi đè mã, kích thước hay điểm đến của kiện. Kiện của yêu cầu giao
 * không đi đường này: chúng vào và rời chuyến cùng yêu cầu.
 */
export function tripPoolMethods(ctx: DbContext): TripPoolMethods {
  const { trips } = ctx.state

  function planningTrip(tripId: string): Trip {
    const trip = ctx.scope.trips.own(tripId)
    if (trip.phase !== 'planning') throw new MockDbError('TRIP_LOCKED', { tripId, phase: trip.phase })
    return trip
  }

  /** Điểm giao nhận kiện: vị trí trong `stops` trả về. Điểm mới phải có tên; toạ độ có cả hai hoặc không có cái nào. */
  function targetStop(trip: Trip, target: TripStopTarget): { stops: DeliveryStop[]; index: number } {
    if ('stopId' in target) {
      const index = trip.stops.findIndex((stop) => stop.id === target.stopId)
      if (index === -1) throw new MockDbError('STOP_NOT_FOUND', { tripId: trip.id, stopId: target.stopId })
      return { stops: trip.stops, index }
    }
    const { lat, lng } = target.newStop
    const name = target.newStop.name.trim()
    const hasPoint = lat !== undefined || lng !== undefined
    if (name === '' || (hasPoint && (lat === undefined || lng === undefined || !isValidCoordinate(lat, lng)))) {
      throw new MockDbError('TRIP_INVALID', { tripId: trip.id, field: 'stop' })
    }
    const phone = optionalText(target.newStop.phone)
    const contactName = optionalText(target.newStop.contactName)
    const stop: DeliveryStop = {
      id: nextStopId(trip.stops), name, address: target.newStop.address.trim(),
      ...(lat === undefined || lng === undefined ? {} : { lat, lng }),
      ...(phone === undefined ? {} : { phone }),
      ...(contactName === undefined ? {} : { contactName }),
    }
    return { stops: [...trip.stops, stop], index: trip.stops.length }
  }

  return {
    listTripPackages: (tripId) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.read(tripId)
        const lineById = new Map(trip.packages.map((line) => [line.id, line]))
        return tripLinks(ctx, tripId).flatMap((link): TripPoolPackage[] => {
          const line = lineById.get(link.lineId)
          // Dòng của yêu cầu bị sửa số lượng mất liên kết với kiện của yêu cầu (`lineInstances`): không tính
          if (!line || line.quantity !== link.packageIds.length) return []
          const origin = link.requirementId !== undefined ? 'REQUIREMENT' : link.fromPool === true ? 'POOL' : 'TRIP'
          return link.packageIds.map((id) => ({ package: found(ctx.state.packages, 'packages', id), lineId: line.id, deliveryStop: line.deliveryStop, origin }))
        })
      }),
    addTripPackages: (tripId, packageIds, target) =>
      ctx.respond(() => {
        const trip = planningTrip(tripId)
        const ids = [...new Set(packageIds)]
        if (ids.length === 0) throw new MockDbError('PACKAGES_REQUIRED', {})
        // Kiểm hết trước khi ghi: còn ở kho kiện (`IMPORTED`), không cờ (D-92), không thuộc yêu cầu giao nào
        const members = ids.map((id) => {
          const pkg = ctx.scope.packages.ref(id, trip.companyId)
          const flag = pkg.flags[0]
          if (flag !== undefined) throw new MockDbError('PACKAGE_FLAGGED', { packageId: id, flag })
          if (pkg.status !== 'IMPORTED' || pkg.requirementId !== undefined) throw new MockDbError('PACKAGE_UNAVAILABLE', { packageId: id, status: pkg.status })
          return pkg
        })
        const placed = targetStop(trip, target)
        const stop = placed.stops[placed.index]
        if (!stop) throw new Error(`Chuyến ${tripId} không dựng được điểm giao cho kiện đưa thẳng vào chuyến`)
        const { cargo, links } = poolLines(ctx, members, trip, placed.index + 1)
        setTripLinks(ctx, tripId, [...tripLinks(ctx, tripId), ...links.map((link) => ({ ...link, fromPool: true }))])
        const stored = put(trips, { ...trip, stops: placed.stops, packages: [...trip.packages, ...cargo], inputVersion: trip.inputVersion + 1 })
        for (const pkg of members) movePackage(ctx, pkg, 'ASSIGNED', { tripId, stopId: stop.id })
        ctx.log('trip.packagesAdded', { type: 'trip', id: tripId }, { count: members.length, stopNumber: placed.index + 1 })
        return stored
      }),
    removeTripPackage: (tripId, packageId) =>
      ctx.respond(() => {
        const trip = planningTrip(tripId)
        const pkg = ctx.scope.packages.ref(packageId, trip.companyId)
        const links = tripLinks(ctx, tripId)
        // Chỉ kiện của một dòng không thuộc yêu cầu giao: kiện của yêu cầu rời chuyến bằng cách gỡ yêu cầu
        const link = links.find((item) => item.requirementId === undefined && item.packageIds.includes(packageId))
        const line = link === undefined ? undefined : trip.packages.find((item) => item.id === link.lineId)
        if (pkg.tripId !== tripId || !link || !line) throw new MockDbError('PACKAGE_UNAVAILABLE', { packageId, status: pkg.status })
        const packageIds = link.packageIds.filter((id) => id !== packageId)
        // Dòng thu lại một kiện, các kiện sau dồn lên; dòng hết kiện thì bỏ cả dòng
        setTripLinks(ctx, tripId, links.flatMap((item) => (item !== link ? [item] : packageIds.length === 0 ? [] : [{ ...item, packageIds }])))
        const lines = packageIds.length === 0
          ? trip.packages.filter((item) => item.id !== line.id)
          : trip.packages.map((item) => (item.id === line.id ? { ...item, quantity: packageIds.length } : item))
        const pruned = pruneGeneratedStops(trip.stops, lines)
        const packagesLeft = [...pruned.packages]
        const stops = withStopDemands(pruned.stops, stopDemandsOf(ctx, { id: tripId, packages: packagesLeft }))
        const stored = put(trips, { ...trip, stops, packages: packagesLeft, inputVersion: trip.inputVersion + 1 })
        movePackage(ctx, pkg, 'IMPORTED')
        ctx.log('trip.packageRemoved', { type: 'trip', id: tripId }, { packageId, packageCode: pkg.packageCode })
        return stored
      }),
  }
}
