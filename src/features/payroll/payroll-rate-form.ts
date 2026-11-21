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
  kpiTargetKg: z.string(),
  kpiBonusVnd: z.string(),
}).superRefine((values, context) => {
  const targetIssue = kpiTargetIssue(values.kpiTargetKg)
  if (targetIssue) {
    context.addIssue({ code: 'custom', path: ['kpiTargetKg'], message: targetIssue })
  }

  if (values.kpiTargetKg.trim() !== '' && targetIssue === null) {
    const bonusIssue = kpiBonusIssue(values.kpiBonusVnd)
    if (bonusIssue) context.addIssue({ code: 'custom', path: ['kpiBonusVnd'], message: bonusIssue })
  }
}).transform((values) => {
  const usesKpi = values.kpiTargetKg.trim() !== ''
  return {
    ...values,
    kpiTargetKg: usesKpi ? Number(values.kpiTargetKg) : null,
    kpiBonusVnd: usesKpi ? Number(values.kpiBonusVnd) : null,
  }
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

export function kpiTargetIssue(raw: string): 'positive' | 'decimals' | null {
  const value = raw.trim()
  if (value === '') return null

  const match = value.match(/^\d+(?:\.(\d*))?$/)
  if (!match) return 'positive'
  if ((match[1]?.length ?? 0) > 2) return 'decimals'
  return Number(value) > 0 ? null : 'positive'
}

export function kpiBonusIssue(raw: string): 'required' | 'positive' | 'decimals' | null {
  const value = raw.trim()
  if (value === '') return 'required'

  const match = value.match(/^\d+(?:\.(\d*))?$/)
  if (!match) return 'positive'
  if ((match[1]?.length ?? 0) > 2) return 'decimals'
  // Tiền thưởng trả theo đồng (làm tròn HALF_UP như backend): dưới 0,5 đồng là làm tròn về 0, tài xế đạt vẫn không được gì.
  return Number(value) >= 0.5 ? null : 'positive'
}
