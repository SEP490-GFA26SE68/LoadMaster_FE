import { fetchVehicles } from '@/features/fleet/vehicles-api'
import { fetchVehicleTypes } from '@/features/vehicle-types/vehicle-types-api'
import { apiFetch } from '@/lib/api-client'

import type { CargoPackage, VehicleConfig } from '@/domain/models'
import {
  getMockDb,
  isMockDbError,
  latestApproved,
  tripManualSubStatus,
  tripRouteSubStatus,
  tripStatus,
  tripSubStatus,
  vnDate,
  type AuditEvent,
  type CompanyDepot,
  type Revision,
  type Trip,
  type VehicleStatus,
} from '@/lib/mock-db'
import type { TripStatus, TripSubStatus } from '@/types/trip'
import type { User } from '@/types/user'
import { tripRow, type TripRow } from './trip-list'
import { duplicatePackage, stopFields, type TripStopInput } from './trip-packages'
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
// chưa có ở BE
export async function fetchTrips(): Promise<TripRow[]> {
  const db = getMockDb()
  const [trips, vehicles, users] = await Promise.all([db.listTrips(), db.listVehicles(), db.listUsers()])
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]))
  const userById = new Map(users.map((user) => [user.id, user]))
  const revisions = await Promise.all(trips.map((trip) => db.listRevisions(trip.id)))
  return trips.map((trip, index) => tripRow(
    trip,
    vehicleById.get(trip.vehicleId),
    revisions[index] ?? [],
    trip.driverId === null ? undefined : userById.get(trip.driverId),
  ))
}

export type TripFrame = {
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
}

export type CreatedTrip = {
  id: string
  tripCode: string
  tripName: string
  status: 'DRAFT'
}
/**
 * Tạo chuyến (FE-4b-04): kho cấp mã chuyến. Chuyến mới chưa có điểm giao và kiện — điểm giao tự sinh khi đưa yêu cầu giao vào chuyến,
 * hoặc thêm tay ở Chi tiết chuyến (D-73).
 */
// POST /api/trips
export async function createTrip({
  name,
  vehicleId,
  departureAt,
  originWarehouseId,
  driverId = null,
}: TripFrame): Promise<CreatedTrip> {



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



export async function fetchBackendActiveRoutePlan(
  tripId: string,
): Promise<BackendActiveRoutePlan> {
  const response = await apiFetch<{
    success: boolean
    data: BackendActiveRoutePlan
  }>(
    `/api/trips/${encodeURIComponent(tripId)}/route-plans/active`,
  )

  return response.data
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


export type TripFrameChanges = {
  readonly name: string
  readonly departureAt: string
  readonly driverId: string | null
  /** Vắng khi chuyến đã khoá xe (kho đã bắt đầu xếp, D-45). */
  readonly vehicleId?: string
  /** Vắng khi chuyến đã khoá. */
  readonly depot?: CompanyDepot
  /** Sửa chữ của điểm giao hiện có theo thứ tự; mã và thứ tự giữ nguyên. Vắng khi chuyến đã khoá. */
  readonly stops?: readonly TripStopInput[]
}

/**
 * Sửa khung chuyến: tên, giờ xuất phát, tài xế, xe, kho xuất phát và chữ của điểm giao (toạ độ, hạn, ưu tiên và nguồn của điểm giữ
 * nguyên). Đổi xe làm revision cũ lỗi thời (D-31).
 */
// chưa có ở BE
export async function updateTripFrame(tripId: string, changes: TripFrameChanges): Promise<Trip> {
  const db = getMockDb()
  const { stops: edited, ...frame } = changes
  const current = edited ? await db.getTrip(tripId) : undefined
  const stops = current && edited
    ? current.stops.map((stop, index) => {
      const { phone: _phone, contactName: _contactName, ...kept } = stop
      return { ...kept, ...stopFields(edited[index] ?? stop) }
    })
    : undefined
  return db.updateTrip(tripId, { ...frame, ...(stops ? { stops } : {}) })
}

export type VehicleOption = {
  readonly vehicle: Pick<
    VehicleConfig,
    | 'id'
    | 'name'
    | 'innerLengthCm'
    | 'innerWidthCm'
    | 'innerHeightCm'
    | 'maxPayloadKg'
  >
  readonly status: VehicleStatus
}
/**
 * Xe và tài xế chọn được ở form chuyến (D-46, D-53): xe kèm trạng thái để khoá xe bảo dưỡng; mọi người dùng vai trò tài xế. `depot`:
 * kho của công ty của người đang đăng nhập — kho xuất phát mặc định của chuyến mới (D-76).
 */
export type TripFormOptions = { readonly vehicles: readonly VehicleOption[]; readonly drivers: readonly User[]; readonly depot: CompanyDepot | null }

async function fetchAllPages<T>(
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
// chưa có ở BE
export async function fetchTripFormOptions(): Promise<TripFormOptions> {
  const [vehicles, vehicleTypes] = await Promise.all([
    fetchAllPages((page, size) => fetchVehicles(page, size)),
    fetchAllPages((page, size) => fetchVehicleTypes(page, size)),
  ])

  const typeById = new Map(
    vehicleTypes.map((type) => [type.id, type]),
  )

  const db = getMockDb()

  const [drivers, companies] = await Promise.all([
    fetchDriverOptions(),
    db.listCompanies(),
  ])

  const company = companies.find(
    (item) => item.id === db.sessionUser()?.companyId,
  ) ?? companies[0]

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
      companyId: company?.id,
      lastActiveAt: null,
    })),
    depot: company?.depot ?? null,
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

export type TripDetail = {
  readonly trip: Trip
  readonly vehicle: VehicleConfig
  /** `null` khi chưa gán, hoặc tài khoản đã bị xoá khỏi kho. */
  readonly driver: User | null
  readonly status: TripStatus
  /** Dòng phụ dưới chip: tiến độ kho hoặc phương án lỗi thời (LM-104). */
  readonly sub: TripSubStatus | null
  /** Dòng phụ thứ hai: tuyến đã tối ưu có điểm trễ hạn dự kiến (FE-4b-09), hoặc còn xác nhận tay chờ duyệt (FE-6-04). */
  readonly extraSub: TripSubStatus | null
  /** Revision Planner mở mặc định (bản đã duyệt mới nhất, không có thì bản mới nhất); `null` khi chưa tối ưu. */
  readonly plan: { readonly jobId: string; readonly revisionId: string } | null
}

/** Chuyến kèm xe, tài xế và trạng thái hiển thị — màn chi tiết, form sửa và màn thiết lập tối ưu cùng cần. */
// chưa có ở BE
export async function fetchTripDetail(tripId: string): Promise<TripDetail> {
  const db = getMockDb()
  const trip = await db.getTrip(tripId)
  const [vehicle, revisions, driver] = await Promise.all([
    db.getVehicle(trip.vehicleId),
    db.listRevisions(tripId),
    trip.driverId === null ? null : db.getUser(trip.driverId).catch(notFoundAsNull),
  ])
  const shown = latestApproved(revisions) ?? revisions.at(-1)
  return {
    trip, vehicle, driver,
    status: tripStatus(trip),
    sub: tripSubStatus(trip, revisions),
    extraSub: tripRouteSubStatus(trip) ?? tripManualSubStatus(trip),
    plan: shown ? { jobId: shown.jobId, revisionId: shown.id } : null,
  }
}

function notFoundAsNull(error: unknown): null {
  if (isMockDbError(error) && error.code === 'NOT_FOUND') return null
  throw error
}

export type TripActivity = {
  readonly revisions: readonly Revision[]
  /** Nhật ký của chuyến, mới nhất trước. */
  readonly events: readonly AuditEvent[]
  /** Người dùng để đổi mã người làm thành tên. */
  readonly users: readonly User[]
}

/** Revision, nhật ký và người dùng cho thẻ Tiến trình (LM-088). */
// chưa có ở BE
export async function fetchTripActivity(tripId: string): Promise<TripActivity> {
  const db = getMockDb()
  const [revisions, events, users] = await Promise.all([db.listRevisions(tripId), db.listEvents({ targetId: tripId }), db.listUsers()])
  // `targetId` của kho khớp theo chuỗi con: giữ đúng sự kiện của chuyến này
  return { revisions, events: events.filter((event) => event.target.type === 'trip' && event.target.id === tripId), users }
}

/** Huỷ chuyến trước khi giao (D-45): kho bắt buộc lý do và ghi nhật ký. */
// chưa có ở BE
export async function cancelTrip(tripId: string, reason: string): Promise<Trip> {
  return getMockDb().cancelTrip(tripId, reason)
}

// chưa có ở BE
export async function fetchPackages(tripId: string): Promise<CargoPackage[]> {
  return (await getMockDb().getTrip(tripId)).packages
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


function mapTripFromApi(api: TripDetailApiResponse): Trip {
  // Lưu ý: Spring LocalDateTime không mang thông tin múi giờ.
  // departureTime và createdAt được hiểu là giờ Việt Nam.
  const vietnamIso = (value: string): string =>
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value)
      ? value
      : `${value}+07:00`

  const departureAt = vietnamIso(api.departureTime)

  const phase: Trip['phase'] =
    api.status === 'CANCELLED'
      ? 'cancelled'
      : api.status === 'DELIVERED'
        ? 'completed'
        : api.status === 'IN_TRANSIT'
          ? 'delivering'
          : api.status === 'LOADING'
            ? 'loading'
            : 'planning'

  return {
    id: String(api.id),
    companyId: String(api.companyId),
    name: api.tripName,
    vehicleId: String(api.vehicleId),
    driverId: api.driverId === null ? null : String(api.driverId),

    departureAt,
    scheduledDate: api.departureTime.slice(0, 10),

    depot: {
      name: api.originName,
      address: api.originAddress ?? '',
      lat: api.originLatitude,
      lng: api.originLongitude,
    },

    phase,
    createdAt: vietnamIso(api.createdAt),

    // Chỉ dành cho chuyến mới chưa được gán dữ liệu.
    stops: [],
    packages: [],
    inputVersion: 0,
  }
}
/** Thêm kiện mới hoặc thay kiện cùng mã; kiện đổi thì `inputVersion` tăng và revision cũ thành lỗi thời (D-31). */
// POST /api/trips/{id}/packages (sửa kiện đang có: chưa có ở BE)
export async function savePackage(tripId: string, pkg: CargoPackage, overrideReason?: string): Promise<Trip> {
  const db = getMockDb()
  const { packages } = await db.getTrip(tripId)
  const index = packages.findIndex((item) => item.id === pkg.id)
  const next = index === -1 ? [...packages, pkg] : packages.with(index, pkg)
  return db.updateTrip(tripId, { packages: next, ...(overrideReason === undefined ? {} : { overrideReason }) })
}

/**
 * Nhập kiện từ file (LM-093, D-49): thêm sau các kiện đang có trong **một** lần ghi — `inputVersion` tăng một lần, kho ghi một sự kiện
 * nhật ký. Dòng lỗi đã bị bỏ ở bước xem trước; nơi gọi chỉ đưa kiện hợp lệ.
 */
// POST /api/trips/{id}/packages
export async function importPackages(tripId: string, imported: readonly CargoPackage[], overrideReason?: string): Promise<Trip> {
  const db = getMockDb()
  const { packages } = await db.getTrip(tripId)
  return db.updateTrip(tripId, { packages: [...packages, ...imported], ...(overrideReason === undefined ? {} : { overrideReason }) })
}

// DELETE /api/trips/{id}/packages/{packageId}
export async function deletePackage(tripId: string, packageId: string): Promise<Trip> {
  const db = getMockDb()
  const { packages } = await db.getTrip(tripId)
  return db.updateTrip(tripId, { packages: packages.filter((item) => item.id !== packageId) })
}

/** Nhân bản kiện (D-33): mã mới lấy theo mã lớn nhất đang có, bản sao nằm ngay sau bản gốc. */
// chưa có ở BE
export async function duplicateTripPackage(tripId: string, packageId: string): Promise<CargoPackage> {
  const db = getMockDb()
  const { packages } = await db.getTrip(tripId)
  const index = packages.findIndex((item) => item.id === packageId)
  const source = packages[index]
  if (!source) throw new Error(`Chuyến ${tripId} không có kiện ${packageId}`)
  const copy = duplicatePackage(source, packages.map((item) => item.id))
  await db.updateTrip(tripId, { packages: packages.toSpliced(index + 1, 0, copy) })
  return copy
}

export type TripRevisions = { readonly trip: Trip; readonly revisions: Revision[] }

/** Chuyến kèm mọi revision đã lưu, cũ trước — màn So sánh phương án cần `inputVersion` của chuyến để biết bản lỗi thời (LM-051). */
// chưa có ở BE
export async function fetchTripRevisions(tripId: string): Promise<TripRevisions> {
  const db = getMockDb()
  const [trip, revisions] = await Promise.all([db.getTrip(tripId), db.listRevisions(tripId)])
  return { trip, revisions }
}
