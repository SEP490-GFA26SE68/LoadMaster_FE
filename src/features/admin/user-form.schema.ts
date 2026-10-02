import { z } from 'zod'
import type { MessageKey, TFunction } from '@/lib/i18n'
import { rolesInScope, type UserScope } from '@/lib/mock-db'
import { formatPhone, PHONE_PATTERN, phoneDigits } from '@/lib/phone'
import type { Role } from '@/types/user'

/**
 * Schema giữ key từ điển thay vì câu chữ (như form đăng nhập); hộp thoại dịch lúc hiển thị,
 * nên đổi ngôn ngữ khi lỗi đang hiện thì lỗi đổi theo.
 *
 * Không có trạng thái: khoá/mở khoá là thao tác riêng ở menu dòng (LM-092), tài khoản mới luôn đang hoạt động.
 *
 * Form theo phạm vi của người quản trị (FE-0-08, `user-scope.ts`): quản trị hệ thống tạo và sửa tài khoản nền tảng — chỉ ba vai trò
 * nền tảng, không có kho (FE-0-03: kho bỏ qua giá trị của ô đó khi ghi); quản trị công ty tạo và sửa người của công ty mình — chỉ năm
 * vai trò công ty, kho / chi nhánh bắt buộc. Công ty không phải ô nhập: kho gán công ty của người quản trị.
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

export function userFormSchema(scope: UserScope) {
  const roles = rolesInScope(scope) as readonly [Role, ...Role[]]
  return z.object({
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
    // Vai trò ngoài phạm vi không có trong ô chọn; lọt vào (dữ liệu cũ) thì coi như chưa chọn
    role: z.enum(roles, { error: ERRORS.roleRequired }),
    depot: z.string().trim(),
  }).refine((values) => scope === 'platform' || values.depot !== '', { error: ERRORS.depotRequired, path: ['depot'] })
}

/** Dịch message của schema; message không phải key của schema thì bỏ qua. */
export function translateUserFormError(t: TFunction, message: string | undefined): string | undefined {
  const key = Object.values(ERRORS).find((candidate) => candidate === message)
  return key ? t(key) : undefined
}

type UserFormSchema = ReturnType<typeof userFormSchema>
export type UserFormValues = z.infer<UserFormSchema>
/** Giá trị trước khi zod chuẩn hoá số điện thoại — dùng cho defaultValues. */
export type UserFormInput = z.input<UserFormSchema>
