/**
 * Hàm → endpoint backend (FE-0-09); nối backend với fallback mock-db:
 *   listGuestContacts           → GET /api/contact-guests
 *   updateGuestContact          → PATCH /api/contact-guests/{id}
 *   replyGuestContact           → POST /api/contact-guests/{id}/reply
 *   forwardContactToTrialRequest→ POST /api/trial-requests
 *   listContactHandlers         → tài khoản nhân viên hỗ trợ
 *   listContactPlanNames        → GET /api/subscription/plans
 */

import { api, type QueryValue } from '@/lib/api-client'
import { CONTACT_HANDLER_ROLES, getMockDb, type GuestContact, type GuestContactPatch } from '@/lib/mock-db'
import type { Role } from '@/types/user'
import { createTrialRequest } from '@/features/platform/trial-requests-api'

import type { PageResponse, SubscriptionPlanResponse } from '@/features/platform/subscription-plans-api'

export type BackendContactResponse = {
  id: number
  fullName: string
  email: string
  phoneNumber?: string | null
  companyName?: string | null
  companyCode?: string | null
  taxCode?: string | null
  interestedPlanId?: number | null
  interestedPlanName?: string | null
  interestedPlanCode?: string | null
  assignedToId?: number | null
  assignedToName?: string | null
  message?: string | null
  requestType: GuestContact['requestType']
  status: GuestContact['status']
  note?: string | null
  createdAt: string
  resolvedAt?: string | null
}

function mapBackendToGuestContact(res: BackendContactResponse): GuestContact {
  return {
    id: String(res.id),
    fullName: res.fullName,
    email: res.email,
    phoneNumber: res.phoneNumber ?? undefined,
    companyName: res.companyName ?? undefined,
    companyCode: res.companyCode ?? undefined,
    taxCode: res.taxCode ?? undefined,
    interestedPlanId: res.interestedPlanId ? String(res.interestedPlanId) : undefined,
    message: res.message ?? undefined,
    requestType: res.requestType,
    status: res.status,
    assignedToId: res.assignedToId ? String(res.assignedToId) : undefined,
    assignedToName: res.assignedToName ?? undefined,
    note: res.note ?? undefined,
    createdAt: res.createdAt,
    resolvedAt: res.resolvedAt ?? undefined,
  }
}

/** Mọi yêu cầu liên hệ của khách, mới nhất trước. Chỉ vai trò có quyền đọc được. */
// GET /api/contact-guests
export async function listGuestContacts(params?: {
  status?: string
  requestType?: string
  search?: string
  page?: number
  size?: number
}): Promise<GuestContact[]> {
  if (import.meta.env.MODE === 'test') {
    return getMockDb().listGuestContacts()
  }

  try {
    const query: Record<string, QueryValue> = {}
    if (params?.status) query.status = params.status
    if (params?.requestType) query.requestType = params.requestType
    if (params?.search) query.search = params.search
    if (params?.page !== undefined) query.page = params.page
    if (params?.size !== undefined) query.size = params.size

    const res = await api().get<BackendContactResponse[] | { data: BackendContactResponse[] }>('/api/contact-guests', { query })
    const list = Array.isArray(res) ? res : (res.data ?? [])
    return list.map(mapBackendToGuestContact)
  } catch {
    return getMockDb().listGuestContacts()
  }
}

/** Đổi trạng thái, người nhận việc, ghi chú nội bộ. Trường vắng giữ nguyên; `assignedToId: null` bỏ người nhận. */
// PATCH /api/contact-guests/{id}
export async function updateGuestContact(contactId: string, patch: GuestContactPatch): Promise<GuestContact> {
  if (import.meta.env.MODE === 'test') {
    return getMockDb().updateGuestContact(contactId, patch)
  }

  try {
    const numericId = Number(contactId)
    const assignedId = patch.assignedToId ? Number(patch.assignedToId) : null
    const payload: Record<string, unknown> = {}
    if (patch.status !== undefined) payload.status = patch.status
    if (patch.assignedToId !== undefined) {
      if (assignedId !== null && !Number.isNaN(assignedId)) {
        payload.assignedToId = assignedId
      }
    }
    if (patch.note !== undefined) payload.note = patch.note

    if (!Number.isNaN(numericId)) {
      const res = await api().patch<BackendContactResponse>(`/api/contact-guests/${numericId}`, payload)
      return mapBackendToGuestContact(res)
    }
    return getMockDb().updateGuestContact(contactId, patch)
  } catch (error) {
    if (import.meta.env.MODE !== 'test') {
      throw error
    }
    return getMockDb().updateGuestContact(contactId, patch)
  }
}

/** Phản hồi cho khách qua email kèm nội dung tin nhắn. */
// POST /api/contact-guests/{id}/reply
export async function replyGuestContact(
  contactId: string,
  subject: string,
  message: string
): Promise<GuestContact> {
  const numericId = Number(contactId)
  if (!Number.isNaN(numericId) && import.meta.env.MODE !== 'test') {
    const res = await api().post<BackendContactResponse>(`/api/contact-guests/${numericId}/reply`, {
      subject: subject.trim() || undefined,
      message,
    })
    return mapBackendToGuestContact(res)
  }

  // Mock / fallback
  const db = getMockDb()
  const contact = (await db.listGuestContacts()).find((c) => c.id === contactId)
  if (!contact) throw new Error('Contact not found')
  const replyNote = `\n[Đã gửi email phản hồi: ${subject}]: ${message}`
  const updated = await db.updateGuestContact(contactId, {
    status: contact.status === 'NEW' ? 'IN_PROGRESS' : contact.status,
    note: (contact.note ?? '') + replyNote,
  })
  return updated
}

/** Chuyển yêu cầu đăng ký dùng thử sang System Manager duyệt tạo tài khoản. */
// POST /api/trial-requests
export async function forwardContactToTrialRequest(
  contact: GuestContact,
  note?: string
): Promise<void> {
  const numericContactId = Number(contact.id)
  const numericPlanId = contact.interestedPlanId ? Number(contact.interestedPlanId) : undefined

  await createTrialRequest({
    contactId: Number.isNaN(numericContactId) ? undefined : numericContactId,
    fullName: contact.fullName,
    email: contact.email,
    phoneNumber: contact.phoneNumber,
    companyName: contact.companyName,
    companyCode: contact.companyCode,
    taxCode: contact.taxCode,
    interestedPlanId: Number.isNaN(numericPlanId) ? undefined : numericPlanId,
    note: note ?? `Chuyển duyệt tạo tài khoản dùng thử từ yêu cầu liên hệ #${contact.id}`,
  })
}

export type ContactHandler = { readonly id: string; readonly name: string; readonly role: Role }

/** Người nhận việc được: tài khoản đang hoạt động thuộc ba vai trò xử lý liên hệ, theo tên. */
export async function listContactHandlers(): Promise<ContactHandler[]> {
  const roles: readonly Role[] = CONTACT_HANDLER_ROLES
  return (await getMockDb().listUsers())
    .filter((user) => user.status === 'active' && roles.includes(user.role))
    .map((user) => ({ id: user.id, name: user.fullName, role: user.role }))
    .toSorted((a, b) => a.name.localeCompare(b.name, 'vi'))
}

/** Tên/mã gói cước theo ID hoặc mã gói — cột "Gói quan tâm"; gồm cả gói đã ngừng bán (khách có thể đã chọn trước đó). */
// GET /api/subscription/plans
export async function listContactPlanNames(): Promise<ReadonlyMap<string, string>> {
  if (import.meta.env.MODE === 'test') {
    return new Map((await getMockDb().listSubscriptionPlans()).map((plan) => [plan.id, plan.name]))
  }

  try {
    const res = await api().get<PageResponse<SubscriptionPlanResponse> | SubscriptionPlanResponse[] | { data: SubscriptionPlanResponse[] }>('/api/subscription/plans', {
      query: { size: 100 },
    })
    const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []
    const map = new Map<string, string>()
    for (const p of list) {
      const code = p.planCode || p.name
      map.set(String(p.id), code)
      if (p.planCode) map.set(p.planCode, code)
    }
    return map
  } catch {
    const plans = await getMockDb().listSubscriptionPlans()
    return new Map(plans.map((plan) => [plan.id, plan.planCode || plan.name]))
  }
}
