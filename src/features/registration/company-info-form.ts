import { z } from 'zod'
import { isPhoneValidForCountry, type PhoneCountryCode } from '@/components/ui/PhoneInput'
import { isApiError } from '@/lib/api-client'
import type { TFunction } from '@/lib/i18n'

/**
 * Bước "Thông tin công ty" dùng chung cho đăng ký trả phí `/dang-ky` và đăng ký dùng thử `/dang-ky-trai-nghiem` (react-hook-form + zod,
 * mục 9). Câu lỗi lấy theo nhánh từ điển của từng trang; số điện thoại kiểm theo mã vùng đang chọn nên nằm chung một nhóm.
 */

export const TAX_CODE_REGEX = /^([0-9]{10}|[0-9]{10}-[0-9]{3}|[0-9]{13})$/
export const COMPANY_CODE_REGEX = /^[A-Za-z0-9_-]{3,50}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Số điện thoại gửi máy chủ: bỏ khoảng trắng, dấu chấm, gạch ngang. */
export const cleanPhone = (value: string) => value.replace(/[\s.-]/g, '')
/** Ô mã số thuế chỉ nhận số và gạch ngang. */
export const taxCodeInput = (value: string) => value.replace(/[^0-9-]/g, '')

type Namespace = 'guestRegistration' | 'trialRegistration'

const filled = (message: string) => z.string().refine((value) => value.trim() !== '', message)
const matches = (regex: RegExp, message: string) => (value: string) => value.trim() === '' || regex.test(value.trim()) || message

function checked(schema: z.ZodString, rule: (value: string) => true | string) {
  return schema.superRefine((value, ctx) => {
    const result = rule(value)
    if (result !== true) ctx.addIssue({ code: 'custom', message: result })
  })
}

function phoneSchema(t: TFunction) {
  return z.object({ country: z.custom<PhoneCountryCode>(), number: z.string() }).superRefine((phone, ctx) => {
    const cleaned = cleanPhone(phone.number)
    const message = cleaned === ''
      ? t('guestRegistration.validation.phoneRequired')
      : isPhoneValidForCountry(cleaned, phone.country)
        ? null
        : phone.country === 'VN' ? t('guestRegistration.validation.phoneInvalidVN') : t('guestRegistration.validation.phoneInvalidCountry')
    if (message !== null) ctx.addIssue({ code: 'custom', message, path: ['number'] })
  })
}

/** Trường chung của hai trang; `ns` chọn câu lỗi. */
export function companyInfoShape(t: TFunction, ns: Namespace) {
  return {
    companyName: filled(t(`${ns}.validation.companyNameRequired`)),
    taxCode: checked(filled(t(`${ns}.validation.taxCodeRequired`)), matches(TAX_CODE_REGEX, t(`${ns}.validation.taxCodeInvalid`))),
    companyAddress: z.string(),
    fullName: filled(t(`${ns}.validation.fullNameRequired`)),
    email: checked(filled(t(`${ns}.validation.emailRequired`)), matches(EMAIL_REGEX, t(`${ns}.validation.emailInvalid`))),
    phone: phoneSchema(t),
  }
}

/** Mã công ty của đăng ký trả phí. */
export function companyCodeSchema(t: TFunction) {
  return checked(filled(t('guestRegistration.validation.companyCodeRequired')), matches(COMPANY_CODE_REGEX, t('guestRegistration.validation.companyCodeInvalid')))
}

export const EMPTY_COMPANY_INFO = {
  companyName: '',
  taxCode: '',
  companyAddress: '',
  fullName: '',
  email: '',
  phone: { country: 'VN' as PhoneCountryCode, number: '' },
}

/** Ô của bước thông tin mà mã lỗi của máy chủ nói tới — chỉ đọc mã, không đọc câu đã dịch. */
export function fieldOfError(err: unknown): 'taxCode' | 'email' | 'phone.number' | null {
  if (!isApiError(err)) return null
  const code = err.code ?? ''
  if (code.includes('TAX_CODE')) return 'taxCode'
  if (code.includes('EMAIL') || code === 'USER_ALREADY_EXISTS') return 'email'
  if (code.includes('PHONE')) return 'phone.number'
  return null
}

/** Mã OTP 6 số qua email — ô chỉ nhận số. */
export const otpSchema = z.object({ otp: z.string().regex(/^[0-9]{6}$/) })
export type OtpValues = z.infer<typeof otpSchema>

/** Bước thông tin của đăng ký dùng thử: trường chung + ghi chú. */
export function trialInfoSchema(t: TFunction) {
  return z.object({ ...companyInfoShape(t, 'trialRegistration'), note: z.string() })
}
export type TrialInfoValues = z.infer<ReturnType<typeof trialInfoSchema>>

/** Bước thông tin của đăng ký trả phí: trường chung + mã công ty. */
export function guestInfoSchema(t: TFunction) {
  return z.object({ ...companyInfoShape(t, 'guestRegistration'), companyCode: companyCodeSchema(t) })
}
export type GuestInfoValues = z.infer<ReturnType<typeof guestInfoSchema>>
