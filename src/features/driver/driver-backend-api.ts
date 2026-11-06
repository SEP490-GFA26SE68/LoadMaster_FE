/**
 * Hàm → endpoint backend của màn tài xế khi nhóm `driver` nối backend (`usesBackend('driver')`):
 *   driverId (mã tài xế của backend) → GET /api/users/me
 *   fetchMyTrips                     → GET /api/driver/trips?driverId=
 *   fetchStopScreen                  → GET /api/driver/trips?driverId= rồi GET /api/driver/trips/{id}/current-stop
 *   arrive                           → POST /api/driver/stops/{id}/arrive
 *   unload                           → POST /api/driver/packages/{id}/unload?driverId=
 *   completeStop                     → POST /api/driver/stops/{id}/complete?driverId=
 *   postLocation                     → POST /api/driver/location
 *   startTrip                        → POST /api/driver/trips/{id}/start
 */
import { api, ApiError, isApiError, type ApiClient } from '@/lib/api-client'
import {
  myTripsOf,
  isUnloaded,
  packageOfCode,
  stopScreenOf,
  withUnloaded,
  type ArriveStopDto,
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
  /** Chuyến vừa giao xong, kèm mã chuyến — chuyến đã giao rời khỏi danh sách của backend. */
  readonly finished: Map<string, string>
}

const emptyMemory = (): Memory => ({ codes: new Map(), stops: new Map(), finished: new Map() })

/** Lỗi nghiệp vụ của backend chưa kèm mã: đọc theo mã HTTP của từng endpoint. */
const failedWith = (error: unknown, status: number) => isApiError(error) && error.status === status

/**
 * Nguồn backend của màn tài xế. Giờ đến điểm và kiện đã dỡ đọc từ máy chủ (`current-stop`), tải lại trang vẫn đúng; lớp này chỉ tự giữ
 * chuyến nào vừa giao xong trong lần mở trang. Một lần mở trang một người đăng nhập — đăng nhập và đăng xuất Keycloak đều tải lại trang — nên
 * mã tài xế đọc một lần.
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
    return { kind: 'stop', trip, ...stopScreenOf(dto, row.stopCount) }
  }

  /** Điểm hiện tại của chuyến, khi nó đúng là điểm số `stopNumber` trên màn; đọc lại nếu chưa có. */
  async function stopOf(tripId: string, stopNumber: number): Promise<CurrentStopDto> {
    const { memory: store } = await mine()
    const cached = store.stops.get(tripId)
    const dto = cached?.stopSequence === stopNumber ? cached : await currentStop(tripId)
    if (dto.stopSequence !== stopNumber) throw new ApiError('DELIVERY_STOP_NOT_FOUND')
    return dto
  }

  // POST /api/driver/stops/{id}/arrive
  /**
   * Báo đã đến điểm đang giao; giờ đến đọc lại ở `current-stop`. Máy chủ đã ghi đến từ trước (409 `DELIVERY_STOP_ALREADY_ARRIVED`, ví dụ
   * báo ở máy khác): coi như đã đến — lần đọc lại mang giờ đến của máy chủ.
   */
  async function arrive(tripId: string, stopNumber: number): Promise<void> {
    const dto = await stopOf(tripId, stopNumber)
    try {
      await client().post<ArriveStopDto>(`/api/driver/stops/${dto.stopId}/arrive`)
    } catch (error) {
      if (!(isApiError(error) && error.code === 'DELIVERY_STOP_ALREADY_ARRIVED')) throw error
    }
  }

  // POST /api/driver/packages/{id}/unload?driverId=
  async function unload(tripId: string, { stopNumber, code }: BackendUnloadInput): Promise<{ readonly packageInstanceId: string }> {
    const { id, memory: store } = await mine()
    const dto = await stopOf(tripId, stopNumber)
    const pkg = packageOfCode(dto, code)
    if (pkg.kind === 'unknown') throw new ApiError('UNLOAD_CODE_UNMATCHED', { params: { code: code.trim() } })
    if (pkg.kind === 'ambiguous') throw new ApiError('UNLOAD_CODE_AMBIGUOUS', { params: { code: code.trim(), count: pkg.count } })
    const packageInstanceId = String(pkg.packageId)
    if (isUnloaded(dto, pkg.packageId)) throw new ApiError('DUPLICATE_UNLOAD', { params: { code: pkg.label } })
    try {
      await client().post<ConfirmUnloadDto>(`/api/driver/packages/${pkg.packageId}/unload`, { query: { driverId: id } })
    } catch (error) {
      // Đã dỡ ở máy khác sau lần đọc gần nhất: lần đọc lại (sau mỗi lệnh ghi) cho thấy kiện đã dỡ
      if (failedWith(error, 409)) throw new ApiError('DUPLICATE_UNLOAD', { status: 409, params: { code: pkg.label } })
      if (failedWith(error, 400)) throw new ApiError('WRONG_DELIVERY_STOP', { status: 400, params: { code: pkg.label } })
      throw error
    }
    // Lần gõ kế tiếp trước khi màn đọc lại điểm cũng thấy kiện này đã dỡ
    store.stops.set(tripId, withUnloaded(dto, pkg.packageId))
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
    if (result.tripCompleted === true) store.finished.set(tripId, store.codes.get(tripId) ?? tripId)
  }

  // POST /api/driver/trips/{id}/start
  /** Xuất phát: Đang xếp hàng → Đang vận chuyển. Thẻ chỉ bật nút khi kho đã xếp xong; máy chủ vẫn từ chối 409 `LOADING_NOT_COMPLETED`. */
  async function startTrip(tripId: string): Promise<void> {
    await mine()
    try {
      await client().post<DriverTripDto>(`/api/driver/trips/${encodeURIComponent(tripId)}/start`)
    } catch (error) {
      if (isApiError(error) && error.code === 'CONFLICT') throw new ApiError('LOADING_NOT_COMPLETED', { status: 409 })
      throw error
    }
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

  return { fetchMyTrips: listTrips, fetchStopScreen, arrive, unload, completeStop, postLocation, startTrip }
}

export type DriverBackend = ReturnType<typeof createDriverBackend>
