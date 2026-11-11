/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm. Nhóm `contacts` nối backend thì gọi backend, không thì gọi kho mẫu:
 *   listGuestContacts     → GET /api/contact-guests?status&requestType
 *   updateGuestContact    → PATCH /api/contact-guests/{id} (bỏ người nhận việc: `unassign: true`)
 *   claimGuestContact     → PATCH /api/contact-guests/{id} (người đang đăng nhập nhận việc, trạng thái Đang xử lý)
 *   replyGuestContact     → POST /api/contact-guests/{id}/reply (chỉ backend)
 *   forwardContactToTrial → POST /api/trial-requests (chỉ backend)
 *   listContactHandlers   → GET /api/contact-guests/handlers
 *   listContactPlanNames  → GET /api/subscription/plans (nối backend: tên gói đi kèm yêu cầu, không gọi)
 */

import { fetchBackendMe } from '@/features/auth/me-api'
import { roleOfBackend } from '@/features/auth/backend-user'
import { api, ApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import { createTrialRequest, TRIAL_REQUESTS_SOURCE } from '@/features/platform/trial-requests-api'
import { CONTACT_HANDLER_ROLES, getMockDb, type GuestContact, type GuestContactPatch } from '@/lib/mock-db'
import type { Role } from '@/types/user'
import { contactPatchBody, guestContactOf, type ContactHandlerDto, type ContactOfGuestDto } from './contact-dto'

const ON_BACKEND = usesBackend('contacts')

/**
 * Việc màn làm được theo nguồn dữ liệu: gửi email trả lời khách và chuyển đơn dùng thử sang quản lý nền tảng chỉ backend có (kho mẫu không
 * gửi email, không có yêu cầu dùng thử).
 */
export const CONTACTS_SOURCE = {
  canReply: ON_BACKEND,
  // Yêu cầu dùng thử thuộc nhóm `companies`: chỉ chuyển được khi nhóm đó cũng nối backend
  canForwardTrial: ON_BACKEND && TRIAL_REQUESTS_SOURCE.available,
} as const

/** Mọi yêu cầu liên hệ của khách, mới nhất trước. Chỉ quản trị hệ thống và hỗ trợ khách hàng đọc được (kho: `ROLE_NOT_ALLOWED`, backend: 403). */
// GET /api/contact-guests?status&requestType
export async function listGuestContacts(): Promise<GuestContact[]> {
  if (!ON_BACKEND) return getMockDb().listGuestContacts()
  const contacts = await api().get<ContactOfGuestDto[]>('/api/contact-guests')
  return contacts.flatMap((dto) => guestContactOf(dto) ?? [])
}

/** Đổi trạng thái, người nhận việc, ghi chú nội bộ. Trường vắng giữ nguyên; `assignedToId: null` bỏ người nhận. */
// PATCH /api/contact-guests/{id}
export async function updateGuestContact(contactId: string, patch: GuestContactPatch): Promise<GuestContact> {
  if (!ON_BACKEND) return getMockDb().updateGuestContact(contactId, patch)
  const contact = guestContactOf(await api().patch<ContactOfGuestDto>(`/api/contact-guests/${contactId}`, { body: contactPatchBody(patch) }))
  if (contact === null) throw new ApiError('SERVER_ERROR')
  return contact
}

/** Người đang đăng nhập nhận việc: gán cho chính mình và chuyển sang Đang xử lý. */
// PATCH /api/contact-guests/{id}
export async function claimGuestContact(contactId: string): Promise<GuestContact> {
  const me = ON_BACKEND ? (await fetchBackendMe()).id : getMockDb().sessionUser()?.id
  if (me === undefined) throw new ApiError('NOT_SIGNED_IN')
  return updateGuestContact(contactId, { status: 'IN_PROGRESS', assignedToId: me })
}

/** Gửi email trả lời khách (chỉ backend — `CONTACTS_SOURCE.canReply`). Tiêu đề để trống thì máy chủ tự đặt. */
// POST /api/contact-guests/{id}/reply
export async function replyGuestContact(contactId: string, subject: string, message: string): Promise<GuestContact> {
  if (!ON_BACKEND) throw new ApiError('NOT_SUPPORTED')
  const contact = guestContactOf(
    await api().post<ContactOfGuestDto>(`/api/contact-guests/${contactId}/reply`, { body: { subject: subject.trim() || undefined, message } }),
  )
  if (contact === null) throw new ApiError('SERVER_ERROR')
  return contact
}

/** Chuyển yêu cầu đăng ký dùng thử sang quản lý nền tảng duyệt tạo tài khoản (chỉ backend — `CONTACTS_SOURCE.canForwardTrial`). */
// POST /api/trial-requests
export async function forwardContactToTrialRequest(contact: GuestContact, note: string): Promise<void> {
  if (!ON_BACKEND) throw new ApiError('NOT_SUPPORTED')
  const contactId = Number(contact.id)
  const planId = contact.interestedPlanId === undefined ? Number.NaN : Number(contact.interestedPlanId)
  await createTrialRequest({
    ...(Number.isInteger(contactId) ? { contactId } : {}),
    fullName: contact.fullName,
    email: contact.email,
    ...(contact.phoneNumber ? { phoneNumber: contact.phoneNumber } : {}),
    ...(contact.companyName ? { companyName: contact.companyName } : {}),
    ...(contact.companyCode ? { companyCode: contact.companyCode } : {}),
    ...(contact.taxCode ? { taxCode: contact.taxCode } : {}),
    ...(Number.isInteger(planId) ? { interestedPlanId: planId } : {}),
    note,
  })
}

export type ContactHandler = { readonly id: string; readonly name: string; readonly role: Role }

const byName = (a: ContactHandler, b: ContactHandler) => a.name.localeCompare(b.name, 'vi')

function isHandlerRole(role: Role | null): role is Role {
  const roles: readonly Role[] = CONTACT_HANDLER_ROLES
  return role !== null && roles.includes(role)
}

/**
 * Người nhận việc được: tài khoản đang hoạt động thuộc hai vai trò xử lý liên hệ (`CONTACT_HANDLER_ROLES`), theo tên. Backend trả đúng tập
 * đó cho cả quản trị hệ thống lẫn hỗ trợ khách hàng; vai trò app không biết bị bỏ.
 */
// GET /api/contact-guests/handlers
export async function listContactHandlers(): Promise<ContactHandler[]> {
  if (!ON_BACKEND) {
    return (await getMockDb().listUsers())
      .filter((user) => user.status === 'active' && isHandlerRole(user.role))
      .map((user) => ({ id: user.id, name: user.fullName, role: user.role }))
      .toSorted(byName)
  }
  const handlers = await api().get<ContactHandlerDto[]>('/api/contact-guests/handlers')
  return handlers
    .flatMap(({ id, fullName, role }) => {
      const appRole = roleOfBackend(role)
      return isHandlerRole(appRole) ? [{ id: String(id), name: fullName, role: appRole }] : []
    })
    .toSorted(byName)
}

/**
 * Tên gói theo mã — cột "Gói quan tâm"; gồm cả gói đã ngừng bán (khách có thể đã chọn trước đó). Backend trả tên gói kèm từng yêu cầu
 * (`interestedPlanName`), nên không cần danh mục.
 */
// GET /api/subscription/plans
export async function listContactPlanNames(): Promise<ReadonlyMap<string, string>> {
  if (ON_BACKEND) return new Map()
  return new Map((await getMockDb().listSubscriptionPlans()).map((plan) => [plan.id, plan.name]))
}
