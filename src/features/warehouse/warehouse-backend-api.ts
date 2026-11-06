/**
 * Hàm → endpoint backend của màn kho khi nhóm `warehouse` nối backend (`usesBackend('warehouse')`):
 *   fetchTrips   → GET /api/warehouse/tasks
 *   fetchSession → GET /api/warehouse/tasks/{tripId}
 *   start        → POST /api/warehouse/tasks/{tripId}/start
 *   confirm      → POST /api/warehouse/placements/{id}/confirm
 *   deviation    → POST /api/warehouse/placements/{id}/deviation
 *   complete     → POST /api/warehouse/tasks/{tripId}/complete
 *   stage        → POST /api/warehouse/tasks/{tripId}/staging/packages/{packageId}/confirm
 *   stageManually → POST /api/warehouse/tasks/{tripId}/staging/packages/{packageId}/manual
 *   reportShortage → POST /api/warehouse/tasks/{tripId}/staging/packages/{packageId}/shortage
 *   confirmManually → POST /api/warehouse/placements/{id}/manual
 *   damaged      → POST /api/warehouse/placements/{id}/damaged
 *   seal         → POST /api/warehouse/tasks/{tripId}/seal
 */
import { api, ApiError, isApiError, type ApiClient } from '@/lib/api-client'
import type { ManualConfirmReason } from '@/lib/mock-db'
import { sessionOf, taskOf, type DamageDto, type ServerLoadingSession, type ServerWarehouseTrip, type StagingDto, type StartLoadingDto, type WarehouseTaskDto } from './warehouse-dto'

export type {
  PlacementOutcome,
  ServerCargoBox,
  ServerLoadingSession,
  ServerManualState,
  ServerPlacement,
  ServerSeal,
  ServerStagingState,
  ServerWarehouseStage,
  ServerWarehouseTrip,
} from './warehouse-dto'
export { codeMatches } from './warehouse-dto'

/** Vị trí kiện thật sự đặt, cm, và lý do lệch khỏi phương án. */
export type DeviationInput = { readonly x: number; readonly y: number; readonly z: number; readonly reason: string }

/** Xác nhận tay khi nhãn không đọc được: lý do (`OTHER` bắt buộc ghi chú). */
export type ServerManualInput = { readonly reason: ManualConfirmReason; readonly note?: string }

/** Kết quả soạn một kiện: `alreadyStaged` — kiện đã soạn từ trước, máy chủ không ghi thêm. */
export type StagingResult = { readonly session: ServerLoadingSession; readonly alreadyStaged: boolean }

/** Kết quả ghi kiện hỏng: `leftOut` — kiện bỏ lại kho, xếp tiếp; `replanned` — chuyến về Đã lập kế hoạch, không còn phiên để đọc. */
export type DamageResult =
  | { readonly outcome: 'leftOut'; readonly session: ServerLoadingSession }
  | { readonly outcome: 'replanned'; readonly resting: number }

const manualBody = (input: ServerManualInput) => ({ reason: input.reason, note: input.note?.trim() || undefined })

const hasCode = (error: unknown, code: string) => isApiError(error) && error.code === code

const tripPath = (tripId: string) => `/api/warehouse/tasks/${encodeURIComponent(tripId)}`
const placementPath = (placementId: string) => `/api/warehouse/placements/${encodeURIComponent(placementId)}`
const stagingPath = (tripId: string, packageId: string) => `${tripPath(tripId)}/staging/packages/${encodeURIComponent(packageId)}`

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
      // Phiên của màn web luôn có bước soạn hàng; app di động không gửi cờ này nên vẫn xếp thẳng như cũ
      return sessionOf(await client().post<StartLoadingDto>(`${tripPath(tripId)}/start`, { body: { staging: true } }))
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

  // POST /api/warehouse/tasks/{tripId}/staging/packages/{packageId}/confirm — quét lại kiện đã soạn trả `alreadyStaged`, không ghi
  async function stage(tripId: string, packageId: string, method: 'QR' | 'CODE'): Promise<StagingResult> {
    const result = await client().post<StagingDto | null>(`${stagingPath(tripId, packageId)}/confirm`, { body: { method } })
    return { session: await fetchSession(tripId), alreadyStaged: result?.alreadyStaged === true }
  }

  // POST /api/warehouse/tasks/{tripId}/staging/packages/{packageId}/manual — kiện tính là đã soạn, xác nhận chờ điều phối viên duyệt
  async function stageManually(tripId: string, packageId: string, input: ServerManualInput): Promise<ServerLoadingSession> {
    await client().post(`${stagingPath(tripId, packageId)}/manual`, { body: manualBody(input) })
    return fetchSession(tripId)
  }

  // POST /api/warehouse/tasks/{tripId}/staging/packages/{packageId}/shortage — báo lại kiện đang báo thiếu không ghi thêm
  async function reportShortage(tripId: string, packageId: string): Promise<ServerLoadingSession> {
    await client().post(`${stagingPath(tripId, packageId)}/shortage`)
    return fetchSession(tripId)
  }

  // POST /api/warehouse/placements/{id}/manual — kiện tính là đã xếp, xác nhận chờ điều phối viên duyệt
  async function confirmManually(tripId: string, placementId: string, input: ServerManualInput): Promise<ServerLoadingSession> {
    await client().post(`${placementPath(placementId)}/manual`, { body: manualBody(input) })
    return fetchSession(tripId)
  }

  // POST /api/warehouse/placements/{id}/damaged
  async function damaged(tripId: string, placementId: string): Promise<DamageResult> {
    const result = await client().post<DamageDto>(`${placementPath(placementId)}/damaged`)
    if (result.outcome === 'REPLANNED') return { outcome: 'replanned', resting: result.restingCount ?? 0 }
    return { outcome: 'leftOut', session: await fetchSession(tripId) }
  }

  // POST /api/warehouse/tasks/{tripId}/seal — chỉ khi đã xếp xong và xe chưa xuất phát (`SEAL_NOT_ALLOWED`)
  async function seal(tripId: string, sealNumber: string): Promise<ServerLoadingSession> {
    await client().post(`${tripPath(tripId)}/seal`, { body: { sealNumber: sealNumber.trim() } })
    return fetchSession(tripId)
  }

  return { fetchTrips, fetchSession, start, confirm, deviation, complete, stage, stageManually, reportShortage, confirmManually, damaged, seal }
}

export type WarehouseBackend = ReturnType<typeof createWarehouseBackend>
