import { expect, test } from 'vitest'
import { HANDLING_CLASSES } from '@/domain/models'
import { parseCsv } from '@/features/trips/csv'
import { toCsv } from '@/features/trips/package-import-template'
import { createTranslator } from '@/lib/i18n'
import type { PackageType } from '@/lib/mock-db'
import {
  columnOfHeader, IMPORT_COLUMNS, importFileError, importInputs, importTemplateRows, MAX_IMPORT_ROWS, parseHandlingClass, parsePackageImport,
  type ImportContext, type PackageImportPreview,
} from './package-pool-import'

const TYPE: PackageType = {
  id: 'PT-006', companyId: 'LOG-001', name: 'Thùng quạt điện', lengthCm: 60, widthCm: 25, heightCm: 60, weightKg: 6, fragilityLevel: 'HIGH',
  allowedOrientations: ['LWH', 'WLH'], keepUpright: true, stackable: false, maxTopLoadKg: 0, createdAt: '2026-08-05T02:00:00.000Z',
}

const CONTEXT: ImportContext = { packageTypes: [TYPE], existing: [{ id: 'PK-0049', packageCode: 'HK-DNG-2609-01' }] }

const HEADER = ['package_code', 'length', 'width', 'height', 'weight', 'handling_class', 'destination', 'package_type']
const row = (code: string, extra: Partial<Record<(typeof HEADER)[number], string | number>> = {}) => {
  const values: Record<string, string | number> = { package_code: code, length: 60, width: 40, height: 40, weight: 18, handling_class: 'STANDARD', destination: 'KCN Hoà Khánh, Đà Nẵng', package_type: '', ...extra }
  return HEADER.map((column) => values[column] ?? '')
}

function preview(table: readonly (readonly (string | number)[])[], context = CONTEXT): PackageImportPreview {
  const result = parsePackageImport(table, context)
  if (result.kind !== 'preview') throw new Error(`Chờ bản xem trước, nhận lỗi file ${result.code}`)
  return result
}

const issues = (result: PackageImportPreview) => result.rows.filter((item) => item.errors.length > 0 || item.warnings.length > 0).map((item) => [item.line, item.errors, item.warnings])

test('a file of 500 valid rows: every row valid, nothing to fix, and the store input carries every field', () => {
  const table = [HEADER, ...Array.from({ length: 500 }, (_, index) => row(`DN-${String(index + 1).padStart(4, '0')}`, { weight: 18.5, handling_class: index % 2 === 0 ? 'STANDARD' : 'fragile' }))]
  const result = preview(table)
  expect([result.total, result.valid, result.errorRows, result.warningRows]).toStrictEqual([500, 500, 0, 0])
  expect(issues(result)).toStrictEqual([])
  const inputs = importInputs(result)
  expect(inputs).toHaveLength(500)
  expect(inputs?.[1]).toStrictEqual({ packageCode: 'DN-0002', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 18.5, handlingClass: 'FRAGILE', destination: 'KCN Hoà Khánh, Đà Nẵng' })
  // Số dòng như khi mở file bằng Excel: tiêu đề là dòng 1, dữ liệu từ dòng 2
  expect([result.rows[0]?.line, result.rows.at(-1)?.line]).toStrictEqual([2, 501])
})

test('one row with a zero dimension is an error with its row number, and then no row at all goes to the store', () => {
  const result = preview([HEADER, row('DN-0001'), row('DN-0002', { height: 0 }), row('DN-0003')])
  expect([result.total, result.valid, result.errorRows]).toStrictEqual([3, 2, 1])
  expect(issues(result)).toStrictEqual([[3, [{ code: 'INVALID_DIMENSION', field: 'height' }], []]])
  expect(importInputs(result)).toBeNull()
})

test('a package code repeated in the file is an error on the later row, naming the first one; case and spaces do not hide it', () => {
  const result = preview([HEADER, row('DN-0001'), row('DN-0002'), row(' dn-0001 ')])
  expect(issues(result)).toStrictEqual([[4, [{ code: 'DUPLICATE_PACKAGE_CODE', firstLine: 2 }], []]])
  expect(importInputs(result)).toBeNull()
})

test('a package code already in the pool is only a warning: the row is still valid and still imported', () => {
  const result = preview([HEADER, row('hk-dng-2609-01'), row('DN-0002')])
  expect([result.total, result.valid, result.errorRows, result.warningRows]).toStrictEqual([2, 2, 0, 1])
  expect(issues(result)).toStrictEqual([[2, [], [{ code: 'PACKAGE_CODE_EXISTS', packageId: 'PK-0049' }]]])
  expect(importInputs(result)?.map((input) => input.packageCode)).toStrictEqual(['hk-dng-2609-01', 'DN-0002'])
})

test('every row problem is reported as a code: sizes, weight, handling class, destination, package code, package type', () => {
  const result = preview([
    HEADER,
    row('DN-0001', { length: -1, width: 'abc', weight: 0 }),
    row('DN-0002', { handling_class: 'FROZEN' }),
    row('DN-0003', { handling_class: '', destination: '  ' }),
    row('', { package_type: 'PT-404' }),
    row('DN-0005', { length: '60,5', weight: '1.250,5', package_type: 'thung quat dien' }),
  ])
  expect(result.rows.map((item) => item.errors)).toStrictEqual([
    [{ code: 'INVALID_DIMENSION', field: 'length' }, { code: 'INVALID_DIMENSION', field: 'width' }, { code: 'INVALID_WEIGHT' }],
    [{ code: 'INVALID_HANDLING_CLASS', value: 'FROZEN' }],
    [{ code: 'INVALID_HANDLING_CLASS', value: '' }, { code: 'DESTINATION_REQUIRED' }],
    [{ code: 'PACKAGE_CODE_REQUIRED' }, { code: 'PACKAGE_TYPE_NOT_FOUND', value: 'PT-404' }],
    [],
  ])
  // Số viết kiểu Việt đọc được; loại kiện tìm theo mã hoặc đúng tên (bỏ dấu)
  expect(result.rows[4]).toMatchObject({ lengthCm: 60.5, weightKg: 1250.5, packageTypeId: 'PT-006' })
  expect([result.total, result.valid, result.errorRows]).toStrictEqual([5, 1, 4])
})

test('columns are found by header in Vietnamese or English, in any order, with or without the unit; blank rows are skipped', () => {
  const csv = 'Điểm đến;Mã kiện;Dài (cm);Rộng (cm);Cao (cm);Khối lượng (kg);Loại hàng\r\n;;;;;;\r\n"KCN Phú Bài, Huế";PB-01;50;40;30;9,5;Dễ vỡ\r\n'
  const result = preview(parseCsv(csv))
  expect(result.rows).toHaveLength(1)
  expect(result.rows[0]).toMatchObject({ line: 3, packageCode: 'PB-01', lengthCm: 50, widthCm: 40, heightCm: 30, weightKg: 9.5, handlingClass: 'FRAGILE', destination: 'KCN Phú Bài, Huế', errors: [] })
  expect(importInputs(result)).toStrictEqual([{ packageCode: 'PB-01', lengthCm: 50, widthCm: 40, heightCm: 30, weightKg: 9.5, handlingClass: 'FRAGILE', destination: 'KCN Phú Bài, Huế' }])

  for (const locale of ['vi', 'en'] as const) {
    const t = createTranslator(locale)
    expect(IMPORT_COLUMNS.map((column) => columnOfHeader(t(`sourcing.import.header.${column}`))), locale).toStrictEqual([...IMPORT_COLUMNS])
    expect(HANDLING_CLASSES.map((value) => parseHandlingClass(t(`common.handlingClasses.${value}`))), locale).toStrictEqual([...HANDLING_CLASSES])
  }
  expect(HEADER.map(columnOfHeader)).toStrictEqual([...IMPORT_COLUMNS])
  expect(columnOfHeader('Ghi chú')).toBeUndefined()
})

test('file errors: wrong type, too large, empty, missing columns, more than 1,000 rows', () => {
  expect(importFileError({ name: 'kien.pdf', size: 1200 })).toStrictEqual({ kind: 'error', code: 'UNSUPPORTED_FILE_TYPE', params: {} })
  expect(importFileError({ name: 'KIEN.XLSX', size: 10 * 1024 * 1024 })).toBeNull()
  expect(importFileError({ name: 'kien.csv', size: 10 * 1024 * 1024 + 1 })).toStrictEqual({ kind: 'error', code: 'FILE_TOO_LARGE', params: { maxMb: 10 } })
  expect(importFileError({ name: 'kien.csv', size: 0 })).toStrictEqual({ kind: 'error', code: 'EMPTY_FILE', params: {} })

  expect(parsePackageImport([], CONTEXT)).toStrictEqual({ kind: 'error', code: 'EMPTY_FILE', params: {} })
  expect(parsePackageImport([HEADER, ['', '']], CONTEXT)).toStrictEqual({ kind: 'error', code: 'EMPTY_FILE', params: {} })
  expect(parsePackageImport([['package_code', 'length', 'ghi chu'], ['DN-1', 60, '']], CONTEXT)).toStrictEqual({
    kind: 'error', code: 'IMPORT_COLUMNS_MISSING', params: { columns: ['width', 'height', 'weight', 'handling_class', 'destination'] },
  })
  const tooMany = [HEADER, ...Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, index) => row(`DN-${index}`))]
  expect(parsePackageImport(tooMany, CONTEXT)).toStrictEqual({ kind: 'error', code: 'BATCH_TOO_LARGE', params: { max: 1000, rows: 1001 } })
  expect(preview(tooMany.slice(0, -1)).total).toBe(1000)
})

test('the template has the unit in its headers and imports unchanged as valid rows, in both languages', () => {
  for (const locale of ['vi', 'en'] as const) {
    const rows = importTemplateRows(createTranslator(locale))
    expect(rows[0]?.filter((header) => /\((cm|kg)\)/.test(String(header))), locale).toHaveLength(4)
    const result = preview(parseCsv(toCsv(rows)), { packageTypes: [], existing: [] })
    expect([result.total, result.valid, result.errorRows, result.warningRows], locale).toStrictEqual([2, 2, 0, 0])
  }
})
