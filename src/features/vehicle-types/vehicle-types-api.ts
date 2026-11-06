/**
 * Hàm → endpoint backend (FE-0-09). Nhóm `fleet` nối backend (`usesBackend('fleet')`, thân hàm ở `fleet/fleet-backend-api.ts`), chỉ phần đọc:
 *   fetchVehicleTypes          → GET /api/vehicle-types · GET /api/vehicles
 *   fetchVehicleAssignmentRows → GET /api/vehicles
 *   chưa dùng ở màn: saveVehicleType → POST /api/vehicle-types (tạo)
 *   chưa có ở BE: saveVehicleType (sửa), deleteVehicleType, setVehicleType, fetchVehicleTypeAssignments
 */

import { readBackendAssignments, readBackendVehicleTypes } from '@/features/fleet/fleet-backend-api'
import { ApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import { compareText } from '@/lib/list-filter'
import { getMockDb, type VehicleType, type VehicleTypeAssignment, type VehicleTypeInput } from '@/lib/mock-db'

/**
 * Lớp dữ liệu loại xe (LM-104): kho mẫu, hoặc backend khi nhóm `fleet` bật — việc làm được theo nguồn ở `FLEET_CAPABILITIES`
 * (`fleet/vehicles-api.ts`). Xe gắn loại tuỳ chọn ở kho mẫu, lưu ngoài `VehicleConfig` (D-04); ở backend mọi xe đều có loại.
 */

const ON_BACKEND = usesBackend('fleet')

/** Việc backend chưa có: màn đã ẩn nút, lỡ gọi tới thì từ chối — không bao giờ báo thành công giả hay ghi kho mẫu thay. */
const unsupported = (): Promise<never> => Promise.reject(new ApiError('NOT_SUPPORTED'))

export type VehicleRef = { readonly id: string; readonly name: string }

/** Loại xe của màn: backend không trả công ty hay ngày tạo của loại xe, màn cũng không dùng hai trường đó. */
export type VehicleTypeEntry = Omit<VehicleType, 'companyId' | 'createdAt'>

/** Loại xe kèm các xe đang gắn (mã và tên, theo tên xe). */
export type VehicleTypeRow = { readonly type: VehicleTypeEntry; readonly vehicleIds: readonly string[]; readonly vehicles: readonly VehicleRef[] }

/** Một xe của đội và loại đang gắn (`null` khi chưa gắn) — bảng "Gắn loại cho xe". */
export type VehicleAssignmentRow = { readonly vehicle: VehicleRef; readonly vehicleTypeId: string | null }

// GET /api/vehicle-types · GET /api/vehicles
export async function fetchVehicleTypes(): Promise<VehicleTypeRow[]> {
  if (ON_BACKEND) return readBackendVehicleTypes()
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
  if (ON_BACKEND) return unsupported()
  return getMockDb().listVehicleTypeAssignments()
}

/** Mọi xe của đội (theo tên) kèm loại đang gắn. */
// GET /api/vehicles
export async function fetchVehicleAssignmentRows(): Promise<VehicleAssignmentRow[]> {
  if (ON_BACKEND) return readBackendAssignments()
  const db = getMockDb()
  const [vehicles, assignments] = await Promise.all([db.listVehicles(), db.listVehicleTypeAssignments()])
  const typeOf = new Map(assignments.map((item) => [item.vehicleId, item.vehicleTypeId]))
  return vehicles
    .map((vehicle) => ({ vehicle: { id: vehicle.id, name: vehicle.name }, vehicleTypeId: typeOf.get(vehicle.id) ?? null }))
    .toSorted((a, b) => compareText(a.vehicle.name, b.vehicle.name))
}

/** `id` vắng là loại mới (`VT-NNN`). Sai dữ liệu: `VEHICLE_TYPE_INVALID` kèm tên trường. */
// POST /api/vehicle-types (tạo, chưa dùng ở màn) · sửa: chưa có ở BE
export function saveVehicleType(input: VehicleTypeInput, id?: string): Promise<VehicleType> {
  if (ON_BACKEND) return unsupported()
  return id === undefined ? getMockDb().createVehicleType(input) : getMockDb().updateVehicleType(id, input)
}

// chưa có ở BE
export function deleteVehicleType(id: string): Promise<void> {
  if (ON_BACKEND) return unsupported()
  return getMockDb().deleteVehicleType(id)
}

// chưa có ở BE
export function setVehicleType(vehicleId: string, vehicleTypeId: string | null): Promise<VehicleTypeAssignment | null> {
  if (ON_BACKEND) return unsupported()
  return getMockDb().setVehicleType(vehicleId, vehicleTypeId)
}
