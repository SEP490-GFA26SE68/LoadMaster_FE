import { expect, test } from 'vitest'

import { payrollRateFormSchema } from './payroll-rate-form'

const base = {
  effectiveFrom: '2026-12',
  baseSalaryVnd: '15000000',
  rateVndPerKg: '40000',
  commissionPercent: '15',
  handlingFeeVndPerKg: '150',
  handlingDriverPercent: '85',
}

const ok = (patch: Partial<typeof base>) => payrollRateFormSchema.safeParse({ ...base, ...patch }).success

test('percent and money fields accept up to two decimals', () => {
  expect(ok({})).toBe(true)
  expect(ok({ commissionPercent: '15.25', handlingFeeVndPerKg: '150.5', handlingDriverPercent: '84.75' })).toBe(true)
  expect(ok({ commissionPercent: '100', handlingDriverPercent: '0' })).toBe(true)
})

test('percent and money fields reject more than two decimals', () => {
  expect(ok({ commissionPercent: '15.255' })).toBe(false)
  expect(ok({ handlingDriverPercent: '85.001' })).toBe(false)
  expect(ok({ handlingFeeVndPerKg: '150.555' })).toBe(false)
})

test('percent fields reject negative values and values above 100', () => {
  expect(ok({ commissionPercent: '-1' })).toBe(false)
  expect(ok({ commissionPercent: '100.01' })).toBe(false)
  expect(ok({ handlingDriverPercent: '101' })).toBe(false)
  expect(ok({ handlingFeeVndPerKg: '-5' })).toBe(false)
})
