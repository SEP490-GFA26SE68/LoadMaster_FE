import { z } from 'zod'
import type { Role } from '@/types/user'

/**
 * Yêu cầu liên hệ của khách chưa có tài khoản (entity `ContactOfGuest` của backend): khách gửi từ form công khai ở trang giới thiệu, ba
 * vai trò nền tảng xử lý ở `/lien-he-khach`. Kiểu và hằng số thuần — kho ghi ở `db-contacts.ts`, seed ở `seed-contacts.ts`.
 */

export const CONTACT_REQUEST_TYPES = ['INQUIRY', 'DEMO_REQUEST', 'PRICING', 'CONTRACT', 'OTHER'] as const
export type ContactRequestType = (typeof CONTACT_REQUEST_TYPES)[number]

export const CONTACT_STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const
export type ContactStatus = (typeof CONTACT_STATUSES)[number]

/** Vai trò xử lý yêu cầu liên hệ, cũng là vai trò được nhận việc (`assignedToId`). */
export const CONTACT_HANDLER_ROLES = ['systemSupporter', 'systemManager', 'systemAdmin'] as const satisfies readonly Role[]

/** Giới hạn độ dài theo cột của backend; kho kiểm (`CONTACT_INVALID`). Nội dung là `TEXT` ở backend, app giữ 2.000 ký tự. */
export const CONTACT_LIMITS = {
  fullName: 150,
  email: 150,
  phoneNumber: 30,
  companyName: 200,
  message: 2000,
  note: 2000,
} as const

/** Trường kho báo sai (`CONTACT_INVALID { field }`): các trường khách gửi, gói quan tâm, và ba trường người xử lý sửa. Nhãn ở `contacts.fields`. */
export const CONTACT_FIELDS = [
  'fullName', 'email', 'phoneNumber', 'companyName', 'requestType', 'interestedPlanId', 'message', 'status', 'assignedToId', 'note',
] as const
export type ContactField = (typeof CONTACT_FIELDS)[number]

const EMAIL = z.email()

/**
 * Email của khách — một luật cho form công khai và kho: định dạng email của zod. Ký tự của truy vấn (`?`, `&`, `=`, `%`) không qua
 * được, nên email không chèn được người nhận hay tiêu đề vào liên kết `mailto:` của người xử lý.
 */
export function isContactEmail(value: string): boolean {
  return EMAIL.safeParse(value).success
}

export type GuestContact = {
  /** `LH-NNN`. */
  id: string
  fullName: string
  email: string
  phoneNumber?: string
  companyName?: string
  /** Gói khách quan tâm (`PLAN-NNN`), vắng khi khách không chọn. */
  interestedPlanId?: string
  /** Tên gói backend trả kèm yêu cầu (`interestedPlanName`); kho mẫu không ghi — màn tra tên theo danh mục gói. */
  interestedPlanName?: string
  message?: string
  requestType: ContactRequestType
  status: ContactStatus
  assignedToId?: string
  /** Tên người nhận việc chụp lúc giao, như backend trả `assignedToName`. */
  assignedToName?: string
  /** Ghi chú nội bộ của người xử lý, khách không thấy. */
  note?: string
  /** ISO 8601 */
  createdAt: string
  /** Lần đầu yêu cầu thành Đã giải quyết hoặc Đã đóng; giữ nguyên khi mở lại. */
  resolvedAt?: string
}

export type NewGuestContact = Pick<GuestContact, 'fullName' | 'email' | 'requestType'> &
  Partial<Pick<GuestContact, 'phoneNumber' | 'companyName' | 'interestedPlanId' | 'message'>>

/** `PATCH /api/contact-guests/{id}`: trường vắng giữ nguyên; `assignedToId: null` bỏ người nhận, `note: ''` xoá ghi chú. */
export type GuestContactPatch = {
  status?: ContactStatus
  assignedToId?: string | null
  note?: string
}
