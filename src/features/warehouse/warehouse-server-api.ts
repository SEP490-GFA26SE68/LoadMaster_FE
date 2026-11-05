/**
 * Hàm → endpoint backend của màn kho bản máy chủ (nhóm `warehouse`, thân hàm ở `warehouse-backend-api.ts`):
 *   fetchServerWarehouseTrips → GET /api/warehouse/tasks và GET /api/trips?status=LOADING
 *   fetchServerLoadingSession → (phiên giữ ở tab — backend chưa có lối đọc lại)
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

export type { DeviationInput, ServerLoadingSession, ServerPlacement, ServerWarehouseStage, ServerWarehouseTrip } from './warehouse-backend-api'
export { codeMatches } from './warehouse-backend-api'

const ON_BACKEND = usesBackend('warehouse')

/**
 * Màn kho làm được gì với nguồn dữ liệu đang dùng (D-20). Kho mẫu: soạn hàng, báo thiếu, đối chiếu ba mức, kiện hỏng, seal, khung 3D vị trí
 * kiện, chuông. Backend: danh sách chuyến chờ xếp và đang xếp, bắt đầu xếp theo phương án đã duyệt, xác nhận từng kiện theo thứ tự (gõ mã),
 * ghi sai lệch vị trí, hoàn tất xếp. Backend chưa có — màn bản máy chủ không vẽ: soạn hàng và báo thiếu, quét QR (bước xếp không trả mã QR),
 * xác nhận tay, kiện hỏng làm chuyến quay về, số seal, khung 3D (kho không đọc được kích thước thùng xe và điểm giao), thông báo.
 */
export type WarehouseCapabilities = {
  /** Màn `/kho` là bản máy chủ (`ServerWarehouseTripsPage`, `ServerLoadingSession`). */
  readonly backend: boolean
  readonly notifications: boolean
}

export const WAREHOUSE_CAPABILITIES: WarehouseCapabilities = { backend: ON_BACKEND, notifications: !ON_BACKEND }

let source: WarehouseBackend | null = null
const backend = (): WarehouseBackend => (source ??= createWarehouseBackend())

/** Kho mẫu không có các hàm này: màn kho mẫu dùng `warehouse-api.ts`. */
const mockOnly = (): Promise<never> => Promise.reject(new ApiError('NOT_SUPPORTED'))

// GET /api/warehouse/tasks · GET /api/trips?status=LOADING
export function fetchServerWarehouseTrips(): Promise<ServerWarehouseTrip[]> {
  return ON_BACKEND ? backend().fetchTrips() : mockOnly()
}

// chưa có ở BE: đọc lại phiên đang xếp
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
