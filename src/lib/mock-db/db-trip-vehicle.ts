import { vehicleFit } from '@/domain/constraints'
import { put, type DbContext } from './db-context'
import { activeTripOf } from './db-vehicles'
import { MockDbError } from './errors'
import { tripStatus } from './operations'
import type { MockDb } from './types'
import { withTypeLimits } from './vehicle-limits'

type TripVehicleMethods = Pick<MockDb, 'changeTripVehicle'>

/**
 * Đổi xe của chuyến Đã lập kế hoạch (FE-5b-08, D-80). Kho kiểm lại mọi điều kiện — nơi gọi bỏ qua giao diện vẫn bị từ chối: xe cùng
 * công ty, khác xe đang dùng, **sẵn sàng** (không bảo dưỡng, không chạy chuyến khác) và chở được hàng của chuyến (`vehicleFit` trên
 * xe đã ghép giới hạn của loại xe, như kho trả xe ra). Xe là đầu vào tối ưu: `inputVersion` tăng, mọi phương án của chuyến lỗi thời —
 * bản đã duyệt cũng phải tối ưu lại rồi duyệt. Điểm giao không đổi nên tuyến (`routePlan`) và trạng thái Đã lập kế hoạch giữ nguyên.
 */
export function tripVehicleMethods(ctx: DbContext): TripVehicleMethods {
  const { trips, maintenance, vehicleTypes, vehicleTypeOf } = ctx.state
  return {
    changeTripVehicle: (tripId, vehicleId) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        if (trip.phase !== 'planning') throw new MockDbError('TRIP_LOCKED', { tripId, phase: trip.phase })
        if (tripStatus(trip) !== 'PLANNED') throw new MockDbError('TRIP_NOT_PLANNED', { tripId })
        const stored = ctx.scope.vehicles.ref(vehicleId, trip.companyId)
        if (vehicleId === trip.vehicleId) throw new MockDbError('VEHICLE_UNCHANGED', { vehicleId })
        if (maintenance.has(vehicleId)) throw new MockDbError('VEHICLE_IN_MAINTENANCE', { vehicleId })
        const running = activeTripOf(trips.values(), vehicleId)
        if (running) throw new MockDbError('VEHICLE_BUSY', { vehicleId, tripId: running.id })
        const vehicle = withTypeLimits(stored, vehicleTypes.get(vehicleTypeOf.get(vehicleId) ?? ''))
        const reasons = vehicleFit(vehicle, trip.packages).issues.flatMap((issue) => (issue.severity === 'error' ? [issue.code] : []))
        if (reasons.length > 0) throw new MockDbError('VEHICLE_UNFIT', { vehicleId, reasons })
        // `fields` như sự kiện sửa chuyến: thanh "kết quả lỗi thời" đọc được lần đổi xe này là lý do
        ctx.log('trip.vehicleChanged', { type: 'trip', id: tripId }, { fields: 'vehicleId', before: trip.vehicleId, after: vehicleId })
        return put(trips, { ...trip, vehicleId, inputVersion: trip.inputVersion + 1 })
      }),
  }
}
