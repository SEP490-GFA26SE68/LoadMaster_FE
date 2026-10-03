import { nextPackageId } from '@/domain/cargo'
import type { CargoPackage } from '@/domain/models'
import { found, put, sameData, type DbContext } from './db-context'
import type { Package } from './package-model'
import { cargoFromPackage } from './package-type-cargo'
import type { TripPackageLink } from './review1-status'
import { withFreshRoute } from './trip-route'
import { withStopDemands, type StopDemand } from './trip-stops'
import type { Trip } from './types'

/**
 * Dòng kiện của chuyến sinh từ kiện kho kiện, và hạn / ưu tiên của điểm giao (FE-4b-04, FE-4b-05) — phần dùng chung của "đưa yêu cầu
 * giao vào chuyến" (`db-requirement-trips.ts`) và "đưa kiện thẳng vào chuyến" (`db-trip-pool.ts`).
 */

/** Mọi liên kết dòng kiện ↔ kiện kho kiện của chuyến `tripId`: dòng của yêu cầu giao (`requirementId`) và dòng thêm ngay trong chuyến. */
export function tripLinks(ctx: DbContext, tripId: string): readonly TripPackageLink[] {
  return ctx.state.tripPackageLinks.get(tripId) ?? []
}

export function setTripLinks(ctx: DbContext, tripId: string, links: readonly TripPackageLink[]) {
  if (links.length > 0) ctx.state.tripPackageLinks.set(tripId, [...links])
  else ctx.state.tripPackageLinks.delete(tripId)
}

/**
 * Kiện kho kiện `members` thành dòng kiện mới của chuyến ở điểm số `stopNumber`, theo thứ tự kiện: các kiện cùng loại kiện, cùng kích
 * thước, khối lượng và loại hàng gộp một dòng; kiện không có loại kiện mỗi kiện một dòng (tên dòng là mã kiện của bên gửi). Kiện thứ i
 * của một dòng là instance thứ i của dòng đó.
 */
export function poolLines(ctx: DbContext, members: readonly Package[], trip: Pick<Trip, 'packages'>, stopNumber: number, extra: Partial<CargoPackage> = {}) {
  const groups = new Map<string, Package[]>()
  for (const pkg of members) {
    const key = pkg.packageTypeId === undefined
      ? pkg.id
      : [pkg.packageTypeId, pkg.lengthCm, pkg.widthCm, pkg.heightCm, pkg.weightKg, pkg.handlingClass].join('|')
    groups.set(key, [...(groups.get(key) ?? []), pkg])
  }
  const ids = trip.packages.map((pkg) => pkg.id)
  const cargo: CargoPackage[] = []
  const links: TripPackageLink[] = []
  for (const group of groups.values()) {
    const first = group[0]
    if (!first) continue
    const lineId = nextPackageId(ids)
    ids.push(lineId)
    const type = first.packageTypeId === undefined ? undefined : found(ctx.state.packageTypes, 'packageTypes', first.packageTypeId)
    cargo.push({ ...cargoFromPackage(first, type, { id: lineId, quantity: group.length, deliveryStop: stopNumber }), ...extra })
    links.push({ lineId, packageIds: group.map((pkg) => pkg.id) })
  }
  return { cargo, links }
}

/** Yêu cầu giao đang có kiện ở từng điểm của chuyến: mỗi dòng kiện của một yêu cầu là một phần tử (điểm của dòng, hạn, ưu tiên). */
export function stopDemandsOf(ctx: DbContext, trip: Pick<Trip, 'id' | 'packages'>): StopDemand[] {
  const stopOfLine = new Map(trip.packages.map((line) => [line.id, line.deliveryStop]))
  return tripLinks(ctx, trip.id).flatMap((link) => {
    const requirement = link.requirementId === undefined ? undefined : ctx.state.requirements.get(link.requirementId)
    const deliveryStop = stopOfLine.get(link.lineId)
    if (requirement?.tripId !== trip.id || deliveryStop === undefined) return []
    return [{ deliveryStop, deadline: requirement.deadline, priority: requirement.priority }]
  })
}

/**
 * Ghi lại hạn và ưu tiên của các điểm giao của `trip` theo yêu cầu đang ở từng điểm; không đổi gì thì không ghi. Hạn đổi thì mức hạn
 * của tuyến đã tối ưu tính lại (FE-4b-09).
 */
export function syncStopDemands(ctx: DbContext, trip: Trip): Trip {
  const stops = withStopDemands(trip.stops, stopDemandsOf(ctx, trip))
  return sameData(stops, trip.stops) ? trip : put(ctx.state.trips, withFreshRoute({ ...trip, stops }))
}
