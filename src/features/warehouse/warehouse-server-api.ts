/**
 * Hàm → endpoint backend của màn kho bản máy chủ (nhóm `warehouse`, thân hàm ở `warehouse-backend-api.ts`):
 *   fetchServerWarehouseTrips → GET /api/warehouse/tasks
 *   fetchServerLoadingSession → GET /api/warehouse/tasks/{tripId}
 *   startServerLoading        → POST /api/warehouse/tasks/{tripId}/start
 *   confirmServerPlacement    → POST /api/warehouse/placements/{id}/confirm
 *   recordServerDeviation     → POST /api/warehouse/placements/{id}/deviation
 *   completeServerLoading     → POST /api/warehouse/tasks/{tripId}/complete
 */
import { ApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import {
  createWarehouseBackend,
  type DeviationInput,
  type ServerLoadingSession,
  type ServerWarehouseTrip,
  type WarehouseBackend,
} from './warehouse-backend-api'

export type { DeviationInput, ServerCargoBox, ServerLoadingSession, ServerPlacement, ServerWarehouseStage, ServerWarehouseTrip } from './warehouse-backend-api'
export { codeMatches } from './warehouse-backend-api'

const ON_BACKEND = usesBackend('warehouse')

/**
 * Màn kho làm được gì với nguồn dữ liệu đang dùng (D-20). Kho mẫu: soạn hàng, báo thiếu, đối chiếu ba mức, kiện hỏng, seal, khung 3D vị trí
 * kiện, chuông. Backend: danh sách chuyến chờ xếp, đang xếp và đã xếp xong, bắt đầu xếp theo phương án đã duyệt, mở lại phiên ở mọi thiết
 * bị, đối chiếu từng kiện theo thứ tự (quét QR hoặc gõ mã), ghi sai lệch vị trí, hoàn tất xếp, khung 3D vị trí kiện khi máy chủ trả lòng
 * thùng. Backend chưa có — màn bản máy chủ không vẽ: soạn hàng và báo thiếu, xác nhận tay, kiện hỏng làm chuyến quay về, số seal. Chuông đọc máy chủ khi nhóm `notifications` nối backend.
 */
export type WarehouseCapabilities = {
  /** Màn `/kho` là bản máy chủ (`ServerWarehouseTripsPage`, `ServerLoadingSession`). */
  readonly backend: boolean
  readonly notifications: boolean
}

export const WAREHOUSE_CAPABILITIES: WarehouseCapabilities = {
  backend: ON_BACKEND,
  // Chuông bản máy chủ khi nhóm `notifications` cũng nối backend (`GET /api/notifications`)
  notifications: !ON_BACKEND || usesBackend('notifications'),
}

let source: WarehouseBackend | null = null
const backend = (): WarehouseBackend => (source ??= createWarehouseBackend())

/** Kho mẫu không có các hàm này: màn kho mẫu dùng `warehouse-api.ts`. */
const mockOnly = (): Promise<never> => Promise.reject(new ApiError('NOT_SUPPORTED'))

// GET /api/warehouse/tasks
export function fetchServerWarehouseTrips(): Promise<ServerWarehouseTrip[]> {
  return ON_BACKEND ? backend().fetchTrips() : mockOnly()
}

// GET /api/warehouse/tasks/{tripId}
export function fetchServerLoadingSession(tripId: string): Promise<ServerLoadingSession> {
  return ON_BACKEND ? backend().fetchSession(tripId) : mockOnly()
}

// POST /api/warehouse/tasks/{tripId}/start
export function startServerLoading(tripId: string): Promise<ServerLoadingSession> {
  return ON_BACKEND ? backend().start(tripId) : mockOnly()
}

// POST /api/warehouse/placements/{id}/confirm
export function confirmServerPlacement(tripId: string, placementId: string): Promise<ServerLoadingSession> {
  return ON_BACKEND ? backend().confirm(tripId, placementId) : mockOnly()
}

// POST /api/warehouse/placements/{id}/deviation
export function recordServerDeviation(tripId: string, placementId: string, input: DeviationInput): Promise<ServerLoadingSession> {
  return ON_BACKEND ? backend().deviation(tripId, placementId, input) : mockOnly()
}

// POST /api/warehouse/tasks/{tripId}/complete
export function completeServerLoading(tripId: string): Promise<ServerLoadingSession> {
  return ON_BACKEND ? backend().complete(tripId) : mockOnly()
}
