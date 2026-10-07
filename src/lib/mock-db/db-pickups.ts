import { gt, roundCm, roundKg } from '@/domain/geometry'
import { HANDLING_CLASSES } from '@/domain/models'
import type { PickupsDb } from './db-api-pickups'
import { nextId, optionalText, put, type DbContext } from './db-context'
import { MockDbError } from './errors'
import { tripStatus } from './operations'
import { canTransitionPickup, type PickupPackage, type PickupPoint, type PickupRequest } from './pickup-model'
import { isValidCoordinate } from './requirement-model'

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

/**
 * Yêu cầu nhận hàng dọc đường (FE-7-01, D-88): tạo cho chuyến Đang vận chuyển, đọc, đổi trạng thái theo `PICKUP_TRANSITIONS`. Công ty
 * lọc qua chuyến (`ctx.scope.trips`). Kiểm mười luật, tạo kiện, chèn điểm vào tuyến khi duyệt là việc của lớp trên (FE-7-03, FE-7-04).
 */
export function pickupMethods(ctx: DbContext): PickupsDb {
  const { pickups } = ctx.state

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
    createPickupRequest: (tripId, input) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        const status = tripStatus(trip)
        if (status !== 'IN_TRANSIT') throw new MockDbError('INVALID_TRIP_STATUS_TRANSITION', { tripId, from: status, to: 'IN_TRANSIT' })
        if (input.packages.length === 0) throw new MockDbError('PACKAGES_REQUIRED', {})
        const deadline = deadlineOf(input.deadline)
        return put(pickups, {
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
        })
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
