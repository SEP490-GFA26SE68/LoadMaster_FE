import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend } from '@/test/fake-backend'
import { fetchBackendPlanSource } from './viewer-backend-api'

/**
 * Xe của phương án (`LoadPlanDetailResponse.vehicleId`): chuyến đã đổi xe sau lần chạy thì Planner đọc cấu hình của xe mà phương án được
 * tính cho để vẽ phương án trong đúng xe đó; cùng xe, máy chủ không biết xe, hay đọc xe đó lỗi thì không gọi thêm / về lối dự phòng.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

vi.mock('@/features/trips/trips-api', () => ({
  resolveBackendTripId: () => Promise.resolve('42'),
  fetchBackendTripDetail: () => Promise.resolve({ trip: { tripName: 'Bình Dương', status: 'PLANNED' }, stops: [] }),
}))

const config = (vehicleId: number, name: string, innerLength: number) => ({
  vehicleId, vehicleName: name, innerLength, innerWidth: 200, innerHeight: 200, maxPayloadKg: 3500,
})

const PLAN = (vehicleId: number | null) => ({
  id: 7, tripId: 42, vehicleId, approved: false, manuallyEdited: false, stale: true, placements: [], unplaced: [],
})

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const routes = (vehicleId: number | null, planVehicle?: { status?: number; body?: unknown }) => ({
  'GET /api/trips/42/vehicle-config': { body: envelope(config(2, 'Xe 8 tấn', 800)) },
  'GET /api/trips/42/load-plans': { body: envelope({ tripId: 42, approvedPlanId: null, plans: [PLAN(vehicleId)] }) },
  ...(planVehicle ? { 'GET /api/vehicles/1/config': planVehicle } : {}),
})

test('phương án tính cho xe khác xe hiện tại: đọc cấu hình xe đó, giữ xe hiện tại riêng', async () => {
  const { calls } = stubBackend(routes(1, { body: envelope(config(1, 'Xe 3,5 tấn', 520)) }))
  const source = await fetchBackendPlanSource('TRIP-0042')
  expect(source.plan?.vehicleId).toBe('1')
  expect(source.vehicle).toMatchObject({ id: '2', innerLengthCm: 800 })
  expect(source.planVehicle).toMatchObject({ id: '1', name: 'Xe 3,5 tấn', innerLengthCm: 520 })
  expect(calls.some((call) => call.path === '/api/vehicles/1/config')).toBe(true)
})

test('cùng xe hoặc máy chủ không biết xe của phương án: không gọi thêm, không có xe riêng', async () => {
  for (const vehicleId of [2, null]) {
    const { calls } = stubBackend(routes(vehicleId))
    const source = await fetchBackendPlanSource('TRIP-0042')
    expect(source.planVehicle).toBeNull()
    expect(calls.some((call) => call.path.startsWith('/api/vehicles/'))).toBe(false)
    vi.unstubAllGlobals()
  }
})

test('đọc xe của phương án lỗi (xe đã xoá): về lối dự phòng, Planner vẫn mở', async () => {
  stubBackend(routes(1, { status: 404, body: { success: false, code: 'VEHICLE_NOT_FOUND', message: 'x' } }))
  const source = await fetchBackendPlanSource('TRIP-0042')
  expect(source.planVehicle).toBeNull()
  expect(source.plan?.id).toBe('7')
})

test('kiểu thân xe đi cùng cấu hình xe đã đọc: xe của phương án khi có, không thì xe hiện tại; giá trị lạ là tự chọn', async () => {
  const withStyle = (base: object, bodyStyle: unknown) => ({ ...base, bodyStyle })
  const { calls } = stubBackend({
    ...routes(1),
    'GET /api/trips/42/vehicle-config': { body: envelope(withStyle(config(2, 'Xe 8 tấn', 800), 'TRUCK_BOX')) },
    'GET /api/vehicles/1/config': { body: envelope(withStyle(config(1, 'Xe 3,5 tấn', 520), 'TRUCK_CANVAS')) },
  })
  expect((await fetchBackendPlanSource('TRIP-0042')).vehicleBodyStyle).toBe('TRUCK_CANVAS')
  expect(calls.filter((call) => call.path.endsWith('config'))).toHaveLength(2)
  vi.unstubAllGlobals()

  stubBackend({ ...routes(2), 'GET /api/trips/42/vehicle-config': { body: envelope(withStyle(config(2, 'Xe 8 tấn', 800), 'TRUCK_REEFER')) } })
  expect((await fetchBackendPlanSource('TRIP-0042')).vehicleBodyStyle).toBe('TRUCK_REEFER')
  vi.unstubAllGlobals()

  for (const bodyStyle of ['BUS', null, undefined]) {
    stubBackend({ ...routes(2), 'GET /api/trips/42/vehicle-config': { body: envelope(withStyle(config(2, 'Xe 8 tấn', 800), bodyStyle)) } })
    expect((await fetchBackendPlanSource('TRIP-0042')).vehicleBodyStyle).toBeUndefined()
    vi.unstubAllGlobals()
  }
})
