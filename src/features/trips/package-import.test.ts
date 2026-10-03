import { expect, test } from 'vitest'
import { SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import type { CargoPackage } from '@/domain/models'
import { createFormatter } from '@/lib/format'
import { createTranslator } from '@/lib/i18n'
import { parseCsv } from './csv'
import { previewImport, type ImportPreview, type ImportTable, type ReadyPreview } from './package-import'
import { importFragilityAliases, importHandlingAliases, importHeaderAliases } from './package-import-columns'
import { importFileProblemMessage, importProblemMessage } from './package-import-messages'
import { csvTemplateBlob, importTemplateRows, toCsv, xlsxTemplateBlob } from './package-import-template'
import { readImportFile } from './read-import-file'

/**
 * Seam: bảng ô của file → xem trước (LM-093, D-49), rồi câu lỗi theo ngôn ngữ. Kiện có sẵn: `PKG-001` × 2 của Truck 6m Spec mục 12
 * (cửa 220 × 230 cm), chuyến có 2 điểm giao.
 */
const EXISTING: CargoPackage = {
  id: 'PKG-001', name: 'Thùng carton A', lengthCm: 60, widthCm: 40, heightCm: 30, weightKg: 12, quantity: 2,
  allowedOrientations: ['LWH', 'WLH'], keepUpright: true, fragilityLevel: 'NONE', stackable: true,
  maxTopLoadKg: 80, minSupportRatio: 0.8, deliveryStop: 1, priority: 0, mustLoad: false,
}

const vi = createTranslator('vi')
const viFormat = createFormatter('vi-VN')

function preview(table: ImportTable, existing: readonly CargoPackage[] = [EXISTING]): ImportPreview {
  return previewImport(table, {
    existing, stopCount: 2, vehicle: SPEC_TRUCK_6M, headers: importHeaderAliases(), fragility: importFragilityAliases(),
    handling: importHandlingAliases(),
  })
}

function ready(result: ImportPreview): ReadyPreview {
  if (result.kind !== 'ready') throw new Error(`Xem trước lỗi cả file: ${JSON.stringify(result.problem)}`)
  return result
}

const messages = (result: ReadyPreview, row: number) =>
  result.rows.find((item) => item.row === row)?.problems.map((problem) => importProblemMessage(problem, vi, viFormat))

test('a Vietnamese Excel CSV — BOM, ";", decimal commas, a blank line — reads into packages with defaults for missing columns', () => {
  const csv = '﻿Mã kiện;Tên kiện;Dài (cm);Rộng (cm);Cao (cm);Khối lượng (kg);Số lượng;Điểm giao;Giữ thẳng đứng\r\n'
    + 'PKG-101;Bao gạo 25 kg;70;45;15,55;25,125;4;2;không\r\n'
    + '\r\n'
    + 'PKG-102;Thùng nước suối;50;35;25;13;10;1;có\r\n'
  const result = ready(preview(parseCsv(csv)))
  expect(result.rows.map((row) => row.row)).toStrictEqual([2, 4])
  expect(result.invalidCount).toBe(0)
  expect(result.valid).toStrictEqual([
    {
      id: 'PKG-101', name: 'Bao gạo 25 kg', lengthCm: 70, widthCm: 45, heightCm: 15.6, weightKg: 25.13, quantity: 4, deliveryStop: 2,
      allowedOrientations: ['LWH', 'LHW', 'WLH', 'WHL', 'HLW', 'HWL'], keepUpright: false, fragilityLevel: 'NONE', stackable: true,
      maxTopLoadKg: 0, minSupportRatio: 0.7, priority: 0, mustLoad: false, handlingClass: 'STANDARD',
    },
    {
      id: 'PKG-102', name: 'Thùng nước suối', lengthCm: 50, widthCm: 35, heightCm: 25, weightKg: 13, quantity: 10, deliveryStop: 1,
      allowedOrientations: ['LWH', 'WLH'], keepUpright: true, fragilityLevel: 'NONE', stackable: true,
      maxTopLoadKg: 0, minSupportRatio: 0.7, priority: 0, mustLoad: false, handlingClass: 'STANDARD',
    },
  ])
})

test('the optional handling class column: the code or its label in either language; blank is STANDARD, anything else is a row error', () => {
  const result = ready(preview([
    [...HEADER, 'Loại hàng'],
    ['PKG-601', 'Bình gốm', 40, 30, 25, 6, 1, 1, 'LWH', 'có', 'FRAGILE'],
    ['PKG-602', 'Kem que', 40, 30, 25, 6, 1, 1, 'LWH', 'có', 'hang lanh'],
    ['PKG-603', 'Đồng hồ', 40, 30, 25, 6, 1, 1, 'LWH', 'có', 'High value'],
    ['PKG-604', 'Thùng giấy', 40, 30, 25, 6, 1, 1, 'LWH', 'có', ''],
    ['PKG-605', 'Thùng lạ', 40, 30, 25, 6, 1, 1, 'LWH', 'có', 'Dễ cháy'],
  ]))
  expect(result.valid.map((pkg) => [pkg.id, pkg.handlingClass])).toStrictEqual([
    ['PKG-601', 'FRAGILE'], ['PKG-602', 'REFRIGERATED'], ['PKG-603', 'HIGH_VALUE'], ['PKG-604', 'STANDARD'],
  ])
  expect(messages(result, 6)).toStrictEqual(['Loại hàng: "Dễ cháy" không phải loại hàng (STANDARD, FRAGILE, REFRIGERATED, HAZARDOUS, HIGH_VALUE).'])
  // Tên trường và tiêu đề tiếng Anh cũng là cột đó
  for (const title of ['handlingClass', 'Handling class']) {
    expect(ready(preview([[...HEADER, title], ['PKG-606', 'Pin', 40, 30, 25, 6, 1, 1, 'LWH', 'có', 'HAZARDOUS']])).valid[0]?.handlingClass).toBe('HAZARDOUS')
  }
})

test('English titles and field names are accepted in one header; unknown columns are listed and skipped', () => {
  const table = [
    ['Package ID', 'name', 'Length (cm)', 'widthCm', 'Height', 'Weight (kg)', 'Quantity', 'deliveryStop', 'Fragility', 'Barcode'],
    ['PKG-201', 'Glass jars', 40, 30, 25, 13.5, 2, 1, 'Medium', '893000'],
  ]
  const result = ready(preview(table))
  expect(result.ignoredColumns).toStrictEqual(['Barcode'])
  expect(result.valid[0]).toMatchObject({ id: 'PKG-201', lengthCm: 40, weightKg: 13.5, fragilityLevel: 'MEDIUM' })
})

test('missing required columns fail the whole file with the column titles in the current language', () => {
  const result = preview([['Mã kiện', 'Tên kiện', 'Số lượng'], ['PKG-1', 'A', 1]])
  expect(result).toStrictEqual({ kind: 'fileError', problem: { code: 'MISSING_COLUMNS', fields: ['lengthCm', 'widthCm', 'heightCm', 'weightKg', 'deliveryStop'] } })
  if (result.kind !== 'fileError') return
  expect(importFileProblemMessage(result.problem, vi, viFormat))
    .toBe('Thiếu cột bắt buộc: Dài (cm), Rộng (cm), Cao (cm), Khối lượng (kg) và Điểm giao.')
  expect(preview([[''], ['   ']])).toStrictEqual({ kind: 'fileError', problem: { code: 'EMPTY' } })
})

const HEADER = ['id', 'name', 'lengthCm', 'widthCm', 'heightCm', 'weightKg', 'quantity', 'deliveryStop', 'allowedOrientations', 'keepUpright']

test('row errors map to sentences in the column\'s own title: required, not a number, not yes/no, unknown orientation, schema rules', () => {
  const result = ready(preview([
    HEADER,
    ['PKG-301', '', 'abc', 40, 30, 12, 1, 1, 'LWH', 'có'],
    ['PKG-302', 'Tủ lạnh', 60, 60, 180, 70, 1, 1, 'LWX', 'maybe'],
    ['PKG-303', 'Kiện số lượng 0', 60, 40, 30, 12, 0, 1, 'LWH', 'có'],
    ['PKG-304', 'Kiện nằm', 60, 40, 30, 12, 1, 1, 'LWH|HLW', 'có'],
  ]))
  expect(result.valid).toHaveLength(0)
  expect(messages(result, 2)).toStrictEqual(['Tên kiện: chưa có giá trị.', 'Dài (cm): "abc" không phải là số.'])
  expect(messages(result, 3)).toStrictEqual([
    'Hướng đặt: "LWX" không phải mã hướng đặt (LWH, LHW, WLH, WHL, HLW, HWL).',
    'Giữ thẳng đứng: "maybe" không phải có/không.',
  ])
  expect(messages(result, 4)).toStrictEqual(['Số lượng: Số lượng tối thiểu là 1.'])
  expect(messages(result, 5)).toStrictEqual(['Hướng đặt: Kiện giữ thẳng đứng chỉ được đặt LWH hoặc WLH.'])
})

test('duplicate IDs in the file or with existing packages, and unknown stops, are row errors; the first occurrence stays valid', () => {
  const result = ready(preview([
    HEADER,
    ['PKG-001', 'Trùng kiện có sẵn', 60, 40, 30, 12, 1, 1, 'LWH', 'không'],
    ['PKG-401', 'Kiện A', 60, 40, 30, 12, 1, 1, 'LWH', 'không'],
    ['PKG-401', 'Kiện A lặp', 60, 40, 30, 12, 1, 2, 'LWH', 'không'],
    ['PKG-402', 'Điểm lạ', 60, 40, 30, 12, 1, 3, 'LWH', 'không'],
  ]))
  expect(result.valid.map((pkg) => pkg.id)).toStrictEqual(['PKG-401'])
  expect(messages(result, 2)).toStrictEqual(['Mã kiện PKG-001 đã có trong chuyến.'])
  expect(messages(result, 4)).toStrictEqual(['Mã kiện PKG-401 trùng với dòng 3 của file.'])
  expect(messages(result, 5)).toStrictEqual(['Chuyến không có điểm giao 3 (chuyến có 2 điểm).'])
})

test('domain checks: an ID that collides with an instance of an existing package, and a package too big for the door', () => {
  const result = ready(preview([
    HEADER,
    ['PKG-001-01', 'Đụng instance', 60, 40, 30, 12, 1, 1, 'LWH', 'không'],
    ['PKG-501', 'Tủ đông lớn', 300, 300, 300, 50, 1, 1, 'LWH', 'không'],
  ]))
  expect(result.valid).toHaveLength(0)
  expect(result.rows[0]?.problems.map((problem) => problem.code === 'CONSTRAINT' && problem.issue.code)).toStrictEqual(['DUPLICATE_INSTANCE_ID'])
  expect(messages(result, 3)).toStrictEqual(['Kiện PKG-501 không lọt qua cửa 220 × 230 cm.'])
})

test('the template of either language, for this trip, imports as two valid packages — CSV and .xlsx', async () => {
  for (const locale of ['vi', 'en'] as const) {
    const rows = importTemplateRows(createTranslator(locale), [EXISTING], 2)
    const result = ready(preview(parseCsv(toCsv(rows))))
    expect(result.valid.map((pkg) => pkg.id)).toStrictEqual(['PKG-002', 'PKG-003'])
    expect(result.invalidCount).toBe(0)
    // Cột cuối của file mẫu là loại hàng (FE-3b-07); hai dòng mẫu cùng loại để nhập mẫu không vướng phân tách hàng (FE-4b-06)
    expect(result.valid.map((pkg) => pkg.handlingClass)).toStrictEqual(['STANDARD', 'STANDARD'])
    expect(rows[0]).toHaveLength(20)
  }
  const rows = importTemplateRows(vi, [EXISTING], 2)
  expect(rows[0]?.at(-1)).toBe('Loại hàng')
  // BOM UTF-8 (EF BB BF) đầu file để Excel đọc đúng chữ có dấu; `Blob.text()` tự bỏ BOM nên so byte
  const bytes = new Uint8Array(await csvTemplateBlob(rows).arrayBuffer())
  expect([...bytes.slice(0, 3)]).toStrictEqual([0xef, 0xbb, 0xbf])
  expect(await csvTemplateBlob(rows).text()).toMatch(/^Mã kiện,Tên kiện,Dài \(cm\)/)
  const xlsx = new File([await xlsxTemplateBlob(rows, 'Kiện')], 'mau-nhap-kien.xlsx')
  const result = ready(preview(await readImportFile(xlsx)))
  expect(result.valid).toStrictEqual(ready(preview(parseCsv(toCsv(rows)))).valid)
})
