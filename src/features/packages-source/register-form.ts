import { z } from 'zod'
import { MAX_REGISTER_QUANTITY } from '@/lib/mock-db'
import type { TFunction } from '@/lib/i18n'

/**
 * Form đăng ký một kiện / theo số lượng (LM-104). Message dịch sẵn khi dựng schema vì `SelectField` in thẳng message của lỗi; hộp thoại
 * dựng lại schema khi đổi ngôn ngữ. Nhà sản xuất luôn đăng ký cho công ty mình; vai trò khác (quản trị viên) phải chọn công ty —
 * `needCompany`.
 */
export function registerFormSchema(needCompany: boolean, t: TFunction) {
  const quantityRange = t('sourcing.register.errors.quantityRange', { max: MAX_REGISTER_QUANTITY })
  const companyRequired = t('sourcing.register.errors.companyRequired')
  return z.object({
    ownerCompanyId: needCompany ? z.string().min(1, companyRequired) : z.string(),
    packageTypeId: z.string().min(1, t('sourcing.register.errors.typeRequired')),
    quantity: z.number({ error: quantityRange }).int(quantityRange).min(1, quantityRange).max(MAX_REGISTER_QUANTITY, quantityRange),
    reference: z.string().trim().max(60),
    note: z.string().trim().max(200),
  })
}

export type RegisterFormValues = z.output<ReturnType<typeof registerFormSchema>>

export const EMPTY_REGISTER: RegisterFormValues = { ownerCompanyId: '', packageTypeId: '', quantity: 1, reference: '', note: '' }
