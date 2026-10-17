import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth, isApiError } from '@/lib/api-client'
import {
  completeStop,
  confirmUnloadManually,
  DRIVER_CAPABILITIES,
  fetchDriverTrip,
  fetchDriverTripLabels,
  fetchDriverTripMonitoring,
  fetchMyTrips,
  postDriverLocation,
  setDriverGps,
  startDelivery,
} from './driver-api'
import { createDriverBackend } from './driver-backend-api'

/**
 * Màn tài xế nối backend (`usesBackend('driver')`): mỗi lệnh gọi đúng endpoint của `DriverController`, luôn kèm `driverId` của
 * backend (đọc ở `/api/users/me`), đổi DTO sang kiểu của màn; lỗi backend chưa kèm mã được đọc theo mã HTTP. `fetch` giả trả phong bì
 * và DTO theo `DriverController` của backend.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['driver']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'driver',
}))

type Call = { readonly method: string; readonly url: string; readonly body: unknown; readonly auth: string | null }
type Reply = { readonly status?: number; readonly body: unknown }

let calls: Call[] = []
let routes: Record<string, Reply> = {}

const ok = (data: unknown): Reply => ({ body: { success: true, message: 'ok', data } })
const fail = (status: number, message: string): Reply => ({ status, body: { success: false, message } })

beforeEach(() => {
  calls = []
  routes = { 'GET /api/users/me': ok({ id: 9, userRoleType: 'DRIVER', status: 'ACTIVE' }) }
  connectApiAuth(() => Promise.resolve('token-1'))
  vi.stubGlobal('fetch', (input: string, init: RequestInit) => {
    const headers = init.headers as Record<string, string>
    const method = init.method ?? 'GET'
    calls.push({ method, url: input, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined, auth: headers.Authorization ?? null })
    const reply = routes[`${method} ${new URL(input).pathname}`] ?? fail(500, 'không có route giả')
    return Promise.resolve(new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 }))
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const TRIP = { tripId: 1, tripCode: 'TRIP-20261017-94EE14F0', vehicleLicensePlate: '51C-284.19', stopCount: 3, departureTime: '2026-10-17T13:37:59', status: 'IN_TRANSIT' }

const STOP = {
  stopId: 2, tripId: 1, stopSequence: 2, stopName: 'Kho Bách Hoá Xanh Dĩ An', address: '215 Quốc lộ 1K, Dĩ An', status: 'PENDING',
  packages: [
    { packageId: 11, packageName: 'Thùng dầu ăn 12 chai', trackingBarcode: 'LB-PK-0007', weight: 12, stepSequence: 7, unloadOrder: 1 },
    { packageId: 12, packageName: null, trackingBarcode: null, weight: null, stepSequence: 4, unloadOrder: 2 },
    { packageId: null, packageName: 'Dòng không có kiện', trackingBarcode: null, weight: null, stepSequence: null, unloadOrder: 3 },
  ],
}

function onStop() {
  routes['GET /api/driver/trips'] = ok([TRIP])
  routes['GET /api/driver/trips/1/current-stop'] = ok(STOP)
}

const paths = () => calls.map((call) => `${call.method} ${call.url.replace('http://be.test', '')}`)

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(() => null, (failure: unknown) => failure)
  if (!isApiError(error)) throw new Error('phải từ chối bằng ApiError')
  return error
}

test('"Chuyến của tôi": mã tài xế của backend ở mọi lượt, chỉ chuyến đang vận chuyển, giờ xuất phát sớm trước', async () => {
  routes['GET /api/driver/trips'] = ok([
    { ...TRIP, tripId: 4, tripCode: null, departureTime: '2026-10-18T07:00:00', stopCount: null },
    TRIP,
    { ...TRIP, tripId: 5, status: 'DELIVERED' },
  ])
  const trips = await fetchMyTrips()
  expect(paths()).toStrictEqual(['GET /api/users/me', 'GET /api/driver/trips?driverId=9'])
  expect(calls.every((call) => call.auth === 'Bearer token-1')).toBe(true)
  expect(trips.loaded).toStrictEqual([])
  expect(trips.preparing).toStrictEqual([])
  expect(trips.recent).toStrictEqual([])
  expect(trips.inTransit.map((row) => row.id)).toStrictEqual(['1', '4'])
  expect(trips.inTransit[0]).toMatchObject({
    id: '1', code: 'TRIP-20261017-94EE14F0', scheduledDate: '2026-10-17', vehicleName: '51C-284.19', status: 'IN_TRANSIT', stopCount: 3, stops: [],
  })
  // Backend chưa trả tên tuyến, số kiện, điểm đang giao: để trống, không điền số
  expect(trips.inTransit[0]?.name).toBeUndefined()
  expect(trips.inTransit[0]?.packageCount).toBeUndefined()
  expect(trips.inTransit[0]?.currentStop).toBeUndefined()
  expect(trips.inTransit[1]).toMatchObject({ code: '4', stopCount: 0 })
})

test('không đọc được mã tài xế: không gọi endpoint nào của tài xế (thiếu driverId là chuyến của mọi tài xế); lần sau hỏi lại', async () => {
  const driver = createDriverBackend()
  routes['GET /api/users/me'] = ok({ id: null })
  expect((await rejection(driver.fetchMyTrips())).code).toBe('UNAUTHENTICATED')
  routes['GET /api/users/me'] = fail(401, 'hết phiên')
  expect((await rejection(driver.fetchMyTrips())).code).toBe('UNAUTHENTICATED')
  expect(paths().filter((path) => path.includes('/api/driver/'))).toStrictEqual([])
  routes['GET /api/users/me'] = ok({ id: 13 })
  routes['GET /api/driver/trips'] = ok([TRIP])
  expect((await driver.fetchMyTrips()).inTransit).toHaveLength(1)
  expect(paths().at(-1)).toBe('GET /api/driver/trips?driverId=13')
})

test('màn điểm giao: điểm đang giao, kiện theo thứ tự dỡ, các điểm trước đã hoàn tất', async () => {
  onStop()
  const screen = await createDriverBackend().fetchStopScreen('1')
  expect(paths()).toStrictEqual(['GET /api/users/me', 'GET /api/driver/trips?driverId=9', 'GET /api/driver/trips/1/current-stop'])
  if (screen.kind !== 'stop') throw new Error('phải là điểm đang giao')
  expect(screen.trip).toStrictEqual({ id: '1', code: 'TRIP-20261017-94EE14F0' })
  expect(screen.stopId).toBe('2')
  expect(screen.view.stop).toMatchObject({ number: 2, name: 'Kho Bách Hoá Xanh Dĩ An', address: '215 Quốc lộ 1K, Dĩ An' })
  expect(screen.view.items.map(({ item }) => item)).toStrictEqual([
    { id: '11', packageId: '11', label: 'LB-PK-0007', name: 'Thùng dầu ăn 12 chai', weightKg: 12, unloadingOrder: 1 },
    { id: '12', packageId: '12', label: '12', name: '12', weightKg: undefined, unloadingOrder: 2 },
  ])
  expect(screen.view).toMatchObject({ mode: 'delivering', arrivedAt: undefined, total: 2, unloadedCount: 0, remaining: 2, verifiable: 2, issueCount: 0, pendingConfirms: 0 })
  expect([...screen.view.completedStops]).toStrictEqual([1])
  expect(screen.stops.map((stop) => [stop.number, stop.name])).toStrictEqual([[1, ''], [2, 'Kho Bách Hoá Xanh Dĩ An'], [3, '']])
})

test('màn điểm giao: chuyến không có trong danh sách của tài xế thì không đọc điểm của nó; hết điểm là noStops', async () => {
  routes['GET /api/driver/trips'] = ok([TRIP])
  expect(await createDriverBackend().fetchStopScreen('TRIP-2026-0914')).toStrictEqual({ kind: 'notInTransit' })
  expect(paths().some((path) => path.includes('current-stop'))).toBe(false)
  routes['GET /api/driver/trips/1/current-stop'] = fail(404, 'Không còn điểm dừng nào cần giao hàng')
  expect(await createDriverBackend().fetchStopScreen('1')).toStrictEqual({ kind: 'noStops', trip: { id: '1', code: 'TRIP-20261017-94EE14F0' } })
})

test('dỡ: mã gõ khớp mã trên nhãn (không phân biệt hoa thường), gửi kèm driverId; dòng kiện thành đã dỡ', async () => {
  onStop()
  const driver = createDriverBackend()
  await driver.fetchStopScreen('1')
  routes['POST /api/driver/packages/11/unload'] = ok({ packageId: 11, trackingBarcode: 'LB-PK-0007', stopId: 2, remainingPackagesCount: 1 })
  expect(await driver.unload('1', { stopNumber: 2, code: '  lb-pk-0007 ' })).toStrictEqual({ packageInstanceId: '11' })
  expect(paths().at(-1)).toBe('POST /api/driver/packages/11/unload?driverId=9')
  const screen = await driver.fetchStopScreen('1')
  expect(screen.kind === 'stop' && screen.view.items.map((entry) => entry.unloaded)).toStrictEqual([true, false])
  expect(screen.kind === 'stop' && screen.view.remaining).toBe(1)
})

test('dỡ: mã không khớp hoặc kiện đã ghi thì không gọi backend', async () => {
  onStop()
  const driver = createDriverBackend()
  await driver.fetchStopScreen('1')
  // Mã kiện của backend chỉ khớp kiện không có mã vạch: kiện có mã vạch phải gõ mã vạch
  expect(await rejection(driver.unload('1', { stopNumber: 2, code: '11' }))).toMatchObject({ code: 'UNLOAD_CODE_UNMATCHED', params: { code: '11' } })
  routes['POST /api/driver/packages/12/unload'] = ok({ packageId: 12, stopId: 2, remainingPackagesCount: 1 })
  await driver.unload('1', { stopNumber: 2, code: '12' })
  const before = calls.length
  expect(await rejection(driver.unload('1', { stopNumber: 2, code: '12' }))).toMatchObject({ code: 'DUPLICATE_UNLOAD', params: { code: '12' } })
  expect(calls).toHaveLength(before)
})

test('dỡ: 409 là kiện đã dỡ từ trước — ghi nhận lại; 400 là kiện không thuộc điểm; còn 0 kiện là cả điểm đã dỡ', async () => {
  onStop()
  const driver = createDriverBackend()
  await driver.fetchStopScreen('1')
  routes['POST /api/driver/packages/11/unload'] = fail(409, 'Kiện hàng này đã được dỡ trước đó: LB-PK-0007')
  expect(await rejection(driver.unload('1', { stopNumber: 2, code: 'LB-PK-0007' }))).toMatchObject({ code: 'DUPLICATE_UNLOAD', status: 409, params: { code: 'LB-PK-0007' } })
  routes['POST /api/driver/packages/12/unload'] = fail(400, 'Kiện hàng thuộc điểm dừng sau')
  expect(await rejection(driver.unload('1', { stopNumber: 2, code: '12' }))).toMatchObject({ code: 'WRONG_DELIVERY_STOP', status: 400 })
  let screen = await driver.fetchStopScreen('1')
  expect(screen.kind === 'stop' && screen.view.items.map((entry) => entry.unloaded)).toStrictEqual([true, false])
  routes['POST /api/driver/packages/12/unload'] = ok({ packageId: 12, stopId: 2, remainingPackagesCount: 0 })
  await driver.unload('1', { stopNumber: 2, code: '12' })
  screen = await driver.fetchStopScreen('1')
  expect(screen.kind === 'stop' && screen.view.remaining).toBe(0)
})

test('hoàn tất điểm: theo mã điểm của backend; 400 là còn kiện chưa dỡ; điểm cuối thì chuyến thành đã giao xong', async () => {
  onStop()
  const driver = createDriverBackend()
  await driver.fetchStopScreen('1')
  routes['POST /api/driver/stops/2/complete'] = fail(400, 'Điểm dừng chưa hoàn tất: còn 2 kiện hàng chưa được dỡ')
  expect(await rejection(driver.completeStop('1', 2))).toMatchObject({ code: 'INCOMPLETE_STOP_UNLOAD', status: 400 })
  // Màn đang ở điểm khác điểm hiện tại của backend: không hoàn tất nhầm điểm
  expect((await rejection(driver.completeStop('1', 1))).code).toBe('DELIVERY_STOP_NOT_FOUND')
  routes['POST /api/driver/stops/2/complete'] = ok({ stopId: 2, stopStatus: 'COMPLETED', nextStopId: null, tripStatus: 'DELIVERED', tripCompleted: true })
  await driver.completeStop('1', 2)
  expect(paths().at(-1)).toBe('POST /api/driver/stops/2/complete?driverId=9')
  routes['GET /api/driver/trips'] = ok([])
  expect(await driver.fetchStopScreen('1')).toStrictEqual({ kind: 'completed', trip: { id: '1', code: 'TRIP-20261017-94EE14F0' } })
})

test('GPS: gửi thẳng lên backend kèm mã chuyến; 400 là chuyến không đang vận chuyển; bật / tắt không gọi gì', async () => {
  routes['POST /api/driver/location'] = ok({ lat: 10.9, lng: 106.8, speedKmh: 36, heading: 90, recordedAt: '2026-10-17T07:00:00Z', source: 'GPS' })
  expect(await postDriverLocation('1', { lat: 10.9, lng: 106.8, speedKmh: 36, heading: 90 })).toStrictEqual({ recordedAt: '2026-10-17T07:00:00Z' })
  expect(calls).toStrictEqual([{ method: 'POST', url: 'http://be.test/api/driver/location', body: { tripId: '1', lat: 10.9, lng: 106.8, speedKmh: 36, heading: 90 }, auth: 'Bearer token-1' }])
  routes['POST /api/driver/location'] = fail(400, 'Chuyến đi không ở trạng thái đang vận chuyển')
  expect((await rejection(postDriverLocation('1', { lat: 1, lng: 2 }))).code).toBe('GPS_TRIP_NOT_IN_TRANSIT')
  const before = calls.length
  expect(await setDriverGps('1', true)).toBe(true)
  expect(await setDriverGps('1', false)).toBe(false)
  expect(calls).toHaveLength(before)
})

test('việc backend chưa có: màn ẩn (capabilities), lỡ gọi thì từ chối NOT_SUPPORTED, không gọi mạng', async () => {
  expect(DRIVER_CAPABILITIES).toStrictEqual({
    backend: true, arrive: false, qrVerify: false, manualConfirm: false, deliveryIssues: false, notifications: false, upcomingTrips: false, simulatedPosition: false,
  })
  for (const call of [
    () => fetchDriverTrip('1'),
    () => fetchDriverTripMonitoring('1'),
    () => fetchDriverTripLabels('1'),
    () => startDelivery('1'),
    () => confirmUnloadManually('1', 2, { packageInstanceId: '11', reason: 'LABEL_DAMAGED' }),
  ]) {
    expect((await rejection(call())).code).toBe('NOT_SUPPORTED')
  }
  expect(calls).toStrictEqual([])
})

test('hoàn tất điểm qua lớp API của màn: gọi backend, không đọc kho mẫu', async () => {
  onStop()
  routes['POST /api/driver/stops/2/complete'] = ok({ stopId: 2, tripCompleted: false, nextStopId: 3 })
  await completeStop('1', 2)
  expect(paths().slice(-2)).toStrictEqual(['GET /api/driver/trips/1/current-stop', 'POST /api/driver/stops/2/complete?driverId=9'])
})
