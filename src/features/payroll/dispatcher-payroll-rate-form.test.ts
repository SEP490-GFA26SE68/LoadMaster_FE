import { expect, test } from 'vitest'

import { dispatcherPayrollRateFormSchema } from './dispatcher-payroll-rate-form'

const base = {
  effectiveFrom: '2026-12',
  baseSalaryVnd: '10000000',
  overtimeVndPerHour: '50000',
  overtimeHoursPerDay: '2',
  overtimeDaysPerMonth: '4',
  kpiAmountVnd: '500000',
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

test('dispatcher rate accepts overtime days per month from 0 to 31', () => {
  expect(ok({ overtimeDaysPerMonth: '0' })).toBe(true)
  expect(ok({ overtimeDaysPerMonth: '31' })).toBe(true)
  expect(ok({ overtimeDaysPerMonth: '32' })).toBe(false)
  expect(ok({ overtimeDaysPerMonth: '-1' })).toBe(false)
  expect(ok({ overtimeDaysPerMonth: '1.5' })).toBe(false)
})

test('dispatcher rate accepts a non-negative KPI bonus', () => {
  expect(ok({ kpiAmountVnd: '0' })).toBe(true)
  expect(ok({ kpiAmountVnd: '1500000.50' })).toBe(true)
  expect(ok({ kpiAmountVnd: '-1' })).toBe(false)
})
