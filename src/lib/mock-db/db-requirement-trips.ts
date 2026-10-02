import { nextPackageId } from '@/domain/cargo'
import type { CargoPackage } from '@/domain/models'
import { found, put, type DbContext } from './db-context'
import type { Review1Db } from './db-api-review1'
import { movePackage } from './db-packages'
import { syncTripPool } from './db-trip-packages'
import { MockDbError } from './errors'
import type { Package } from './package-model'
import { cargoFromPackage } from './package-type-cargo'
import { REQUIREMENT_CARGO_PRIORITY, type DeliveryRequirement } from './requirement-model'
import type { Trip } from './types'

type RequirementTripMethods = Pick<Review1Db, 'assignDeliveryRequirement' | 'unassignDeliveryRequirement'>

/**
 * Yêu cầu giao ↔ chuyến (FE-4b-01, D-91). *(tạm, tới FE-4b-04)* Điều phối viên chọn điểm giao có sẵn của chuyến; điểm giao tự sinh
 * theo địa chỉ và toạ độ của yêu cầu là việc của FE-4b-04. Kiện của yêu cầu thành dòng kiện của chuyến, mang ưu tiên của yêu cầu
 * (`REQUIREMENT_CARGO_PRIORITY`, D-93).
 */

/** Yêu cầu về "chờ xếp chuyến": rời chuyến, bỏ điểm giao và dòng kiện đã sinh. */
function backToPending(ctx: DbContext, requirement: DeliveryRequirement): DeliveryRequirement {
  const { tripId: _trip, assignment: _assignment, ...rest } = requirement
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
 * Đổi ưu tiên của yêu cầu đã vào chuyến: dòng kiện của nó trong chuyến còn lập kế hoạch đổi `priority` / `mustLoad` theo (D-93) —
 * kiện của chuyến đổi nên phương án đã tối ưu thành lỗi thời (D-31). Chuyến đã sang vận hành thì không đổi gì.
 */
export function syncRequirementPriority(ctx: DbContext, requirement: DeliveryRequirement) {
  const trip = requirement.tripId === undefined ? undefined : ctx.state.trips.get(requirement.tripId)
  if (!trip || trip.phase !== 'planning' || !requirement.assignment) return
  const lineIds = new Set(requirement.assignment.lines.map((line) => line.lineId))
  const cargo = REQUIREMENT_CARGO_PRIORITY[requirement.priority]
  const packages = trip.packages.map((line) => (lineIds.has(line.id) ? { ...line, ...cargo } : line))
  put(ctx.state.trips, { ...trip, packages, inputVersion: trip.inputVersion + 1 })
}

export function requirementTripMethods(ctx: DbContext): RequirementTripMethods {
  const { requirements, packages, trips, packageTypes } = ctx.state
  const scope = ctx.scope.requirements

  /**
   * Kiện của yêu cầu thành dòng kiện mới của chuyến, theo thứ tự kiện trong yêu cầu: các kiện cùng loại kiện, cùng kích thước, khối
   * lượng và loại hàng gộp một dòng; kiện không có loại kiện mỗi kiện một dòng (tên dòng là mã kiện của bên gửi). `groupId` là mã yêu cầu.
   */
  function requirementLines(requirement: DeliveryRequirement, trip: Trip, stopNumber: number) {
    const groups = new Map<string, Package[]>()
    for (const id of requirement.packageIds) {
      const pkg = found(packages, 'packages', id)
      const key = pkg.packageTypeId === undefined
        ? pkg.id
        : [pkg.packageTypeId, pkg.lengthCm, pkg.widthCm, pkg.heightCm, pkg.weightKg, pkg.handlingClass].join('|')
      groups.set(key, [...(groups.get(key) ?? []), pkg])
    }
    const ids = trip.packages.map((pkg) => pkg.id)
    const cargo: CargoPackage[] = []
    const lines: { lineId: string; packageIds: string[] }[] = []
    for (const members of groups.values()) {
      const first = members[0]
      if (!first) continue
      const lineId = nextPackageId(ids)
      ids.push(lineId)
      const type = first.packageTypeId === undefined ? undefined : found(packageTypes, 'packageTypes', first.packageTypeId)
      const line = cargoFromPackage(first, type, { id: lineId, quantity: members.length, deliveryStop: stopNumber, groupId: requirement.id })
      cargo.push({ ...line, ...REQUIREMENT_CARGO_PRIORITY[requirement.priority] })
      lines.push({ lineId, packageIds: members.map((pkg) => pkg.id) })
    }
    return { cargo, lines }
  }

  return {
    assignDeliveryRequirement: (requirementId, tripId, stopId) =>
      ctx.respond(() => {
        const requirement = scope.own(requirementId)
        if (requirement.status !== 'PENDING') throw new MockDbError('REQUIREMENT_NOT_PENDING', { requirementId, status: requirement.status })
        const trip = ctx.scope.trips.ref(tripId, requirement.companyId)
        if (trip.phase !== 'planning') throw new MockDbError('TRIP_LOCKED', { tripId, phase: trip.phase })
        const stopIndex = trip.stops.findIndex((stop) => stop.id === stopId)
        if (stopIndex === -1) throw new MockDbError('STOP_NOT_FOUND', { tripId, stopId })
        const members = requirement.packageIds.map((id) => found(packages, 'packages', id))
        for (const pkg of members) {
          const flag = pkg.flags[0]
          if (flag !== undefined) throw new MockDbError('PACKAGE_FLAGGED', { packageId: pkg.id, flag })
        }
        const { cargo, lines } = requirementLines(requirement, trip, stopIndex + 1)
        const nextTrip = put(trips, { ...trip, packages: [...trip.packages, ...cargo], inputVersion: trip.inputVersion + 1 })
        for (const pkg of members) movePackage(ctx, pkg, 'ASSIGNED', { tripId, stopId })
        const assignment = { stopId, lines, at: ctx.nowIso(), by: ctx.state.session.userId }
        ctx.log('requirement.assigned', { type: 'requirement', id: requirementId }, {
          destinationName: requirement.destinationName, tripId, stopNumber: stopIndex + 1, count: requirement.packageIds.length,
        })
        return { requirement: put(requirements, { ...requirement, status: 'ASSIGNED', tripId, assignment }), trip: nextTrip }
      }),
    unassignDeliveryRequirement: (requirementId) =>
      ctx.respond(() => {
        const requirement = scope.own(requirementId)
        const { tripId, assignment } = requirement
        if (requirement.status !== 'ASSIGNED' || tripId === undefined || !assignment) {
          throw new MockDbError('REQUIREMENT_STATUS_INVALID', { requirementId, status: requirement.status })
        }
        const trip = found(trips, 'trips', tripId)
        // Gỡ được trước khi kho bắt đầu xếp (D-91)
        if (trip.phase !== 'planning') throw new MockDbError('TRIP_LOCKED', { tripId, phase: trip.phase })
        const lineIds = new Set(assignment.lines.map((line) => line.lineId))
        const stored = put(trips, { ...trip, packages: trip.packages.filter((pkg) => !lineIds.has(pkg.id)), inputVersion: trip.inputVersion + 1 })
        // Dòng của yêu cầu đã bị sửa số lượng mang kiện riêng của chuyến: gỡ dòng thì các kiện đó về kho kiện (FE-3b-07)
        syncTripPool(ctx, stored)
        for (const id of requirement.packageIds) {
          const pkg = found(packages, 'packages', id)
          if (pkg.status !== 'IMPORTED') movePackage(ctx, pkg, 'IMPORTED')
        }
        ctx.log('requirement.unassigned', { type: 'requirement', id: requirementId }, { destinationName: requirement.destinationName, tripId })
        return backToPending(ctx, requirement)
      }),
  }
}
