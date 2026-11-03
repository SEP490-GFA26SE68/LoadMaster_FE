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
  companyRequired: 'landing.contact.form.errors.companyRequired',
  companyTooLong: 'landing.contact.form.errors.companyTooLong',
  companyCodeTooLong: 'landing.contact.form.errors.companyCodeTooLong',
  taxCodeTooLong: 'landing.contact.form.errors.taxCodeTooLong',
  messageTooLong: 'landing.contact.form.errors.messageTooLong',
} as const satisfies Record<string, MessageKey>

export const GUEST_CONTACT_OPTIONS = ['PRICING', 'DEMO_REQUEST', 'INQUIRY'] as const
export type GuestContactOption = (typeof GUEST_CONTACT_OPTIONS)[number]

export const contactFormSchema = z.object({
  fullName: z.string().trim().min(1, ERRORS.fullNameRequired).max(CONTACT_LIMITS.fullName, ERRORS.fullNameTooLong),
  // Cùng luật email với kho (`isContactEmail`): form không nhận gì kho sẽ từ chối
  email: z.string().trim().min(1, ERRORS.emailRequired).max(CONTACT_LIMITS.email, ERRORS.emailTooLong).refine(isContactEmail, ERRORS.emailInvalid),
  phoneNumber: z.string().trim().max(CONTACT_LIMITS.phoneNumber, ERRORS.phoneTooLong),
  companyName: z.string().trim().max(CONTACT_LIMITS.companyName, ERRORS.companyTooLong),
  companyCode: z.string().trim().max(50, ERRORS.companyCodeTooLong).optional().default(''),
  taxCode: z.string().trim().max(50, ERRORS.taxCodeTooLong).optional().default(''),
  requestType: z.enum(GUEST_CONTACT_OPTIONS),
  planId: z.string(),
  message: z.string().trim().max(CONTACT_LIMITS.message, ERRORS.messageTooLong),
}).superRefine((data, ctx) => {
  if (data.requestType === 'DEMO_REQUEST' && !data.companyName.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: ERRORS.companyRequired,
      path: ['companyName'],
    })
  }
})
export type ContactFormValues = z.infer<typeof contactFormSchema>

/**
 * Giá trị đầu của form: loại yêu cầu và gói chọn sẵn từ URL (`?loai=bao-gia&goi=PLAN-002`, nút "Liên hệ tư vấn" của thẻ gói ở Bảng giá).
 * Gói không có trong danh sách hoặc đã ngừng bán thì bỏ; loại lạ thì mặc định là "Hỗ trợ tư vấn".
 */
export function contactDefaults(search: URLSearchParams, plans: readonly SubscriptionPlan[]): ContactFormValues {
  const planId = search.get('goi')
  const slugType = contactTypeFromSlug(search.get('loai'))
  const requestType = slugType && GUEST_CONTACT_OPTIONS.includes(slugType as GuestContactOption)
    ? (slugType as GuestContactOption)
    : 'PRICING'
  return {
    fullName: '',
    email: '',
    phoneNumber: '',
    companyName: '',
    companyCode: '',
    taxCode: '',
    requestType,
    planId: plans.find((plan) => plan.id === planId && plan.active)?.id ?? NO_PLAN,
    message: '',
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
    ...(values.companyCode ? { companyCode: values.companyCode } : {}),
    ...(values.taxCode ? { taxCode: values.taxCode } : {}),
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
  return `/gioi-thieu${search === '' ? '' : `?${search}`}#${CONTACT_ANCHOR}`
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
    case ERRORS.companyRequired: return t(ERRORS.companyRequired)
    case ERRORS.companyTooLong: return t(ERRORS.companyTooLong, { max: CONTACT_LIMITS.companyName })
    case ERRORS.companyCodeTooLong: return t(ERRORS.companyCodeTooLong, { max: 50 })
    case ERRORS.taxCodeTooLong: return t(ERRORS.taxCodeTooLong, { max: 50 })
    case ERRORS.messageTooLong: return t(ERRORS.messageTooLong, { max: CONTACT_LIMITS.message })
    default: return undefined
  }
}
