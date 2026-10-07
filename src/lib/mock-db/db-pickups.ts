import { gt, roundCm, roundKg } from '@/domain/geometry'
import { HANDLING_CLASSES } from '@/domain/models'
import { evaluatePickup, type PickupRuleResult } from '@/domain/pickup'
import type { Role } from '@/types/user'
import type { PickupsDb } from './db-api-pickups'
import { nextId, optionalText, put, type DbContext } from './db-context'
import { MockDbError } from './errors'
import { tripStatus } from './operations'
import { createPickupPackages } from './db-pickup-packages'
import { pickupEntries } from './db-pickup-progress'
import { insertPickupIntoTrip } from './db-pickup-stops'
import { buildPickupContext } from './pickup-context'
import { canTransitionPickup, MAX_PICKUP_REASON_LENGTH, type PickupPackage, type PickupPoint, type PickupRequest } from './pickup-model'
import { isValidCoordinate } from './requirement-model'
import type { Trip } from './types'

const invalid = (field: string) => new MockDbError('PICKUP_INVALID', { field })

/** Điểm nhận hoặc điểm giao đã chuẩn hoá: tên, địa chỉ không trống, toạ độ hợp lệ. */
function pointOf(point: PickupPoint, field: 'pickup' | 'delivery'): PickupPoint {
  const name = point.name.trim()
  const address = point.address.trim()
  if (name === '') throw invalid(`${field}.name`)
  if (address === '') throw invalid(`${field}.address`)
  if (!isValidCoordinate(point.lat, point.lng)) throw invalid(`${field}.coordinates`)
  return { name, address, lat: point.lat, lng: point.lng }
}

const SIZE_FIELDS = ['lengthCm', 'widthCm', 'heightCm', 'weightKg'] as const

/** Kiện đã làm tròn tại biên (D-03); trường sai: `PICKUP_INVALID` kèm tên trường. */
function packageOf(pkg: PickupPackage): PickupPackage {
  const packageCode = pkg.packageCode.trim()
  if (packageCode === '') throw invalid('packages.packageCode')
  for (const field of SIZE_FIELDS) {
    if (!Number.isFinite(pkg[field]) || !gt(pkg[field], 0)) throw invalid(`packages.${field}`)
  }
  if (!HANDLING_CLASSES.includes(pkg.handlingClass)) throw invalid('packages.handlingClass')
  return {
    packageCode, lengthCm: roundCm(pkg.lengthCm), widthCm: roundCm(pkg.widthCm), heightCm: roundCm(pkg.heightCm),
    weightKg: roundKg(pkg.weightKg), handlingClass: pkg.handlingClass,
  }
}

function deadlineOf(deadline: string | undefined): string | undefined {
  if (deadline === undefined) return undefined
  const ms = Date.parse(deadline)
  if (Number.isNaN(ms)) throw invalid('deadline')
  return new Date(ms).toISOString()
}

/** Mười luật đạt cả mười: yêu cầu `VALIDATED`; còn luật không đạt thì `PENDING`, chờ điều phối viên quyết. */
const statusOf = (results: readonly PickupRuleResult[]): 'VALIDATED' | 'PENDING' => (results.every((result) => result.passed) ? 'VALIDATED' : 'PENDING')

/**
 * Yêu cầu nhận hàng dọc đường (FE-7-01, D-88): tạo cho chuyến Đang vận chuyển, kiểm mười luật (FE-7-03), đọc, đổi trạng thái theo
 * `PICKUP_TRANSITIONS`. Công ty lọc qua chuyến (`ctx.scope.trips`), vai trò xét như hàm sự cố cấp chuyến (`db-exceptions.ts`).
 */
export function pickupMethods(ctx: DbContext): PickupsDb {
  const { pickups, users } = ctx.state

  const sessionUser = () => (ctx.state.session.userId === null ? undefined : users.get(ctx.state.session.userId))

  /** Việc của một vai trò; kho không có phiên (test logic) thì không xét. Tài xế chỉ làm trên chuyến của mình. */
  function assertRole(trip: Trip, ...roles: Role[]) {
    const user = sessionUser()
    if (user === undefined) return
    if (!roles.includes(user.role) || (user.role === 'driver' && trip.driverId !== user.id)) throw new MockDbError('ROLE_NOT_ALLOWED', { role: user.role })
  }

  /** Yêu cầu `pickupId` của chuyến `tripId`; không có, hoặc thuộc chuyến khác: `NOT_FOUND`. */
  function pickupOf(tripId: string, pickupId: string): PickupRequest {
    const pickup = pickups.get(pickupId)
    if (pickup?.tripId !== tripId) throw new MockDbError('NOT_FOUND', { collection: 'pickups', id: pickupId })
    return pickup
  }

  return {
    listPickupRequests: (tripId) =>
      ctx.respond(() => {
        ctx.scope.trips.read(tripId)
        return [...pickups.values()].filter((pickup) => pickup.tripId === tripId)
      }),
    getPickupRequest: (tripId, pickupId) =>
      ctx.respond(() => {
        ctx.scope.trips.read(tripId)
        return pickupOf(tripId, pickupId)
      }),
    listPickupPackages: (tripId) =>
      ctx.respond(() => {
        ctx.scope.trips.read(tripId)
        return pickupEntries(ctx, tripId).map(({ pkg }) => pkg)
      }),
    createPickupRequest: (tripId, input) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertRole(trip, 'dispatcher', 'driver')
        const status = tripStatus(trip)
        if (status !== 'IN_TRANSIT') throw new MockDbError('INVALID_TRIP_STATUS_TRANSITION', { tripId, from: status, to: 'IN_TRANSIT' })
        if (input.packages.length === 0) throw new MockDbError('PACKAGES_REQUIRED', {})
        const deadline = deadlineOf(input.deadline)
        const draft: PickupRequest = {
          id: nextId('PKR', pickups.keys()),
          companyId: trip.companyId,
          tripId,
          pickup: pointOf(input.pickup, 'pickup'),
          delivery: pointOf(input.delivery, 'delivery'),
          ...(deadline === undefined ? {} : { deadline }),
          packages: input.packages.map(packageOf),
          status: 'PENDING',
          validationResults: [],
          createdAt: ctx.nowIso(),
          createdBy: ctx.state.session.userId,
        }
        // Kiểm trước khi ghi: không dựng được ngữ cảnh (điểm chưa có toạ độ) thì không ghi gì
        const validationResults = evaluatePickup(buildPickupContext(ctx, trip, draft))
        const stored = put(pickups, { ...draft, validationResults, status: statusOf(validationResults) })
        ctx.log('pickup.requested', { type: 'trip', id: tripId }, {
          pickupId: stored.id, count: stored.packages.length, failedRules: validationResults.filter((result) => !result.passed).length,
        })
        return stored
      }),
    validatePickupRequest: (tripId, pickupId) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertRole(trip, 'dispatcher', 'driver')
        const current = pickupOf(tripId, pickupId)
        if (current.status !== 'PENDING' && current.status !== 'VALIDATED') {
          throw new MockDbError('INVALID_PICKUP_STATUS_TRANSITION', { pickupId, from: current.status, to: 'VALIDATED' })
        }
        const validationResults = evaluatePickup(buildPickupContext(ctx, trip, current))
        return put(pickups, { ...current, validationResults, status: statusOf(validationResults) })
      }),
    approvePickupRequest: (tripId, pickupId, input = {}) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertRole(trip, 'dispatcher')
        const current = pickupOf(tripId, pickupId)
        if (!canTransitionPickup(current.status, 'APPROVED')) throw new MockDbError('INVALID_PICKUP_STATUS_TRANSITION', { pickupId, from: current.status, to: 'APPROVED' })
        if (trip.phase !== 'delivering') throw new MockDbError('TRIP_PHASE_INVALID', { tripId, phase: trip.phase })
        // Kiểm lại trên chuyến lúc này: xe đã đi tiếp từ lúc gửi yêu cầu
        const context = buildPickupContext(ctx, trip, current)
        const validationResults = evaluatePickup(context)
        const failed = validationResults.filter((result) => !result.passed).length
        const overrideReason = failed === 0 ? undefined : optionalText(input.overrideReason)?.slice(0, MAX_PICKUP_REASON_LENGTH)
        if (failed > 0 && overrideReason === undefined) throw new MockDbError('REASON_REQUIRED', {})
        const inserted = insertPickupIntoTrip(ctx, trip, current, context.stops)
        const created = createPickupPackages(ctx, current, inserted.deliveryStopId)
        const { overrideReason: _earlier, ...kept } = current
        const request = put(pickups, {
          ...kept, validationResults, status: 'APPROVED', approvedAt: ctx.nowIso(), approvedBy: ctx.state.session.userId,
          packageIds: created.map((pkg) => pkg.id), pickupStopId: inserted.pickupStopId, deliveryStopId: inserted.deliveryStopId,
          ...(overrideReason === undefined ? {} : { overrideReason }),
        })
        ctx.log('pickup.approved', { type: 'trip', id: tripId }, {
          pickupId, count: created.length, failedRules: failed, ...(overrideReason === undefined ? {} : { reason: overrideReason }),
          ...(trip.driverId === null ? {} : { driverId: trip.driverId }),
        })
        return { request, packages: created }
      }),
    rejectPickupRequest: (tripId, pickupId, reason) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertRole(trip, 'dispatcher')
        const current = pickupOf(tripId, pickupId)
        if (!canTransitionPickup(current.status, 'REJECTED')) throw new MockDbError('INVALID_PICKUP_STATUS_TRANSITION', { pickupId, from: current.status, to: 'REJECTED' })
        const rejectReason = optionalText(reason)?.slice(0, MAX_PICKUP_REASON_LENGTH)
        if (rejectReason === undefined) throw new MockDbError('REASON_REQUIRED', {})
        ctx.log('pickup.rejected', { type: 'trip', id: tripId }, { pickupId, reason: rejectReason, ...(trip.driverId === null ? {} : { driverId: trip.driverId }) })
        return put(pickups, { ...current, status: 'REJECTED', rejectReason, rejectedAt: ctx.nowIso(), rejectedBy: ctx.state.session.userId })
      }),
    updatePickupStatus: (tripId, pickupId, status, details = {}) =>
      ctx.respond(() => {
        ctx.scope.trips.own(tripId)
        const current = pickupOf(tripId, pickupId)
        if (!canTransitionPickup(current.status, status)) {
          throw new MockDbError('INVALID_PICKUP_STATUS_TRANSITION', { pickupId, from: current.status, to: status })
        }
        const overrideReason = optionalText(details.overrideReason) ?? current.overrideReason
        return put(pickups, {
          ...current,
          status,
          validationResults: details.validationResults ?? current.validationResults,
          ...(overrideReason === undefined ? {} : { overrideReason }),
          ...(status === 'APPROVED' ? { approvedAt: ctx.nowIso(), approvedBy: ctx.state.session.userId } : {}),
        })
      }),
  }
}
