/**
 * Hàm → endpoint backend (FE-0-09, issue BE S7-02, S7-03); nối backend chỉ thay thân hàm.
 *   createPickupRequest   → POST /api/trips/{id}/pickup-requests
 *   validatePickupRequest → GET /api/trips/{id}/pickup-requests/{pid}/validate (kho FE ghi cả kết quả lên yêu cầu)
 *   chưa có ở BE: listPickupRequests, getPickupRequest
 */
import { getMockDb, type PickupRequest, type PickupRequestInput } from '@/lib/mock-db'

/**
 * Lớp gọi API của nhận hàng dọc đường (FE-7-03, D-88). Chưa có backend: yêu cầu nằm trong kho của tab đang mở. Mười luật do kho kiểm
 * ngay khi tạo; `validatePickupRequest` kiểm lại theo trạng thái chuyến lúc này.
 */

/** Một yêu cầu kèm họ tên người gửi, để thẻ yêu cầu của chuyến đọc được. */
export type PickupRow = { readonly request: PickupRequest; readonly createdByName: string | null }

/**
 * Yêu cầu nhận của một chuyến, cũ trước, kèm tên người gửi (cùng phạm vi với nhật ký: `listAuditNames`, không đòi quyền xem người
 * dùng). Người gửi không còn tài khoản, hoặc yêu cầu ghi khi không có phiên: `null`.
 */
// chưa có ở BE
export async function fetchPickupRows(tripId: string): Promise<PickupRow[]> {
  const db = getMockDb()
  const requests = await db.listPickupRequests(tripId)
  if (requests.length === 0) return []
  const names = new Map((await db.listAuditNames()).users.map((user) => [user.id, user.fullName]))
  return requests.map((request) => ({ request, createdByName: request.createdBy === null ? null : (names.get(request.createdBy) ?? null) }))
}

// chưa có ở BE
export function getPickupRequest(tripId: string, pickupId: string): Promise<PickupRequest> {
  return getMockDb().getPickupRequest(tripId, pickupId)
}

/** Điều phối viên hoặc tài xế của chuyến gửi yêu cầu; kho kiểm mười luật ngay: đạt cả mười thì `VALIDATED`, không thì `PENDING`. */
// POST /api/trips/{id}/pickup-requests
export function createPickupRequest(tripId: string, input: PickupRequestInput): Promise<PickupRequest> {
  return getMockDb().createPickupRequest(tripId, input)
}

/** Kiểm lại mười luật theo trạng thái chuyến lúc này. */
// GET /api/trips/{id}/pickup-requests/{pid}/validate
export function validatePickupRequest(tripId: string, pickupId: string): Promise<PickupRequest> {
  return getMockDb().validatePickupRequest(tripId, pickupId)
}
