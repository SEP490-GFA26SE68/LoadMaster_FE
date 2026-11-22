import { expect, test } from 'vitest'

import { PAYROLL_VERSION_PAGE_SIZE, pagedPayrollItems } from './payroll-dialog-pager'

test('phiên bản mức lương chia 5 dòng mỗi trang', () => {
  const items = [1, 2, 3, 4, 5, 6]
  expect(pagedPayrollItems(items, 0, PAYROLL_VERSION_PAGE_SIZE).items).toEqual([1, 2, 3, 4, 5])
  expect(pagedPayrollItems(items, 1, PAYROLL_VERSION_PAGE_SIZE).items).toEqual([6])
  expect(pagedPayrollItems(items, 9, PAYROLL_VERSION_PAGE_SIZE).pageIndex).toBe(1)
})
