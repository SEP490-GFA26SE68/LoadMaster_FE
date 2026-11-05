/**
 * Hàm → endpoint backend của màn kho khi nhóm `warehouse` nối backend (`usesBackend('warehouse')`):
 *   fetchTrips   → GET /api/warehouse/tasks
 *   fetchSession → GET /api/warehouse/tasks/{tripId}
 *   start        → POST /api/warehouse/tasks/{tripId}/start
 *   confirm      → POST /api/warehouse/placements/{id}/confirm
 *   deviation    → POST /api/warehouse/placements/{id}/deviation
 *   complete     → POST /api/warehouse/tasks/{tripId}/complete
 */
import { api, ApiError, isApiError, type ApiClient } from '@/lib/api-client'
import { sessionOf, taskOf, type ServerLoadingSession, type ServerWarehouseTrip, type StartLoadingDto, type WarehouseTaskDto } from './warehouse-dto'

export type { PlacementOutcome, ServerCargoBox, ServerLoadingSession, ServerPlacement, ServerWarehouseStage, ServerWarehouseTrip } from './warehouse-dto'
export { codeMatches } from './warehouse-dto'

/** Vị trí kiện thật sự đặt, cm, và lý do lệch khỏi phương án. */
export type DeviationInput = { readonly x: number; readonly y: number; readonly z: number; readonly reason: string }

const hasCode = (error: unknown, code: string) => isApiError(error) && error.code === code

const tripPath = (tripId: string) => `/api/warehouse/tasks/${encodeURIComponent(tripId)}`
const placementPath = (placementId: string) => `/api/warehouse/placements/${encodeURIComponent(placementId)}`

/**
 * Nguồn backend của màn kho. Máy chủ giữ phiên xếp: danh sách chuyến có cả chuyến Đang xếp hàng kèm trạng thái phiên, và phiên đọc lại được
 * ở mọi thiết bị kèm kết quả từng kiện. Sau mỗi lần ghi lớp này đọc lại phiên, nên màn luôn vẽ đúng điều máy chủ đã ghi.
 */
export function createWarehouseBackend(client: () => ApiClient = api) {
  // GET /api/warehouse/tasks
  async function fetchTrips(): Promise<ServerWarehouseTrip[]> {
    const tasks = await client().get<readonly WarehouseTaskDto[] | null>('/api/warehouse/tasks')
    const byDeparture = (a: ServerWarehouseTrip, b: ServerWarehouseTrip) => (a.departureAt ?? '').localeCompare(b.departureAt ?? '') || a.code.localeCompare(b.code)
    return (tasks ?? []).map(taskOf).toSorted(byDeparture)
  }

  // GET /api/warehouse/tasks/{tripId} — 409 `TRIP_NOT_LOADING`, `LOADING_EXECUTION_NOT_FOUND`
  async function fetchSession(tripId: string): Promise<ServerLoadingSession> {
    return sessionOf(await client().get<StartLoadingDto>(tripPath(tripId)))
  }

  // POST /api/warehouse/tasks/{tripId}/start
  async function start(tripId: string): Promise<ServerLoadingSession> {
    try {
      return sessionOf(await client().post<StartLoadingDto>(`${tripPath(tripId)}/start`))
    } catch (error) {
      // Đã bắt đầu ở thiết bị khác (hoặc lượt gọi trước mất phản hồi): mở lại phiên đó
      if (hasCode(error, 'TRIP_ALREADY_LOADING')) return fetchSession(tripId)
      throw error
    }
  }

  // POST /api/warehouse/placements/{id}/confirm
  async function confirm(tripId: string, placementId: string): Promise<ServerLoadingSession> {
    try {
      await client().post(`${placementPath(placementId)}/confirm`)
    } catch (error) {
      // Đã xác nhận từ trước (lượt gọi trước mất phản hồi): đọc lại phiên, không báo lỗi
      if (!hasCode(error, 'PLACEMENT_ALREADY_CONFIRMED')) throw error
    }
    return fetchSession(tripId)
  }

  // POST /api/warehouse/placements/{id}/deviation
  async function deviation(tripId: string, placementId: string, input: DeviationInput): Promise<ServerLoadingSession> {
    try {
      await client().post(`${placementPath(placementId)}/deviation`, {
        body: { actualPosX: Math.round(input.x), actualPosY: Math.round(input.y), actualPosZ: Math.round(input.z), reason: input.reason.trim() },
      })
    } catch (error) {
      if (!hasCode(error, 'DEVIATION_ALREADY_RECORDED')) throw error
    }
    return fetchSession(tripId)
  }

  // POST /api/warehouse/tasks/{tripId}/complete — 400 `INCOMPLETE_LOADING` khi còn kiện chưa xử lý
  async function complete(tripId: string): Promise<ServerLoadingSession> {
    try {
      await client().post(`${tripPath(tripId)}/complete`)
    } catch (error) {
      // Máy chủ cũ báo còn kiện chưa xử lý bằng 400 không kèm mã
      if (hasCode(error, 'BAD_REQUEST')) throw new ApiError('INCOMPLETE_LOADING', { status: 400 })
      throw error
    }
    return fetchSession(tripId)
  }

  return { fetchTrips, fetchSession, start, confirm, deviation, complete }
}

export type WarehouseBackend = ReturnType<typeof createWarehouseBackend>
