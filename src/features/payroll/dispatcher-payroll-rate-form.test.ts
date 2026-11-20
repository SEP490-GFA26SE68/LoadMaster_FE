import { expect, test } from 'vitest'

import { dispatcherPayrollRateFormSchema } from './dispatcher-payroll-rate-form'

const base = {
  effectiveFrom: '2026-12',
  baseSalaryVnd: '10000000',
  overtimeVndPerHour: '50000',
  overtimeHoursPerDay: '2',
}

const ok = (patch: Partial<typeof base>) => dispatcherPayrollRateFormSchema.safeParse({ ...base, ...patch }).success

test('dispatcher rate accepts money and hours with up to two decimals', () => {
  expect(ok({})).toBe(true)
  expect(ok({ overtimeVndPerHour: '50000.50', overtimeHoursPerDay: '2.25' })).toBe(true)
  expect(ok({ overtimeHoursPerDay: '24' })).toBe(true)
  expect(ok({ overtimeHoursPerDay: '0' })).toBe(true)
})

test('dispatcher rate rejects hours above 24 and extra decimals', () => {
  expect(ok({ overtimeHoursPerDay: '24.01' })).toBe(false)
  expect(ok({ overtimeHoursPerDay: '2.255' })).toBe(false)
  expect(ok({ overtimeVndPerHour: '50000.555' })).toBe(false)
  expect(ok({ overtimeHoursPerDay: '-1' })).toBe(false)
})
