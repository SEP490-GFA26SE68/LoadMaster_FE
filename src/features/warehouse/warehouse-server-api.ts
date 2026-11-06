/**
 * Hàm → endpoint backend của màn kho bản máy chủ (nhóm `warehouse`, thân hàm ở `warehouse-backend-api.ts`):
 *   fetchServerWarehouseTrips → GET /api/warehouse/tasks
 *   fetchServerLoadingSession → GET /api/warehouse/tasks/{tripId}
 *   startServerLoading        → POST /api/warehouse/tasks/{tripId}/start
 *   confirmServerPlacement    → POST /api/warehouse/placements/{id}/confirm
 *   recordServerDeviation     → POST /api/warehouse/placements/{id}/deviation
 *   completeServerLoading     → POST /api/warehouse/tasks/{tripId}/complete
 *   stageServerPackage        → POST /api/warehouse/tasks/{tripId}/staging/packages/{packageId}/confirm
 *   stageServerPackageManually → POST /api/warehouse/tasks/{tripId}/staging/packages/{packageId}/manual
 *   reportServerShortage      → POST /api/warehouse/tasks/{tripId}/staging/packages/{packageId}/shortage
 *   confirmServerPlacementManually → POST /api/warehouse/placements/{id}/manual
 *   reportServerDamaged       → POST /api/warehouse/placements/{id}/damaged
 *   recordServerSeal          → POST /api/warehouse/tasks/{tripId}/seal
 */
import { ApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import {
  createWarehouseBackend,
  type DamageResult,
  type DeviationInput,
  type ServerLoadingSession,
  type ServerManualInput,
  type ServerWarehouseTrip,
  type StagingResult,
  type WarehouseBackend,
} from './warehouse-backend-api'

export type {
  DamageResult,
  DeviationInput,
  PlacementOutcome,
  ServerCargoBox,
  ServerLoadingSession,
  ServerManualInput,
  ServerManualState,
  ServerPlacement,
  ServerSeal,
  ServerStagingState,
  ServerWarehouseStage,
  ServerWarehouseTrip,
  StagingResult,
} from './warehouse-backend-api'
export { codeMatches } from './warehouse-backend-api'

const ON_BACKEND = usesBackend('warehouse')

/**
 * Màn kho làm được gì với nguồn dữ liệu đang dùng (D-20). Kho mẫu: soạn hàng, báo thiếu, đối chiếu ba mức, kiện hỏng, seal, khung 3D vị trí
 * kiện, chuông. Backend: danh sách chuyến chờ xếp, đang xếp và đã xếp xong, bắt đầu xếp theo phương án đã duyệt, mở lại phiên ở mọi thiết
 * bị, soạn hàng và báo thiếu, đối chiếu từng kiện theo thứ tự (quét QR, gõ mã hoặc xác nhận tay), ghi sai lệch vị trí, kiện hỏng, hoàn tất
 * xếp, số seal, khung 3D vị trí kiện khi máy chủ trả lòng thùng. Backend chưa có — màn bản máy chủ không vẽ: thông báo.
 */
export type WarehouseCapabilities = {
  /** Màn `/kho` là bản máy chủ (`ServerWarehouseTripsPage`, `ServerLoadingSession`). */
  readonly backend: boolean
  readonly notifications: boolean
  /** Bước soạn hàng trước khi xếp, kèm báo thiếu từng kiện. */
  readonly staging: boolean
  /** Mức 3 của đối chiếu kiện (xác nhận tay chờ điều phối viên duyệt) ở bước soạn và bước xếp. */
  readonly manualConfirm: boolean
  /** "Kiện hỏng" ở bước xếp. */
  readonly damaged: boolean
  /** Ghi số seal khi đã xếp xong. */
  readonly seal: boolean
}

export const WAREHOUSE_CAPABILITIES: WarehouseCapabilities = {
  backend: ON_BACKEND,
  notifications: !ON_BACKEND,
  staging: true,
  manualConfirm: true,
  damaged: true,
  seal: true,
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

// POST /api/warehouse/tasks/{tripId}/staging/packages/{packageId}/confirm
export function stageServerPackage(tripId: string, packageId: string, method: 'QR' | 'CODE'): Promise<StagingResult> {
  return ON_BACKEND ? backend().stage(tripId, packageId, method) : mockOnly()
}

// POST /api/warehouse/tasks/{tripId}/staging/packages/{packageId}/manual
export function stageServerPackageManually(tripId: string, packageId: string, input: ServerManualInput): Promise<ServerLoadingSession> {
  return ON_BACKEND ? backend().stageManually(tripId, packageId, input) : mockOnly()
}

// POST /api/warehouse/tasks/{tripId}/staging/packages/{packageId}/shortage
export function reportServerShortage(tripId: string, packageId: string): Promise<ServerLoadingSession> {
  return ON_BACKEND ? backend().reportShortage(tripId, packageId) : mockOnly()
}

// POST /api/warehouse/placements/{id}/manual
export function confirmServerPlacementManually(tripId: string, placementId: string, input: ServerManualInput): Promise<ServerLoadingSession> {
  return ON_BACKEND ? backend().confirmManually(tripId, placementId, input) : mockOnly()
}

// POST /api/warehouse/placements/{id}/damaged
export function reportServerDamaged(tripId: string, placementId: string): Promise<DamageResult> {
  return ON_BACKEND ? backend().damaged(tripId, placementId) : mockOnly()
}

// POST /api/warehouse/tasks/{tripId}/seal
export function recordServerSeal(tripId: string, sealNumber: string): Promise<ServerLoadingSession> {
  return ON_BACKEND ? backend().seal(tripId, sealNumber) : mockOnly()
}
