import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { serverDashboard } from '@/test/dashboard-backend'
import { envelope, stubBackend } from '@/test/fake-backend'
import { fetchServerDashboard } from './dashboard-backend-api'

/**
 * Bảng điều khiển nối backend (`usesBackend('monitoring')`): gọi đúng endpoint theo kỳ, đổi số của máy chủ sang `DashboardSummary`;
 * số máy chủ trả `null` giữ `null` (màn hiện "—"), không thành 0, và không mang MOCK RESULT.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['monitoring']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'monitoring',
}))

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const PERIOD = { from: '2026-10-07', to: '2026-11-05' }

test('đọc số của kỳ ở máy chủ và giữ nguyên số không có nguồn', async () => {
  const backend = stubBackend({ 'GET /api/manager/dashboard': { body: envelope(serverDashboard()) } })
  const summary = await fetchServerDashboard(PERIOD)

  expect(backend.calls.map((call) => [call.path, call.query])).toStrictEqual([['/api/manager/dashboard', PERIOD]])
  expect(summary.period).toStrictEqual(PERIOD)
  expect(summary.tripCount).toBe(12)
  expect(summary.completedCount).toBe(5)
  expect(summary.fill).toStrictEqual({ averagePercent: null, planCount: 0, isMockResult: false })
  expect(summary.deliveredWeightKg).toBe(3250.5)
  expect(summary.delivery).toStrictEqual({ cleanPercent: 87.5, cleanItems: 70, finishedItems: 80 })
  expect(summary.vehicles).toStrictEqual({ inUse: 2, total: 9, byStatus: { available: 4, in_use: 2, maintenance: 1, retired: 2 } })
  // Chỉ trạng thái có chuyến, theo thứ tự vòng đời
  expect(summary.tripsByStatus.map((entry) => entry.status)).toStrictEqual(['PLANNED', 'LOADING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'])
  expect(summary.byVehicle).toStrictEqual([
    { vehicleId: '7', vehicleName: 'Hino 500 · 51C-123.45', tripCount: 4, deliveredWeightKg: 2000, averageFillPercent: null },
  ])
})

test('lấp đầy theo ngày: mọi ngày của kỳ, ngày máy chủ không có số để trống', async () => {
  stubBackend({ 'GET /api/manager/dashboard': { body: envelope(serverDashboard()) } })
  const { fillByDay } = await fetchServerDashboard(PERIOD)
  expect(fillByDay).toHaveLength(30)
  expect(fillByDay.find((day) => day.date === '2026-11-03')).toStrictEqual({ date: '2026-11-03', averagePercent: 72.4, planCount: 2 })
  expect(fillByDay.find((day) => day.date === '2026-11-04')).toStrictEqual({ date: '2026-11-04', averagePercent: null, planCount: 0 })
})

test('chuyến gần đây: mã chuyến của máy chủ, ngày chạy theo giờ Việt Nam, chỉ những trường máy chủ trả', async () => {
  stubBackend({
    'GET /api/manager/dashboard': { body: envelope(serverDashboard({
      recentTrips: [{ ...serverDashboard().recentTrips[0], departureTime: '2026-11-03T18:30:00Z', fillPercent: '64.25' }],
    })) },
  })
  const { trips } = await fetchServerDashboard(PERIOD)
  expect(trips).toStrictEqual([{
    id: 'TRIP-20261104-01', name: 'Tuyến Biên Hoà – Dĩ An', scheduledDate: '2026-11-04', vehicleName: 'Hino 500 · 51C-123.45',
    driverName: 'Lê Văn Tài', status: 'IN_TRANSIT', volumePercent: 64.25,
  }])
})

test('trạng thái chuyến lạ là lỗi của máy chủ, không vẽ chip sai', async () => {
  stubBackend({
    'GET /api/manager/dashboard': { body: envelope(serverDashboard({
      recentTrips: [{ ...serverDashboard().recentTrips[0], status: 'ARCHIVED' }],
    })) },
  })
  await expect(fetchServerDashboard(PERIOD)).rejects.toMatchObject({ code: 'SERVER_ERROR' })
})
