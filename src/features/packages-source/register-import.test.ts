import { expect, test } from 'vitest'
import { parseCsv } from '@/features/trips/csv'
import type { PackageType } from '@/lib/mock-db'
import { findType, parseRegisterTable, registerTemplateCsv, toRegisterRows } from './register-import'

const TYPES: PackageType[] = [
  {
    id: 'PT-001', name: 'Thùng nước suối 24 chai', lengthCm: 50, widthCm: 35, heightCm: 25, weightKg: 13, fragilityLevel: 'NONE',
    allowedOrientations: ['LWH', 'WLH'], keepUpright: true, stackable: true, maxStackCount: 5, maxTopLoadKg: 60, createdAt: '2026-08-05T02:00:00.000Z',
  },
  {
    id: 'PT-002', name: 'Thùng mì ăn liền 30 gói', lengthCm: 55, widthCm: 40, heightCm: 30, weightKg: 3.5, fragilityLevel: 'LOW',
    allowedOrientations: ['LWH', 'WLH'], keepUpright: true, stackable: true, maxStackCount: 5, maxTopLoadKg: 20, createdAt: '2026-08-05T02:00:00.000Z',
  },
]

test('a type is found by its code in any case, or by its exact name without accents', () => {
  expect(findType(TYPES, ' pt-002 ')?.id).toBe('PT-002')
  expect(findType(TYPES, 'thung nuoc suoi 24 chai')?.id).toBe('PT-001')
  expect(findType(TYPES, 'Thùng nước')).toBeUndefined()
})

test('rows after the header are read by column position, blank rows are skipped and lines match the spreadsheet', () => {
  const rows = parseRegisterTable(parseCsv('Mã loại kiện,Số lượng,Mã lô / SKU,Ghi chú\r\nPT-001,10,MP-NS24,\r\n,,,\r\nPT-002,4,,giao sớm\r\n'), TYPES, 500)
  expect(rows.map((row) => [row.line, row.type?.id, row.quantity, row.reference, row.note, row.problems])).toStrictEqual([
    [2, 'PT-001', 10, 'MP-NS24', '', []],
    [4, 'PT-002', 4, '', 'giao sớm', []],
  ])
})

test('every problem of a row is reported as a code, and invalid rows never reach the store input', () => {
  const rows = parseRegisterTable([['type', 'qty'], ['PT-404', 3], ['', 0], ['PT-001', 2.5], ['PT-001', 501], ['PT-001', 500]], TYPES, 500)
  expect(rows.map((row) => row.problems)).toStrictEqual([
    [{ code: 'typeUnknown', value: 'PT-404' }],
    [{ code: 'typeMissing' }, { code: 'quantityInvalid' }],
    [{ code: 'quantityInvalid' }],
    [{ code: 'quantityInvalid' }],
    [],
  ])
  expect(toRegisterRows(rows, 'MFR-002')).toStrictEqual([{ packageTypeId: 'PT-001', quantity: 500, ownerCompanyId: 'MFR-002' }])
})

test('an empty file has no rows', () => {
  expect(parseRegisterTable([], TYPES, 500)).toStrictEqual([])
  expect(parseRegisterTable([['', ''], []], TYPES, 500)).toStrictEqual([])
})

test('the CSV template uses real package types from the catalog, so importing it unchanged registers valid packages', () => {
  const csv = registerTemplateCsv(['Mã loại kiện', 'Số lượng', 'Mã lô / SKU', 'Ghi chú'], TYPES)
  const rows = parseRegisterTable(parseCsv(csv), TYPES, 500)
  expect(toRegisterRows(rows)).toStrictEqual([{ packageTypeId: 'PT-001', quantity: 10 }, { packageTypeId: 'PT-002', quantity: 4 }])
})
