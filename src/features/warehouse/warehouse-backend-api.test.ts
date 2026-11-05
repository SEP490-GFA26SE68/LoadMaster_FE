import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth, isApiError } from '@/lib/api-client'
import { envelope, page, stubBackend } from '@/test/fake-backend'
import { serverLoadingView } from './server-loading'
import { codeMatches, createWarehouseBackend, type ServerLoadingSession, type SessionStore } from './warehouse-backend-api'

/**
 * Màn kho nối backend (`usesBackend('warehouse')`): mỗi lệnh gọi đúng endpoint của `WarehouseController`, đổi DTO sang kiểu của màn và giữ
 * phiên xếp ở tab (backend chỉ trả danh sách kiện lúc bắt đầu). `fetch` giả trả phong bì và DTO theo backend.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['warehouse']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'warehouse',
}))

function memoryStore(initial: Record<string, ServerLoadingSession> = {}): SessionStore {
  let sessions = initial
  return { read: () => sessions, write: (next) => { sessions = next } }
}

const TASK = { tripId: 7, tripCode: 'TRIP-20261106-A1', vehicleInfo: 'Isuzu 51C-284.19', totalPackages: 2, loadPlanId: 3, departureTime: '2026-11-06 14:30:00', status: 'PLANNED' }
const LOADING = { id: 8, tripCode: 'TRIP-20261106-B2', vehicleName: 'Hino', licensePlate: '51D-111.22', departureTime: '2026-11-06T09:00:00', packageCount: 5 }

const step = (placementId: number, sequence: number, barcode: string | null) => ({
  placementId, packageId: placementId * 10, packageName: `Kiện ${placementId}`, trackingBarcode: barcode,
  posX: 10.4, posY: 0, posZ: 0, packedLength: 60, packedWidth: 40, packedHeight: 30, rotation: 0, sequence,
})

const START = {
  executionId: 1, tripId: 7, tripCode: 'TRIP-20261106-A1', vehicleInfo: 'Isuzu 51C-284.19', totalPackages: 2, status: 'IN_PROGRESS',
  startedAt: '2026-11-06 10:00:00', placements: [step(102, 2, 'LB-PK-0002'), step(101, 1, 'lb-pk-0001')],
}

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('danh sách: chuyến chờ xếp từ tasks, chuyến đang xếp từ /api/trips; phiên của tab quyết nhóm', async () => {
  const { calls } = stubBackend({
    'GET /api/warehouse/tasks': { body: envelope([TASK]) },
    'GET /api/trips': { body: page([LOADING, { ...LOADING, id: 9, tripCode: 'TRIP-C3', departureTime: '2026-11-06T08:00:00' }]) },
  })
  const store = memoryStore({ 8: { tripId: '8', code: LOADING.tripCode, vehicle: '', placements: [], outcomes: {}, completed: false }, 99: { tripId: '99', code: 'cũ', vehicle: '', placements: [], outcomes: {}, completed: true } })
  const rows = await createWarehouseBackend(undefined, store).fetchTrips()
  expect(rows.map((row) => [row.id, row.stage])).toEqual([['9', 'elsewhere'], ['8', 'loading'], ['7', 'waiting']])
  expect(rows[1]).toMatchObject({ code: 'TRIP-20261106-B2', vehicle: 'Hino · 51D-111.22', packageCount: 5 })
  expect(rows[2]).toMatchObject({ code: 'TRIP-20261106-A1', vehicle: 'Isuzu 51C-284.19', packageCount: 2, departureAt: '2026-11-06T07:30:00.000Z' })
  expect(calls.find((call) => call.path === '/api/trips')?.query).toMatchObject({ status: 'LOADING' })
  // Phiên của chuyến không còn Đang xếp hàng bị bỏ
  expect(Object.keys(store.read())).toEqual(['8'])
})

test('bắt đầu: giữ phiên theo thứ tự xếp; gọi lại không gọi máy chủ lần hai', async () => {
  const { calls } = stubBackend({ 'POST /api/warehouse/tasks/7/start': { body: envelope(START) } })
  const backend = createWarehouseBackend(undefined, memoryStore())
  const session = await backend.start('7')
  expect(session.placements.map((placement) => placement.id)).toEqual(['101', '102'])
  expect(session.placements[0]).toMatchObject({ packageId: '1010', barcode: 'lb-pk-0001', x: 10.4, lengthCm: 60, sequence: 1 })
  await backend.start('7')
  expect(calls).toHaveLength(1)
  await expect(backend.fetchSession('7')).resolves.toEqual(session)
})

test('bắt đầu: chuyến đã xếp ở nơi khác là phiên không mở lại được', async () => {
  stubBackend({ 'POST /api/warehouse/tasks/7/start': { status: 400, body: { success: false, code: 'TRIP_ALREADY_LOADING', message: 'x' } } })
  const error = await createWarehouseBackend(undefined, memoryStore()).start('7').catch((caught: unknown) => caught)
  expect(isApiError(error) && error.code).toBe('LOADING_SESSION_UNAVAILABLE')
})

test('xác nhận, sai lệch, hoàn tất: đúng endpoint, kết quả ghi vào phiên của tab', async () => {
  const { calls } = stubBackend({
    'POST /api/warehouse/tasks/7/start': { body: envelope(START) },
    'POST /api/warehouse/placements/101/confirm': { body: envelope({ placementId: 101, status: 'CONFIRMED' }) },
    'POST /api/warehouse/placements/102/deviation': { status: 409, body: { success: false, code: 'DEVIATION_ALREADY_RECORDED', message: 'x' } },
    'POST /api/warehouse/tasks/7/complete': { body: envelope({ tripId: 7, totalPackages: 2, totalDeviations: 1 }) },
  })
  const backend = createWarehouseBackend(undefined, memoryStore())
  await backend.start('7')
  await backend.confirm('7', '101')
  // Máy chủ đã ghi sai lệch từ lượt trước: vẫn ghi nhận ở tab
  const afterDeviation = await backend.deviation('7', '102', { x: 12.6, y: 0.4, z: 0, reason: '  vướng vách  ' })
  expect(calls.find((call) => call.path.endsWith('/deviation'))?.body).toEqual({ actualPosX: 13, actualPosY: 0, actualPosZ: 0, reason: 'vướng vách' })
  expect(afterDeviation.outcomes).toEqual({ 101: 'confirmed', 102: 'deviation' })
  expect(serverLoadingView(afterDeviation)).toMatchObject({ done: 2, total: 2, current: undefined })
  const done = await backend.complete('7')
  expect(done.completed).toBe(true)
})

test('hoàn tất khi còn kiện: 400 không mã đọc là INCOMPLETE_LOADING', async () => {
  stubBackend({
    'POST /api/warehouse/tasks/7/start': { body: envelope(START) },
    'POST /api/warehouse/tasks/7/complete': { status: 400, body: { success: false, message: 'Còn 2 kiện' } },
  })
  const backend = createWarehouseBackend(undefined, memoryStore())
  await backend.start('7')
  const error = await backend.complete('7').catch((caught: unknown) => caught)
  expect(isApiError(error) && error.code).toBe('INCOMPLETE_LOADING')
  await expect(backend.fetchSession('7')).resolves.toMatchObject({ completed: false })
})

test('phiên tab không giữ: xác nhận không gọi máy chủ', async () => {
  const { calls } = stubBackend({})
  const error = await createWarehouseBackend(undefined, memoryStore()).confirm('7', '101').catch((caught: unknown) => caught)
  expect(isApiError(error) && error.code).toBe('LOADING_SESSION_UNAVAILABLE')
  expect(calls).toHaveLength(0)
})

test('mã gõ khớp mã vạch hoặc mã kho kiện, không phân biệt hoa thường', () => {
  const placement = { id: '1', packageId: '1010', name: 'Kiện', barcode: 'lb-pk-0001', x: 0, y: 0, z: 0, lengthCm: 1, widthCm: 1, heightCm: 1, rotation: 0, sequence: 1 }
  expect(codeMatches(placement, ' LB-PK-0001 ')).toBe(true)
  expect(codeMatches(placement, '1010')).toBe(true)
  expect(codeMatches(placement, 'LB-PK-0002')).toBe(false)
  expect(codeMatches(placement, '  ')).toBe(false)
})
