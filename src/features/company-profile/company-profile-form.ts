import { z } from 'zod'
import { COMPANY_ADDRESS_MAX, COMPANY_NAME_MAX, COMPANY_PHONE, COMPANY_PHONE_MAX } from '@/features/platform/company-form'
import { SERVER_COMPANY_LIMITS } from '@/features/platform/server-company-form'
import type { MessageKey, TFunction } from '@/lib/i18n'
import type { CompanyProfile, CompanyProfileSave, CompanyProfileSource } from './company-profile-api'

/**
 * Form Thông tin công ty `/cong-ty`. Chỉ có ô của trường nơi lưu thật sự lưu: máy chủ lưu tên và email thanh toán (`PATCH
 * /api/company/profile` nhận thêm địa chỉ, số điện thoại nhưng bỏ đi, nên không có ô cho hai trường đó); kho mẫu lưu tên, địa chỉ, số điện
 * thoại. Giới hạn độ dài theo nơi lưu. Message của schema là key từ điển, cùng câu với form công ty của quản trị hệ thống.
 */
export type CompanyProfileField = 'name' | 'billingEmail' | 'address' | 'phone'

export const PROFILE_FIELDS: Readonly<Record<CompanyProfileSource, readonly CompanyProfileField[]>> = {
  server: ['name', 'billingEmail'],
  mock: ['name', 'address', 'phone'],
}

export type CompanyProfileInput = Record<CompanyProfileField, string>

const ERRORS = {
  nameRequired: 'companies.form.errors.nameRequired',
  addressRequired: 'companies.form.errors.addressRequired',
  phoneRequired: 'companies.form.errors.phoneRequired',
  phoneInvalid: 'companies.form.errors.phoneInvalid',
  billingEmailRequired: 'companies.server.form.errors.billingEmailRequired',
  billingEmailInvalid: 'companies.server.form.errors.billingEmailInvalid',
  tooLong: 'companies.form.errors.tooLong',
} as const satisfies Record<string, MessageKey>

const MAX_OF: Readonly<Record<CompanyProfileSource, Partial<Record<CompanyProfileField, number>>>> = {
  server: { name: SERVER_COMPANY_LIMITS.name, billingEmail: SERVER_COMPANY_LIMITS.billingEmail },
  mock: { name: COMPANY_NAME_MAX, address: COMPANY_ADDRESS_MAX, phone: COMPANY_PHONE_MAX },
}

const isEmail = (value: string) => z.email().safeParse(value).success

/** Câu khi ô trống, rồi luật riêng của ô — chỉ xét khi ô đã có chữ và không quá dài. */
const RULES: Readonly<Record<CompanyProfileField, { required: MessageKey; check?: (value: string) => MessageKey | null }>> = {
  name: { required: ERRORS.nameRequired },
  address: { required: ERRORS.addressRequired },
  phone: { required: ERRORS.phoneRequired, check: (value) => (COMPANY_PHONE.test(value) ? null : ERRORS.phoneInvalid) },
  billingEmail: { required: ERRORS.billingEmailRequired, check: (value) => (isEmail(value) ? null : ERRORS.billingEmailInvalid) },
}

export function companyProfileSchema(source: CompanyProfileSource) {
  const text = z.string().trim()
  return z.object({ name: text, billingEmail: text, address: text, phone: text }).superRefine((values, ctx) => {
    for (const field of PROFILE_FIELDS[source]) {
      const value = values[field]
      const max = MAX_OF[source][field] ?? Number.POSITIVE_INFINITY
      const message = value === '' ? RULES[field].required : value.length > max ? ERRORS.tooLong : (RULES[field].check?.(value) ?? null)
      if (message !== null) ctx.addIssue({ code: 'custom', path: [field], message })
    }
  })
}

export type CompanyProfileValues = z.output<ReturnType<typeof companyProfileSchema>>

/** Dịch message của schema (key từ điển) cho ô `field`; message lạ thì bỏ qua. */
export function translateCompanyProfileError(t: TFunction, source: CompanyProfileSource, field: CompanyProfileField, message: string | undefined) {
  if (message === undefined) return undefined
  if (message === ERRORS.tooLong) return t(ERRORS.tooLong, { max: MAX_OF[source][field] ?? 0 })
  const key = Object.values(ERRORS).find((candidate) => candidate === message)
  return key === undefined || key === ERRORS.tooLong ? undefined : t(key)
}

/** Giá trị ban đầu của form: ô không thuộc nguồn để trống, không gửi đi. */
export function companyProfileDefaults(profile: CompanyProfile): CompanyProfileInput {
  if (profile.source === 'server') return { name: profile.company.name, billingEmail: profile.company.billingEmail, address: '', phone: '' }
  return { name: profile.company.name, billingEmail: '', address: profile.company.address, phone: profile.company.phone }
}

export function toCompanyProfileSave(source: CompanyProfileSource, values: CompanyProfileValues): CompanyProfileSave {
  return source === 'server'
    ? { source, name: values.name, billingEmail: values.billingEmail }
    : { source, name: values.name, address: values.address, phone: values.phone }
}
