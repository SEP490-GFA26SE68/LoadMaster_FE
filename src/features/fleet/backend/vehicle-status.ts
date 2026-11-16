
import { matchesQuery } from '@/lib/list-filter'
import type { TripPhase } from '@/lib/mock-db'
import type { FleetStatus, FleetVehicleState } from '../vehicle-status'

import type {
  Vehicle,
  VehicleStatus,
} from './vehicles-api'

/**
 * Thứ tự hiển thị trạng thái xe.
 * Đồng bộ với enum VehicleStatus của BE.
 */
export const VEHICLE_STATUSES = [
  'AVAILABLE',
  'IN_TRIP',
  'MAINTENANCE',
  'RETIRED',
] as const satisfies readonly VehicleStatus[]

/**
 * Giá trị bộ lọc trạng thái trên URL.
 */
export const VEHICLE_STATUS_SLUGS = {
  AVAILABLE: 'san-sang',
  IN_TRIP: 'dang-chay',
  MAINTENANCE: 'bao-duong',
  RETIRED: 'ngung-su-dung',
} as const satisfies Record<VehicleStatus, string>

/**
 * Một dòng bảng đội xe.
 * Không cần ghép dữ liệu trạng thái mock nữa.
 */
export type VehicleRow = Vehicle

export function statusFromSlug(
  slug: string,
): VehicleStatus | null {
  return (
    VEHICLE_STATUSES.find(
      (status) =>
        VEHICLE_STATUS_SLUGS[status] === slug,
    ) ?? null
  )
}

/**
 * Thứ tự sắp xếp trạng thái.
 */
export function statusRank(
  status: VehicleStatus,
): number {
  return VEHICLE_STATUSES.indexOf(status)
}

/**
 * Tìm kiếm và lọc trạng thái xe.
 *
 * Lưu ý: hàm chỉ lọc trên danh sách
 * đã tải về từ API, không phải toàn bộ DB.
 */
export function filterVehicleRows(
  rows: readonly VehicleRow[],
  query: string,
  statusSlug: string,
): VehicleRow[] {
  const status = statusFromSlug(statusSlug)

  return rows.filter(
    (row) =>
      (status === null || row.status === status) &&
      matchesQuery(
        [
          row.name,
          row.licensePlate,
          row.id,
          row.vehicleTypeName,
        ],
        query,
      ),
  )
}

const FLEET_STATUS_OF = {
  AVAILABLE: 'available',
  IN_TRIP: 'in_use',
  MAINTENANCE: 'maintenance',
  RETIRED: 'retired',
} as const satisfies Record<VehicleStatus, FleetStatus>

/** Trạng thái chuyến của máy chủ → pha chuyến để ô trạng thái ghi chuyến đang ở bước nào; trạng thái khác không ghi pha. */
const TRIP_PHASE_OF: Readonly<Record<string, TripPhase>> = { LOADING: 'loading', IN_TRANSIT: 'delivering' }

/**
 * Xe của máy chủ → trạng thái dùng chung với màn kho mẫu (`VehicleStatusCell`, `VehicleStateBanner`): chuyến đang dùng xe (mã chuyến
 * của máy chủ) và ghi chú, mốc bắt đầu bảo dưỡng.
 */
export function fleetStateOf(vehicle: Vehicle): FleetVehicleState {
  const tripPhase = vehicle.currentTrip ? TRIP_PHASE_OF[vehicle.currentTrip.status] : undefined
  return {
    vehicleId: vehicle.id,
    status: FLEET_STATUS_OF[vehicle.status],
    ...(vehicle.status === 'IN_TRIP' && vehicle.currentTrip ? { tripId: vehicle.currentTrip.code } : {}),
    ...(tripPhase ? { tripPhase } : {}),
    ...(vehicle.status === 'MAINTENANCE' && vehicle.maintenance ? { maintenance: vehicle.maintenance } : {}),
  }
}
