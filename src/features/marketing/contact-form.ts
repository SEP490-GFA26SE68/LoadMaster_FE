import { z } from 'zod'
import { PUBLIC_HOME } from '@/features/auth/landing'
import { CONTACT_TYPE_SLUGS, contactTypeFromSlug } from '@/lib/contact-slugs'
import type { MessageKey, TFunction } from '@/lib/i18n'
import {
  CONTACT_LIMITS,
  CONTACT_REQUEST_TYPES,
  isContactEmail,
  type ContactRequestType,
  type NewGuestContact,
  type SubscriptionPlan,
} from '@/lib/mock-db'

/**
 * Form liên hệ công khai ở trang giới thiệu (`ContactOfGuest`): luật thuần, không React. Message của schema là key từ điển nên lỗi đổi
 * theo ngôn ngữ; kho kiểm lại cùng giới hạn (`CONTACT_INVALID`). Hai ô không gửi cho kho: ô đồng ý (phải đánh dấu) và ô bẫy `website`
 * chống gửi tự động.
 */

/** Neo của phần liên hệ trên trang giới thiệu (`#lien-he`). */
export const CONTACT_ANCHOR = 'lien-he'

/** Ô "Gói quan tâm" chưa chọn gói: Radix Select không nhận giá trị rỗng. */
export const NO_PLAN = 'none'

const ERRORS = {
  fullNameRequired: 'landing.contact.form.errors.fullNameRequired',
  fullNameTooLong: 'landing.contact.form.errors.fullNameTooLong',
  emailRequired: 'landing.contact.form.errors.emailRequired',
  emailInvalid: 'landing.contact.form.errors.emailInvalid',
  emailTooLong: 'landing.contact.form.errors.emailTooLong',
  phoneTooLong: 'landing.contact.form.errors.phoneTooLong',
  companyTooLong: 'landing.contact.form.errors.companyTooLong',
  messageTooLong: 'landing.contact.form.errors.messageTooLong',
  consentRequired: 'landingContact.errors.consentRequired',
} as const satisfies Record<string, MessageKey>

export const contactFormSchema = z.object({
  fullName: z.string().trim().min(1, ERRORS.fullNameRequired).max(CONTACT_LIMITS.fullName, ERRORS.fullNameTooLong),
  // Cùng luật email với kho (`isContactEmail`): form không nhận gì kho sẽ từ chối
  email: z.string().trim().min(1, ERRORS.emailRequired).max(CONTACT_LIMITS.email, ERRORS.emailTooLong).refine(isContactEmail, ERRORS.emailInvalid),
  phoneNumber: z.string().trim().max(CONTACT_LIMITS.phoneNumber, ERRORS.phoneTooLong),
  companyName: z.string().trim().max(CONTACT_LIMITS.companyName, ERRORS.companyTooLong),
  requestType: z.enum(CONTACT_REQUEST_TYPES),
  planId: z.string(),
  message: z.string().trim().max(CONTACT_LIMITS.message, ERRORS.messageTooLong),
  /** Đồng ý để LoadMaster dùng thông tin này để liên hệ tư vấn: không đánh dấu thì không gửi. */
  consent: z.boolean().refine((value) => value, ERRORS.consentRequired),
  /** Ô bẫy: ẩn với người dùng, chỉ trình gửi tự động điền (`contactGuard`). */
  website: z.string(),
})
export type ContactFormValues = z.infer<typeof contactFormSchema>

/**
 * Ô của form gửi cho kho, theo thứ tự trên form, kèm nhãn và có bắt buộc không. Trang chính sách bảo mật liệt kê đúng danh sách này;
 * `contact-form.test.ts` canh nó khớp schema (đủ ô, đúng ô bắt buộc).
 */
export const CONTACT_FORM_FIELDS = [
  { name: 'fullName', label: 'landing.contact.form.fullName', required: true },
  { name: 'email', label: 'landing.contact.form.email', required: true },
  { name: 'phoneNumber', label: 'landing.contact.form.phone', required: false },
  { name: 'companyName', label: 'landing.contact.form.company', required: false },
  { name: 'requestType', label: 'landing.contact.form.type', required: true },
  { name: 'planId', label: 'landing.contact.form.plan', required: false },
  { name: 'message', label: 'landing.contact.form.message', required: false },
] as const satisfies readonly { name: keyof ContactFormValues; label: MessageKey; required: boolean }[]

/** Thời gian tối thiểu (ms) từ lúc form hiện ra tới lúc gửi: người điền form cần lâu hơn thế, trình gửi tự động thì không. */
export const CONTACT_MIN_FILL_MS = 3000

/** Vì sao một lần gửi bị chặn trước khi tới kho: ô bẫy có chữ, hoặc gửi quá nhanh. Màn không nói lý do, chỉ mời thử lại. */
export type ContactGuard = 'TRAP_FILLED' | 'TOO_FAST'

/** Kiểm chống gửi tự động; `shownAt`, `now` là mili giây (`Date.now()`). `null`: gửi được. */
export function contactGuard({ trap, shownAt, now }: { trap: string; shownAt: number; now: number }): ContactGuard | null {
  if (trap.trim() !== '') return 'TRAP_FILLED'
  return now - shownAt < CONTACT_MIN_FILL_MS ? 'TOO_FAST' : null
}

/**
 * Giá trị đầu của form: loại yêu cầu và gói chọn sẵn từ URL (`?loai=bao-gia&goi=PLAN-002`, nút "Liên hệ tư vấn" của thẻ gói ở Bảng giá).
 * Gói không có trong danh sách hoặc đã ngừng bán thì bỏ; loại lạ thì là "Hỏi thông tin". Ô đồng ý luôn bắt đầu chưa đánh dấu.
 */
export function contactDefaults(search: URLSearchParams, plans: readonly SubscriptionPlan[]): ContactFormValues {
  const planId = search.get('goi')
  return {
    fullName: '',
    email: '',
    phoneNumber: '',
    companyName: '',
    requestType: contactTypeFromSlug(search.get('loai')) ?? 'INQUIRY',
    planId: plans.find((plan) => plan.id === planId && plan.active)?.id ?? NO_PLAN,
    message: '',
    consent: false,
    website: '',
  }
}

/** Yêu cầu gửi cho kho: ô tuỳ chọn để trống thì không gửi; ô đồng ý và ô bẫy không bao giờ gửi. Giá trị đã qua schema nên đã cắt khoảng trắng. */
export function toNewContact(values: ContactFormValues): NewGuestContact {
  return {
    fullName: values.fullName,
    email: values.email,
    requestType: values.requestType,
    ...(values.phoneNumber ? { phoneNumber: values.phoneNumber } : {}),
    ...(values.companyName ? { companyName: values.companyName } : {}),
    ...(values.planId === NO_PLAN ? {} : { interestedPlanId: values.planId }),
    ...(values.message ? { message: values.message } : {}),
  }
}

/** Đường tới form liên hệ, kèm gói và loại yêu cầu chọn sẵn: `/gioi-thieu?goi=PLAN-002&loai=bao-gia#lien-he`. */
export function contactPath(prefill: { planId?: string; type?: ContactRequestType } = {}): string {
  const params = new URLSearchParams()
  if (prefill.planId !== undefined) params.set('goi', prefill.planId)
  if (prefill.type !== undefined) params.set('loai', CONTACT_TYPE_SLUGS[prefill.type])
  const search = params.toString()
  return `${PUBLIC_HOME}${search === '' ? '' : `?${search}`}#${CONTACT_ANCHOR}`
}

/** Dịch message của schema; message không phải key của schema thì bỏ qua. */
export function translateContactError(t: TFunction, message: string | undefined): string | undefined {
  switch (message) {
    case ERRORS.fullNameRequired: return t(ERRORS.fullNameRequired)
    case ERRORS.fullNameTooLong: return t(ERRORS.fullNameTooLong, { max: CONTACT_LIMITS.fullName })
    case ERRORS.emailRequired: return t(ERRORS.emailRequired)
    case ERRORS.emailInvalid: return t(ERRORS.emailInvalid)
    case ERRORS.emailTooLong: return t(ERRORS.emailTooLong, { max: CONTACT_LIMITS.email })
    case ERRORS.phoneTooLong: return t(ERRORS.phoneTooLong, { max: CONTACT_LIMITS.phoneNumber })
    case ERRORS.companyTooLong: return t(ERRORS.companyTooLong, { max: CONTACT_LIMITS.companyName })
    case ERRORS.messageTooLong: return t(ERRORS.messageTooLong, { max: CONTACT_LIMITS.message })
    case ERRORS.consentRequired: return t(ERRORS.consentRequired)
    default: return undefined
  }
}
