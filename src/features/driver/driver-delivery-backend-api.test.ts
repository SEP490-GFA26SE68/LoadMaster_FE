import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth, isApiError } from '@/lib/api-client'
import { envelope, stubBackend, type FakeRoutes } from '@/test/fake-backend'
import { createDriverBackend } from './driver-backend-api'
import { driverServerScene } from './driver-server-scene'
import { serverStopListTimings } from './server-stop-timing'

/**
 * Tài xế nối backend — phần ngoài lệnh dỡ: sự cố theo kiện (khách từ chối), xác nhận tay, phương án kho đã xếp cho khung 3D, giờ đến và
 * hạn giao các điểm. DTO theo `DriverController` (`DeliveryIssueResponse`, `ManualConfirmationResponse`, `DriverLoadPlanResponse`,
 * `DriverTripStopsResponse`) của backend; mốc giờ `LocalDateTime` là giờ Việt Nam.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['driver']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'driver',
}))

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const TRIP = { tripId: 1, tripCode: 'TRIP-20261017-94EE14F0', vehicleLicensePlate: '51C-284.19', stopCount: 3, departureTime: '2026-10-17T13:37:59', status: 'IN_TRANSIT' }

const PACKAGE = { packageId: 11, packageName: 'Thùng dầu ăn 12 chai', trackingBarcode: 'LB-PK-0007', weight: 12, unloadOrder: 1, unloaded: false }

const stop = (packages: readonly object[]) => ({
  stopId: 2, stopSequence: 2, stopName: 'Kho Bách Hoá Xanh Dĩ An', address: '215 Quốc lộ 1K, Dĩ An', status: 'ARRIVED', actualArrival: '2026-10-17 14:20:00',
  packages: [...packages, { packageId: 12, packageName: 'Nước rửa chén', trackingBarcode: 'LB-PK-0008', weight: 5, unloadOrder: 2, unloaded: false }],
})

function backendWith(routes: FakeRoutes) {
  return stubBackend({
    'GET /api/users/me': { body: envelope({ id: 9 }) },
    'GET /api/driver/trips': { body: envelope([TRIP]) },
    'GET /api/driver/trips/1/current-stop': { body: envelope(stop([PACKAGE])) },
    ...routes,
  })
}

const writes = (calls: readonly { method: string; path: string; body: unknown }[]) =>
  calls.filter((call) => call.method === 'POST').map((call) => [call.path, call.body])

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(() => null, (failure: unknown) => failure)
  if (!isApiError(error)) throw new Error('phải từ chối bằng ApiError')
  return error
}

test('khách từ chối: gửi sự cố của kiện theo mã kiện; lần đọc lại cho thấy kiện ở lại xe, không phải dỡ nữa', async () => {
  const backend = backendWith({ 'POST /api/driver/packages/11/issues': { body: envelope({ issueId: 5, packageId: 11, kind: 'REFUSED', unloaded: false }) } })
  const driver = createDriverBackend()
  await driver.fetchStopScreen('1')
  await driver.reportIssue('1', { stopNumber: 2, packageInstanceId: '11', kind: 'refused', note: 'Khách không nhận' })
  expect(writes(backend.calls)).toStrictEqual([['/api/driver/packages/11/issues', { kind: 'REFUSED', note: 'Khách không nhận' }]])

  vi.unstubAllGlobals()
  backendWith({ 'GET /api/driver/trips/1/current-stop': { body: envelope(stop([{ ...PACKAGE, issueKind: 'REFUSED', issueNote: 'Khách không nhận' }])) } })
  const screen = await driver.fetchStopScreen('1')
  if (screen.kind !== 'stop') throw new Error('phải là điểm đang giao')
  const [refused] = screen.view.items
  expect(refused).toMatchObject({ unloaded: false, returned: true, issue: { kind: 'refused', note: 'Khách không nhận' } })
  expect(screen.view).toMatchObject({ total: 2, issueCount: 1, remaining: 1, verifiable: 1, pendingConfirms: 0 })
})

test('sự cố cho kiện không thuộc điểm đang giao: từ chối, không gọi máy chủ', async () => {
  const backend = backendWith({})
  const failure = await rejection(createDriverBackend().reportIssue('1', { stopNumber: 2, packageInstanceId: '99', kind: 'damaged', note: '' }))
  expect(failure.code).toBe('UNLOAD_CODE_UNMATCHED')
  expect(writes(backend.calls)).toStrictEqual([])
})

test('xác nhận tay: gửi lý do; chờ duyệt thì kiện đã dỡ và chặn hoàn tất; bị từ chối thì kiện về chưa dỡ kèm lý do', async () => {
  const backend = backendWith({ 'POST /api/driver/packages/11/manual-unload': { body: envelope({ id: 3, packageId: 11, status: 'PENDING' }) } })
  const driver = createDriverBackend()
  expect(await driver.manualUnload('1', 2, { packageInstanceId: '11', reason: 'QR_UNREADABLE' })).toStrictEqual({ packageInstanceId: '11' })
  expect(writes(backend.calls)).toStrictEqual([['/api/driver/packages/11/manual-unload', { reason: 'QR_UNREADABLE', note: null }]])

  vi.unstubAllGlobals()
  backendWith({ 'GET /api/driver/trips/1/current-stop': { body: envelope(stop([{ ...PACKAGE, unloaded: true, manualStatus: 'PENDING', manualReason: 'QR_UNREADABLE' }])) } })
  const pending = await driver.fetchStopScreen('1')
  if (pending.kind !== 'stop') throw new Error('phải là điểm đang giao')
  expect(pending.view.items[0]?.verification).toMatchObject({ method: 'MANUAL', manual: { status: 'MANUAL_PENDING', reason: 'QR_UNREADABLE' } })
  expect(pending.view).toMatchObject({ unloadedCount: 1, pendingConfirms: 1 })

  vi.unstubAllGlobals()
  backendWith({
    'GET /api/driver/trips/1/current-stop': { body: envelope(stop([{ ...PACKAGE, manualStatus: 'REJECTED', manualReason: 'OTHER', manualRejectReason: 'Ảnh không khớp' }])) },
  })
  const rejected = await driver.fetchStopScreen('1')
  if (rejected.kind !== 'stop') throw new Error('phải là điểm đang giao')
  expect(rejected.view.items[0]).toMatchObject({ unloaded: false, verification: { manual: { status: 'MANUAL_REJECTED', rejectReason: 'Ảnh không khớp' } } })
  expect(rejected.view).toMatchObject({ unloadedCount: 0, pendingConfirms: 0, verifiable: 2 })
})

test('xác nhận tay kiện đã dỡ: câu riêng nêu mã trên nhãn; còn xác nhận chờ thì hoàn tất điểm giữ mã của máy chủ', async () => {
  backendWith({
    'POST /api/driver/packages/11/manual-unload': { status: 409, body: { success: false, code: 'DUPLICATE_UNLOAD', message: 'đã dỡ' } },
    'POST /api/driver/stops/2/complete': { status: 409, body: { success: false, code: 'MANUAL_CONFIRM_PENDING', message: 'còn chờ' } },
  })
  const driver = createDriverBackend()
  const duplicate = await rejection(driver.manualUnload('1', 2, { packageInstanceId: '11', reason: 'LABEL_DAMAGED' }))
  expect([duplicate.code, duplicate.params]).toStrictEqual(['DUPLICATE_UNLOAD', { code: 'LB-PK-0007' }])
  expect((await rejection(driver.completeStop('1', 2))).code).toBe('MANUAL_CONFIRM_PENDING')
})

const LOAD_PLAN = {
  tripId: 1, tripCode: 'TRIP-20261017-94EE14F0', loadPlanId: 40, licensePlate: '51C-284.19',
  innerLength: 600, innerWidth: 240, innerHeight: 240, doorWidth: null, doorHeight: 220, maxPayloadKg: 5000,
  stops: [{ stopId: 1, stopSequence: 1, stopName: 'Điểm 1', status: 'COMPLETED' }, { stopId: 2, stopSequence: 2, stopName: 'Điểm 2', status: 'ARRIVED' }],
  placements: [
    { placementId: 501, packageId: 11, packageCode: 'BG-11', trackingBarcode: 'LB-PK-0007', posX: 0, posY: 0, posZ: 0, packedLength: 100, packedWidth: 80, packedHeight: 60, rotation: 0, weightKg: 12, stepSequence: 1, unloadOrder: 3, stopSequence: 2, unloaded: false },
    { placementId: 502, packageId: 13, packageCode: null, trackingBarcode: 'LB-PK-0009', posX: 500, posY: 0, posZ: 0, packedLength: 100, packedWidth: 80, packedHeight: 60, rotation: 0, weightKg: 8, stepSequence: 2, unloadOrder: 1, stopSequence: 1, unloaded: true },
  ],
}

test('phương án kho đã xếp: khung 3D theo thứ tự dỡ của máy chủ, kiện đã dỡ đánh dấu; thiếu lòng thùng hoặc điểm giao thì không vẽ', async () => {
  const backend = backendWith({ 'GET /api/driver/trips/1/load-plan': { body: envelope(LOAD_PLAN) } })
  const plan = await createDriverBackend().fetchLoadPlan('1')
  expect(backend.calls.at(-1)?.path).toBe('/api/driver/trips/1/load-plan')
  // Cửa chưa khai một chiều: lấy chiều của lòng thùng
  expect(plan.box).toStrictEqual({ innerLengthCm: 600, innerWidthCm: 240, innerHeightCm: 240, doorWidthCm: 240, doorHeightCm: 220 })
  expect(plan.placements.map((item) => [item.id, item.code, item.unloadOrder, item.unloaded])).toStrictEqual([['501', 'BG-11', 3, false], ['502', 'LB-PK-0009', 1, true]])

  const scene = driverServerScene(plan)
  if (scene === null) throw new Error('phải vẽ được')
  expect(scene.model.isMockResult).toBe(false)
  expect(scene.model.placements.map((item) => [item.packageId, item.stop, item.unloadingOrder])).toStrictEqual([['11', 2, 3], ['13', 1, 1]])
  const doneCodes = scene.model.placements.filter((item) => scene.doneIds.has(item.id)).map((item) => item.packageId)
  expect(doneCodes).toStrictEqual(['13'])

  expect(driverServerScene({ ...plan, box: null })).toBeNull()
  expect(driverServerScene({ ...plan, placements: plan.placements.map((item) => ({ ...item, stopSequence: null })) })).toBeNull()
  expect(driverServerScene({ ...plan, placements: [] })).toBeNull()
})

test('giờ các điểm: đã đến kèm kịp hạn, chưa đến theo GPS rồi theo kế hoạch; điểm đã hoàn tất không có giờ; không MOCK RESULT', async () => {
  backendWith({
    'GET /api/driver/trips/1/stops': {
      body: envelope({
        tripId: 1, status: 'IN_TRANSIT', location: { lat: 10.9, lng: 106.8, source: 'GPS', recordedAt: '2026-10-17T14:00:00' }, refreshMs: 30000,
        stops: [
          { stopSequence: 1, stopName: 'Điểm 1', status: 'COMPLETED', packageCount: 3, plannedArrival: '2026-10-17T13:00:00', actualArrival: '2026-10-17T13:05:00', deadline: null },
          { stopSequence: 2, stopName: 'Điểm 2', status: 'ARRIVED', packageCount: 2, actualArrival: '2026-10-17T14:20:00', deadline: '2026-10-17T14:00:00' },
          { stopSequence: 3, stopName: 'Điểm 3', status: 'PENDING', packageCount: 4, plannedArrival: '2026-10-17T15:00:00', plannedStatus: 'OK', eta: '2026-10-17T15:40:00', etaStatus: 'AT_RISK', deadline: '2026-10-17T16:00:00' },
          { stopSequence: 4, stopName: 'Điểm 4', status: 'PENDING', packageCount: 1, plannedArrival: '2026-10-17T16:30:00', plannedStatus: 'MISSED', eta: null, deadline: '2026-10-17T16:00:00' },
        ],
      }),
    },
  })
  const times = await createDriverBackend().fetchStopTimes('1')
  expect(times.refreshMs).toBe(30000)
  expect(times.stops.map((entry) => [entry.number, entry.done, entry.packageCount])).toStrictEqual([[1, true, 3], [2, false, 2], [3, false, 4], [4, false, 1]])
  const { byStop, sources } = serverStopListTimings(times)
  expect([...byStop.keys()]).toStrictEqual([2, 3, 4])
  // 14:20 giờ Việt Nam, hạn 14:00: đến trễ
  expect(byStop.get(2)?.arrival).toStrictEqual({ at: '2026-10-17T07:20:00.000Z', onTime: false })
  expect(byStop.get(3)?.expected).toStrictEqual({ eta: '2026-10-17T08:40:00.000Z', source: 'GPS', status: 'AT_RISK' })
  expect(byStop.get(4)?.expected).toStrictEqual({ eta: '2026-10-17T09:30:00.000Z', source: 'PLAN', status: 'MISSED' })
  expect(sources).toStrictEqual(['GPS', 'PLAN'])
})
