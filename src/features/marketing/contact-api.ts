/**
 * Hàm → endpoint backend (FE-0-09). Trang công khai: gọi được khi chưa đăng nhập.
 *   sendGuestContact → POST /api/contact-guests
 */

import { api } from '@/lib/api-client'
import type { ContactRequestType, ContactStatus, GuestContact, NewGuestContact } from '@/lib/mock-db'

export type CreateContactOfGuestRequest = {
  fullName: string
  email: string
  phoneNumber?: string
  companyName?: string
  companyCode?: string
  taxCode?: string
  interestedPlanId?: number | null
  message?: string
  requestType: ContactRequestType
}

export type ContactOfGuestResponse = {
  id: number
  fullName: string
  email: string
  phoneNumber?: string | null
  companyName?: string | null
  companyCode?: string | null
  taxCode?: string | null
  interestedPlanId?: number | null
  interestedPlanName?: string | null
  assignedToId?: number | null
  assignedToName?: string | null
  message?: string | null
  requestType: ContactRequestType
  status: ContactStatus
  note?: string | null
  createdAt?: string
  resolvedAt?: string | null
}

export function toGuestContact(res: ContactOfGuestResponse): GuestContact {
  return {
    id: String(res.id),
    fullName: res.fullName,
    email: res.email,
    phoneNumber: res.phoneNumber || undefined,
    companyName: res.companyName || undefined,
    companyCode: res.companyCode || undefined,
    taxCode: res.taxCode || undefined,
    interestedPlanId: res.interestedPlanId != null ? String(res.interestedPlanId) : undefined,
    message: res.message || undefined,
    requestType: res.requestType,
    status: res.status,
    assignedToId: res.assignedToId != null ? String(res.assignedToId) : undefined,
    assignedToName: res.assignedToName || undefined,
    note: res.note || undefined,
    createdAt: res.createdAt ? String(res.createdAt) : new Date().toISOString(),
    resolvedAt: res.resolvedAt ? String(res.resolvedAt) : undefined,
  }
}

/** Gửi yêu cầu liên hệ của khách chưa có tài khoản lên backend; trả về bản ghi vừa tạo. */
// POST /api/contact-guests
export async function sendGuestContact(input: NewGuestContact): Promise<GuestContact> {
  if (import.meta.env.MODE === 'test' && !('mock' in (api as unknown as Record<string, unknown>))) {
    const { getMockDb } = await import('@/lib/mock-db')
    return getMockDb().createGuestContact(input)
  }

  const rawPlanId = input.interestedPlanId ? Number(input.interestedPlanId) : null
  const interestedPlanId = Number.isFinite(rawPlanId) && rawPlanId !== null && rawPlanId > 0 ? rawPlanId : null

  const body: CreateContactOfGuestRequest = {
    fullName: input.fullName.trim(),
    email: input.email.trim(),
    phoneNumber: input.phoneNumber?.trim() || undefined,
    companyName: input.companyName?.trim() || undefined,
    companyCode: input.companyCode?.trim() || undefined,
    taxCode: input.taxCode?.trim() || undefined,
    interestedPlanId,
    message: input.message?.trim() || undefined,
    requestType: input.requestType,
  }

  const res = await api().post<ContactOfGuestResponse>('/api/contact-guests', { body })
  return toGuestContact(res)
}
