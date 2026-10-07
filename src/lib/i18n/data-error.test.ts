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
  TRIP_INVALID: { tripId: 'TRIP-015', field: 'depot' },
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
  ROLE_OUT_OF_SCOPE: { role: 'driver' },
  USER_MANAGED_BY_COMPANY: { userId: 'US-0009' },
  USER_IN_USE: { userId: 'US-0004', tripIds: ['TRIP-2026-0914', 'TRIP-010'] },
  PASSWORD_INCORRECT: {},
  PASSWORD_TOO_SHORT: { min: 8 },
  PACKAGE_TYPE_INVALID: { codes: ['package.dimension.positive'] },
  PACKAGE_TYPE_IN_USE: { packageTypeId: 'PT-001', count: 12 },
  QUANTITY_INVALID: { min: 1, max: 500 },
  COMPANY_REQUIRED: {},
  FORBIDDEN_COMPANY: { collection: 'trips', id: 'TRIP-PN-001' },
  PACKAGE_UNAVAILABLE: { packageId: 'PK-0035', status: 'ASSIGNED' },
  PACKAGES_REQUIRED: {},
  QR_UNKNOWN: { token: 'LM-0000-0000-0000' },
  STOP_NOT_FOUND: { tripId: 'TRIP-014', stopId: 'STOP-09' },
  VEHICLE_TYPE_INVALID: { field: 'payloadKg' },
  VEHICLE_TYPE_IN_USE: { vehicleTypeId: 'VT-001', vehicleIds: ['VEHICLE-001'] },
  PACKAGE_NOT_IN_TRIP: { tripId: 'TRIP-011', token: 'LM-0000-0000-0000' },
  WRONG_PACKAGE_SCANNED: { expected: 'PKG-001-02', scanned: 'PKG-001-05' },
  QR_WRONG_STOP: { packageInstanceId: 'PKG-002-01', stopNumber: 3 },
  SEAL_INVALID: { max: 32 },
  PACKAGE_INVALID: { field: 'destination' },
  INVALID_PACKAGE_STATUS_TRANSITION: { packageId: 'PK-0049', from: 'IMPORTED', to: 'LOADED' },
  PACKAGE_FLAGGED: { packageId: 'PK-0063', flag: 'NOT_FOUND' },
  PACKAGE_FLAG_NOT_SET: { packageId: 'PK-0049', flag: 'DAMAGED' },
  ROLE_NOT_ALLOWED: { role: 'warehouse' },
  REQUIREMENT_INVALID: { field: 'coordinates' },
  REQUIREMENT_DEADLINE_PAST: { deadline: '2026-09-13T10:00:00.000Z' },
  REQUIREMENT_NOT_PENDING: { requirementId: 'REQ-006', status: 'ASSIGNED' },
  REQUIREMENT_STATUS_INVALID: { requirementId: 'REQ-005', status: 'PENDING' },
  CARGO_SEGREGATION_CONFLICT: { tripId: 'TRIP-014', lockedClass: 'STANDARD', packages: ['PB-HUE-2609-04', 'PB-HUE-2609-05'] },
  OVERRIDE_REASON_TOO_LONG: { max: 500 },
  ROUTE_STOPS_REQUIRED: { tripId: 'TRIP-015' },
  MISSING_STOP_COORDINATES: { tripId: 'TRIP-014', stopIds: ['STOP-01'], stopNumbers: [1] },
  APPROVAL_BLOCKED: { revisionId: 'REV-025', count: 2, codes: ['AXLE_OVERLOAD', 'MUST_LOAD_UNPLACED'] },
  LATE_STOPS_UNCONFIRMED: { tripId: 'TRIP-012', stopIds: ['STOP-02', 'STOP-03'], stopNumbers: [2, 3] },
  TRIP_NOT_PLANNED: { tripId: 'TRIP-014' },
  ROUTE_NOT_PLANNED: { tripId: 'TRIP-014' },
  VEHICLE_UNCHANGED: { vehicleId: 'VEHICLE-002' },
  VEHICLE_BUSY: { vehicleId: 'VEHICLE-007', tripId: 'TRIP-011' },
  VEHICLE_UNFIT: { vehicleId: 'VEHICLE-001', reasons: ['CARGO_WEIGHT_EXCEEDED'] },
  PACKAGE_CODE_AMBIGUOUS: { tripId: 'TRIP-011', code: 'KH-778', count: 2 },
  MANUAL_CONFIRM_PENDING: { tripId: 'TRIP-011', count: 2 },
  MANUAL_CONFIRM_NOT_PENDING: { tripId: 'TRIP-011', confirmationId: 'VF-003' },
  STAGING_INCOMPLETE: { tripId: 'TRIP-011', remaining: 12 },
  PACKAGE_ALREADY_STAGED: { tripId: 'TRIP-011', packageInstanceId: 'PKG-001-07' },
  SHORTAGE_NOT_OPEN: { tripId: 'TRIP-011', packageInstanceId: 'PKG-001-07' },
  STOP_NOT_ARRIVED: { tripId: 'TRIP-009', stopNumber: 2 },
  INVALID_TRIP_STATUS_TRANSITION: { tripId: 'TRIP-009', from: 'IN_TRANSIT', to: 'CANCELLED' },
  LOCATION_INVALID: { field: 'coordinates' },
  EXCEPTION_INVALID: { field: 'delayMinutes' },
  EXCEPTION_STATUS_INVALID: { exceptionId: 'EXC-002', status: 'RESOLVED' },
  REROUTE_UNAVAILABLE: { tripId: 'TRIP-009' },
  PICKUP_INVALID: { field: 'packages.weightKg' },
  INVALID_PICKUP_STATUS_TRANSITION: { pickupId: 'PKR-001', from: 'PENDING', to: 'LOADED' },
  PICKUP_ROUTE_UNAVAILABLE: { tripId: 'TRIP-009', stopNumbers: [2, 3] },
  UNSUPPORTED_FILE_TYPE: {},
  EMPTY_FILE: {},
  FILE_TOO_LARGE: { maxMb: 10 },
  BATCH_TOO_LARGE: { max: 1000, rows: 1204 },
  IMPORT_COLUMNS_MISSING: { columns: ['weight', 'destination'] },
  PACKAGE_IMPORT_INVALID: { errors: 3 },
  INSUFFICIENT_CREDITS: { balance: 0 },
  SUBSCRIPTION_EXPIRED: { expiredAt: '2026-09-30T00:00:00.000Z' },
  SUBSCRIPTION_ACTIVE: { subscriptionId: 'SUB-001' },
  SUBSCRIPTION_STATUS_INVALID: { status: 'EXPIRED' },
  PLAN_INACTIVE: { planId: 'PLAN-002' },
  PLAN_INVALID: { field: 'priceVnd' },
  TOPUP_INVALID: { credits: 75 },
  CREDIT_NOT_RESERVED: { reference: 'JOB-017' },
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

test('file errors of the package import say the limit that was broken (FE-3b-02)', () => {
  const t = createTranslator('vi')
  expect(dataErrorMessage(new MockDbError('BATCH_TOO_LARGE', SAMPLES.BATCH_TOO_LARGE), t)).toBe('File có 1.204 dòng, mỗi lần chỉ nhập tối đa 1.000 dòng.')
  expect(dataErrorMessage(new MockDbError('FILE_TOO_LARGE', SAMPLES.FILE_TOO_LARGE), t)).toBe('File lớn hơn 10 MB nên không nhập được.')
  expect(dataErrorMessage(new MockDbError('IMPORT_COLUMNS_MISSING', SAMPLES.IMPORT_COLUMNS_MISSING), createTranslator('en'))).toBe(
    'The header row is missing columns: weight, destination. Download the template to see every column.',
  )
})

test('a record of another company is named by its id, never by the company it belongs to (FE-0-02)', () => {
  const error = new MockDbError('FORBIDDEN_COMPANY', SAMPLES.FORBIDDEN_COMPANY)
  expect(dataErrorMessage(error, createTranslator('vi'))).toBe('TRIP-PN-001 thuộc công ty khác nên không dùng được.')
  expect(dataErrorMessage(error, createTranslator('en'))).toBe('TRIP-PN-001 belongs to another company and cannot be used.')
})
