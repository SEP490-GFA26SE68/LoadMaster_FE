import { apiFetch } from '@/lib/api-client'

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


type DeliveryRequirementApi = {
  id: number
  companyId: number
  customerId: number | null
  customerName: string | null
  destination: string
  destinationLat: number | null
  destinationLng: number | null
  deadline: string
  priority: DeliveryRequirement['priority']
  status: DeliveryRequirement['status']
  expectedPackageCount: number | null
  receivedPackageCount: number
  packageIds: number[]
  note: string | null
  tripId: number | null
  createdBy: number | null
  createdAt: string
}

type RequirementPageApi = {
  success: boolean
  data: DeliveryRequirementApi[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

type RequirementDetailApi = {
  success: boolean
  data: DeliveryRequirementApi
}
function vietnamIso(value: string): string {
  return /(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    ? value
    : `${value}+07:00`
}

function toVietnamLocalDateTime(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid deadline')
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:00`
}

function requirementFromApi(
  api: DeliveryRequirementApi,
): DeliveryRequirement {
  return {
    id: String(api.id),
    companyId: String(api.companyId),

    customerId: api.customerId == null
      ? undefined
      : String(api.customerId),
    customerName: api.customerName ?? undefined,

    // Backend hiện chưa lưu tên điểm đến riêng.
    destinationName: api.destination,
    address: api.destination,

    ...(api.destinationLat == null
      ? {}
      : { lat: api.destinationLat }),
    ...(api.destinationLng == null
      ? {}
      : { lng: api.destinationLng }),

    deadline: vietnamIso(api.deadline),
    priority: api.priority,
    status: api.status,
    packageIds: api.packageIds.map(String),

    expectedPackageCount: api.expectedPackageCount ?? undefined,
    receivedPackageCount: api.receivedPackageCount,

    note: api.note ?? undefined,
    tripId: api.tripId == null ? undefined : String(api.tripId),
    createdBy: api.createdBy == null ? null : String(api.createdBy),
    createdAt: vietnamIso(api.createdAt),
  }
}

function requirementRowFromApi(
  api: DeliveryRequirementApi,
): RequirementRow {
  const requirement = requirementFromApi(api)

  return {
    requirement,
    status: requirement.status,
    closed: false,
    packages: [],
    totalKg: 0,
    trip: undefined,
    stopNumber: undefined,
    createdByName: null,
  }
}

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
  const size = 100

  const first = await apiFetch<RequirementPageApi>(
    `/api/delivery-requirements?page=0&size=${size}`,
  )

  const results = [...first.data]

  for (let page = 1; page < first.totalPages; page++) {
    const response = await apiFetch<RequirementPageApi>(
      `/api/delivery-requirements?page=${page}&size=${size}`,
    )

    results.push(...response.data)
  }

  return results.map(requirementRowFromApi)
}

// GET /api/delivery-requirements/{id}
export async function getDeliveryRequirement(
  id: string,
): Promise<RequirementRow> {
  const response = await apiFetch<RequirementDetailApi>(
    `/api/delivery-requirements/${encodeURIComponent(id)}`,
  )

  return requirementRowFromApi(response.data)
}

// POST /api/delivery-requirements
export async function createDeliveryRequirement(
  input: RequirementInput,
): Promise<DeliveryRequirement> {
  const customerId = Number(input.customerId)
  const expectedPackageCount = input.expectedPackageCount

  if (
    !Number.isSafeInteger(customerId) ||
    customerId <= 0 ||
    !Number.isSafeInteger(expectedPackageCount) ||
    expectedPackageCount === undefined ||
    expectedPackageCount < 1
  ) {
    throw new Error('Invalid customer or expected package count')
  }

  const response = await apiFetch<RequirementDetailApi>(
    '/api/delivery-requirements',
    {
      method: 'POST',
      body: JSON.stringify({
        customerId,
        destination: input.address.trim(),
        destinationLat: input.lat ?? null,
        destinationLng: input.lng ?? null,
        deadline: toVietnamLocalDateTime(input.deadline),
        priority: input.priority,
        expectedPackageCount,
        note: input.note?.trim() ?? null,
        packageIds: [],
      }),
    },
  )

  return requirementFromApi(response.data)
}

// PATCH /api/delivery-requirements/{id}
export function updateDeliveryRequirement(id: string, changes: RequirementChanges): Promise<DeliveryRequirement> {
  return getMockDb().updateDeliveryRequirement(id, changes)
}

// DELETE /api/delivery-requirements/{id}
// DELETE /api/delivery-requirements/{id}
export async function deleteDeliveryRequirement(
  id: string,
): Promise<void> {
  await apiFetch<void>(
    `/api/delivery-requirements/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    },
  )
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

/** `overrideReason`: lý do vượt luật "một chuyến một loại hàng" khi yêu cầu mang kiện khác loại hàng của chuyến (FE-4b-06, D-74). */
export type AssignRequirementInput = { readonly requirementId: string; readonly tripId: string; readonly overrideReason?: string }

/** Đưa cả yêu cầu vào chuyến: điểm giao tự sinh theo địa chỉ và toạ độ của yêu cầu, trùng điểm đang có thì gộp (FE-4b-04, D-73). */
// chưa có ở BE (BE có POST /api/trips/{id}/packages theo từng kiện)
export function assignRequirementToTrip({ requirementId, tripId, overrideReason }: AssignRequirementInput): Promise<{ requirement: DeliveryRequirement; trip: Trip }> {
  return getMockDb().assignDeliveryRequirement(requirementId, tripId, overrideReason === undefined ? {} : { overrideReason })
}

// chưa có ở BE
export function unassignRequirementFromTrip(requirementId: string): Promise<DeliveryRequirement> {
  return getMockDb().unassignDeliveryRequirement(requirementId)
}
