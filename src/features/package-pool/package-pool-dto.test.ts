import { expect, test } from 'vitest'
import { backendRowErrorOf, backendRowWarningOf, isBackendQrToken, lookupOf, packageOf, toBackendToken } from './package-pool-dto'

// Mẫu JSON theo dạng của backend: kiện thêm tay, kiện nhập file. Kích thước là cm (`numeric(10,2)`).
const MANUAL = {
  id: 1, orderId: null, packageTypeId: null, trackingBarcode: 'QA-BARCODE-0001', actualLength: 120.5, actualWeightKg: 12.5, isPinned: false,
  packageCode: 'QA PK-0001', qrToken: '63abd059-f710-4bf5-abe1-a1c120f2c6d9', handlingClass: 'FRAGILE', status: 'PENDING',
}
const IMPORTED = {
  id: 4, orderId: 1, packageTypeId: null, trackingBarcode: null, actualLength: '50.00', actualWeightKg: '3.00', isPinned: false,
  packageCode: '', qrToken: '7086df89-979c-4813-bfd0-eea152332f55', handlingClass: null, status: 'PLANNED',
}

test('kiện của backend: kích thước cm (số hoặc chuỗi), trường backend không có để trống', () => {
  expect(packageOf(MANUAL)).toEqual({
    id: '1', companyId: '', packageCode: 'QA PK-0001', qrToken: '63abd059-f710-4bf5-abe1-a1c120f2c6d9',
    lengthCm: 120.5, widthCm: 0, heightCm: 0, weightKg: 12.5, handlingClass: 'FRAGILE', destination: '',
    status: 'IMPORTED', flags: [], source: 'IMPORT', createdAt: '', createdBy: null, history: [],
  })
  expect(packageOf(IMPORTED)).toMatchObject({ id: '4', packageCode: '4', lengthCm: 50, weightKg: 3, handlingClass: 'STANDARD', status: 'ASSIGNED', source: 'IMPORT' })
  expect(packageOf({ ...MANUAL, actualWidth: 80, actualHeight: 60, destination: ' Kho Biên Hoà ' })).toMatchObject({ widthCm: 80, heightCm: 60, destination: 'Kho Biên Hoà' })
})

test('trạng thái của backend: bốn trạng thái có ở app, kiện đã huỷ và trạng thái lạ bị bỏ', () => {
  const status = (value: string) => packageOf({ ...MANUAL, status: value })?.status ?? null
  expect(['PENDING', 'PLANNED', 'LOADED', 'DELIVERED', 'CANCELLED', 'LOST'].map(status)).toEqual(['IMPORTED', 'ASSIGNED', 'LOADED', 'DELIVERED', null, null])
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
  // Kiện khách từ chối, chở về kho khi tài xế hoàn tất điểm
  expect(lookupOf({ ...scan, status: 'RETURNED' })?.package.status).toBe('RETURNED')
})

test('mã QR của backend: UUID viết hoa đổi về chữ thường, mã khác giữ nguyên', () => {
  expect(toBackendToken(' 63ABD059-F710-4BF5-ABE1-A1C120F2C6D9 ')).toBe('63abd059-f710-4bf5-abe1-a1c120f2c6d9')
  expect(toBackendToken('QA PK-0001')).toBe('QA PK-0001')
  expect(isBackendQrToken('63ABD059-F710-4BF5-ABE1-A1C120F2C6D9')).toBe(true)
  expect(isBackendQrToken('LM-ABCD-EFGH-JKMN')).toBe(false)
})

test('lỗi dòng của file nhập: mã của backend thành mã của app, mã lạ và chi tiết thiếu vẫn có câu', () => {
  const issue = (errorCode: string, detail: string | null = null) => ({ rowIndex: 3, errorCode, detail })
  expect([
    issue('IMPORT_DUPLICATE_CODE', 'trùng với dòng 2'),
    issue('IMPORT_DUPLICATE_CODE'),
    issue('IMPORT_INVALID_LENGTH'),
    issue('IMPORT_INVALID_WEIGHT'),
    issue('IMPORT_INVALID_HANDLING_CLASS', "'XYZ'"),
    issue('IMPORT_INVALID_HANDLING_CLASS'),
    issue('IMPORT_BLANK_DESTINATION'),
    issue('IMPORT_SOMETHING_NEW'),
  ].map(backendRowErrorOf)).toEqual([
    { code: 'DUPLICATE_PACKAGE_CODE', firstLine: 2 },
    { code: 'DUPLICATE_PACKAGE_CODE_IN_FILE' },
    { code: 'INVALID_DIMENSION', field: 'length' },
    { code: 'INVALID_WEIGHT' },
    { code: 'INVALID_HANDLING_CLASS', value: 'XYZ' },
    { code: 'INVALID_HANDLING_CLASS', value: '' },
    { code: 'DESTINATION_REQUIRED' },
    { code: 'ROW_INVALID' },
  ])
  expect([issue('IMPORT_EXISTING_CODE', "'HK-1'"), issue('IMPORT_OTHER_WARNING')].map(backendRowWarningOf))
    .toEqual([{ code: 'PACKAGE_CODE_EXISTS_ON_SERVER' }, { code: 'ROW_WARNING' }])
})
