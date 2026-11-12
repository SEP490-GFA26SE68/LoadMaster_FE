import { compareText } from '@/lib/list-filter'
import { getMockDb, type VehicleType, type VehicleTypeAssignment, type VehicleTypeInput } from '@/lib/mock-db'

/**
 * Lớp dữ liệu loại xe của kho mẫu (LM-104). Xe gắn loại tuỳ chọn, lưu ngoài `VehicleConfig` (D-04). Nhóm `fleet` nối backend thì màn
 * là bản của `./backend` (đọc ghi máy chủ qua `backend/vehicle-types-api.ts`), không đi qua file này.
 */

export type VehicleRef = { readonly id: string; readonly name: string }

/** Loại xe của màn: backend không trả công ty hay ngày tạo của loại xe, màn cũng không dùng hai trường đó. */
export type VehicleTypeEntry = Omit<VehicleType, 'companyId' | 'createdAt'>

/** Loại xe kèm các xe đang gắn (mã và tên, theo tên xe). */
export type VehicleTypeRow = { readonly type: VehicleTypeEntry; readonly vehicleIds: readonly string[]; readonly vehicles: readonly VehicleRef[] }

/** Một xe của đội và loại đang gắn (`null` khi chưa gắn) — bảng "Gắn loại cho xe". */
export type VehicleAssignmentRow = { readonly vehicle: VehicleRef; readonly vehicleTypeId: string | null }

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

export function fetchVehicleTypeAssignments(): Promise<VehicleTypeAssignment[]> {
  return getMockDb().listVehicleTypeAssignments()
}

/** Mọi xe của đội (theo tên) kèm loại đang gắn. */
export async function fetchVehicleAssignmentRows(): Promise<VehicleAssignmentRow[]> {
  const db = getMockDb()
  const [vehicles, assignments] = await Promise.all([db.listVehicles(), db.listVehicleTypeAssignments()])
  const typeOf = new Map(assignments.map((item) => [item.vehicleId, item.vehicleTypeId]))
  return vehicles
    .map((vehicle) => ({ vehicle: { id: vehicle.id, name: vehicle.name }, vehicleTypeId: typeOf.get(vehicle.id) ?? null }))
    .toSorted((a, b) => compareText(a.vehicle.name, b.vehicle.name))
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
