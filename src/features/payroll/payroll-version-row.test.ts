import { expect, test } from 'vitest'

import { lockedPayrollMonth } from './payroll-version-row'

test('outer payroll board follows the locked version, not a draft', () => {
  expect(lockedPayrollMonth([], '2026-12', 'DRAFT')).toBeNull()
  expect(lockedPayrollMonth([], '2026-12', undefined)).toBeNull()
  expect(lockedPayrollMonth([], '2026-12', 'LOCKED')).toBe('2026-12')
  expect(lockedPayrollMonth(
    [
      { effectiveFrom: '2026-11-01', periodStatus: 'LOCKED' },
      { effectiveFrom: '2026-12-01', periodStatus: 'DRAFT' },
    ],
    '2026-12',
    'DRAFT',
  )).toBe('2026-11')
  expect(lockedPayrollMonth(
    [
      { effectiveFrom: '2026-11-01', periodStatus: 'LOCKED' },
      { effectiveFrom: '2026-12-01', periodStatus: 'LOCKED' },
    ],
    '2026-12',
    'LOCKED',
  )).toBe('2026-12')
})
