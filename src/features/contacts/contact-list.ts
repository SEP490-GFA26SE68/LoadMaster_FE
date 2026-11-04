import { CONTACT_TYPE_SLUGS } from '@/lib/contact-slugs'
import { matchesQuery } from '@/lib/list-filter'
import type { ContactStatus, GuestContact } from '@/lib/mock-db'

/**
 * Danh sách của màn Liên hệ của khách: luật thuần, không React. Bộ lọc trên URL là slug tiếng Việt không dấu (D-52): `trang-thai`,
 * `loai` (cùng bảng slug với form công khai, `@/lib/contact-slugs`); `lien-he` là yêu cầu đang mở ở khung bên phải.
 */
export const STATUS_FILTER = 'trang-thai'
export const TYPE_FILTER = 'loai'
export const CONTACT_FILTERS = [STATUS_FILTER, TYPE_FILTER] as const
export type ContactFilter = (typeof CONTACT_FILTERS)[number]
export const SELECTED_PARAM = 'lien-he'

export const CONTACT_STATUS_SLUGS = {
  NEW: 'moi',
  IN_PROGRESS: 'dang-xu-ly',
  RESOLVED: 'da-giai-quyet',
  CLOSED: 'da-dong',
} as const satisfies Record<ContactStatus, string>

/**
 * Một dòng của bảng: yêu cầu kèm tên gói khách quan tâm (vắng khi khách không chọn hoặc gói không còn trong danh mục). Tên backend trả kèm
 * yêu cầu đứng trước tên tra theo danh mục.
 */
export type ContactRow = { readonly contact: GuestContact; readonly planName?: string }

export function contactRows(contacts: readonly GuestContact[], planNames: ReadonlyMap<string, string>): ContactRow[] {
  return contacts.map((contact) => {
    const planName = contact.interestedPlanName ?? (contact.interestedPlanId === undefined ? undefined : planNames.get(contact.interestedPlanId))
    return planName === undefined ? { contact } : { contact, planName }
  })
}

/** Tìm theo tên, email, số điện thoại, công ty, mã (bỏ dấu); lọc theo slug trạng thái và loại — giá trị rỗng là không lọc. */
export function filterContactRows(rows: readonly ContactRow[], query: string, filters: Readonly<Record<ContactFilter, string>>): ContactRow[] {
  const status = filters[STATUS_FILTER]
  const type = filters[TYPE_FILTER]
  return rows.filter(({ contact }) =>
    matchesQuery([contact.fullName, contact.email, contact.phoneNumber, contact.companyName, contact.id], query)
    && (status === '' || CONTACT_STATUS_SLUGS[contact.status] === status)
    && (type === '' || CONTACT_TYPE_SLUGS[contact.requestType] === type))
}

/** Số yêu cầu còn Mới — số đếm trên dải tiêu đề, tính trên mọi yêu cầu (không theo ô tìm). */
export function countNew(contacts: readonly GuestContact[]): number {
  return contacts.filter((contact) => contact.status === 'NEW').length
}
