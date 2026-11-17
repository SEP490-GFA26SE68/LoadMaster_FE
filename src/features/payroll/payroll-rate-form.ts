import { z } from 'zod'

const decimalVnd = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/)
  .transform(Number)
  .pipe(z.number().finite().nonnegative())

const percent = decimalVnd.pipe(z.number().max(100))

export const payrollRateFormSchema = z.object({
  effectiveFrom: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  baseSalaryVnd: decimalVnd,
  rateVndPerKg: decimalVnd,
  commissionPercent: percent,
  handlingFeeVndPerKg: decimalVnd,
  handlingDriverPercent: percent,
})

export type PayrollRateFormInput = z.input<typeof payrollRateFormSchema>
export type PayrollRateFormValues = z.output<typeof payrollRateFormSchema>

/** Chính sách cố định của hệ thống: công ty không chỉnh ba khoản này trong form mức lương. */
export const FIXED_PAYROLL_POLICY = {
  commissionPercent: '15',
  handlingFeeVndPerKg: '150',
  handlingDriverPercent: '85',
} as const
