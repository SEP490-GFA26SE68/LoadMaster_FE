import { z } from 'zod'
import { coordinateText, EMPTY_COORDINATES, parseCoordinates } from '@/components/map'
import type { MessageKey, TFunction } from '@/lib/i18n'
import type { Company, CompanyInfo, NewCompany } from '@/lib/mock-db'
import { formatPhone, PHONE_PATTERN, phoneDigits } from '@/lib/phone'

/**
 * Form công ty (FE-8-06). Message của schema là key từ điển nên lỗi đổi theo ngôn ngữ. Form tạo có thêm ba ô của Quản trị công ty đầu tiên;
 * form sửa chỉ có thông tin công ty và kho xuất phát. Kho kiểm lại mọi trường (`COMPANY_INVALID`), schema chỉ để báo lỗi tại ô.
 */
export const COMPANY_NAME_MAX = 120
export const COMPANY_ADDRESS_MAX = 200

const ERRORS = {
  nameRequired: 'companies.form.errors.nameRequired',
  addressRequired: 'companies.form.errors.addressRequired',
  phoneRequired: 'companies.form.errors.phoneRequired',
  phoneInvalid: 'companies.form.errors.phoneInvalid',
  depotNameRequired: 'companies.form.errors.depotNameRequired',
  depotCoordinatesRequired: 'companies.form.errors.depotCoordinatesRequired',
  depotCoordinatesInvalid: 'companies.form.errors.depotCoordinatesInvalid',
  adminNameRequired: 'companies.form.errors.adminNameRequired',
  adminEmailRequired: 'companies.form.errors.adminEmailRequired',
  adminEmailInvalid: 'companies.form.errors.adminEmailInvalid',
  adminPhoneRequired: 'companies.form.errors.adminPhoneRequired',
  adminPhoneInvalid: 'companies.form.errors.adminPhoneInvalid',
  tooLong: 'companies.form.errors.tooLong',
} as const satisfies Record<string, MessageKey>

/** Độ dài tối đa của từng ô chữ (kho kiểm cùng giới hạn). */
const MAX_OF: Partial<Record<string, number>> = {
  name: COMPANY_NAME_MAX, address: COMPANY_ADDRESS_MAX, phone: 20, depotName: COMPANY_NAME_MAX, depotAddress: COMPANY_ADDRESS_MAX, adminName: 80,
}

/** Dịch message của schema (key từ điển) cho ô `field`; message không phải key của schema thì bỏ qua. */
export function translateCompanyFormError(t: TFunction, field: string, message: string | undefined): string | undefined {
  if (message === undefined) return undefined
  if (message === ERRORS.tooLong) return t(ERRORS.tooLong, { max: MAX_OF[field] ?? 0 })
  const key = Object.values(ERRORS).find((candidate) => candidate === message)
  return key === undefined || key === ERRORS.tooLong ? undefined : t(key)
}

/** Số điện thoại công ty có thể là máy bàn ("0251 383 6120") hay có mã vùng "+84": chữ số, dấu cách và `+ - . ( )`. */
const COMPANY_PHONE = /^[0-9+().\s-]+$/

export function companyFormSchema(withAdmin: boolean) {
  return z
    .object({
      name: z.string().trim().min(1, ERRORS.nameRequired).max(COMPANY_NAME_MAX, ERRORS.tooLong),
      address: z.string().trim().min(1, ERRORS.addressRequired).max(COMPANY_ADDRESS_MAX, ERRORS.tooLong),
      phone: z.string().trim().min(1, ERRORS.phoneRequired).max(20, ERRORS.tooLong).regex(COMPANY_PHONE, ERRORS.phoneInvalid),
      depotName: z.string().trim().min(1, ERRORS.depotNameRequired).max(COMPANY_NAME_MAX, ERRORS.tooLong),
      depotAddress: z.string().trim().max(COMPANY_ADDRESS_MAX, ERRORS.tooLong),
      coordinates: z.object({ lat: z.string(), lng: z.string() }),
      adminName: z.string().trim(),
      adminEmail: z.string().trim(),
      adminPhone: z.string().trim(),
    })
    .superRefine((values, ctx) => {
      const point = parseCoordinates(values.coordinates.lat, values.coordinates.lng)
      // Lỗi của từng ô vĩ độ / kinh độ do ô chọn toạ độ tự hiện; lỗi ở đây là của cả nhóm
      if (point.kind !== 'ok') {
        ctx.addIssue({ code: 'custom', path: ['coordinates'], message: point.kind === 'empty' ? ERRORS.depotCoordinatesRequired : ERRORS.depotCoordinatesInvalid })
      }
      if (!withAdmin) return
      const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
      if (values.adminName === '') issue('adminName', ERRORS.adminNameRequired)
      else if (values.adminName.length > 80) issue('adminName', ERRORS.tooLong)
      if (values.adminEmail === '') issue('adminEmail', ERRORS.adminEmailRequired)
      else if (!z.email().safeParse(values.adminEmail).success) issue('adminEmail', ERRORS.adminEmailInvalid)
      if (values.adminPhone === '') issue('adminPhone', ERRORS.adminPhoneRequired)
      else if (!PHONE_PATTERN.test(phoneDigits(values.adminPhone))) issue('adminPhone', ERRORS.adminPhoneInvalid)
    })
}

export type CompanyFormInput = z.input<ReturnType<typeof companyFormSchema>>
export type CompanyFormValues = z.output<ReturnType<typeof companyFormSchema>>

/** Giá trị ban đầu: form tạo trống; form sửa nhận công ty hiện có (ô quản trị bỏ trống, không dùng). */
export function companyFormDefaults(company?: Company): CompanyFormInput {
  return {
    name: company?.name ?? '',
    address: company?.address ?? '',
    phone: company?.phone ?? '',
    depotName: company?.depot.name ?? '',
    depotAddress: company?.depot.address ?? '',
    coordinates: company ? coordinateText(company.depot.lat, company.depot.lng) : EMPTY_COORDINATES,
    adminName: '',
    adminEmail: '',
    adminPhone: '',
  }
}

/** Thông tin công ty và kho ghi vào kho. Gọi sau khi schema đã qua: toạ độ chắc chắn đọc được. */
export function toCompanyInfo(values: CompanyFormValues): CompanyInfo {
  const point = parseCoordinates(values.coordinates.lat, values.coordinates.lng)
  if (point.kind !== 'ok') throw new Error('Kho xuất phát chưa có toạ độ hợp lệ')
  return {
    name: values.name,
    address: values.address,
    phone: values.phone,
    depot: { name: values.depotName, address: values.depotAddress, lat: point.lat, lng: point.lng },
  }
}

/** Công ty mới: số điện thoại của quản trị lưu theo dạng hiển thị của kho ("0901 234 567"). */
export function toNewCompany(values: CompanyFormValues): NewCompany {
  return { ...toCompanyInfo(values), admin: { fullName: values.adminName, email: values.adminEmail, phone: formatPhone(phoneDigits(values.adminPhone)) } }
}
