import { z } from 'zod'

const decimalVnd = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/)
  .transform(Number)
  .pipe(z.number().finite().nonnegative())

export const payrollRateFormSchema = z.object({
  effectiveFrom: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  baseSalaryVnd: decimalVnd,
  rateVndPerKg: decimalVnd,
  rateVndPerKm: decimalVnd,
})

export type PayrollRateFormInput = z.input<typeof payrollRateFormSchema>
export type PayrollRateFormValues = z.output<typeof payrollRateFormSchema>
