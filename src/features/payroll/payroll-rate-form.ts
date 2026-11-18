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

/** Phân loại lỗi của ô phần trăm để báo đúng điều người dùng cần sửa. */
export function percentIssue(raw: string): 'required' | 'range' | 'decimals' {
  const value = raw.trim()
  if (value === '') return 'required'
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > 100) return 'range'
  return 'decimals'
}
