import { ApiError, apiFetch } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'


import { roundKg } from '@/domain/geometry'
import type {
  DeliveryRequirement,
  PackageType,
  RequirementChanges,
  RequirementInput,
  RequirementStatus,
  Trip,
} from '@/lib/mock-db'
import { fetchAllPages } from '@/lib/api-page'
import { assignBackendRequirementToTrip, type TripStopApiResponse } from '@/features/trips/trips-backend-api'
import { tripRowOf, type TripDto } from '@/features/trips/trips-dto'

import {
  fetchPackage,
  type CargoPackage,
} from '@/features/package-pool/backend/packages-api'




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
  /** Kho đã bỏ kiện của yêu cầu khỏi chuyến (thiếu, hỏng); máy chủ cũ không trả. */
  droppedPackageCount?: number | null
  shortDelivered?: boolean | null
  expectedPackageCount: number | null
  receivedPackageCount: number
  packageIds: number[]
  note: string | null
  tripId: number | null
  tripCode: string | null
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
    tripCode: api.tripCode == null ? undefined : String(api.tripCode),
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
    // Kho bỏ kiện của yêu cầu khỏi chuyến (thiếu, hỏng) mà yêu cầu vẫn trong chuyến: giao thiếu (D-92, suy lúc đọc)
    status: api.shortDelivered === true && requirement.tripId !== undefined ? 'PARTIAL' : requirement.status,
    closed: false,
    packages: [],
    totalKg: 0,
    trip: undefined,
    stopNumber: undefined,
    createdByName: null,
  }
}

function packageViewFromApi(
  pkg: CargoPackage,
): RequirementPackageView {
  return {
    id: pkg.id,
    packageCode: pkg.packageCode,
    lengthCm: pkg.lengthCm,
    widthCm: pkg.widthCm,
    heightCm: pkg.heightCm,
    weightKg: pkg.weightKg,
    handlingClass: pkg.handlingClass,
    destination: pkg.destination,
    status: pkg.status,
  }
}

export type RequirementPackageView = {
  id: string
  packageCode: string
  lengthCm: number
  widthCm: number
  heightCm: number
  weightKg: number
  handlingClass: CargoPackage['handlingClass']
  destination: string
  status: CargoPackage['status']
}



export type RequirementPackage = {
  readonly package: RequirementPackageView
  readonly type: PackageType | undefined
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

// GET /api/delivery-requirements
export async function listDeliveryRequirements(): Promise<RequirementRow[]> {
  // Màn khách hàng của kho (`WarehouseCustomersPage`) mở cả khi chưa nối máy chủ: không gọi mạng
  if (!usesBackend('trips')) throw new ApiError('NOT_SUPPORTED')
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

  const api = response.data
  const row = requirementRowFromApi(api)

  const packages = await Promise.all(
    api.packageIds.map((packageId) =>
      fetchPackage(String(packageId)),
    ),
  )

  const members = packages



  return {
    ...row,
    packages: members.map((pkg) => ({
      package: packageViewFromApi(pkg),
      type: undefined,
    })),
    totalKg: roundKg(
      members.reduce(
        (sum, pkg) => sum + pkg.weightKg,
        0,
      ),
    ),
  }
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

/**
 * Sửa yêu cầu còn chờ xếp chuyến: chỉ gửi trường có giá trị (máy chủ bỏ qua trường vắng). Máy chủ đòi `DELIVERY_DEMAND_MANAGE` mà chưa
 * vai trò nào có, nên màn chưa gọi tới đây (`REQUIREMENT_SERVER_SUPPORT.manage`).
 */
// PATCH /api/delivery-requirements/{id}
export async function updateDeliveryRequirement(id: string, changes: RequirementChanges): Promise<DeliveryRequirement> {
  const customerId = changes.customerId === undefined ? undefined : Number(changes.customerId)
  const body = {
    ...(customerId !== undefined && Number.isSafeInteger(customerId) && customerId > 0 ? { customerId } : {}),
    ...(changes.address === undefined ? {} : { destination: changes.address.trim() }),
    ...(typeof changes.lat === 'number' && typeof changes.lng === 'number' ? { destinationLat: changes.lat, destinationLng: changes.lng } : {}),
    ...(changes.deadline === undefined ? {} : { deadline: toVietnamLocalDateTime(changes.deadline) }),
    ...(changes.priority === undefined ? {} : { priority: changes.priority }),
    ...(changes.expectedPackageCount === undefined ? {} : { expectedPackageCount: changes.expectedPackageCount }),
    ...(changes.note === undefined ? {} : { note: changes.note.trim() }),
  }
  const response = await apiFetch<RequirementDetailApi>(`/api/delivery-requirements/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return requirementFromApi(response.data)
}

export type RequirementCoordinatesInput = {
  destinationLat: number
  destinationLng: number
}

// PATCH /api/delivery-requirements/{id}/coordinates
export async function updateRequirementCoordinates(
  id: string,
  input: RequirementCoordinatesInput,
): Promise<DeliveryRequirement> {
  const response = await apiFetch<RequirementDetailApi>(
    `/api/delivery-requirements/${encodeURIComponent(id)}/coordinates`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )

  return requirementFromApi(response.data)
}



export type UpdateRequirementScheduleInput = {
  deadline?: string
  priority?: string
}

/**
 * Sửa hạn giao và ưu tiên khi Trip còn DRAFT/PLANNED.
 * Không gửi các trường khách hàng, địa chỉ hay kiện hàng.
 */
// PATCH /api/delivery-requirements/{id}
export async function updateRequirementSchedule(
  id: string,
  input: UpdateRequirementScheduleInput,
): Promise<DeliveryRequirement> {
  const response = await apiFetch<{
    success: boolean
    data: DeliveryRequirementApi
  }>(
    `/api/delivery-requirements/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )

  return requirementFromApi(response.data)
}

export type ExtendRequirementDeadlineInput = {
  newDeadline: string
  reason: string
}

/**
 * Gia hạn khi Trip đang IN_TRANSIT.
 * Backend kiểm tra quyền, deadline và ghi Audit Log.
 */
// PATCH /api/delivery-requirements/{id}/extend-deadline
export async function extendRequirementDeadline(
  id: string,
  input: ExtendRequirementDeadlineInput,
): Promise<DeliveryRequirement> {
  const response = await apiFetch<{
    success: boolean
    data: DeliveryRequirementApi
  }>(
    `/api/delivery-requirements/${encodeURIComponent(id)}/extend-deadline`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  )

  return requirementFromApi(response.data)
}


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

/**
 * Chuyến nhận được yêu cầu: máy chủ chỉ gắn yêu cầu vào chuyến Nháp. `id` là mã số của máy chủ (đường dẫn gắn yêu cầu), `code` là mã
 * chuyến hiện trên màn. Danh sách không có điểm giao: máy chủ tự sinh hoặc gộp điểm giao khi gắn, màn không đoán trước.
 */
export type AssignableTrip = Pick<Trip, 'id' | 'name' | 'scheduledDate' | 'vehicleId'> & { readonly code: string }

// GET /api/trips?status=DRAFT
export async function fetchAssignableTrips(): Promise<AssignableTrip[]> {
  const rows = await fetchAllPages<TripDto>('/api/trips', { query: { status: 'DRAFT' }, size: 100 })
  return rows.map((dto) => {
    const row = tripRowOf(dto)
    return { id: String(dto.id), code: row.id, name: row.name, scheduledDate: row.scheduledDate, vehicleId: row.vehicleId }
  })
}

/** `tripId` là mã số của máy chủ (`AssignableTrip.id`). */
export type AssignRequirementInput = { readonly requirementId: string; readonly tripId: string }

/**
 * Gắn cả yêu cầu vào chuyến Nháp: máy chủ kiểm yêu cầu còn chờ và đã nhận đủ kiện, rồi tự sinh (hoặc gộp) điểm giao — trả điểm giao đó.
 */
// POST /api/trips/{tripId}/delivery-requirements/{requirementId}
export function assignRequirementToTrip({ requirementId, tripId }: AssignRequirementInput): Promise<TripStopApiResponse> {
  return assignBackendRequirementToTrip(tripId, requirementId)
}
