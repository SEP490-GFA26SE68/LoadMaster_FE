import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { getMockDb } from '@/lib/mock-db'
import { envelope, page, stubBackend, type FakeCall } from '@/test/fake-backend'
import { optimizeTripRoute } from './route-api'
import { overrideTripSegregation } from './segregation-api'
import { resolveStagingShortage } from './shortage-api'
import { deletePackage } from './trip-package-lines-api'
import { addTripPackages, removeTripPackage } from './trip-pool-api'
import { removeTripStop, updateTripStops } from './trip-stops-api'
import { cancelTrip, fetchTrips, updateTripFrame } from './trips-api'
import { resolveBackendTripId } from './trips-backend-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

/**
 * Lớp gọi API của chuyến khi nhóm `trips` nối backend: danh sách đọc hết mọi trang của `GET /api/trips` (tối đa 100 dòng mỗi trang),
 * mã chuyến trên URL đổi sang mã số bằng tìm kiếm; lệnh ghi từ chối `NOT_SUPPORTED` mà không gọi mạng hay kho mẫu.
 */
const CODE = 'TRIP-20261019-7F3A'
const ROW = {
  id: 42, tripCode: CODE, tripName: 'Biên Hoà – Dĩ An', vehicleId: 5, vehicleName: 'Hino 500', licensePlate: '51C-284.19', driverId: 9,
  driverName: 'Trần Văn Hùng', departureTime: '2026-10-19T06:30:00', status: 'IN_TRANSIT', stopCount: 2, packageCount: 14,
}
const OTHER = { ...ROW, id: 43, tripCode: `${CODE}-B`, tripName: null, vehicleId: null, vehicleName: null, licensePlate: null, driverId: null, driverName: null, departureTime: null, status: 'DRAFT', stopCount: null, packageCount: null }
let calls: FakeCall[] = []

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('danh sách đọc hết mọi trang, 100 dòng mỗi trang, và dựng dòng chỉ từ những gì máy chủ trả', async () => {
  calls = stubBackend({
    'GET /api/trips': (call) => ({
      body: call.query.page === '0' ? { success: true, data: [ROW], page: 0, totalPages: 2, last: false } : { success: true, data: [OTHER], page: 1, totalPages: 2, last: true },
    }),
  }).calls
  const rows = await fetchTrips()
  expect(calls.map((call) => call.query)).toEqual([{ page: '0', size: '100' }, { page: '1', size: '100' }])
  expect(rows[0]).toEqual({
    id: CODE, name: 'Biên Hoà – Dĩ An', scheduledDate: '2026-10-19', vehicleId: '5', vehicleName: 'Hino 500 · 51C-284.19', driverId: '9',
    driverName: 'Trần Văn Hùng', route: '', packageCount: 14, stopCount: 2, volumePercent: null, status: 'IN_TRANSIT', sub: null, extraSub: null,
    phase: 'delivering', hasActiveRoutePlan: false,
  })
  // Không tên, không xe, không giờ: tên là mã chuyến, ô trống thay vì số nghĩ ra
  expect(rows[1]).toMatchObject({ id: `${CODE}-B`, name: `${CODE}-B`, scheduledDate: '', vehicleId: '', vehicleName: '', driverId: null, status: 'DRAFT', phase: 'planning' })
})

test('trạng thái lạ của máy chủ là lỗi, không đoán', async () => {
  stubBackend({ 'GET /api/trips': { body: envelope(page([{ ...ROW, status: 'ON_HOLD' }])) } })
  await expect(fetchTrips()).rejects.toMatchObject({ code: 'SERVER_ERROR' })
})

test('mã chuyến trên URL đổi sang mã số của máy chủ (không phân biệt hoa thường); mã số đi thẳng', async () => {
  calls = stubBackend({ 'GET /api/trips': { body: envelope(page([OTHER, ROW])) } }).calls
  await expect(resolveBackendTripId(CODE.toLowerCase())).resolves.toBe('42')
  expect(calls.map((call) => call.query)).toEqual([{ search: CODE.toLowerCase(), page: '0', size: '100' }])
  await expect(resolveBackendTripId('42')).resolves.toBe('42')
  expect(calls).toHaveLength(1)
})

test('mã không có trên máy chủ (mã kho mẫu, gõ sai) là TRIP_NOT_FOUND', async () => {
  calls = stubBackend({ 'GET /api/trips': { body: envelope(page([OTHER])) } }).calls
  await expect(resolveBackendTripId('TRIP-2026-0914')).rejects.toMatchObject({ code: 'TRIP_NOT_FOUND' })
  expect(calls.map((call) => call.path)).toEqual(['/api/trips'])
})

test('máy chủ từ chối vai trò: lỗi mang mã của máy chủ để màn nói đúng lý do', async () => {
  stubBackend({ 'GET /api/trips': { status: 403, body: { success: false, code: 'FORBIDDEN', message: 'Access Denied' } } })
  await expect(fetchTrips()).rejects.toMatchObject({ status: 403 })
})

test('lệnh ghi của chuyến từ chối NOT_SUPPORTED, không gọi mạng và không ghi kho mẫu', async () => {
  calls = stubBackend({}).calls
  const db = getMockDb()
  const writes = [vi.spyOn(db, 'updateTrip'), vi.spyOn(db, 'cancelTrip'), vi.spyOn(db, 'optimizeTripRoute')]
  const results = await Promise.allSettled([
    updateTripFrame(CODE, { name: 'Khác', departureAt: '2026-10-19T00:00:00.000Z', driverId: null }),
    cancelTrip(CODE, 'Khách huỷ'),
    deletePackage(CODE, 'PKG-001'),
    updateTripStops(CODE, []),
    removeTripStop(CODE, '7'),
    addTripPackages(CODE, { packageIds: ['PK-0001'], target: { stopId: '7' } }),
    removeTripPackage(CODE, 'PK-0001'),
    optimizeTripRoute(CODE),
    overrideTripSegregation(CODE, 'Cùng khách'),
    resolveStagingShortage(CODE, 'PKG-001-01', 'DROP'),
  ])
  expect(results.map((result) => (result.status === 'rejected' ? (result.reason as { code?: string }).code : 'fulfilled'))).toEqual(Array(10).fill('NOT_SUPPORTED'))
  expect(calls).toEqual([])
  for (const write of writes) expect(write).not.toHaveBeenCalled()
})
