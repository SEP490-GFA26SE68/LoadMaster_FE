import { z } from 'zod'
import type { MessageKey, TFunction } from '@/lib/i18n'
import { formatPhone, PHONE_PATTERN, phoneDigits } from '@/lib/phone'
import { isPlatformRole, ROLES } from '@/types/user'

/**
 * Schema giữ key từ điển thay vì câu chữ (như form đăng nhập); hộp thoại dịch lúc hiển thị,
 * nên đổi ngôn ngữ khi lỗi đang hiện thì lỗi đổi theo.
 *
 * Không có trạng thái: khoá/mở khoá là thao tác riêng ở menu dòng (LM-092), tài khoản mới luôn đang hoạt động.
 * Kho / chi nhánh bắt buộc với vai trò của công ty; vai trò nền tảng không thuộc kho nào (FE-0-03) nên ô đó bị khoá, không bắt buộc,
 * và kho bỏ qua giá trị của nó khi ghi.
 */
const ERRORS = {
  fullNameRequired: 'admin.users.errors.fullNameRequired',
  fullNameTooLong: 'admin.users.errors.fullNameTooLong',
  emailRequired: 'admin.users.errors.emailRequired',
  emailInvalid: 'admin.users.errors.emailInvalid',
  phoneRequired: 'admin.users.errors.phoneRequired',
  phoneInvalid: 'admin.users.errors.phoneInvalid',
  roleRequired: 'admin.users.errors.roleRequired',
  depotRequired: 'admin.users.errors.depotRequired',
} as const satisfies Record<string, MessageKey>

export const userFormSchema = z.object({
  fullName: z.string().trim().min(1, ERRORS.fullNameRequired).max(80, ERRORS.fullNameTooLong),
  email: z.string().trim().min(1, ERRORS.emailRequired).email(ERRORS.emailInvalid),
  phone: z
    .string()
    .trim()
    .min(1, ERRORS.phoneRequired)
    .transform(phoneDigits)
    .refine((value) => PHONE_PATTERN.test(value), ERRORS.phoneInvalid)
    // Lưu theo dạng hiển thị của kho ("0901 234 567"), để mở form rồi lưu không đổi gì thì kho không thấy thay đổi
    .transform(formatPhone),
  role: z.enum(ROLES, { error: ERRORS.roleRequired }),
  depot: z.string().trim(),
}).refine((values) => isPlatformRole(values.role) || values.depot !== '', { error: ERRORS.depotRequired, path: ['depot'] })

/** Dịch message của schema; message không phải key của schema thì bỏ qua. */
export function translateUserFormError(t: TFunction, message: string | undefined): string | undefined {
  const key = Object.values(ERRORS).find((candidate) => candidate === message)
  return key ? t(key) : undefined
}

export type UserFormValues = z.infer<typeof userFormSchema>
/** Giá trị trước khi zod chuẩn hoá số điện thoại — dùng cho defaultValues. */
export type UserFormInput = z.input<typeof userFormSchema>
