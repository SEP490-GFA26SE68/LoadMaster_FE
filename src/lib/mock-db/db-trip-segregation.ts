import { addedConflicts, OVERRIDE_REASON_MAX_LENGTH, segregation, type Segregation } from '@/domain/constraints'
import { put, type DbContext } from './db-context'
import type { Review1Db } from './db-api-review1'
import { MockDbError } from './errors'
import type { Trip } from './types'

type SegregationMethods = Pick<Review1Db, 'getTripSegregation' | 'overrideTripSegregation'>

/** Phân nhóm hàng của một chuyến kèm lý do vượt luật đã ghi (`GET /api/trips/{id}/segregation`). */
export type TripSegregation = Segregation & { overrideReason?: string }

/** Lý do vượt luật đã bỏ khoảng trắng hai đầu: bắt buộc (`REASON_REQUIRED`), dài tối đa 500 ký tự (`OVERRIDE_REASON_TOO_LONG`). */
function overrideReasonOf(reason: string): string {
  const trimmed = reason.trim()
  if (trimmed === '') throw new MockDbError('REASON_REQUIRED', {})
  if (trimmed.length > OVERRIDE_REASON_MAX_LENGTH) throw new MockDbError('OVERRIDE_REASON_TOO_LONG', { max: OVERRIDE_REASON_MAX_LENGTH })
  return trimmed
}

/**
 * Luật "một chuyến một loại hàng" (FE-4b-06, D-74) cho **mọi** lần dòng kiện của chuyến đổi — đưa yêu cầu giao vào chuyến, đưa kiện
 * thẳng từ kho kiện, gõ / nhập / sửa kiện ngay trong chuyến, tạo chuyến có sẵn kiện. Gọi **trước khi ghi**, với chuyến trước
 * (`before`) và chuyến sắp ghi (`next`); trả chuyến sắp ghi đã mang đúng `overrideReason`:
 *
 * - không còn kiện khác loại đang khoá: gỡ lý do vượt (khoá tự tính lại khi chuyến rỗng);
 * - có xung đột **mới** mà nơi gọi không đưa lý do và chuyến chưa có lý do: từ chối `CARGO_SEGREGATION_CONFLICT` kèm danh sách kiện;
 * - nơi gọi đưa lý do: lưu vào chuyến và ghi nhật ký `trip.segregationOverridden`; chuyến đã có lý do thì kiện khác loại thêm sau đi tiếp.
 *
 * `codesOf`: mã để gọi tên kiện của một dòng trong lỗi (mã của bên gửi với kiện kho kiện); vắng thì dùng mã dòng.
 */
export function settleSegregation(
  ctx: DbContext,
  before: Pick<Trip, 'id' | 'packages' | 'overrideReason'>,
  next: Trip,
  options: { overrideReason?: string; codesOf?: (lineId: string) => readonly string[] | undefined } = {},
): Trip {
  const { overrideReason: _kept, ...rest } = next
  const state = segregation(next.packages, undefined)
  if (state.lockedClass === null || state.conflicts.length === 0) return rest
  const given = options.overrideReason === undefined ? undefined : overrideReasonOf(options.overrideReason)
  if (given === undefined) {
    const added = addedConflicts(before.packages, next.packages)
    if (added.length > 0 && before.overrideReason === undefined) {
      const packages = added.flatMap((conflict) => options.codesOf?.(conflict.packageId) ?? [conflict.packageId])
      throw new MockDbError('CARGO_SEGREGATION_CONFLICT', { tripId: before.id, lockedClass: state.lockedClass, packages })
    }
    return before.overrideReason === undefined ? rest : { ...rest, overrideReason: before.overrideReason }
  }
  logOverride(ctx, before.id, state, given)
  return { ...rest, overrideReason: given }
}

function logOverride(ctx: DbContext, tripId: string, state: Segregation, reason: string) {
  const count = state.conflicts.reduce((sum, conflict) => sum + conflict.count, 0)
  ctx.log('trip.segregationOverridden', { type: 'trip', id: tripId }, { reason, handlingClass: state.lockedClass ?? '', conflictCount: count })
}

export function segregationMethods(ctx: DbContext): SegregationMethods {
  const { trips, vehicles } = ctx.state
  return {
    getTripSegregation: (tripId) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.read(tripId)
        const state = segregation(trip.packages, vehicles.get(trip.vehicleId))
        return trip.overrideReason === undefined ? state : { ...state, overrideReason: trip.overrideReason }
      }),
    overrideTripSegregation: (tripId, reason) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        if (trip.phase !== 'planning') throw new MockDbError('TRIP_LOCKED', { tripId, phase: trip.phase })
        const given = overrideReasonOf(reason)
        const state = segregation(trip.packages, undefined)
        // Chuyến không có kiện khác loại, hoặc lý do không đổi: không ghi gì
        if (state.conflicts.length === 0 || trip.overrideReason === given) return trip
        logOverride(ctx, tripId, state, given)
        return put(trips, { ...trip, overrideReason: given })
      }),
  }
}
