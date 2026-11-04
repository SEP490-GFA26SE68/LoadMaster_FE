/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm. Nhóm `contacts` nối backend thì gọi backend, không thì gọi kho mẫu:
 *   listGuestContacts     → GET /api/contact-guests?status&requestType
 *   updateGuestContact    → PATCH /api/contact-guests/{id} (bỏ người nhận việc: chưa có ở BE)
 *   listContactHandlers   → GET /api/users/me + GET /api/users (danh sách người nhận việc: chưa có ở BE)
 *   listContactPlanNames  → GET /api/subscription/plans (nối backend: tên gói đi kèm yêu cầu, không gọi)
 */

import { fetchBackendMe } from '@/features/auth/me-api'
import { roleOfBackend } from '@/features/auth/backend-user'
import { api, ApiError } from '@/lib/api-client'
import { fetchAllPages } from '@/lib/api-page'
import { usesBackend } from '@/lib/backend-config'
import { CONTACT_HANDLER_ROLES, getMockDb, type GuestContact, type GuestContactPatch } from '@/lib/mock-db'
import type { Role } from '@/types/user'
import { contactPatchBody, guestContactOf, type ContactOfGuestDto } from './contact-dto'

const ON_BACKEND = usesBackend('contacts')

/** Việc màn làm được theo nguồn dữ liệu: backend chưa bỏ được người nhận việc (`PATCH` bỏ qua `assignedToId: null`). */
export const CONTACTS_SOURCE = { canUnassign: !ON_BACKEND } as const

/** Mọi yêu cầu liên hệ của khách, mới nhất trước. Chỉ ba vai trò nền tảng đọc được (kho: `ROLE_NOT_ALLOWED`, backend: 403). */
// GET /api/contact-guests?status&requestType
export async function listGuestContacts(): Promise<GuestContact[]> {
  if (!ON_BACKEND) return getMockDb().listGuestContacts()
  const contacts = await api().get<ContactOfGuestDto[]>('/api/contact-guests')
  return contacts.flatMap((dto) => guestContactOf(dto) ?? [])
}

/** Đổi trạng thái, người nhận việc, ghi chú nội bộ. Trường vắng giữ nguyên; `assignedToId: null` bỏ người nhận (chỉ kho mẫu). */
// PATCH /api/contact-guests/{id}
export async function updateGuestContact(contactId: string, patch: GuestContactPatch): Promise<GuestContact> {
  if (!ON_BACKEND) return getMockDb().updateGuestContact(contactId, patch)
  const contact = guestContactOf(await api().patch<ContactOfGuestDto>(`/api/contact-guests/${contactId}`, { body: contactPatchBody(patch) }))
  if (contact === null) throw new ApiError('SERVER_ERROR')
  return contact
}

export type ContactHandler = { readonly id: string; readonly name: string; readonly role: Role }

type BackendUserRow = { readonly id: number; readonly fullName: string; readonly userRoleType: string; readonly status: string }

const byName = (a: ContactHandler, b: ContactHandler) => a.name.localeCompare(b.name, 'vi')

function isHandlerRole(role: Role | null): role is Role {
  const roles: readonly Role[] = CONTACT_HANDLER_ROLES
  return role !== null && roles.includes(role)
}

/**
 * Người nhận việc được: tài khoản đang hoạt động thuộc ba vai trò xử lý liên hệ, theo tên. Backend: Hỗ trợ khách hàng không có quyền đọc
 * danh sách người dùng (`USERS_READ`), nên danh sách của họ chỉ có chính mình; quản trị hệ thống và quản lý nền tảng đọc được cả ba vai trò.
 */
// chưa có ở BE: GET /api/users/me + GET /api/users
export async function listContactHandlers(): Promise<ContactHandler[]> {
  if (!ON_BACKEND) {
    return (await getMockDb().listUsers())
      .filter((user) => user.status === 'active' && isHandlerRole(user.role))
      .map((user) => ({ id: user.id, name: user.fullName, role: user.role }))
      .toSorted(byName)
  }
  const me = await fetchBackendMe()
  const readsUsers = me.role === 'systemAdmin' || me.role === 'systemManager'
  const users = readsUsers ? await fetchAllPages<BackendUserRow>('/api/users', { size: 200 }) : []
  const handlers = new Map<string, ContactHandler>()
  if (isHandlerRole(me.role)) handlers.set(me.id, { id: me.id, name: me.fullName, role: me.role })
  for (const user of users) {
    const role = roleOfBackend(user.userRoleType)
    if (user.status === 'ACTIVE' && isHandlerRole(role)) handlers.set(String(user.id), { id: String(user.id), name: user.fullName, role })
  }
  return [...handlers.values()].toSorted(byName)
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
