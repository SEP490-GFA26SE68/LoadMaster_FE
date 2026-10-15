/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm:
 *   listGuestContacts     → GET /api/contact-guests?status&requestType
 *   updateGuestContact    → PATCH /api/contact-guests/{id}
 *   listContactHandlers   → chưa có ở BE
 *   listContactPlanNames  → GET /api/subscription/plans
 */

import { CONTACT_HANDLER_ROLES, getMockDb, type GuestContact, type GuestContactPatch } from '@/lib/mock-db'
import type { Role } from '@/types/user'

/** Mọi yêu cầu liên hệ của khách, mới nhất trước. Chỉ ba vai trò nền tảng đọc được (`ROLE_NOT_ALLOWED`). */
// GET /api/contact-guests?status&requestType
export function listGuestContacts(): Promise<GuestContact[]> {
  return getMockDb().listGuestContacts()
}

/** Đổi trạng thái, người nhận việc, ghi chú nội bộ. Trường vắng giữ nguyên; `assignedToId: null` bỏ người nhận. */
// PATCH /api/contact-guests/{id}
export function updateGuestContact(contactId: string, patch: GuestContactPatch): Promise<GuestContact> {
  return getMockDb().updateGuestContact(contactId, patch)
}

export type ContactHandler = { readonly id: string; readonly name: string; readonly role: Role }

/** Người nhận việc được: tài khoản đang hoạt động thuộc ba vai trò xử lý liên hệ, theo tên. */
// chưa có ở BE
export async function listContactHandlers(): Promise<ContactHandler[]> {
  const roles: readonly Role[] = CONTACT_HANDLER_ROLES
  return (await getMockDb().listUsers())
    .filter((user) => user.status === 'active' && roles.includes(user.role))
    .map((user) => ({ id: user.id, name: user.fullName, role: user.role }))
    .toSorted((a, b) => a.name.localeCompare(b.name, 'vi'))
}

/** Tên gói theo mã — cột "Gói quan tâm"; gồm cả gói đã ngừng bán (khách có thể đã chọn trước đó). */
// GET /api/subscription/plans
export async function listContactPlanNames(): Promise<ReadonlyMap<string, string>> {
  return new Map((await getMockDb().listSubscriptionPlans()).map((plan) => [plan.id, plan.name]))
}
