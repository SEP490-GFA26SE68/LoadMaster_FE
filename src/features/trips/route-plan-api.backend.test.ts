import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { encodePolyline } from '@/components/map/polyline'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend } from '@/test/fake-backend'
import { getTripRoutePath } from './route-plan-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

/**
 * Đường của bản đồ chuyến: chuyến máy chủ đọc tuyến đã lưu ở máy chủ, không thì nối thẳng kho → điểm giao. Không bao giờ gọi dịch vụ
 * chỉ đường công khai (toạ độ khách không rời máy chủ của mình), lỗi của máy chủ không bị nuốt thành "không có đường".
 */
const DEPOT = { lat: 10.93, lng: 106.87 }
const STOPS = [{ lat: 10.95, lng: 106.82 }, { lat: 10.9, lng: 106.76 }]

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('chuyến kho mẫu: nối thẳng kho → điểm giao, không gọi mạng nào', async () => {
  const { calls } = stubBackend({})
  const path = await getTripRoutePath('TRIP-2026-0914', { depot: DEPOT, stops: STOPS }, false)
  expect(path?.[0]).toMatchObject({ lat: DEPOT.lat, lng: DEPOT.lng })
  expect(path?.at(-1)).toMatchObject({ lat: STOPS[1]!.lat, lng: STOPS[1]!.lng })
  expect(calls).toEqual([])
})

test('chuyến máy chủ có tuyến đã lưu: vẽ theo polyline của các chặng', async () => {
  const bend = { lat: 10.94, lng: 106.85 }
  const { calls } = stubBackend({
    'GET /api/trips/TRIP-7/route-plans/active': {
      body: envelope({ id: 1, tripId: 7, planVersion: 1, isActive: true, legs: [
        { id: 2, legSequence: 2, endStopId: 2, distanceMeters: 1, durationSeconds: 1, polyline: encodePolyline([STOPS[0]!, STOPS[1]!]) },
        { id: 1, legSequence: 1, endStopId: 1, distanceMeters: 1, durationSeconds: 1, polyline: encodePolyline([DEPOT, bend, STOPS[0]!]) },
      ] }),
    },
  })
  const path = await getTripRoutePath('TRIP-7', { depot: DEPOT, stops: STOPS }, true)
  expect(path?.some((point) => Math.abs(point.lat - bend.lat) < 1e-5 && Math.abs(point.lng - bend.lng) < 1e-5)).toBe(true)
  expect(calls.map((call) => call.path)).toEqual(['/api/trips/TRIP-7/route-plans/active'])
})

test('chuyến máy chủ chưa có tuyến (ROUTE_PLAN_NOT_FOUND): nối thẳng; lỗi khác để lộ ra', async () => {
  stubBackend({ 'GET /api/trips/TRIP-7/route-plans/active': { status: 404, body: { success: false, code: 'ROUTE_PLAN_NOT_FOUND' } } })
  await expect(getTripRoutePath('TRIP-7', { depot: DEPOT, stops: STOPS }, true)).resolves.toHaveLength(3)

  stubBackend({ 'GET /api/trips/TRIP-7/route-plans/active': { status: 500, body: { success: false, message: 'boom' } } })
  await expect(getTripRoutePath('TRIP-7', { depot: DEPOT, stops: STOPS }, true)).rejects.toMatchObject({ status: 500 })
})
