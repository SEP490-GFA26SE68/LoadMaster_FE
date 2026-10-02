/**
 * Hàm → endpoint backend (FE-0-09, issue BE S4b-02); nối backend chỉ thay thân hàm.
 *   listDeliveryRequirements   → GET /api/delivery-requirements
 *   getDeliveryRequirement     → GET /api/delivery-requirements/{id}
 *   createDeliveryRequirement  → POST /api/delivery-requirements
 *   updateDeliveryRequirement  → PATCH /api/delivery-requirements/{id}
 *   deleteDeliveryRequirement  → DELETE /api/delivery-requirements/{id}
 *   chưa có ở BE: fetchSelectablePackages, fetchAssignableTrips, assignRequirementToTrip, unassignRequirementFromTrip (đưa cả yêu
 *   cầu vào chuyến — BE có POST /api/trips/{id}/packages theo từng kiện; điểm giao tự sinh ở kho mock, FE-4b-04)
 */

import { roundKg } from '@/domain/geometry'
import {
  getMockDb,
  isRequirementClosed,
  isSelectablePackage,
  requirementStatus,
  type DeliveryRequirement,
  type DeliveryStop,
  type Package,
  type PackageType,
  type RequirementChanges,
  type RequirementInput,
  type RequirementStatus,
  type Trip,
} from '@/lib/mock-db'

/**
 * Lớp dữ liệu yêu cầu giao (FE-4b-02, D-72): quản lý công ty lập yêu cầu từ kiện `IMPORTED` của kho kiện; điều phối viên đưa vào
 * chuyến đang lập kế hoạch — điểm giao tự sinh (FE-4b-04, D-73). Đưa vào chuyến thêm dòng kiện vào chuyến nên chuyến và revision
 * cũng đổi (lỗi thời, D-31).
 */

export type RequirementPackage = { readonly package: Package; readonly type: PackageType | undefined }

function withType(pkg: Package, typeById: ReadonlyMap<string, PackageType>): RequirementPackage {
  return { package: pkg, type: pkg.packageTypeId === undefined ? undefined : typeById.get(pkg.packageTypeId) }
}

/** Một yêu cầu kèm kiện (kèm loại kiện nếu kiện gắn loại), trạng thái hiển thị, tổng khối lượng, chuyến đang chở và người lập. */
export type RequirementRow = {
  readonly requirement: DeliveryRequirement
  /** Trạng thái kho ghi, cộng "Đã giao" / "Giao thiếu" suy từ kiện (mục 7.3). */
  readonly status: RequirementStatus
  /** Đã giao xong: hạn và ưu tiên không sửa được nữa. */
  readonly closed: boolean
  readonly packages: readonly RequirementPackage[]
  readonly totalKg: number
  readonly trip: Pick<Trip, 'id' | 'name' | 'scheduledDate' | 'phase'> | undefined
  /** Số điểm giao (1-based) của điểm yêu cầu được đưa vào; vắng khi chưa vào chuyến hoặc điểm không còn. */
  readonly stopNumber: number | undefined
  /** `null`: kho không ghi người lập, hoặc tài khoản đã xoá. */
  readonly createdByName: string | null
}

async function requirementContext() {
  const db = getMockDb()
  const [packages, types, trips, users] = await Promise.all([db.listPackages(), db.listPackageTypes(), db.listTrips(), db.listUsers()])
  return {
    packageById: new Map(packages.map((pkg) => [pkg.id, pkg])),
    typeById: new Map(types.map((type) => [type.id, type])),
    tripById: new Map(trips.map((trip) => [trip.id, trip])),
    nameById: new Map(users.map((user) => [user.id, user.fullName])),
  }
}

function toRow(requirement: DeliveryRequirement, context: Awaited<ReturnType<typeof requirementContext>>): RequirementRow {
  const members = requirement.packageIds.flatMap((id) => context.packageById.get(id) ?? [])
  const trip = requirement.tripId === undefined ? undefined : context.tripById.get(requirement.tripId)
  // Điểm giao của yêu cầu là điểm của kiện của nó (kho ghi `stopId` vào kiện lúc đưa vào chuyến, và dời theo dòng kiện)
  const stopId = members.find((pkg) => pkg.tripId === requirement.tripId)?.stopId
  const stopIndex = trip && stopId !== undefined ? trip.stops.findIndex((stop) => stop.id === stopId) : -1
  return {
    requirement,
    status: requirementStatus(requirement, members),
    closed: isRequirementClosed(requirement, members),
    packages: members.map((pkg) => withType(pkg, context.typeById)),
    totalKg: roundKg(members.reduce((sum, pkg) => sum + pkg.weightKg, 0)),
    trip: trip ? { id: trip.id, name: trip.name, scheduledDate: trip.scheduledDate, phase: trip.phase } : undefined,
    stopNumber: stopIndex === -1 ? undefined : stopIndex + 1,
    createdByName: requirement.createdBy === null ? null : (context.nameById.get(requirement.createdBy) ?? null),
  }
}

// GET /api/delivery-requirements
export async function listDeliveryRequirements(): Promise<RequirementRow[]> {
  const [requirements, context] = await Promise.all([getMockDb().listDeliveryRequirements(), requirementContext()])
  return requirements.map((requirement) => toRow(requirement, context))
}

// GET /api/delivery-requirements/{id}
export async function getDeliveryRequirement(id: string): Promise<RequirementRow> {
  const [requirement, context] = await Promise.all([getMockDb().getDeliveryRequirement(id), requirementContext()])
  return toRow(requirement, context)
}

// POST /api/delivery-requirements
export function createDeliveryRequirement(input: RequirementInput): Promise<DeliveryRequirement> {
  return getMockDb().createDeliveryRequirement(input)
}

// PATCH /api/delivery-requirements/{id}
export function updateDeliveryRequirement(id: string, changes: RequirementChanges): Promise<DeliveryRequirement> {
  return getMockDb().updateDeliveryRequirement(id, changes)
}

// DELETE /api/delivery-requirements/{id}
export function deleteDeliveryRequirement(id: string): Promise<void> {
  return getMockDb().deleteDeliveryRequirement(id)
}

/** Kiện chọn được cho yêu cầu mới: còn ở kho kiện (`IMPORTED`), không cờ, chưa thuộc yêu cầu nào. Mới nhất trước, như bảng kho kiện. */
// chưa có ở BE
export async function fetchSelectablePackages(): Promise<RequirementPackage[]> {
  const context = await requirementContext()
  return [...context.packageById.values()].filter(isSelectablePackage).map((pkg) => withType(pkg, context.typeById)).toReversed()
}

/** Chuyến nhận được yêu cầu: đang lập kế hoạch (Nháp / Đã lập kế hoạch, kho chưa xếp), kèm điểm giao để nói trước yêu cầu sẽ gộp vào điểm nào. */
export type AssignableTrip = Pick<Trip, 'id' | 'name' | 'scheduledDate' | 'vehicleId'> & { readonly stops: readonly DeliveryStop[] }

// chưa có ở BE
export async function fetchAssignableTrips(): Promise<AssignableTrip[]> {
  const trips = await getMockDb().listTrips()
  return trips
    .filter((trip) => trip.phase === 'planning')
    .map(({ id, name, scheduledDate, vehicleId, stops }) => ({ id, name, scheduledDate, vehicleId, stops }))
}

export type AssignRequirementInput = { readonly requirementId: string; readonly tripId: string }

/** Đưa cả yêu cầu vào chuyến: điểm giao tự sinh theo địa chỉ và toạ độ của yêu cầu, trùng điểm đang có thì gộp (FE-4b-04, D-73). */
// chưa có ở BE (BE có POST /api/trips/{id}/packages theo từng kiện)
export function assignRequirementToTrip({ requirementId, tripId }: AssignRequirementInput): Promise<{ requirement: DeliveryRequirement; trip: Trip }> {
  return getMockDb().assignDeliveryRequirement(requirementId, tripId)
}

// chưa có ở BE
export function unassignRequirementFromTrip(requirementId: string): Promise<DeliveryRequirement> {
  return getMockDb().unassignDeliveryRequirement(requirementId)
}
