import { expect, test } from 'vitest'
import { LABEL_SHEET, labelsBackTarget, labelSelection, sheetFits } from './label-sheet'

/** Khổ nhãn in và tham số của trang in nhãn (FE-3b-05). */

test('four labels fit an A4 portrait page inside the margins: two columns and two rows', () => {
  expect(LABEL_SHEET).toMatchObject({ pageWidthMm: 210, pageHeightMm: 297, columns: 2, rows: 2 })
  expect(sheetFits(LABEL_SHEET)).toBe(true)
  // Rộng hơn 1 mm hoặc cao hơn 3 mm là tràn trang
  expect(sheetFits({ ...LABEL_SHEET, labelWidthMm: LABEL_SHEET.labelWidthMm + 1 })).toBe(false)
  expect(sheetFits({ ...LABEL_SHEET, labelHeightMm: LABEL_SHEET.labelHeightMm + 3 })).toBe(false)
})

test('the label page reads which packages to print from the URL: chosen ids, or every package of a trip; nothing chosen is nothing', () => {
  const read = (search: string) => labelSelection(new URLSearchParams(search))
  expect(read('kien=PK-0001, PK-0002,,PK-0001')).toStrictEqual({ ids: ['PK-0001', 'PK-0002'] })
  expect(read('chuyen=TRIP-014')).toStrictEqual({ tripId: 'TRIP-014' })
  // Có cả hai thì chuyến thắng: liên kết của chuyến không mang danh sách mã
  expect(read('chuyen=TRIP-014&kien=PK-0001')).toStrictEqual({ tripId: 'TRIP-014' })
  expect(read('')).toStrictEqual({})
  expect(read('kien=')).toStrictEqual({})
})

test('the back button of the label page returns to where the labels were asked for, and never to a screen the viewer cannot open', () => {
  const all = () => true
  const warehouse = (permission: string) => ['packages.lookup', 'labels.print', 'warehouse.operate'].includes(permission)
  expect(labelsBackTarget(new URLSearchParams('kien=PK-0001,PK-0002'), all)).toStrictEqual({ kind: 'pool', to: '/kien-hang' })
  expect(labelsBackTarget(new URLSearchParams('chuyen=TRIP-014'), all)).toStrictEqual({ kind: 'trip', to: '/chuyen/TRIP-014', tripId: 'TRIP-014' })
  // In lại một kiện từ Tra cứu kiện: về đúng kiện đó
  expect(labelsBackTarget(new URLSearchParams('kien=PK-0063&tu=tra-cuu'), all)).toStrictEqual({ kind: 'lookup', to: '/tra-cuu-kien?ma=PK-0063' })
  // Nhân viên kho không mở được Kho kiện hay Chi tiết chuyến: luôn về Tra cứu kiện
  expect(labelsBackTarget(new URLSearchParams('kien=PK-0001,PK-0002'), warehouse)).toStrictEqual({ kind: 'lookup', to: '/tra-cuu-kien' })
  expect(labelsBackTarget(new URLSearchParams('chuyen=TRIP-014'), warehouse)).toStrictEqual({ kind: 'lookup', to: '/tra-cuu-kien' })
})
