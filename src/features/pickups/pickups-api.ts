/**
 * Hàm → endpoint backend (FE-0-09, issue BE S7-02, S7-03). Nối backend theo nhóm `trips` (`usesBackend('trips')`: endpoint nằm dưới
 * `/api/trips/{id}`, nhận mã số hoặc mã chuyến); nhóm tắt thì chạy như kho mẫu.
 *   fetchPickupRows       → GET /api/trips/{id}/pickup-requests
 *   getPickupRequest      → GET /api/trips/{id}/pickup-requests/{pid}
 *   createPickupRequest   → POST /api/trips/{id}/pickup-requests
 *   validatePickupRequest → POST /api/trips/{id}/pickup-requests/{pid}/validate
 *   approvePickupRequest  → POST /api/trips/{id}/pickup-requests/{pid}/approve (`overrideReason`)
 *   rejectPickupRequest   → POST /api/trips/{id}/pickup-requests/{pid}/reject (`reason`)
 */
import { api } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import { getMockDb, type PickupApproval, type PickupApproveInput, type PickupRequest, type PickupRequestInput } from '@/lib/mock-db'
import { createBodyOf, pickupPackagesOf, pickupRequestOf, type PickupRequestDto } from './pickups-dto'

/**
 * Lớp gọi API của nhận hàng dọc đường (FE-7-03, D-88). Kho mẫu: yêu cầu nằm trong kho của tab đang mở, mười luật do kho kiểm ngay khi
 * tạo. Máy chủ: mười luật tính ở máy chủ (luật 4–7 và 10 xếp thật kiện nhận vào chỗ trống của thùng), duyệt tạo kiện có mã QR và chèn
 * điểm nhận, điểm giao sau điểm hiện tại.
 */

/** Yêu cầu nhận đọc từ máy chủ (nhóm `trips` nối backend). Màn khác so cờ này với nguồn của mình để biết mã chuyến có cùng nguồn không. */
export const PICKUPS_ON_BACKEND = usesBackend('trips')

/** Một yêu cầu kèm họ tên người gửi, để thẻ yêu cầu của chuyến đọc được. */
export type PickupRow = { readonly request: PickupRequest; readonly createdByName: string | null }

const base = (tripId: string) => `/api/trips/${encodeURIComponent(tripId)}/pickup-requests`
const one = (tripId: string, pickupId: string) => `${base(tripId)}/${encodeURIComponent(pickupId)}`
const rowOf = (dto: PickupRequestDto): PickupRow => ({ request: pickupRequestOf(dto), createdByName: dto.createdByName ?? null })

/**
 * Yêu cầu nhận của một chuyến, cũ trước, kèm tên người gửi (kho mẫu: cùng phạm vi với nhật ký, `listAuditNames`, không đòi quyền xem người
 * dùng). Người gửi không còn tài khoản, hoặc yêu cầu ghi khi không có phiên: `null`.
 */
// GET /api/trips/{id}/pickup-requests
export async function fetchPickupRows(tripId: string): Promise<PickupRow[]> {
  if (PICKUPS_ON_BACKEND) return ((await api().get<readonly PickupRequestDto[] | null>(base(tripId))) ?? []).map(rowOf)
  const db = getMockDb()
  const requests = await db.listPickupRequests(tripId)
  if (requests.length === 0) return []
  const names = new Map((await db.listAuditNames()).users.map((user) => [user.id, user.fullName]))
  return requests.map((request) => ({ request, createdByName: request.createdBy === null ? null : (names.get(request.createdBy) ?? null) }))
}

// GET /api/trips/{id}/pickup-requests/{pid}
export async function getPickupRequest(tripId: string, pickupId: string): Promise<PickupRequest> {
  if (PICKUPS_ON_BACKEND) return pickupRequestOf(await api().get<PickupRequestDto>(one(tripId, pickupId)))
  return getMockDb().getPickupRequest(tripId, pickupId)
}

/** Điều phối viên hoặc tài xế của chuyến gửi yêu cầu; mười luật kiểm ngay: đạt cả mười thì `VALIDATED`, không thì `PENDING`. */
// POST /api/trips/{id}/pickup-requests
export async function createPickupRequest(tripId: string, input: PickupRequestInput): Promise<PickupRequest> {
  if (PICKUPS_ON_BACKEND) return pickupRequestOf(await api().post<PickupRequestDto>(base(tripId), { body: createBodyOf(input) }))
  return getMockDb().createPickupRequest(tripId, input)
}

/** Kiểm lại mười luật theo trạng thái chuyến lúc này. */
// POST /api/trips/{id}/pickup-requests/{pid}/validate
export async function validatePickupRequest(tripId: string, pickupId: string): Promise<PickupRequest> {
  if (PICKUPS_ON_BACKEND) return pickupRequestOf(await api().post<PickupRequestDto>(`${one(tripId, pickupId)}/validate`))
  return getMockDb().validatePickupRequest(tripId, pickupId)
}

/**
 * Điều phối viên duyệt. Mười luật kiểm lại; còn luật không đạt thì cần `overrideReason`. Duyệt xong kiện vào kho kiện kèm mã QR, điểm
 * nhận và điểm giao chèn vào tuyến của chuyến đang vận chuyển.
 */
// POST /api/trips/{id}/pickup-requests/{pid}/approve
export async function approvePickupRequest(tripId: string, pickupId: string, input: PickupApproveInput = {}): Promise<PickupApproval> {
  if (PICKUPS_ON_BACKEND) {
    const body = input.overrideReason === undefined ? {} : { overrideReason: input.overrideReason }
    const dto = await api().post<PickupRequestDto>(`${one(tripId, pickupId)}/approve`, { body })
    return { request: pickupRequestOf(dto), packages: pickupPackagesOf(dto) }
  }
  return getMockDb().approvePickupRequest(tripId, pickupId, input)
}

/** Điều phối viên từ chối kèm lý do: không tạo kiện, không chèn điểm. */
// POST /api/trips/{id}/pickup-requests/{pid}/reject
export async function rejectPickupRequest(tripId: string, pickupId: string, reason: string): Promise<PickupRequest> {
  if (PICKUPS_ON_BACKEND) return pickupRequestOf(await api().post<PickupRequestDto>(`${one(tripId, pickupId)}/reject`, { body: { reason } }))
  return getMockDb().rejectPickupRequest(tripId, pickupId, reason)
}
