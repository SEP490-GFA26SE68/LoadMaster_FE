import { found, put, type DbContext } from './db-context'
import type { Review1Db } from './db-api-review1'
import { movePackage } from './db-packages'
import { poolLines, setTripLinks, stopDemandsOf, syncStopDemands, tripLinks } from './db-trip-lines'
import { syncTripPool } from './db-trip-packages'
import { settleSegregation } from './db-trip-segregation'
import { MockDbError } from './errors'
import { REQUIREMENT_CARGO_PRIORITY, type DeliveryRequirement } from './requirement-model'
import { withFreshRoute } from './trip-route'
import { pruneGeneratedStops, requirementStop, withStopDemands } from './trip-stops'
import type { Trip } from './types'

type RequirementTripMethods = Pick<Review1Db, 'assignDeliveryRequirement' | 'unassignDeliveryRequirement'>

/**
 * Yêu cầu giao ↔ chuyến (FE-4b-01, FE-4b-04, D-73, D-91). Đưa yêu cầu vào chuyến thì **điểm giao tự sinh** theo địa chỉ và toạ độ của
 * yêu cầu (`trip-stops.ts`): trùng điểm đang có thì gộp, không thì thêm điểm cuối tuyến. Kiện của yêu cầu thành dòng kiện của chuyến,
 * mang ưu tiên của yêu cầu (`REQUIREMENT_CARGO_PRIORITY`, D-93). Yêu cầu chỉ ghi `tripId`; dòng kiện nào là của yêu cầu nào nằm ở
 * `DbState.tripPackageLinks` (`TripPackageLink.requirementId`), điểm giao của yêu cầu là điểm của các dòng đó.
 */

/** Yêu cầu về "chờ xếp chuyến": rời chuyến. */
function backToPending(ctx: DbContext, requirement: DeliveryRequirement): DeliveryRequirement {
  const { tripId: _trip, ...rest } = requirement
  return put(ctx.state.requirements, { ...rest, status: 'PENDING' })
}

const requirementsOf = (ctx: DbContext, tripId: string) => [...ctx.state.requirements.values()].filter((requirement) => requirement.tripId === tripId)

/** Huỷ chuyến trước khi xe chạy (D-91): yêu cầu của chuyến về "chờ xếp chuyến". Kiện đã về kho kiện ở `releaseTripPackages`. */
export function releaseTripRequirements(ctx: DbContext, trip: Trip) {
  for (const requirement of requirementsOf(ctx, trip.id)) backToPending(ctx, requirement)
}

/** Xe xuất phát: yêu cầu của chuyến sang "đang giao". */
export function departTripRequirements(ctx: DbContext, trip: Trip) {
  for (const requirement of requirementsOf(ctx, trip.id)) {
    if (requirement.status === 'ASSIGNED') put(ctx.state.requirements, { ...requirement, status: 'IN_TRIP' })
  }
}

/**
 * Yêu cầu đã vào chuyến vừa đổi hạn hoặc ưu tiên:
 *
 * - đổi ưu tiên, chuyến còn lập kế hoạch: dòng kiện của yêu cầu đổi `priority` / `mustLoad` theo (D-93) — kiện của chuyến đổi nên
 *   phương án đã tối ưu thành lỗi thời (D-31);
 * - hạn và ưu tiên của điểm giao chứa yêu cầu được tính lại (D-73), ở mọi pha chuyến còn chạy — quản lý gia hạn khi có sự cố.
 */
export function syncRequirementOnTrip(ctx: DbContext, requirement: DeliveryRequirement, priorityChanged: boolean) {
  const trip = requirement.tripId === undefined ? undefined : ctx.state.trips.get(requirement.tripId)
  if (!trip || trip.phase === 'cancelled' || trip.phase === 'completed') return
  let current = trip
  if (priorityChanged && trip.phase === 'planning') {
    const lineIds = new Set(tripLinks(ctx, trip.id).filter((link) => link.requirementId === requirement.id).map((link) => link.lineId))
    const cargo = REQUIREMENT_CARGO_PRIORITY[requirement.priority]
    const packages = trip.packages.map((line) => (lineIds.has(line.id) ? { ...line, ...cargo } : line))
    current = put(ctx.state.trips, { ...trip, packages, inputVersion: trip.inputVersion + 1 })
  }
  syncStopDemands(ctx, current)
}

export function requirementTripMethods(ctx: DbContext): RequirementTripMethods {
  const { requirements, packages, trips } = ctx.state
  const scope = ctx.scope.requirements

  return {
    assignDeliveryRequirement: (requirementId, tripId, options = {}) =>
      ctx.respond(() => {
        const requirement = scope.own(requirementId)
        if (requirement.status !== 'PENDING') throw new MockDbError('REQUIREMENT_NOT_PENDING', { requirementId, status: requirement.status })
        const trip = ctx.scope.trips.ref(tripId, requirement.companyId)
        if (trip.phase !== 'planning') throw new MockDbError('TRIP_LOCKED', { tripId, phase: trip.phase })
        const members = requirement.packageIds.map((id) => found(packages, 'packages', id))
        for (const pkg of members) {
          const flag = pkg.flags[0]
          if (flag !== undefined) throw new MockDbError('PACKAGE_FLAGGED', { packageId: pkg.id, flag })
        }
        // Điểm giao của yêu cầu: gộp vào điểm cùng địa chỉ và toạ độ, không có thì sinh điểm mới cuối tuyến (D-73)
        const placed = requirementStop(trip.stops, requirement)
        const stop = placed.stops[placed.index]
        if (!stop) throw new Error(`Chuyến ${tripId} không dựng được điểm giao cho yêu cầu ${requirementId}`)
        const stopNumber = placed.index + 1
        const { cargo, links } = poolLines(ctx, members, trip, stopNumber, { groupId: requirementId, ...REQUIREMENT_CARGO_PRIORITY[requirement.priority] })
        const lines = [...trip.packages, ...cargo]
        // Một chuyến một loại hàng (D-74): kiểm trước khi ghi bất cứ gì; lỗi gọi tên kiện bằng mã của bên gửi
        const codeById = new Map(members.map((pkg) => [pkg.id, pkg.packageCode]))
        const codesOf = (lineId: string) => links.find((link) => link.lineId === lineId)?.packageIds.map((id) => codeById.get(id) ?? id)
        const settled = settleSegregation(ctx, trip, { ...trip, packages: lines, inputVersion: trip.inputVersion + 1 }, { overrideReason: options.overrideReason, codesOf })
        const assigned = put(requirements, { ...requirement, status: 'ASSIGNED', tripId })
        setTripLinks(ctx, tripId, [...tripLinks(ctx, tripId), ...links.map((link) => ({ ...link, requirementId }))])
        const stops = withStopDemands(placed.stops, stopDemandsOf(ctx, { id: tripId, packages: lines }))
        // Điểm mới sinh sau khi đã tối ưu tuyến: chuyến về Nháp; gộp vào điểm đang có thì tính lại mức hạn (PRD v2 mục 7.1)
        const nextTrip = put(trips, withFreshRoute({ ...settled, stops }))
        for (const pkg of members) movePackage(ctx, pkg, 'ASSIGNED', { tripId, stopId: stop.id })
        ctx.log('requirement.assigned', { type: 'requirement', id: requirementId }, {
          destinationName: requirement.destinationName, tripId, stopNumber, count: requirement.packageIds.length,
        })
        return { requirement: assigned, trip: nextTrip }
      }),
    unassignDeliveryRequirement: (requirementId) =>
      ctx.respond(() => {
        const requirement = scope.own(requirementId)
        const { tripId } = requirement
        if (requirement.status !== 'ASSIGNED' || tripId === undefined) {
          throw new MockDbError('REQUIREMENT_STATUS_INVALID', { requirementId, status: requirement.status })
        }
        const trip = found(trips, 'trips', tripId)
        // Gỡ được trước khi kho bắt đầu xếp (D-91)
        if (trip.phase !== 'planning') throw new MockDbError('TRIP_LOCKED', { tripId, phase: trip.phase })
        const links = tripLinks(ctx, tripId)
        const lineIds = new Set(links.filter((link) => link.requirementId === requirementId).map((link) => link.lineId))
        setTripLinks(ctx, tripId, links.filter((link) => link.requirementId !== requirementId))
        const back = backToPending(ctx, requirement)
        // Điểm tự sinh không còn dòng kiện nào tự mất, kiện ở các điểm sau đánh số lại (D-73)
        const pruned = pruneGeneratedStops(trip.stops, trip.packages.filter((pkg) => !lineIds.has(pkg.id)))
        const packagesLeft = [...pruned.packages]
        const stops = withStopDemands(pruned.stops, stopDemandsOf(ctx, { id: tripId, packages: packagesLeft }))
        const settled = settleSegregation(ctx, trip, { ...trip, stops, packages: packagesLeft, inputVersion: trip.inputVersion + 1 })
        const stored = put(trips, withFreshRoute(settled))
        // Dòng của yêu cầu đã bị sửa số lượng mang kiện riêng của chuyến: gỡ dòng thì các kiện đó về kho kiện (FE-3b-07)
        syncTripPool(ctx, stored)
        for (const id of requirement.packageIds) {
          const pkg = found(packages, 'packages', id)
          if (pkg.status !== 'IMPORTED') movePackage(ctx, pkg, 'IMPORTED')
        }
        ctx.log('requirement.unassigned', { type: 'requirement', id: requirementId }, { destinationName: requirement.destinationName, tripId })
        return back
      }),
  }
}
