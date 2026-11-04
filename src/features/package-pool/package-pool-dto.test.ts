import { expect, test } from 'vitest'
import { isBackendQrToken, lookupOf, packageOf, packageRequestOf, previewOf, toBackendToken } from './package-pool-dto'

// Mẫu JSON chép từ backend local (17/10/2026): kiện thêm tay, kiện nhập file, bản xem trước có dòng lỗi.
const MANUAL = {
  id: 1, orderId: null, packageTypeId: null, trackingBarcode: 'QA-BARCODE-0001', actualLength: 1205, actualWeightKg: 12.5, isPinned: false,
  packageCode: 'QA PK-0001', qrToken: '63abd059-f710-4bf5-abe1-a1c120f2c6d9', handlingClass: 'FRAGILE', status: 'PENDING',
}
const IMPORTED = {
  id: 4, orderId: 1, packageTypeId: null, trackingBarcode: null, actualLength: 500, actualWeightKg: '3.00', isPinned: false,
  packageCode: '', qrToken: '7086df89-979c-4813-bfd0-eea152332f55', handlingClass: null, status: 'PLANNED',
}

test('kiện của backend: mm thành cm, nguồn theo mã vạch, trường backend không có để trống', () => {
  expect(packageOf(MANUAL)).toEqual({
    id: '1', companyId: '', packageCode: 'QA PK-0001', qrToken: '63abd059-f710-4bf5-abe1-a1c120f2c6d9',
    lengthCm: 120.5, widthCm: 0, heightCm: 0, weightKg: 12.5, handlingClass: 'FRAGILE', destination: '',
    status: 'IMPORTED', flags: [], source: 'MANUAL', createdAt: '', createdBy: null, history: [],
  })
  expect(packageOf(IMPORTED)).toMatchObject({ id: '4', packageCode: '4', lengthCm: 50, weightKg: 3, handlingClass: 'STANDARD', status: 'ASSIGNED', source: 'IMPORT' })
  expect(packageOf({ ...MANUAL, actualWidth: 800, actualHeight: 600, destination: ' Kho Biên Hoà ' })).toMatchObject({ widthCm: 80, heightCm: 60, destination: 'Kho Biên Hoà' })
})

test('trạng thái của backend: bốn trạng thái có ở app, kiện đã huỷ và trạng thái lạ bị bỏ', () => {
  const status = (value: string) => packageOf({ ...MANUAL, status: value })?.status ?? null
  expect(['PENDING', 'PLANNED', 'LOADED', 'DELIVERED', 'CANCELLED', 'LOST'].map(status)).toEqual(['IMPORTED', 'ASSIGNED', 'LOADED', 'DELIVERED', null, null])
})

test('thân tạo kiện: cm thành mm nguyên, mã của bên gửi để trống thì không gửi', () => {
  const input = { packageCode: '  ', lengthCm: 120.5, widthCm: 80, heightCm: 60.04, weightKg: 12.5, handlingClass: 'FRAGILE' as const, destination: ' Kho A ' }
  expect(packageRequestOf(input, 'B-1')).toEqual({
    trackingBarcode: 'B-1', actualLength: 1205, actualWidth: 800, actualHeight: 600, actualWeightKg: 12.5, handlingClass: 'FRAGILE', destination: 'Kho A',
  })
  expect(packageRequestOf({ ...input, packageCode: ' HK-1 ' }, 'B-2')).toMatchObject({ packageCode: 'HK-1' })
})

test('kết quả quét: chuyến và điểm giao của đơn hàng, điểm đến từ backend', () => {
  const scan = {
    id: 7, packageCode: 'HK-1', qrToken: 'b6f77244-f60e-4de3-87da-9a283cf5c717', handlingClass: null, actualWeightKg: 9.5, status: 'PLANNED', orderId: 3,
    trip: { id: 12, name: 'TRIP-2026-1017-A' }, stop: { number: 2, name: 'Kho Thủ Đức' }, destination: 'Kho Thủ Đức',
  }
  const found = lookupOf(scan)
  expect(found?.package).toMatchObject({ id: '7', status: 'ASSIGNED', tripId: '12', destination: 'Kho Thủ Đức', handlingClass: 'STANDARD', weightKg: 9.5 })
  expect(found?.trip).toEqual({ id: '12', name: 'TRIP-2026-1017-A' })
  expect(found?.stop).toEqual({ number: 2, name: 'Kho Thủ Đức' })
  const loose = lookupOf({ ...scan, status: 'PENDING', trip: null, stop: null })
  expect(loose?.trip).toBeUndefined()
  expect(loose?.stop).toBeUndefined()
  expect(loose?.package).not.toHaveProperty('tripId')
  expect(lookupOf({ ...scan, status: 'CANCELLED' })).toBeNull()
})

test('mã QR của backend: UUID viết hoa đổi về chữ thường, mã khác giữ nguyên', () => {
  expect(toBackendToken(' 63ABD059-F710-4BF5-ABE1-A1C120F2C6D9 ')).toBe('63abd059-f710-4bf5-abe1-a1c120f2c6d9')
  expect(toBackendToken('QA PK-0001')).toBe('QA PK-0001')
  expect(isBackendQrToken('63ABD059-F710-4BF5-ABE1-A1C120F2C6D9')).toBe(true)
  expect(isBackendQrToken('LM-ABCD-EFGH-JKMN')).toBe(false)
})

const PREVIEW = {
  totalRows: 8,
  validCount: 3,
  errors: [
    { rowIndex: 3, field: 'packageCode', errorCode: 'IMPORT_DUPLICATE_CODE', detail: 'trùng với dòng 2', message: 'Mã kiện bị trùng lặp trong cùng file (trùng với dòng 2)' },
    { rowIndex: 4, field: 'lengthCm', errorCode: 'IMPORT_INVALID_LENGTH', detail: null, message: 'Chiều dài phải là số dương (> 0 cm)' },
    { rowIndex: 5, field: 'weightKg', errorCode: 'IMPORT_INVALID_WEIGHT', detail: null, message: 'Khối lượng phải là số dương (> 0 kg)' },
    { rowIndex: 6, field: 'handlingClass', errorCode: 'IMPORT_INVALID_HANDLING_CLASS', detail: "'XYZ'", message: 'Loại hàng không hợp lệ.' },
    { rowIndex: 7, field: 'destination', errorCode: 'IMPORT_BLANK_DESTINATION', detail: null, message: 'Điểm đến không được để trống' },
  ],
  warnings: [],
  validRows: [
    { rowIndex: 2, packageCode: 'QA IMP-001', lengthCm: 120.5, widthCm: 80, heightCm: 60, weightKg: 12.5, handlingClass: 'FRAGILE', destination: 'QA Kho Bien Hoa' },
    { rowIndex: 8, packageCode: 'QA PK-0001', lengthCm: 50, widthCm: 40, heightCm: 30, weightKg: 3, handlingClass: 'STANDARD', destination: 'QA Kho Di An' },
    { rowIndex: 9, packageCode: '', lengthCm: 50, widthCm: 40, heightCm: 30, weightKg: 3, handlingClass: 'STANDARD', destination: 'QA Kho Di An' },
  ],
}

test('bản xem trước của backend: dòng theo số dòng của file, mã lỗi của backend thành mã của app', () => {
  const file = new File(['x'], 'kien.csv')
  const preview = previewOf(PREVIEW, file)
  expect(preview).toMatchObject({ kind: 'preview', total: 8, valid: 3, errorRows: 5, warningRows: 0, file })
  expect(preview.rows.map((row) => row.line)).toEqual([2, 3, 4, 5, 6, 7, 8, 9])
  expect(preview.rows[0]).toEqual({
    line: 2, packageCode: 'QA IMP-001', lengthCm: 120.5, widthCm: 80, heightCm: 60, weightKg: 12.5, handlingClass: 'FRAGILE', destination: 'QA Kho Bien Hoa',
    errors: [], warnings: [],
  })
  expect(preview.rows[1]).toEqual({
    line: 3, packageCode: '', lengthCm: null, widthCm: null, heightCm: null, weightKg: null, handlingClass: null, destination: '',
    errors: [{ code: 'DUPLICATE_PACKAGE_CODE', firstLine: 2 }], warnings: [],
  })
  expect(preview.rows.slice(2, 6).map((row) => row.errors)).toEqual([
    [{ code: 'INVALID_DIMENSION', field: 'length' }],
    [{ code: 'INVALID_WEIGHT' }],
    [{ code: 'INVALID_HANDLING_CLASS', value: 'XYZ' }],
    [{ code: 'DESTINATION_REQUIRED' }],
  ])
  expect(preview.rows[7]).toMatchObject({ packageCode: '', errors: [] })
})

test('bản xem trước của backend: cảnh báo mã đã có, mã lạ và chi tiết thiếu vẫn có câu', () => {
  const preview = previewOf({
    totalRows: 2,
    validCount: 1,
    errors: [
      { rowIndex: 3, errorCode: 'IMPORT_DUPLICATE_CODE', detail: null },
      { rowIndex: 3, errorCode: 'IMPORT_INVALID_HANDLING_CLASS', detail: null },
      { rowIndex: 3, errorCode: 'IMPORT_SOMETHING_NEW', detail: null },
    ],
    warnings: [{ rowIndex: 2, errorCode: 'IMPORT_EXISTING_CODE', detail: "'HK-1'" }, { rowIndex: 2, errorCode: 'IMPORT_OTHER_WARNING' }],
    validRows: [{ rowIndex: 2, packageCode: 'HK-1', lengthCm: '60.0', widthCm: '40', heightCm: '40', weightKg: '18.50', handlingClass: '', destination: 'Kho A' }],
  }, new File(['x'], 'kien.xlsx'))
  expect(preview).toMatchObject({ errorRows: 1, warningRows: 1 })
  expect(preview.rows[0]).toMatchObject({ lengthCm: 60, weightKg: 18.5, handlingClass: 'STANDARD', warnings: [{ code: 'PACKAGE_CODE_EXISTS_ON_SERVER' }, { code: 'ROW_WARNING' }] })
  expect(preview.rows[1]?.errors).toEqual([{ code: 'DUPLICATE_PACKAGE_CODE_IN_FILE' }, { code: 'INVALID_HANDLING_CLASS', value: '' }, { code: 'ROW_INVALID' }])
})
