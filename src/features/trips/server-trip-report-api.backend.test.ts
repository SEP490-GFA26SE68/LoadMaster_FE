import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend } from '@/test/fake-backend'
import { fetchServerTripReport } from './server-trip-report-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Báo cáo chuyến máy chủ: mốc giờ Việt Nam đổi sang ISO, mức hạn `ON_TIME` là `OK`, mã lạ bị bỏ, điểm theo thứ tự. */
const REPORT = {
  tripId: 42, tripCode: 'TRIP-2026-0042', tripName: 'Tân Bình – Quận 7', status: 'DELIVERED', vehicleName: 'Hino 500',
  licensePlate: '51C-123.45', driverName: 'Trần Văn Tài', departureTime: '2026-11-10T07:00:00', completedAt: '2026-11-10T11:40:00',
  cancellation: null,
  loading: { startedAt: '2026-11-10T05:30:00', completedAt: '2026-11-10T06:45:00', sealNumber: 'SEAL-0091', sealedAt: '2026-11-10T06:50:00' },
  overrideReason: null,
  stops: [
    {
      stopId: 902, sequence: 2, stopType: 'DELIVERY', name: 'Siêu thị Quận 7', address: '1 Nguyễn Văn Linh', packageCount: 4, unloaded: 3,
      returned: 1, issues: 1, plannedArrival: '2026-11-10T10:30:00', actualArrival: '2026-11-10T10:55:00', deadline: '2026-11-10T10:45:00',
      plannedStatus: 'AT_RISK', arrivedOnTime: false, completed: true,
    },
    {
      stopId: 901, sequence: 1, stopType: 'DELIVERY', name: 'Cửa hàng Tân Bình', address: '12 Cộng Hoà', packageCount: 6, unloaded: 6,
      returned: 0, issues: 0, plannedArrival: '2026-11-10T08:00:00', actualArrival: '2026-11-10T08:10:00', deadline: null,
      plannedStatus: 'ON_TIME', arrivedOnTime: null, completed: true,
    },
  ],
  packages: { total: 11, staged: 11, loaded: 10, damaged: 1, delivered: 9, returned: 1, withIssue: 1 },
  verifications: [
    { step: 'STAGING', label: 11, manual: 0 }, { step: 'LOADING', label: 9, manual: 1 }, { step: 'UNLOADING', label: 9, manual: 0 },
    { step: 'SOMETHING_NEW', label: 1, manual: 0 },
  ],
  manualConfirmations: [{
    id: 5, step: 'LOADING', packageCode: 'PK-0012', stopSequence: 2, reason: 'QR_UNREADABLE', note: null, status: 'APPROVED',
    requestedBy: 'Lê Văn Kho', requestedAt: '2026-11-10T06:00:00', decidedBy: 'Phạm Điều Phối', decidedAt: '2026-11-10T06:05:00', decisionNote: null,
  }],
  exceptions: [{
    id: 3, type: 'TRAFFIC', description: 'Kẹt xe cầu Kênh Tẻ', delayMinutes: 20, status: 'RESOLVED', stopNumber: 2,
    reportedBy: 'Trần Văn Tài', reportedAt: '2026-11-10T09:40:00', resolvedBy: 'Phạm Điều Phối', resolvedAt: '2026-11-10T10:00:00', resolutionNote: null,
  }],
  reroutes: [{ stopNumber: 2, route: 'BYPASS', distanceKm: 6.5, durationMinutes: 18, extraMs: 0, confirmedAt: '2026-11-10T09:45:00', confirmedBy: 'Phạm Điều Phối' }],
}

test('the server report reads by trip code and maps times, deadline levels and statuses into the app shape', async () => {
  const { calls } = stubBackend({ 'GET /api/trips/TRIP-2026-0042/report': { body: envelope(REPORT) } })
  const report = await fetchServerTripReport('TRIP-2026-0042')
  expect(calls.map((call) => `${call.method} ${call.path}`)).toStrictEqual(['GET /api/trips/TRIP-2026-0042/report'])
  expect(report.stops.map((stop) => [stop.number, stop.plannedStatus, stop.arrivedOnTime])).toStrictEqual([[1, 'OK', null], [2, 'AT_RISK', false]])
  expect(report.stops[1]).toMatchObject({ arrivedAt: '2026-11-10T03:55:00.000Z', deadline: '2026-11-10T03:45:00.000Z', completed: true, pickup: false })
  expect(report.loading).toStrictEqual({
    startedAt: '2026-11-09T22:30:00.000Z', completedAt: '2026-11-09T23:45:00.000Z', seal: { number: 'SEAL-0091', at: '2026-11-09T23:50:00.000Z' },
  })
  expect(report.verifications.map((row) => row.step)).toStrictEqual(['STAGING', 'LOADING', 'UNLOADING'])
  expect(report.manualConfirms[0]).toMatchObject({ step: 'LOADING', status: 'MANUAL_APPROVED', reason: 'QR_UNREADABLE', stopNumber: 2, note: '' })
  expect(report.exceptions[0]).toMatchObject({ type: 'TRAFFIC', status: 'RESOLVED', delayMinutes: 20, resolvedAt: '2026-11-10T03:00:00.000Z' })
  expect(report.reroutes).toStrictEqual([{ stopNumber: 2, route: 'BYPASS', distanceKm: 6.5, durationMinutes: 18, confirmedAt: '2026-11-10T02:45:00.000Z' }])
  expect(report.cancellation).toBeNull()
})

test('a trip cancelled on the road keeps its reason; a trip without a report keeps the server code', async () => {
  stubBackend({
    'GET /api/trips/TRIP-2026-0043/report': { body: envelope({ ...REPORT, tripCode: 'TRIP-2026-0043', status: 'CANCELLED', cancellation: { reason: 'Xe hỏng giữa đường', fromStatus: 'IN_TRANSIT' }, loading: null }) },
    'GET /api/trips/TRIP-2026-0044/report': { status: 409, body: { success: false, code: 'TRIP_REPORT_NOT_AVAILABLE', message: 'no report' } },
  })
  const cancelled = await fetchServerTripReport('TRIP-2026-0043')
  expect(cancelled.cancellation).toStrictEqual({ reason: 'Xe hỏng giữa đường', inTransit: true })
  expect(cancelled.loading).toBeNull()
  await expect(fetchServerTripReport('TRIP-2026-0044')).rejects.toMatchObject({ code: 'TRIP_REPORT_NOT_AVAILABLE' })
})
