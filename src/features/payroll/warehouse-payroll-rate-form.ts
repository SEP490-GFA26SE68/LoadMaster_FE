import { z } from 'zod'

import { kpiBonusIssue, kpiTargetIssue } from './payroll-rate-form'

const decimalVnd = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/)
  .transform(Number)
  .pipe(z.number().finite().nonnegative())

/**
 * Mức lương kho của công ty: lương cứng, tiền mỗi kg đã xếp, và KPI tuỳ chọn. Chỉ tiêu để trống là không dùng KPI (máy chủ lưu
 * chỉ tiêu `null`, thưởng 0); có chỉ tiêu thì thưởng bắt buộc và lớn hơn 0 — cùng luật với KPI của tài xế.
 */
export const warehousePayrollRateFormSchema = z.object({
  effectiveFrom: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  baseSalaryVnd: decimalVnd,
  rateVndPerKg: decimalVnd,
  kpiTargetKg: z.string(),
  kpiBonusVnd: z.string(),
}).superRefine((values, context) => {
  const targetIssue = kpiTargetIssue(values.kpiTargetKg)
  if (targetIssue) context.addIssue({ code: 'custom', path: ['kpiTargetKg'], message: targetIssue })
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

export type WarehousePayrollRateFormInput = z.input<typeof warehousePayrollRateFormSchema>
export type WarehousePayrollRateFormValues = z.output<typeof warehousePayrollRateFormSchema>

export const EMPTY_WAREHOUSE_RATE_FORM = { baseSalaryVnd: '', rateVndPerKg: '', kpiTargetKg: '', kpiBonusVnd: '' } as const

/** Giá trị của form từ một phiên bản đã lưu (hoặc vừa lưu): KPI không dùng thì hai ô KPI để trống. */
export function warehouseRateFormValues(
  effectiveFrom: string,
  rate: { readonly baseSalaryVnd: number; readonly rateVndPerKg: number; readonly kpiTargetKg: number | null; readonly kpiBonusVnd: number | null },
): WarehousePayrollRateFormInput {
  return {
    effectiveFrom: effectiveFrom.slice(0, 7),
    baseSalaryVnd: String(rate.baseSalaryVnd),
    rateVndPerKg: String(rate.rateVndPerKg),
    kpiTargetKg: rate.kpiTargetKg == null ? '' : String(rate.kpiTargetKg),
    kpiBonusVnd: rate.kpiTargetKg == null ? '' : String(rate.kpiBonusVnd ?? ''),
  }
}
