/**
 * Hàm → endpoint backend của màn tài xế khi nhóm `driver` nối backend (`usesBackend('driver')`):
 *   driverId (mã tài xế của backend) → GET /api/users/me
 *   fetchMyTrips                     → GET /api/driver/trips?driverId=
 *   fetchStopScreen                  → GET /api/driver/trips?driverId= rồi GET /api/driver/trips/{id}/current-stop
 *   unload                           → POST /api/driver/packages/{id}/unload?driverId=
 *   completeStop                     → POST /api/driver/stops/{id}/complete?driverId=
 *   postLocation                     → POST /api/driver/location
 */
import { api, ApiError, isApiError, type ApiClient } from '@/lib/api-client'
import {
  myTripsOf,
  packageIdsOf,
  packageOfCode,
  stopScreenOf,
  type BackendStop,
  type CompleteStopDto,
  type ConfirmUnloadDto,
  type CurrentStopDto,
  type DriverTripDto,
  type LocationPointDto,
  type UserMeDto,
} from './driver-dto'
import type { MyTrips } from './my-trips'

/** Chuyến mở ở màn điểm giao: mã số của backend (trên route) và mã chuyến hiện trên màn. */
export type TripHead = { readonly id: string; readonly code: string }

/**
 * Màn điểm giao theo backend: `stop` — điểm đang giao; `completed` — chuyến vừa giao xong trong lần mở trang này (chuyến đã giao rời
 * khỏi danh sách của backend); `noStops` — chuyến đang vận chuyển mà không còn điểm nào chờ giao; `notInTransit` — không phải chuyến đang
 * vận chuyển của tài xế này (chưa xuất phát, đã giao từ trước, hoặc của người khác).
 */
export type DriverStopScreen =
  | ({ readonly kind: 'stop'; readonly trip: TripHead } & BackendStop)
  | { readonly kind: 'completed'; readonly trip: TripHead }
  | { readonly kind: 'noStops'; readonly trip: TripHead }
  | { readonly kind: 'notInTransit' }

/** Mã gõ được ở điểm số `stopNumber`. */
export type BackendUnloadInput = { readonly stopNumber: number; readonly code: string }

type Memory = {
  /** Mã chuyến theo mã số, của lần đọc danh sách gần nhất. */
  readonly codes: Map<string, string>
  /** Điểm hiện tại của lần đọc gần nhất theo chuyến: để đổi mã gõ thành mã kiện và tìm mã điểm khi hoàn tất. */
  readonly stops: Map<string, CurrentStopDto>
  /** Kiện đã dỡ theo điểm (`stopId`) — backend chưa trả trạng thái từng kiện. */
  readonly unloaded: Map<string, Set<string>>
  /** Chuyến vừa giao xong, kèm mã chuyến. */
  readonly finished: Map<string, string>
}

const emptyMemory = (): Memory => ({ codes: new Map(), stops: new Map(), unloaded: new Map(), finished: new Map() })

/** Lỗi nghiệp vụ của backend chưa kèm mã: đọc theo mã HTTP của từng endpoint. */
const failedWith = (error: unknown, status: number) => isApiError(error) && error.status === status

/**
 * Nguồn backend của màn tài xế. Điều backend chưa trả thì lớp này tự giữ trong lần mở trang: kiện nào của điểm đã dỡ, chuyến nào vừa
 * giao xong. Một lần mở trang một người đăng nhập — đăng nhập và đăng xuất Keycloak đều tải lại trang — nên mã tài xế đọc một lần. Tải lại
 * trang thì gõ lại mã các kiện đã dỡ: backend báo trùng (409) và lớp này ghi nhận lại.
 * Mọi endpoint của tài xế lọc theo `driverId` ở tham số — thiếu thì backend trả chuyến của mọi tài xế — nên không bao giờ gọi thiếu nó.
 */
export function createDriverBackend(client: () => ApiClient = api) {
  let pendingId: Promise<string> | null = null
  const memory = emptyMemory()

  // GET /api/users/me
  function driverId(): Promise<string> {
    if (pendingId === null) {
      const request = client().get<UserMeDto | null>('/api/users/me').then((me) => {
        if (me?.id === null || me?.id === undefined) throw new ApiError('UNAUTHENTICATED')
        return String(me.id)
      })
      // Đọc hỏng thì lần sau hỏi lại
      request.catch(() => {
        if (pendingId === request) pendingId = null
      })
      pendingId = request
    }
    return pendingId
  }

  /** Mã tài xế kèm dữ liệu tự giữ: lệnh nào cũng đợi mã tài xế trước, nên không lệnh nào gọi backend khi chưa biết đó là ai. */
  async function mine(): Promise<{ readonly id: string; readonly memory: Memory }> {
    return { id: await driverId(), memory }
  }

  function unloadedAt(store: Memory, stopId: string): Set<string> {
    const entries = store.unloaded.get(stopId) ?? new Set<string>()
    store.unloaded.set(stopId, entries)
    return entries
  }

  // GET /api/driver/trips?driverId=
  async function listTrips(): Promise<MyTrips> {
    const { id, memory: store } = await mine()
    const trips = myTripsOf(await client().get<readonly DriverTripDto[] | null>('/api/driver/trips', { query: { driverId: id } }))
    store.codes.clear()
    for (const row of trips.inTransit) store.codes.set(row.id, row.code ?? row.id)
    return trips
  }

  // GET /api/driver/trips/{id}/current-stop
  async function currentStop(tripId: string): Promise<CurrentStopDto> {
    const { memory: store } = await mine()
    const dto = await client().get<CurrentStopDto>(`/api/driver/trips/${encodeURIComponent(tripId)}/current-stop`)
    store.stops.set(tripId, dto)
    return dto
  }

  /**
   * Chỉ chuyến đang vận chuyển của chính tài xế mới mở được: backend đọc điểm hiện tại của chuyến nào cũng được (kể cả của người khác),
   * nên điểm hiện tại chỉ được đọc sau khi danh sách của tài xế có chuyến đó.
   */
  async function fetchStopScreen(tripId: string): Promise<DriverStopScreen> {
    const trips = await listTrips()
    const { memory: store } = await mine()
    const row = trips.inTransit.find((entry) => entry.id === tripId)
    if (row === undefined) {
      const code = store.finished.get(tripId)
      return code === undefined ? { kind: 'notInTransit' } : { kind: 'completed', trip: { id: tripId, code } }
    }
    const trip = { id: tripId, code: row.code ?? tripId }
    let dto: CurrentStopDto
    try {
      dto = await currentStop(tripId)
    } catch (error) {
      // Chuyến đang vận chuyển mà backend không còn điểm nào chưa hoàn tất
      if (failedWith(error, 404)) return { kind: 'noStops', trip }
      throw error
    }
    return { kind: 'stop', trip, ...stopScreenOf(dto, row.stopCount, unloadedAt(store, String(dto.stopId))) }
  }

  /** Điểm hiện tại của chuyến, khi nó đúng là điểm số `stopNumber` trên màn; đọc lại nếu chưa có. */
  async function stopOf(tripId: string, stopNumber: number): Promise<CurrentStopDto> {
    const { memory: store } = await mine()
    const cached = store.stops.get(tripId)
    const dto = cached?.stopSequence === stopNumber ? cached : await currentStop(tripId)
    if (dto.stopSequence !== stopNumber) throw new ApiError('DELIVERY_STOP_NOT_FOUND')
    return dto
  }

  // POST /api/driver/packages/{id}/unload?driverId=
  async function unload(tripId: string, { stopNumber, code }: BackendUnloadInput): Promise<{ readonly packageInstanceId: string }> {
    const { id, memory: store } = await mine()
    const dto = await stopOf(tripId, stopNumber)
    const pkg = packageOfCode(dto, code)
    if (pkg === undefined) throw new ApiError('UNLOAD_CODE_UNMATCHED', { params: { code: code.trim() } })
    const packageInstanceId = String(pkg.packageId)
    const unloaded = unloadedAt(store, String(dto.stopId))
    if (unloaded.has(packageInstanceId)) throw new ApiError('DUPLICATE_UNLOAD', { params: { code: pkg.label } })
    let result: ConfirmUnloadDto
    try {
      result = await client().post<ConfirmUnloadDto>(`/api/driver/packages/${pkg.packageId}/unload`, { query: { driverId: id } })
    } catch (error) {
      if (failedWith(error, 409)) {
        // Đã dỡ từ trước (trước lần tải trang này, hoặc ở máy khác): ghi nhận để dòng kiện đúng trở lại
        unloaded.add(packageInstanceId)
        throw new ApiError('DUPLICATE_UNLOAD', { status: 409, params: { code: pkg.label } })
      }
      if (failedWith(error, 400)) throw new ApiError('WRONG_DELIVERY_STOP', { status: 400, params: { code: pkg.label } })
      throw error
    }
    unloaded.add(packageInstanceId)
    // Backend báo điểm không còn kiện nào chưa dỡ: mọi kiện của điểm đã dỡ, kể cả kiện dỡ trước lần tải trang này
    if (result.remainingPackagesCount === 0) for (const item of packageIdsOf(dto)) unloaded.add(item)
    return { packageInstanceId }
  }

  // POST /api/driver/stops/{id}/complete?driverId=
  async function completeStop(tripId: string, stopNumber: number): Promise<void> {
    const { id, memory: store } = await mine()
    const dto = await stopOf(tripId, stopNumber)
    let result: CompleteStopDto
    try {
      result = await client().post<CompleteStopDto>(`/api/driver/stops/${dto.stopId}/complete`, { query: { driverId: id } })
    } catch (error) {
      if (failedWith(error, 400)) throw new ApiError('INCOMPLETE_STOP_UNLOAD', { status: 400 })
      throw error
    }
    store.stops.delete(tripId)
    store.unloaded.delete(String(dto.stopId))
    if (result.tripCompleted === true) store.finished.set(tripId, store.codes.get(tripId) ?? tripId)
  }

  // POST /api/driver/location
  async function postLocation(tripId: string, location: { readonly lat: number; readonly lng: number; readonly speedKmh?: number; readonly heading?: number }): Promise<{ readonly recordedAt: string }> {
    try {
      const point = await client().post<LocationPointDto>('/api/driver/location', { body: { tripId, ...location } })
      return { recordedAt: point.recordedAt }
    } catch (error) {
      if (failedWith(error, 400)) throw new ApiError('GPS_TRIP_NOT_IN_TRANSIT', { status: 400 })
      throw error
    }
  }

  return { fetchMyTrips: listTrips, fetchStopScreen, unload, completeStop, postLocation }
}

export type DriverBackend = ReturnType<typeof createDriverBackend>
