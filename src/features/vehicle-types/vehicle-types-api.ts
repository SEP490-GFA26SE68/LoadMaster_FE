import { getMockDb, type VehicleType, type VehicleTypeAssignment, type VehicleTypeInput } from '@/lib/mock-db'

/**
 * Lớp dữ liệu loại xe (LM-104) — backend đã có CRUD thật `/api/vehicle-types` (Spring, `VehicleTypeController`); khi nối chỉ thay thân
 * các hàm ở đây. Xe gắn loại tuỳ chọn, lưu ngoài `VehicleConfig` (D-04).
 */

/** Loại xe kèm các xe đang gắn. */
export type VehicleTypeRow = { readonly type: VehicleType; readonly vehicleIds: readonly string[] }

export async function fetchVehicleTypes(): Promise<VehicleTypeRow[]> {
  const db = getMockDb()
  const [types, assignments] = await Promise.all([db.listVehicleTypes(), db.listVehicleTypeAssignments()])
  return types.map((type) => ({ type, vehicleIds: assignments.filter((item) => item.vehicleTypeId === type.id).map((item) => item.vehicleId) }))
}

export function fetchVehicleTypeAssignments(): Promise<VehicleTypeAssignment[]> {
  return getMockDb().listVehicleTypeAssignments()
}

/** `id` vắng là loại mới (`VT-NNN`). Sai dữ liệu: `VEHICLE_TYPE_INVALID` kèm tên trường. */
export function saveVehicleType(input: VehicleTypeInput, id?: string): Promise<VehicleType> {
  return id === undefined ? getMockDb().createVehicleType(input) : getMockDb().updateVehicleType(id, input)
}

export function deleteVehicleType(id: string): Promise<void> {
  return getMockDb().deleteVehicleType(id)
}

export function setVehicleType(vehicleId: string, vehicleTypeId: string | null): Promise<VehicleTypeAssignment | null> {
  return getMockDb().setVehicleType(vehicleId, vehicleTypeId)
}
