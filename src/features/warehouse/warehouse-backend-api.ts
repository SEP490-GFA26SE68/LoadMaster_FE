/**
 * Hàm → endpoint backend của màn kho khi nhóm `warehouse` nối backend (`usesBackend('warehouse')`):
 *   fetchTrips → GET /api/warehouse/tasks và GET /api/trips?status=LOADING
 *   start      → POST /api/warehouse/tasks/{tripId}/start
 *   confirm    → POST /api/warehouse/placements/{id}/confirm
 *   deviation  → POST /api/warehouse/placements/{id}/deviation
 *   complete   → POST /api/warehouse/tasks/{tripId}/complete
 */
import { api, ApiError, isApiError, type ApiClient } from '@/lib/api-client'
import { fetchAllPages } from '@/lib/api-page'
import {
  loadingTripOf,
  sessionOf,
  taskOf,
  type CompleteLoadingDto,
  type ConfirmPlacementDto,
  type DeviationDto,
  type LoadingTripDto,
  type PlacementOutcome,
  type ServerLoadingSession,
  type ServerWarehouseTrip,
  type StartLoadingDto,
  type WarehouseTaskDto,
} from './warehouse-dto'

export type { PlacementOutcome, ServerLoadingSession, ServerPlacement, ServerWarehouseStage, ServerWarehouseTrip } from './warehouse-dto'
export { codeMatches } from './warehouse-dto'

/** Vị trí kiện thật sự đặt, cm, và lý do lệch khỏi phương án. */
export type DeviationInput = { readonly x: number; readonly y: number; readonly z: number; readonly reason: string }

/** Nơi giữ phiên xếp của tab: backend chưa có lối đọc lại danh sách kiện của phiên đang xếp. */
export type SessionStore = {
  read(): Record<string, ServerLoadingSession>
  write(sessions: Record<string, ServerLoadingSession>): void
}

const STORAGE_KEY = 'loadmaster.phien-xep-may-chu'

/**
 * `sessionStorage` của tab: tải lại trang vẫn làm tiếp được phiên đã bắt đầu ở tab này. Trình duyệt chặn bộ nhớ (chế độ riêng tư) thì giữ
 * trong bộ nhớ của trang.
 */
export function tabSessionStore(): SessionStore {
  let memory: Record<string, ServerLoadingSession> = {}
  return {
    read() {
      try {
        const raw = globalThis.sessionStorage?.getItem(STORAGE_KEY)
        return raw ? (JSON.parse(raw) as Record<string, ServerLoadingSession>) : memory
      } catch {
        return memory
      }
    },
    write(sessions) {
      memory = sessions
      try {
        globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(sessions))
      } catch {
        // chỉ còn bản trong bộ nhớ của trang
      }
    },
  }
}

const hasCode = (error: unknown, code: string) => isApiError(error) && error.code === code

/**
 * Nguồn backend của màn kho. Backend trả danh sách kiện của phiên xếp đúng một lần — lúc bắt đầu — và không trả lại kiện nào đã xếp, nên lớp
 * này giữ phiên (kiện theo thứ tự xếp, kết quả từng kiện, đã hoàn tất chưa) trong `SessionStore` của tab. Chuyến Đang xếp hàng mà tab không
 * giữ phiên là `elsewhere`: không làm tiếp được ở tab này.
 */
export function createWarehouseBackend(client: () => ApiClient = api, store: SessionStore = tabSessionStore()) {
  function update(tripId: string, change: (session: ServerLoadingSession) => ServerLoadingSession): ServerLoadingSession {
    const sessions = store.read()
    const current = sessions[tripId]
    if (current === undefined) throw new ApiError('LOADING_SESSION_UNAVAILABLE')
    const next = change(current)
    store.write({ ...sessions, [tripId]: next })
    return next
  }

  const withOutcome = (placementId: string, outcome: PlacementOutcome) => (session: ServerLoadingSession): ServerLoadingSession =>
    ({ ...session, outcomes: { ...session.outcomes, [placementId]: outcome } })

  // GET /api/warehouse/tasks · GET /api/trips?status=LOADING
  async function fetchTrips(): Promise<ServerWarehouseTrip[]> {
    const [tasks, loading] = await Promise.all([
      client().get<readonly WarehouseTaskDto[] | null>('/api/warehouse/tasks'),
      fetchAllPages<LoadingTripDto>('/api/trips', { query: { status: 'LOADING' }, size: 100 }, client()),
    ])
    const sessions = store.read()
    // Phiên của chuyến không còn Đang xếp hàng (tài xế đã xuất phát, chuyến bị huỷ) thì bỏ
    const loadingIds = new Set(loading.map((dto) => String(dto.id)))
    const kept = Object.fromEntries(Object.entries(sessions).filter(([id]) => loadingIds.has(id)))
    if (Object.keys(kept).length !== Object.keys(sessions).length) store.write(kept)
    const loadingRows = loading.map((dto) => {
      const session = kept[String(dto.id)]
      return loadingTripOf(dto, session === undefined ? 'elsewhere' : session.completed ? 'loaded' : 'loading')
    })
    const byDeparture = (a: ServerWarehouseTrip, b: ServerWarehouseTrip) => (a.departureAt ?? '').localeCompare(b.departureAt ?? '') || a.code.localeCompare(b.code)
    return [...loadingRows, ...(tasks ?? []).map(taskOf)].toSorted(byDeparture)
  }

  function fetchSession(tripId: string): Promise<ServerLoadingSession> {
    const session = store.read()[tripId]
    return session === undefined ? Promise.reject(new ApiError('LOADING_SESSION_UNAVAILABLE')) : Promise.resolve(session)
  }

  // POST /api/warehouse/tasks/{tripId}/start
  async function start(tripId: string): Promise<ServerLoadingSession> {
    const existing = store.read()[tripId]
    if (existing !== undefined) return existing
    let dto: StartLoadingDto
    try {
      dto = await client().post<StartLoadingDto>(`/api/warehouse/tasks/${encodeURIComponent(tripId)}/start`)
    } catch (error) {
      if (hasCode(error, 'TRIP_ALREADY_LOADING')) throw new ApiError('LOADING_SESSION_UNAVAILABLE', { status: 400 })
      throw error
    }
    const session = sessionOf(dto)
    store.write({ ...store.read(), [tripId]: session })
    return session
  }

  // POST /api/warehouse/placements/{id}/confirm
  async function confirm(tripId: string, placementId: string): Promise<ServerLoadingSession> {
    await fetchSession(tripId)
    try {
      await client().post<ConfirmPlacementDto>(`/api/warehouse/placements/${encodeURIComponent(placementId)}/confirm`)
    } catch (error) {
      // Đã xác nhận từ trước (lượt gọi trước mất phản hồi): ghi nhận lại, không báo lỗi
      if (!hasCode(error, 'PLACEMENT_ALREADY_CONFIRMED')) throw error
    }
    return update(tripId, withOutcome(placementId, 'confirmed'))
  }

  // POST /api/warehouse/placements/{id}/deviation
  async function deviation(tripId: string, placementId: string, input: DeviationInput): Promise<ServerLoadingSession> {
    await fetchSession(tripId)
    try {
      await client().post<DeviationDto>(`/api/warehouse/placements/${encodeURIComponent(placementId)}/deviation`, {
        body: { actualPosX: Math.round(input.x), actualPosY: Math.round(input.y), actualPosZ: Math.round(input.z), reason: input.reason.trim() },
      })
    } catch (error) {
      if (!hasCode(error, 'DEVIATION_ALREADY_RECORDED')) throw error
    }
    return update(tripId, withOutcome(placementId, 'deviation'))
  }

  // POST /api/warehouse/tasks/{tripId}/complete
  async function complete(tripId: string): Promise<ServerLoadingSession> {
    await fetchSession(tripId)
    try {
      await client().post<CompleteLoadingDto>(`/api/warehouse/tasks/${encodeURIComponent(tripId)}/complete`)
    } catch (error) {
      // Backend báo còn kiện chưa xử lý bằng 400 không kèm mã
      if (hasCode(error, 'BAD_REQUEST')) throw new ApiError('INCOMPLETE_LOADING', { status: 400 })
      throw error
    }
    return update(tripId, (session) => ({ ...session, completed: true }))
  }

  return { fetchTrips, fetchSession, start, confirm, deviation, complete }
}

export type WarehouseBackend = ReturnType<typeof createWarehouseBackend>
