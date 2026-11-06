/**
 * Hàm → endpoint backend (FE-0-09, issue BE S4b-03); nối backend chỉ thay thân hàm.
 *   getTripSegregation        → GET /api/trips/{id}/segregation
 *   overrideTripSegregation   → chưa có ở BE (BE nhận `override`, `overrideReason` ở POST /api/trips/{id}/packages — lúc đưa kiện vào
 *                               chuyến; ghi lý do cho xung đột đang có thì chưa có endpoint)
 */
import { ApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import { getMockDb, type Trip, type TripSegregation } from '@/lib/mock-db'

const ON_BACKEND = usesBackend('trips')

/** Nhóm `trips` nối backend: backend chưa có việc này, màn đã ẩn nút — lỡ gọi tới thì từ chối, không ghi vào kho mẫu. */
const unsupported = (): Promise<never> => Promise.reject(new ApiError('NOT_SUPPORTED'))

/**
 * Phân tách hàng của chuyến (FE-4b-06, D-74): một chuyến một loại hàng. Luật nằm ở `@/domain/constraints` (`segregation`) và kho; lớp
 * này chỉ đọc kết quả và ghi lý do vượt luật.
 */

/** Loại hàng đang khoá, nhóm theo loại, dòng kiện khác loại, cảnh báo về xe và lý do vượt luật đã ghi. */
// GET /api/trips/{id}/segregation
export function getTripSegregation(tripId: string): Promise<TripSegregation> {
  return getMockDb().getTripSegregation(tripId)
}

/** Ghi (hoặc sửa) lý do cho chở chung kiện khác loại đang có trong chuyến. */
// chưa có ở BE
export function overrideTripSegregation(tripId: string, reason: string): Promise<Trip> {
  if (ON_BACKEND) return unsupported()
  return getMockDb().overrideTripSegregation(tripId, reason)
}
