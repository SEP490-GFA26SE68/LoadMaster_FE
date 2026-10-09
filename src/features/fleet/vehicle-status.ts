import type { VehicleConfig } from '@/domain/models'
import { matchesQuery } from '@/lib/list-filter'
import type { TripPhase, VehicleState, VehicleStatus } from '@/lib/mock-db'

/** Thứ tự hiển thị và thứ tự khi sắp xếp theo trạng thái: sẵn sàng trước, bảo dưỡng sau cùng. */
export const VEHICLE_STATUSES = ['available', 'in_use', 'maintenance'] as const satisfies readonly VehicleStatus[]

/** Giá trị bộ lọc `trang-thai` trên URL, tiếng Việt không dấu như mọi tham số của màn danh sách (D-52). */
export const VEHICLE_STATUS_SLUGS = {
  available: 'san-sang',
  in_use: 'dang-chay',
  maintenance: 'bao-duong',
} as const satisfies Record<VehicleStatus, string>

/** Trạng thái xe kèm pha của chuyến đang dùng nó (khi `in_use`): danh sách ghi "TRIP-011 · Đang xếp hàng". */
export type FleetVehicleState = VehicleState & { readonly tripPhase?: TripPhase }

/** Một dòng của bảng đội xe: cấu hình xe kèm trạng thái của kho (D-53, trạng thái lưu ngoài `VehicleConfig` theo D-04). */
export type VehicleRow = VehicleConfig & { readonly state: FleetVehicleState }

export function statusFromSlug(slug: string): VehicleStatus | null {
  return VEHICLE_STATUSES.find((status) => VEHICLE_STATUS_SLUGS[status] === slug) ?? null
}

export function statusRank(status: VehicleStatus): number {
  return VEHICLE_STATUSES.indexOf(status)
}

/**
 * Ghép xe với trạng thái theo mã. Xe không có trong danh sách trạng thái (vừa tạo, trạng thái chưa đọc lại) là Sẵn sàng:
 * xe mới chưa chạy chuyến nào và chưa ai đặt bảo dưỡng.
 */
export function vehicleRows(vehicles: readonly VehicleConfig[], states: readonly FleetVehicleState[]): VehicleRow[] {
  const byId = new Map(states.map((state) => [state.vehicleId, state]))
  return vehicles.map((vehicle) => ({
    ...vehicle,
    state: byId.get(vehicle.id) ?? { vehicleId: vehicle.id, status: 'available' },
  }))
}

/**
 * Tìm bỏ dấu theo tên xe (có biển số), mã xe, chuyến đang chạy và ghi chú bảo dưỡng; lọc theo slug trạng thái. Slug rỗng
 * hoặc lạ (URL sửa tay) là không lọc.
 */
export function filterVehicleRows(rows: readonly VehicleRow[], query: string, statusSlug: string): VehicleRow[] {
  const status = statusFromSlug(statusSlug)
  return rows.filter((row) => (status === null || row.state.status === status)
    && matchesQuery([row.name, row.id, row.state.tripId, row.state.maintenance?.note], query))
}

export type FleetRanges = {
  readonly count: number
  readonly payloadKg: readonly [min: number, max: number]
  readonly lengthCm: readonly [min: number, max: number]
}

/** Số xe, khoảng tải trọng và khoảng chiều dài thùng của cả đội — dòng số dưới tiêu đề; đội rỗng thì `null`, không có số nào để nói. */
export function fleetRanges(vehicles: readonly VehicleConfig[]): FleetRanges | null {
  if (vehicles.length === 0) return null
  const payloads = vehicles.map((vehicle) => vehicle.maxPayloadKg)
  const lengths = vehicles.map((vehicle) => vehicle.innerLengthCm)
  return {
    count: vehicles.length,
    payloadKg: [Math.min(...payloads), Math.max(...payloads)],
    lengthCm: [Math.min(...lengths), Math.max(...lengths)],
  }
}
