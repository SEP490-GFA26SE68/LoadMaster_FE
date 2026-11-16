import { ApiError, apiFetch } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import { roundKg } from '@/domain/geometry'
import type { DeliveryRequirement, PackageType, RequirementStatus, Trip } from '@/lib/mock-db'
import { fetchAllPages } from '@/lib/api-page'
import { assignBackendRequirementToTrip, type TripStopApiResponse } from '@/features/trips/trips-backend-api'
import { tripRowOf, type TripDto } from '@/features/trips/trips-dto'
import { fetchPackage, type CargoPackage } from '@/features/package-pool/backend/packages-api'
import { requirementFromApi, type DeliveryRequirementApi } from './requirement-dto'

/**
 * Yêu cầu giao của máy chủ (nhóm `trips`). Đọc ở đây; ghi ở `requirement-writes-api.ts` (xuất lại bên dưới để màn import một chỗ).
 *
 * | Hàm                       | Endpoint                                                  |
 * |---------------------------|-----------------------------------------------------------|
 * | listDeliveryRequirements  | GET /api/delivery-requirements                            |
 * | getDeliveryRequirement    | GET /api/delivery-requirements/{id}                       |
 * | fetchAssignableTrips      | GET /api/trips?status=DRAFT                               |
 * | assignRequirementToTrip   | POST /api/trips/{tripId}/delivery-requirements/{requirementId} |
 */
export {
  createDeliveryRequirement,
  deleteDeliveryRequirement,
  extendRequirementDeadline,
  unassignRequirementFromTrip,
  updateDeliveryRequirement,
  updateRequirementCoordinates,
  updateRequirementSchedule,
  type ExtendRequirementDeadlineInput,
  type RequirementCoordinatesInput,
  type UnassignRequirementInput,
  type UpdateRequirementScheduleInput,
} from './requirement-writes-api'

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

function requirementRowFromApi(api: DeliveryRequirementApi): RequirementRow {
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

function packageViewFromApi(pkg: CargoPackage): RequirementPackageView {
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
  const first = await apiFetch<RequirementPageApi>(`/api/delivery-requirements?page=0&size=${size}`)
  // Biết số trang sau trang đầu: đọc các trang còn lại cùng lúc, giữ đúng thứ tự trang
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, index) =>
      apiFetch<RequirementPageApi>(`/api/delivery-requirements?page=${index + 1}&size=${size}`),
    ),
  )
  return [first, ...rest].flatMap((response) => response.data).map(requirementRowFromApi)
}

// GET /api/delivery-requirements/{id}
export async function getDeliveryRequirement(id: string): Promise<RequirementRow> {
  const response = await apiFetch<RequirementDetailApi>(`/api/delivery-requirements/${encodeURIComponent(id)}`)
  const dto = response.data
  const row = requirementRowFromApi(dto)
  const members = await Promise.all(dto.packageIds.map((packageId) => fetchPackage(String(packageId))))
  return {
    ...row,
    packages: members.map((pkg) => ({ package: packageViewFromApi(pkg), type: undefined })),
    totalKg: roundKg(members.reduce((sum, pkg) => sum + pkg.weightKg, 0)),
  }
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
