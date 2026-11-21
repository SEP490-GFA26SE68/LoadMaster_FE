import { z } from 'zod'

const decimalVnd = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/)
  .transform(Number)
  .pipe(z.number().finite().nonnegative())

export const dispatcherPayrollRateFormSchema = z.object({
  effectiveFrom: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  baseSalaryVnd: decimalVnd,
  overtimeVndPerHour: decimalVnd,
  overtimeHoursPerDay: decimalVnd.pipe(z.number().max(24)),
  overtimeDaysPerMonth: z
    .string()
    .trim()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(0).max(31)),
  kpiAmountVnd: decimalVnd,
})

export type DispatcherPayrollRateFormInput = z.input<typeof dispatcherPayrollRateFormSchema>
export type DispatcherPayrollRateFormValues = z.output<typeof dispatcherPayrollRateFormSchema>

export function hoursPerDayIssue(raw: string): 'required' | 'range' | 'decimals' {
  const value = raw.trim()
  if (value === '') return 'required'
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > 24) return 'range'
  return 'decimals'
}

export function daysPerMonthIssue(raw: string): 'required' | 'range' | 'decimals' {
  const value = raw.trim()
  if (value === '') return 'required'
  if (!/^\d+$/.test(value)) return 'decimals'
  const number = Number(value)
  if (number < 0 || number > 31) return 'range'
  return 'decimals'
}
