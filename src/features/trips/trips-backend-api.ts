/**
 * Hàm → endpoint backend của danh sách và Chi tiết chuyến khi nhóm `trips` nối backend (`usesBackend('trips')`):
 *   listTrips  → GET /api/trips (đọc hết mọi trang, tối đa 100 dòng mỗi trang)
 *   resolveBackendTripId → GET /api/trips?search={mã chuyến} (mã chuyến trên URL → mã số)
 *   phần của nhóm (lập chuyến, tối ưu tuyến, gắn yêu cầu giao…) ở cuối file, tái xuất qua `trips-api.ts`
 */
import { apiFetch, ApiError } from '@/lib/api-client'
import { fetchVehicles } from '@/features/fleet/backend/vehicles-api'
import { fetchVehicleTypes } from '@/features/vehicle-types/backend/vehicle-types-api'
import { getCachedCurrentUser } from '@/features/auth/auth-api'
import { fetchCompanyWarehouses } from '@/features/company-warehouses/company-warehouses-api'
import type { CompanyDepot, VehicleStatus } from '@/lib/mock-db'
import { fetchAllPages } from '@/lib/api-page'
import type { TripRow } from './trip-list'
import type { TripFormOptions, VehicleOption } from './trips-api'
import { tripRowOf, type TripDto } from './trips-dto'

/** Backend từ chối `size` trên 100. */
const PAGE_SIZE = 100

// GET /api/trips
export async function listTrips(): Promise<TripRow[]> {
  return (await fetchAllPages<TripDto>('/api/trips', { size: PAGE_SIZE })).map(tripRowOf)
}


// ---- Phần nối backend của nhóm (feat/auth-keycloak): lập chuyến, tối ưu tuyến, gắn yêu cầu giao ----
export type TripListParams = {
  page: number
  size: number
  search?: string
  status?: string
  fromDate?: string
  toDate?: string
  vehicleId?: string
  driverId?: string
  unassignedDriver?: boolean
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

export type TripListPageResult = {
  data: TripRow[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export type TripStopApiResponse = {
  id: number
  tripId: number
  deliveryRequirementId: number | null
  stopSequence: number
  stopName: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  status: string
  plannedArrival: string | null
  actualArrival: string | null
  deadline: string | null
}

export type BackendTripDetail = {
  trip: TripDetailApiResponse
  stops: TripStopApiResponse[]
}

type BackendTripDetailApiResponse = {
  success: boolean
  data: BackendTripDetail
}

type TripListApiResponse = {
  success: boolean
  data: TripDetailApiResponse[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

function tripRowFromApi(trip: TripDetailApiResponse): TripRow {

  return {
    id: String(trip.id),
    tripCode: trip.tripCode,
    name: trip.tripName,
    scheduledDate: trip.departureTime.slice(0, 10),

    vehicleId: String(trip.vehicleId),
    vehicleName: [trip.vehicleName, trip.licensePlate]
      .filter(Boolean)
      .join(' · '),

    driverId: trip.driverId === null ? null : String(trip.driverId),
    driverName: trip.driverName,

    route: '',
    packageCount: trip.packageCount ?? 0,
    stopCount: trip.stopCount ?? 0,
    volumePercent: null,
    hasActiveRoutePlan: trip.hasActiveRoutePlan ?? false,

    status: trip.status,
    sub: null,
    extraSub: null,
    phase:
      trip.status === 'CANCELLED'
        ? 'cancelled'
        : trip.status === 'DELIVERED'
          ? 'completed'
          : trip.status === 'IN_TRANSIT'
            ? 'delivering'
            : trip.status === 'LOADING'
              ? 'loading'
              : 'planning',
  }
}

export async function fetchTripsPage({
  page,
  size,
  search,
  status,
  fromDate,
  toDate,
  vehicleId,
  driverId,
  unassignedDriver,
  sortBy = 'departureTime',
  sortDir = 'desc',
}: TripListParams): Promise<TripListPageResult> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sortBy,
    sortDir,
  })

  if (search?.trim()) {
    params.set('search', search.trim())
  }

  if (status) {
    params.set('status', status)
  }

  if (fromDate) {
    params.set('fromDate', fromDate)
  }

  if (toDate) {
    params.set('toDate', toDate)
  }

  if (vehicleId) {
    params.set('vehicleId', vehicleId)
  }

  if (unassignedDriver) {
    params.set('unassignedDriver', 'true')
  } else if (driverId) {
    params.set('driverId', driverId)
  }

  const response = await apiFetch<TripListApiResponse>(
    `/api/trips?${params.toString()}`,
  )

  return {
    data: response.data.map(tripRowFromApi),
    page: response.page,
    size: response.size,
    totalElements: response.totalElements,
    totalPages: response.totalPages,
    last: response.last,
  }
}
/**
 * Lớp gọi API cho chuyến hàng và kiện (LM-043, LM-088). Chi tiết chuyến, điểm giao và kiện đọc/ghi qua mock repository
 * (`@/lib/mock-db`, D-06); nối backend thật chỉ thay thân hàm, hook và component giữ nguyên.
 */

/** Danh sách chuyến (LM-088): mỗi dòng dựng từ chuyến, xe, tài xế và revision trong kho. */
export type BackendTripFrame = {
  readonly name: string
  readonly vehicleId: string
  readonly departureAt: string
  readonly originWarehouseId: string
  readonly driverId?: string | null
}

type TripCreateApiResponse = {
  id: number
  tripCode: string
  tripName: string
  status: 'DRAFT'
}

export type TripVehicleConfigResponse = {
  vehicleId: number
  vehicleName: string
  licensePlate: string

  vehicleTypeId: number
  vehicleTypeName: string

  innerLength: number
  innerWidth: number
  innerHeight: number

  doorWidth: number | null
  doorHeight: number | null

  maxPayloadKg: number
  frontAxleLimitKg: number | null
  rearAxleLimitKg: number | null
  maxCogOffsetRatio: number

  frontAxleX: number | null
  rearAxleX: number | null
  emptyFrontAxleLoadKg: number | null
  emptyRearAxleLoadKg: number | null

  obstacles: {
    id: number
    name: string
    type: 'WHEEL_ARCH' | 'COOLING_UNIT' | 'PARTITION' | 'RESERVED_ZONE' | 'OTHER'
    x: number
    y: number
    z: number
    length: number
    width: number
    height: number
    loadBearing: boolean
  }[]
}


export type BackendRouteLeg = {
  id: number
  routePlanId: number
  legSequence: number
  startStopId: number | null
  endStopId: number
  distanceMeters: number | null
  durationSeconds: number | null
  polyline: string | null
}

export type BackendActiveRoutePlan = {
  id: number
  tripId: number
  planVersion: number
  totalDistanceMeters: number | null
  totalDurationSeconds: number | null
  isActive: boolean
  createdAt: string
  legs: BackendRouteLeg[]
}



export type TripDetailApiResponse = {
  id: number
  tripCode: string
  tripName: string
  companyId: number
  vehicleId: number
  vehicleName: string
  licensePlate: string
  driverId: number | null
  driverName: string | null
  createdByDispatcherId: number
  departureTime: string
  originName: string
  originAddress: string | null
  originLatitude: number
  originLongitude: number
  status:
  | 'DRAFT'
  | 'PLANNED'
  | 'LOADING'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED'
  createdAt: string
  stopCount?: number | null
  packageCount?: number | null
  hasActiveRoutePlan?: boolean | null
  /** Lý do huỷ và trạng thái lúc huỷ; chuyến huỷ trước khi máy chủ lưu hai cột này thì vắng. */
  cancelReason?: string | null
  cancelledFromStatus?: TripDetailApiResponse['status'] | null
  /** Số kiện chưa giao thành Hoàn trả khi chuyến bị huỷ lúc Đang vận chuyển; huỷ ở pha khác hoặc máy chủ cũ thì vắng. */
  cancelReturnedCount?: number | null
}

export type CreatedTrip = {
  id: string
  tripCode: string
  tripName: string
  status: 'DRAFT'
}

type BackendApiResponse<T> = {
  success: boolean
  message?: string
  data: T
}

export async function fetchTripVehicleConfig(
  tripId: string,
): Promise<TripVehicleConfigResponse> {
  const response = await apiFetch<
    BackendApiResponse<TripVehicleConfigResponse>
  >(
    `/api/trips/${encodeURIComponent(tripId)}/vehicle-config`,
  )

  return response.data
}
/**
 * Tạo chuyến (FE-4b-04): kho cấp mã chuyến. Chuyến mới chưa có điểm giao và kiện — điểm giao tự sinh khi đưa yêu cầu giao vào chuyến,
 * hoặc thêm tay ở Chi tiết chuyến (D-73).
 */
// POST /api/trips
export async function createBackendTrip({
  name,
  vehicleId,
  departureAt,
  originWarehouseId,
  driverId = null,
}: BackendTripFrame): Promise<CreatedTrip> {



  const vehicleIdNumber = Number(vehicleId)
  const driverIdNumber = driverId ? Number(driverId) : null
  const warehouseIdNumber = Number(originWarehouseId)

  if (
    !Number.isSafeInteger(warehouseIdNumber) ||
    warehouseIdNumber <= 0
  ) {
    throw new Error('Invalid origin warehouse ID')
  }
  if (
    !Number.isSafeInteger(vehicleIdNumber) ||
    vehicleIdNumber <= 0 ||
    (driverIdNumber !== null &&
      (!Number.isSafeInteger(driverIdNumber) ||
        driverIdNumber <= 0))
  ) {
    throw new Error('Invalid vehicle or driver ID')
  }

  // Chuyển giờ ISO về thời gian địa phương Việt Nam
  // để gửi cho LocalDateTime của Spring Boot.
  const departureDate = new Date(departureAt)

  if (Number.isNaN(departureDate.getTime())) {
    throw new Error('Invalid departure time')
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(departureDate)

  const getPart = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? ''

  const departureTime =
    `${getPart('year')}-${getPart('month')}-${getPart('day')}` +
    `T${getPart('hour')}:${getPart('minute')}:00`

  const response = await apiFetch<{
    success: boolean
    data: TripCreateApiResponse
  }>(
    '/api/trips',
    {
      method: 'POST',
      body: JSON.stringify({
        tripName: name.trim(),
        departureTime,
        vehicleId: vehicleIdNumber,
        driverId: driverIdNumber,
        originWarehouseId: warehouseIdNumber,
      }),
    },
  )

  const created = response.data

  if (!created || !Number.isSafeInteger(created.id) || created.id <= 0) {
    throw new Error('Invalid create trip response: missing trip ID')
  }

  return {
    id: String(created.id),
    tripCode: created.tripCode,
    tripName: created.tripName,
    status: created.status,
  }
}



/** Tuyến đang dùng của chuyến; `null` khi chuyến chưa có tuyến (`ROUTE_PLAN_NOT_FOUND`), lỗi khác để lộ ra cho màn. */
// GET /api/trips/{id}/route-plans/active
export async function fetchBackendActiveRoutePlan(
  tripId: string,
): Promise<BackendActiveRoutePlan | null> {
  try {
    const response = await apiFetch<{
      success: boolean
      data: BackendActiveRoutePlan
    }>(
      `/api/trips/${encodeURIComponent(tripId)}/route-plans/active`,
    )
    return response.data
  } catch (error) {
    if (error instanceof ApiError && error.code === 'ROUTE_PLAN_NOT_FOUND') return null
    throw error
  }
}



export type RouteOptimizationResult = {
  origin: {
    latitude: number
    longitude: number
  }
  orderedStops: number[]
  totalTravelDurationSeconds: number
  totalDistanceMeters: number
  estimatedTotalDurationSeconds: number
  deadlineMissedStops: number[]
  segments: {
    fromStopId: number | null
    toStopId: number
    durationSeconds: number
    distanceMeters: number
    polyline: string | null
  }[]
  stopSchedules: {
    stopId: number
    stopSequence: number
    plannedArrival: string
  }[]
}

export async function optimizeBackendTrip(
  tripId: string,
): Promise<RouteOptimizationResult> {
  const response = await apiFetch<{
    success: boolean
    data: RouteOptimizationResult
  }>(
    `/api/trips/${encodeURIComponent(tripId)}/optimize-route`,
    {
      method: 'POST',
    },
  )

  return response.data
}

async function fetchEveryPage<T>(
  fetchPage: (page: number, size: number) => Promise<{
    data: T[]
    totalPages: number
  }>,
): Promise<T[]> {
  const size = 100
  const first = await fetchPage(0, size)
  const result = [...first.data]

  for (let page = 1; page < first.totalPages; page++) {
    const response = await fetchPage(page, size)
    result.push(...response.data)
  }

  return result
}
/**
 * Công ty và kho xuất phát của form chuyến lấy từ máy chủ, không từ kho mẫu: công ty là của người đăng nhập (`getCachedCurrentUser`),
 * kho xuất phát mặc định là kho mặc định đang hoạt động của công ty (`GET /api/company-warehouses`). Nhóm `companies` chưa nối thì
 * không có danh mục kho (`NOT_SUPPORTED`) và form không điền sẵn kho; lỗi khác của máy chủ để lộ ra.
 */
async function defaultServerDepot(): Promise<CompanyDepot | null> {
  try {
    const warehouses = await fetchCompanyWarehouses(true)
    const chosen = warehouses.find((item) => item.isDefault && item.isActive && item.latitude !== null && item.longitude !== null)
    if (!chosen || chosen.latitude === null || chosen.longitude === null) return null
    return { name: chosen.warehouseName, address: chosen.address, lat: chosen.latitude, lng: chosen.longitude }
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_SUPPORTED') return null
    throw error
  }
}

// GET /api/vehicles · GET /api/vehicle-types · GET /api/trips/driver-options · GET /api/company-warehouses?activeOnly=true
export async function fetchBackendTripFormOptions(): Promise<TripFormOptions> {
  const [vehicles, vehicleTypes, drivers, depot] = await Promise.all([
    fetchEveryPage((page, size) => fetchVehicles(page, size)),
    fetchEveryPage((page, size) => fetchVehicleTypes(page, size)),
    fetchDriverOptions(),
    defaultServerDepot(),
  ])

  const typeById = new Map(
    vehicleTypes.map((type) => [type.id, type]),
  )
  // Công ty của người đăng nhập bằng máy chủ — không phải công ty của kho mẫu
  const companyId = getCachedCurrentUser()?.companyId

  const options: VehicleOption[] = vehicles.flatMap((vehicle) => {
    const type = typeById.get(vehicle.vehicleTypeId)

    if (!type) return []

    // Xe đã ngừng sử dụng không được đưa vào danh sách chọn.
    if (vehicle.status === 'RETIRED') return []

    const status: VehicleStatus =
      vehicle.status === 'AVAILABLE'
        ? 'available'
        : vehicle.status === 'IN_TRIP'
          ? 'in_use'
          : 'maintenance'

    return [{
      vehicle: {
        id: vehicle.id,
        name: vehicle.name,
        innerLengthCm: type.cargoLengthCm,
        innerWidthCm: type.cargoWidthCm,
        innerHeightCm: type.cargoHeightCm,
        maxPayloadKg: type.payloadKg,
      },
      status,
    }]
  })

  return {
    vehicles: options,
    drivers: drivers.map((driver) => ({
      id: String(driver.id),
      fullName: driver.fullName,
      email: '',
      phone: '',
      role: 'driver' as const,
      status: 'active' as const,
      companyId,
      lastActiveAt: null,
    })),
    depot,
  }
}

type DriverOptionApi = {
  id: number
  fullName: string
}



async function fetchDriverOptions(): Promise<DriverOptionApi[]> {
  const response = await apiFetch<{
    success: boolean
    data: DriverOptionApi[]
  }>('/api/trips/driver-options')

  return response.data
}
export async function fetchTripById(
  tripId: string,
): Promise<TripDetailApiResponse> {
  const response = await apiFetch<{
    success: boolean
    data: TripDetailApiResponse
  }>(`/api/trips/${encodeURIComponent(tripId)}`)

  return response.data
}

export async function fetchBackendTripDetail(
  tripId: string,
): Promise<BackendTripDetail> {
  const response = await apiFetch<BackendTripDetailApiResponse>(
    `/api/trips/${encodeURIComponent(tripId)}/detail`,
  )

  return response.data
}


/**
 * POST /api/trips/{tripId}/delivery-requirements/{requirementId}
 *
 * Dispatcher gán toàn bộ yêu cầu giao vào Trip.
 * Backend tự kiểm tra điều kiện và tạo DeliveryStop.
 */
export async function assignBackendRequirementToTrip(
  tripId: string,
  requirementId: string,
): Promise<TripStopApiResponse> {
  const response = await apiFetch<{
    success: boolean
    data: TripStopApiResponse
  }>(
    `/api/trips/${encodeURIComponent(tripId)}` +
    `/delivery-requirements/${encodeURIComponent(requirementId)}`,
    {
      method: 'POST',
    },
  )

  return response.data
}


/**
 * Mã số của chuyến trên máy chủ từ mã trên URL: màn của nhóm mở chuyến theo mã số (`/chuyen/12`), Giám sát và các màn khác mở theo mã
 * chuyến (`/chuyen/TRIP-…`). Mã chuyến thì tìm dòng khớp đúng mã; không có là `TRIP_NOT_FOUND`.
 */
// GET /api/trips?search={mã chuyến}
export async function resolveBackendTripId(idOrCode: string): Promise<string> {
  if (/^[1-9]\d*$/.test(idOrCode)) return idOrCode
  const wanted = idOrCode.trim().toUpperCase()
  const rows = wanted === ''
    ? []
    : await fetchAllPages<TripDto>('/api/trips', { query: { search: idOrCode.trim() }, size: PAGE_SIZE, maxPages: 1 })
  const listed = rows.find((row) => row.tripCode.toUpperCase() === wanted)
  if (!listed) throw new ApiError('TRIP_NOT_FOUND', { status: 404 })
  return String(listed.id)
}
