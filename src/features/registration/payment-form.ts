import { z } from 'zod'

/** Bước chọn gói và kỳ thanh toán của đăng ký trả phí. */
export const paymentSchema = z.object({ planId: z.string().min(1), billingCycle: z.enum(['MONTHLY', 'YEARLY']) })
export type PaymentValues = z.infer<typeof paymentSchema>

const MOCK_PLAN_ID_MAP: Record<string, number> = { 'PLAN-BASIC': 1, 'PLAN-PRO': 2, 'PLAN-ULTIMATE': 3 }

/** Mã gói gửi máy chủ là số; danh mục của kho mẫu mang mã chữ. */
export function resolveNumericPlanId(planId: string): number {
  const parsed = Number(planId)
  if (!Number.isNaN(parsed) && parsed > 0) return parsed
  return MOCK_PLAN_ID_MAP[planId] ?? 1
}
