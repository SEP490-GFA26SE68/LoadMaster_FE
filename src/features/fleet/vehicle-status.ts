import type { VehicleConfig } from '@/domain/models'
import { matchesQuery } from '@/lib/list-filter'
import type { TripPhase, VehicleState, VehicleStatus } from '@/lib/mock-db'

/** Thứ tự hiển thị và thứ tự khi sắp xếp theo trạng thái: sẵn sàng trước, bảo dưỡng sau cùng. */
export const VEHICLE_STATUSES = ['available', 'in_use', 'maintenance'] as const satisfies readonly VehicleStatus[]

/** Trạng thái xe của Đội xe: ba trạng thái của kho mẫu, và "Ngừng sử dụng" chỉ backend có (`RETIRED`). */
export type FleetStatus = VehicleStatus | 'retired'

/** Mọi trạng thái của Đội xe theo thứ tự hiển thị; kho mẫu chỉ dùng `VEHICLE_STATUSES`. */
export const FLEET_STATUSES = [...VEHICLE_STATUSES, 'retired'] as const satisfies readonly FleetStatus[]

/** Giá trị bộ lọc `trang-thai` trên URL, tiếng Việt không dấu như mọi tham số của màn danh sách (D-52). */
export const VEHICLE_STATUS_SLUGS = {
  available: 'san-sang',
  in_use: 'dang-chay',
  maintenance: 'bao-duong',
  retired: 'ngung-su-dung',
} as const satisfies Record<FleetStatus, string>

/** Trạng thái xe kèm pha của chuyến đang dùng nó (khi `in_use`): danh sách ghi "TRIP-011 · Đang xếp hàng". */
export type FleetVehicleState = Omit<VehicleState, 'status'> & { readonly status: FleetStatus; readonly tripPhase?: TripPhase }

/**
 * Xe của Đội xe: cấu hình của Spec, kèm `doorUnknown` khi nguồn dữ liệu không có kích thước cửa (loại xe của backend chưa khai cửa) —
 * cửa khi đó là mặt cắt lòng thùng để mô hình dựng được, và màn nói rõ là chưa khai.
 */
export type FleetVehicle = VehicleConfig & { readonly doorUnknown?: true }

/** Một dòng của bảng đội xe: cấu hình xe kèm trạng thái của kho (D-53, trạng thái lưu ngoài `VehicleConfig` theo D-04). */
export type VehicleRow = VehicleConfig & { readonly state: FleetVehicleState }

/** Slug lạ, hoặc của trạng thái mà nguồn dữ liệu không có (`statuses`), là không lọc. */
export function statusFromSlug(slug: string, statuses: readonly FleetStatus[] = VEHICLE_STATUSES): FleetStatus | null {
  return statuses.find((status) => VEHICLE_STATUS_SLUGS[status] === slug) ?? null
}

export function statusRank(status: FleetStatus): number {
  return FLEET_STATUSES.indexOf(status)
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
export function filterVehicleRows(
  rows: readonly VehicleRow[],
  query: string,
  statusSlug: string,
  statuses: readonly FleetStatus[] = VEHICLE_STATUSES,
): VehicleRow[] {
  const status = statusFromSlug(statusSlug, statuses)
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
