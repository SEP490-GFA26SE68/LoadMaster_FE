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
 * theo ngôn ngữ; kho kiểm lại cùng giới hạn (`CONTACT_INVALID`).
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
  consentRequired: 'landing.contact.form.errors.consentRequired',
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
  // Đồng ý với chính sách bảo mật: chỉ mở được nút gửi, không gửi đi (`toNewContact` bỏ qua)
  consent: z.boolean().refine((value) => value, ERRORS.consentRequired),
})
export type ContactFormValues = z.infer<typeof contactFormSchema>

/**
 * Giá trị đầu của form: loại yêu cầu và gói chọn sẵn từ URL (`?loai=bao-gia&goi=PLAN-002`, nút "Liên hệ tư vấn" của thẻ gói ở Bảng giá).
 * Gói không có trong danh sách hoặc đã ngừng bán thì bỏ; loại lạ thì là "Hỏi thông tin".
 */
export function contactDefaults(search: URLSearchParams, plans: readonly SubscriptionPlan[], message = ''): ContactFormValues {
  const planId = search.get('goi')
  return {
    fullName: '',
    email: '',
    phoneNumber: '',
    companyName: '',
    requestType: contactTypeFromSlug(search.get('loai')) ?? 'INQUIRY',
    planId: plans.find((plan) => plan.id === planId && plan.active)?.id ?? NO_PLAN,
    message,
    consent: false,
  }
}

/** Yêu cầu gửi cho kho: ô tuỳ chọn để trống thì không gửi. Giá trị đã qua schema nên đã cắt khoảng trắng. */
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

/**
 * Lần gửi sớm hơn chừng này (ms) sau lúc form hiện ra là của chương trình tự động: người thật cần vài giây để điền họ tên, email và đánh
 * dấu ô đồng ý. Tính từ lúc form hiện, không từ lần gõ đầu: trình duyệt tự điền họ tên, email cho người thật thì không có lần gõ nào.
 */
export const MIN_FILL_MS = 3_000

/**
 * Lần gửi trông như của chương trình tự động: ô bẫy (ô ẩn người thật không thấy, không tới được bằng phím Tab) có chữ, hoặc form gửi sớm
 * hơn `MIN_FILL_MS`. Khi đúng, form không gửi gì — không gọi kho hay máy chủ, không báo thành công giả.
 */
export function looksAutomated({ trap, elapsedMs }: { trap: string; elapsedMs: number }): boolean {
  return trap.trim() !== '' || elapsedMs < MIN_FILL_MS
}
