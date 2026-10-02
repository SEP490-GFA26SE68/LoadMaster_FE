/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   fetchVehicleTypes → GET /api/vehicle-types (xe đang gắn loại: chưa có ở BE)
 *   saveVehicleType   → POST /api/vehicle-types (tạo) · PUT /api/vehicle-types/{id} (sửa — kiểm lại phương thức khi nối)
 *   deleteVehicleType → DELETE /api/vehicle-types/{id}
 *   chưa có ở BE: fetchVehicleTypeAssignments, fetchVehicleAssignmentRows, setVehicleType
 */

import { compareText } from '@/lib/list-filter'
import { getMockDb, type VehicleType, type VehicleTypeAssignment, type VehicleTypeInput } from '@/lib/mock-db'

/**
 * Lớp dữ liệu loại xe (LM-104) — backend đã có CRUD thật `/api/vehicle-types` (Spring, `VehicleTypeController`); khi nối chỉ thay thân
 * các hàm ở đây. Xe gắn loại tuỳ chọn, lưu ngoài `VehicleConfig` (D-04).
 */

export type VehicleRef = { readonly id: string; readonly name: string }

/** Loại xe kèm các xe đang gắn (mã và tên, theo tên xe). */
export type VehicleTypeRow = { readonly type: VehicleType; readonly vehicleIds: readonly string[]; readonly vehicles: readonly VehicleRef[] }

/** Một xe của đội và loại đang gắn (`null` khi chưa gắn) — bảng "Gắn loại cho xe". */
export type VehicleAssignmentRow = { readonly vehicle: VehicleRef; readonly vehicleTypeId: string | null }

// GET /api/vehicle-types (xe đang gắn loại: chưa có ở BE)
export async function fetchVehicleTypes(): Promise<VehicleTypeRow[]> {
  const db = getMockDb()
  const [types, assignments, vehicles] = await Promise.all([db.listVehicleTypes(), db.listVehicleTypeAssignments(), db.listVehicles()])
  const nameOf = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.name]))
  return types.map((type) => {
    const vehicleIds = assignments.filter((item) => item.vehicleTypeId === type.id).map((item) => item.vehicleId)
    const refs = vehicleIds.map((id) => ({ id, name: nameOf.get(id) ?? id })).toSorted((a, b) => compareText(a.name, b.name))
    return { type, vehicleIds, vehicles: refs }
  })
}

// chưa có ở BE
export function fetchVehicleTypeAssignments(): Promise<VehicleTypeAssignment[]> {
  return getMockDb().listVehicleTypeAssignments()
}

/** Mọi xe của đội (theo tên) kèm loại đang gắn. */
// chưa có ở BE
export async function fetchVehicleAssignmentRows(): Promise<VehicleAssignmentRow[]> {
  const db = getMockDb()
  const [vehicles, assignments] = await Promise.all([db.listVehicles(), db.listVehicleTypeAssignments()])
  const typeOf = new Map(assignments.map((item) => [item.vehicleId, item.vehicleTypeId]))
  return vehicles
    .map((vehicle) => ({ vehicle: { id: vehicle.id, name: vehicle.name }, vehicleTypeId: typeOf.get(vehicle.id) ?? null }))
    .toSorted((a, b) => compareText(a.vehicle.name, b.vehicle.name))
}

/** `id` vắng là loại mới (`VT-NNN`). Sai dữ liệu: `VEHICLE_TYPE_INVALID` kèm tên trường. */
// POST /api/vehicle-types (tạo) · PUT /api/vehicle-types/{id} (sửa — kiểm lại phương thức khi nối)
export function saveVehicleType(input: VehicleTypeInput, id?: string): Promise<VehicleType> {
  return id === undefined ? getMockDb().createVehicleType(input) : getMockDb().updateVehicleType(id, input)
}

// DELETE /api/vehicle-types/{id}
export function deleteVehicleType(id: string): Promise<void> {
  return getMockDb().deleteVehicleType(id)
}

// chưa có ở BE
export function setVehicleType(vehicleId: string, vehicleTypeId: string | null): Promise<VehicleTypeAssignment | null> {
  return getMockDb().setVehicleType(vehicleId, vehicleTypeId)
}
