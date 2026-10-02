import { expect, test } from 'vitest'
import { MockDbError, type MockDbErrorCode, type MockDbErrorParams } from '@/lib/mock-db/errors'
import { createTranslator, dataErrorMessage } from '@/lib/i18n'

/** Một bộ tham số mẫu cho mỗi mã lỗi của kho — thiếu mã là lỗi kiểu. */
const SAMPLES: { [Code in MockDbErrorCode]: MockDbErrorParams[Code] } = {
  NOT_FOUND: { collection: 'trips', id: 'TRIP-404' },
  VEHICLE_IN_USE: { vehicleId: 'VEHICLE-002', tripIds: ['TRIP-001', 'TRIP-002'] },
  VEHICLE_LOCKED: { vehicleId: 'VEHICLE-003', tripId: 'TRIP-010' },
  VEHICLE_IN_MAINTENANCE: { vehicleId: 'VEHICLE-008' },
  REVISION_STALE: { revisionId: 'REV-027' },
  REVISION_NOT_COMPLETED: { revisionId: 'REV-003' },
  PATCH_UNKNOWN_INSTANCE: { packageInstanceId: 'PKG-001-01' },
  TRIP_LOCKED: { tripId: 'TRIP-011', phase: 'loading' },
  TRIP_PHASE_INVALID: { tripId: 'TRIP-009', phase: 'delivering' },
  NO_APPROVED_REVISION: { tripId: 'TRIP-014' },
  INSTANCE_NOT_IN_PLAN: { tripId: 'TRIP-010', packageInstanceId: 'PKG-404-01' },
  INSTANCE_NOT_LOADED: { tripId: 'TRIP-003', packageInstanceId: 'PKG-001-07' },
  LOADING_INCOMPLETE: { tripId: 'TRIP-011', remaining: 170 },
  STOP_INCOMPLETE: { tripId: 'TRIP-009', stopNumber: 2, remaining: 25 },
  STOP_NOT_CURRENT: { tripId: 'TRIP-009', stopNumber: 3 },
  REASON_REQUIRED: {},
  DRIVER_INVALID: { userId: 'US-0001' },
  INVALID_CREDENTIALS: {},
  ACCOUNT_SUSPENDED: {},
  NOT_SIGNED_IN: {},
  EMAIL_TAKEN: { email: 'yen.phan@loadmaster.vn' },
  SELF_CHANGE_FORBIDDEN: {},
  LAST_ADMIN: {},
  USER_IN_USE: { userId: 'US-0004', tripIds: ['TRIP-2026-0914', 'TRIP-010'] },
  PASSWORD_INCORRECT: {},
  PASSWORD_TOO_SHORT: { min: 8 },
  PACKAGE_TYPE_INVALID: { codes: ['package.dimension.positive'] },
  PACKAGE_TYPE_IN_USE: { packageTypeId: 'PT-001', count: 12 },
  QUANTITY_INVALID: { min: 1, max: 500 },
  COMPANY_REQUIRED: {},
  FORBIDDEN_COMPANY: { collection: 'trips', id: 'TRIP-PN-001' },
  PACKAGE_UNAVAILABLE: { packageId: 'RPK-0035', status: 'registered' },
  PACKAGES_REQUIRED: {},
  QR_UNKNOWN: { token: 'LM-0000-0000-0000' },
  ORDER_STATUS_INVALID: { orderId: 'ORD-001', status: 'assigned' },
  STOP_NOT_FOUND: { tripId: 'TRIP-014', stopId: 'STOP-09' },
  VEHICLE_TYPE_INVALID: { field: 'payloadKg' },
  VEHICLE_TYPE_IN_USE: { vehicleTypeId: 'VT-001', vehicleIds: ['VEHICLE-001'] },
  PACKAGE_NOT_IN_TRIP: { tripId: 'TRIP-011', token: 'LM-0000-0000-0000' },
  WRONG_PACKAGE_SCANNED: { expected: 'PKG-001-02', scanned: 'PKG-001-05' },
  QR_WRONG_STOP: { packageInstanceId: 'PKG-002-01', stopNumber: 3 },
  SEAL_INVALID: { max: 32 },
}

test('every data error code has a vi and en sentence with every placeholder filled', () => {
  for (const locale of ['vi', 'en'] as const) {
    const t = createTranslator(locale)
    for (const [code, params] of Object.entries(SAMPLES)) {
      const message = dataErrorMessage(new MockDbError(code as MockDbErrorCode, params as never), t)
      expect(message, `${locale} ${code}`).not.toMatch(/[{}]/)
      expect(message, `${locale} ${code}`).not.toBe(`dataErrors.${code}`)
    }
  }
})

test('lists are joined and numbers kept; an error that is not a data error gets the generic sentence', () => {
  const t = createTranslator('vi')
  expect(dataErrorMessage(new MockDbError('VEHICLE_IN_USE', SAMPLES.VEHICLE_IN_USE), t)).toBe(
    'Xe VEHICLE-002 còn gắn với chuyến TRIP-001, TRIP-002 nên không xoá được.',
  )
  expect(dataErrorMessage(new TypeError('boom'), t)).toBe('Có lỗi xảy ra. Thử lại sau.')
})

test('an account without a company is told why it gets no operational data; the shipment and receiving codes are gone (FE-0-06, FE-0-02)', () => {
  expect(dataErrorMessage(new MockDbError('COMPANY_REQUIRED', {}), createTranslator('vi'))).toBe('Tài khoản này không thuộc công ty nào nên không xem hay sửa được dữ liệu vận hành.')
  expect(dataErrorMessage(new MockDbError('COMPANY_REQUIRED', {}), createTranslator('en'))).toBe('This account does not belong to a company, so it cannot view or change operational data.')
  expect(Object.keys(SAMPLES).filter((code) => /SHIPMENT|RECEIV|COMPANY_KIND|NOT_OWNED/.test(code))).toStrictEqual([])
})

test('a record of another company is named by its id, never by the company it belongs to (FE-0-02)', () => {
  const error = new MockDbError('FORBIDDEN_COMPANY', SAMPLES.FORBIDDEN_COMPANY)
  expect(dataErrorMessage(error, createTranslator('vi'))).toBe('TRIP-PN-001 thuộc công ty khác nên không dùng được.')
  expect(dataErrorMessage(error, createTranslator('en'))).toBe('TRIP-PN-001 belongs to another company and cannot be used.')
})
