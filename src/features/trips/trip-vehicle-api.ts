/**
 * Hàm → endpoint backend (FE-0-09, issue BE S6-01); nối backend chỉ thay thân hàm.
 *   changeTripVehicle   → POST /api/trips/{id}/change-vehicle
 *   chưa có ở BE: fetchVehicleChoices
 */
import { vehicleFit, type VehicleFit } from '@/domain/constraints'
import type { VehicleConfig } from '@/domain/models'
import { getMockDb, type Trip, type VehicleStatus } from '@/lib/mock-db'

/** Một xe của công ty trong hộp thoại Đổi xe: trạng thái, và xe có chở được hàng của chuyến không (`vehicleFit`). */
export type VehicleChoice = {
  readonly vehicle: VehicleConfig
  readonly status: VehicleStatus
  /** Chuyến xe đang chạy, khi `status` là `in_use`. */
  readonly busyTripId?: string
  /** Xe chuyến đang dùng. */
  readonly current: boolean
  readonly fit: VehicleFit
  /** Chọn được: không phải xe đang dùng, sẵn sàng, và chở được hàng — đúng các điều kiện kho kiểm khi đổi xe. */
  readonly selectable: boolean
}

export type VehicleChoices = {
  /** Hàng của chuyến: số kiện, tổng khối lượng (kg) và thể tích (cm³) — các số xe được so với. */
  readonly cargo: { readonly count: number; readonly totalKg: number; readonly totalCm3: number }
  /** Xe chọn được đứng trước, rồi xe đang dùng và xe không chọn được; trong mỗi nhóm theo thứ tự của đội xe. */
  readonly choices: readonly VehicleChoice[]
}

/** Xe của công ty kèm lý do chọn được / không chọn được cho chuyến: kết quả `vehicleFit` trên hàng hiện có của chuyến. */
// chưa có ở BE
export async function fetchVehicleChoices(tripId: string): Promise<VehicleChoices> {
  const db = getMockDb()
  const [trip, vehicles, states] = await Promise.all([db.getTrip(tripId), db.listVehicles(), db.listVehicleStates()])
  const stateById = new Map(states.map((state) => [state.vehicleId, state]))
  const choices = vehicles.map((vehicle): VehicleChoice => {
    const state = stateById.get(vehicle.id)
    const status = state?.status ?? 'available'
    const current = vehicle.id === trip.vehicleId
    const fit = vehicleFit(vehicle, trip.packages)
    return {
      vehicle, status, current, fit,
      ...(state?.tripId === undefined ? {} : { busyTripId: state.tripId }),
      selectable: !current && status === 'available' && fit.fits,
    }
  })
  return {
    cargo: {
      count: trip.packages.reduce((sum, pkg) => sum + pkg.quantity, 0),
      totalKg: trip.packages.reduce((sum, pkg) => sum + pkg.weightKg * pkg.quantity, 0),
      totalCm3: trip.packages.reduce((sum, pkg) => sum + pkg.lengthCm * pkg.widthCm * pkg.heightCm * pkg.quantity, 0),
    },
    choices: [...choices.filter((choice) => choice.selectable), ...choices.filter((choice) => !choice.selectable)],
  }
}

/**
 * Đổi xe của chuyến Đã lập kế hoạch (FE-5b-08, D-80): kho kiểm lại xe sẵn sàng và chở được hàng; đổi xong phương án hiện tại lỗi
 * thời, tuyến giữ nguyên.
 */
// POST /api/trips/{id}/change-vehicle
export function changeTripVehicle(tripId: string, vehicleId: string): Promise<Trip> {
  return getMockDb().changeTripVehicle(tripId, vehicleId)
}
