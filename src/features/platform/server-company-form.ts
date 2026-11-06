import { z } from 'zod'
import { isApiError } from '@/lib/api-client'
import type { MessageKey, TFunction } from '@/lib/i18n'
import { formatPhone, PHONE_PATTERN, phoneDigits } from '@/lib/phone'
import type { NewServerCompany, NewServerCompanyAdmin, ServerCompany, ServerCompanyInput } from './companies-server-api'

/**
 * Form công ty khi nối backend. Ba chế độ: `create` (công ty + quản trị đầu tiên), `edit` (thông tin công ty), `admin` (chỉ quản trị, cho
 * công ty chưa có — kể cả công ty vừa tạo mà bước tạo quản trị hỏng). Giới hạn độ dài theo backend; quản trị theo cùng luật với màn Người
 * dùng. Message của schema là key từ điển. Mã công ty, mã số thuế, email trùng được kiểm trước với danh sách đã đọc — tạo công ty và tạo
 * quản trị là hai lần gọi, kiểm trước để email trùng không để lại công ty chưa có quản trị.
 */
export type ServerCompanyFormMode = 'create' | 'edit' | 'admin'

export const SERVER_COMPANY_LIMITS = { code: 50, name: 255, taxCode: 50, billingEmail: 150, adminName: 80 } as const

const ERRORS = {
  codeRequired: 'companies.server.form.errors.codeRequired',
  codeTaken: 'companies.server.form.errors.codeTaken',
  nameRequired: 'companies.form.errors.nameRequired',
  taxCodeRequired: 'companies.server.form.errors.taxCodeRequired',
  taxCodeTaken: 'companies.server.form.errors.taxCodeTaken',
  billingEmailRequired: 'companies.server.form.errors.billingEmailRequired',
  billingEmailInvalid: 'companies.server.form.errors.billingEmailInvalid',
  adminNameRequired: 'companies.form.errors.adminNameRequired',
  adminEmailRequired: 'companies.form.errors.adminEmailRequired',
  adminEmailInvalid: 'companies.form.errors.adminEmailInvalid',
  adminEmailTaken: 'companies.server.form.errors.adminEmailTaken',
  adminPhoneRequired: 'companies.form.errors.adminPhoneRequired',
  adminPhoneInvalid: 'companies.form.errors.adminPhoneInvalid',
  tooLong: 'companies.form.errors.tooLong',
} as const satisfies Record<string, MessageKey>

export type ServerCompanyFormInput = {
  code: string
  name: string
  taxCode: string
  billingEmail: string
  adminName: string
  adminEmail: string
  adminPhone: string
}

export type ServerCompanyField = keyof ServerCompanyFormInput

const MAX_OF: Partial<Record<ServerCompanyField, number>> = {
  code: SERVER_COMPANY_LIMITS.code,
  name: SERVER_COMPANY_LIMITS.name,
  taxCode: SERVER_COMPANY_LIMITS.taxCode,
  billingEmail: SERVER_COMPANY_LIMITS.billingEmail,
  adminName: SERVER_COMPANY_LIMITS.adminName,
}

/** Mã công ty, mã số thuế đã có (so khớp đúng như backend) và email đã có tài khoản (chữ thường). */
export type ServerCompanyTaken = { readonly codes: readonly string[]; readonly taxCodes: readonly string[]; readonly emails: readonly string[] }

const isEmail = (value: string) => z.email().safeParse(value).success

export function serverCompanyFormSchema(mode: ServerCompanyFormMode, taken: ServerCompanyTaken, current?: ServerCompany) {
  const text = z.string().trim()
  return z
    .object({ code: text, name: text, taxCode: text, billingEmail: text, adminName: text, adminEmail: text, adminPhone: text })
    .superRefine((values, ctx) => {
      const issue = (path: ServerCompanyField, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
      const tooLong = (field: ServerCompanyField) => values[field].length > (MAX_OF[field] ?? Number.POSITIVE_INFINITY)
      // Ô trống → câu "nhập …"; quá dài → giới hạn; còn lại mới tới luật riêng của ô (định dạng, trùng)
      const check = (field: ServerCompanyField, required: string, rest?: () => string | null) => {
        let message: string | null = null
        if (values[field] === '') message = required
        else if (tooLong(field)) message = ERRORS.tooLong
        else message = rest?.() ?? null
        if (message !== null) issue(field, message)
      }
      if (mode === 'create') check('code', ERRORS.codeRequired, () => (taken.codes.includes(values.code) ? ERRORS.codeTaken : null))
      if (mode !== 'admin') {
        check('name', ERRORS.nameRequired)
        check('taxCode', ERRORS.taxCodeRequired, () =>
          values.taxCode !== current?.taxCode && taken.taxCodes.includes(values.taxCode) ? ERRORS.taxCodeTaken : null)
        check('billingEmail', ERRORS.billingEmailRequired, () => (isEmail(values.billingEmail) ? null : ERRORS.billingEmailInvalid))
      }
      if (mode !== 'edit') {
        check('adminName', ERRORS.adminNameRequired)
        check('adminEmail', ERRORS.adminEmailRequired, () => {
          if (!isEmail(values.adminEmail)) return ERRORS.adminEmailInvalid
          return taken.emails.includes(values.adminEmail.toLowerCase()) ? ERRORS.adminEmailTaken : null
        })
        check('adminPhone', ERRORS.adminPhoneRequired, () => (PHONE_PATTERN.test(phoneDigits(values.adminPhone)) ? null : ERRORS.adminPhoneInvalid))
      }
    })
}

export type ServerCompanyFormValues = z.output<ReturnType<typeof serverCompanyFormSchema>>

/** Dịch message của schema (key từ điển) cho ô `field`; message lạ thì bỏ qua. */
export function translateServerCompanyFormError(t: TFunction, field: ServerCompanyField, message: string | undefined): string | undefined {
  if (message === undefined) return undefined
  if (message === ERRORS.tooLong) return t(ERRORS.tooLong, { max: MAX_OF[field] ?? 0 })
  const key = Object.values(ERRORS).find((candidate) => candidate === message)
  return key === undefined || key === ERRORS.tooLong ? undefined : t(key)
}

/** Lỗi máy chủ thuộc về một ô (mã trùng, email trùng) thì hiện ở ô đó thay vì ở cuối hộp thoại. */
export function serverErrorField(error: unknown): { field: ServerCompanyField; message: MessageKey } | null {
  if (!isApiError(error)) return null
  if (error.code === 'COMPANY_ALREADY_EXISTS') return { field: 'code', message: ERRORS.codeTaken }
  if (error.code === 'TAX_CODE_ALREADY_EXISTS') return { field: 'taxCode', message: ERRORS.taxCodeTaken }
  if (error.code === 'EMAIL_ALREADY_EXISTS') return { field: 'adminEmail', message: ERRORS.adminEmailTaken }
  return null
}

export function serverCompanyFormDefaults(company?: ServerCompany, admin?: NewServerCompanyAdmin): ServerCompanyFormInput {
  return {
    code: company?.code ?? '',
    name: company?.name ?? '',
    taxCode: company?.taxCode ?? '',
    billingEmail: company?.billingEmail ?? '',
    adminName: admin?.fullName ?? '',
    adminEmail: admin?.email ?? '',
    adminPhone: admin?.phone ?? '',
  }
}

export function toServerCompanyInput(values: ServerCompanyFormValues): ServerCompanyInput {
  return { name: values.name, taxCode: values.taxCode, billingEmail: values.billingEmail }
}

export function toNewServerCompany(values: ServerCompanyFormValues): NewServerCompany {
  return { ...toServerCompanyInput(values), code: values.code }
}

/** Số điện thoại giữ dạng hiển thị ("0901 234 567"); lớp API gửi chữ số. */
export function toServerCompanyAdmin(values: ServerCompanyFormValues): NewServerCompanyAdmin {
  return { fullName: values.adminName, email: values.adminEmail, phone: formatPhone(phoneDigits(values.adminPhone)) }
}
