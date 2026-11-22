import { expect, test } from 'vitest'

import { payrollRateFormSchema } from './payroll-rate-form'

const base = {
  effectiveFrom: '2026-12',
  baseSalaryVnd: '15000000',
  rateVndPerKg: '40000',
  commissionPercent: '15',
  handlingFeeVndPerKg: '150',
  handlingDriverPercent: '85',
  kpiTargetKg: '',
  kpiBonusVnd: '',
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

test('payroll rates without KPI normalize both optional fields to null', () => {
  const result = payrollRateFormSchema.safeParse(base)

  expect(result.success).toBe(true)
  if (result.success) {
    expect(result.data).toMatchObject({ kpiTargetKg: null, kpiBonusVnd: null })
  }
})

test('KPI target accepts positive kilograms with up to two decimals and a positive bonus', () => {
  const result = payrollRateFormSchema.safeParse({ ...base, kpiTargetKg: '1234.12', kpiBonusVnd: '2500000.25' })

  expect(result.success).toBe(true)
  if (result.success) {
    expect(result.data).toMatchObject({ kpiTargetKg: 1234.12, kpiBonusVnd: 2500000.25 })
  }
})

test.each([
  ['zero KPI target', { kpiTargetKg: '0' }],
  ['negative KPI target', { kpiTargetKg: '-1' }],
  ['KPI target over two decimals', { kpiTargetKg: '1.234' }],
  ['missing KPI bonus', { kpiTargetKg: '1', kpiBonusVnd: '' }],
  ['zero KPI bonus', { kpiTargetKg: '1', kpiBonusVnd: '0' }],
  ['negative KPI bonus', { kpiTargetKg: '1', kpiBonusVnd: '-1' }],
  ['KPI bonus over two decimals', { kpiTargetKg: '1', kpiBonusVnd: '1.234' }],
  ['KPI bonus that rounds down to zero dong', { kpiTargetKg: '1', kpiBonusVnd: '0.49' }],
] as const)('rejects %s', (_case, patch) => {
  expect(payrollRateFormSchema.safeParse({ ...base, ...patch }).success).toBe(false)
})
