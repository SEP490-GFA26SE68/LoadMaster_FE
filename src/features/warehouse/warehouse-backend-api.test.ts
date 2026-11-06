import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth, isApiError } from '@/lib/api-client'
import { envelope, stubBackend } from '@/test/fake-backend'
import { serverLoadingView } from './server-loading'
import { serverSessionScene } from './server-session-scene'
import { codeMatches, createWarehouseBackend, type ServerPlacement } from './warehouse-backend-api'

/**
 * Màn kho nối backend (`usesBackend('warehouse')`): mỗi lệnh gọi đúng endpoint của `WarehouseController` và đổi DTO sang kiểu của màn. Máy
 * chủ giữ phiên xếp: danh sách có cả chuyến Đang xếp hàng, phiên đọc lại được kèm kết quả từng kiện. `fetch` giả trả phong bì và DTO theo
 * backend.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['warehouse']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'warehouse',
}))

const TASK = { tripId: 7, tripCode: 'TRIP-20261106-A1', vehicleInfo: 'Isuzu 51C-284.19', totalPackages: 2, loadPlanId: 3, departureTime: '2026-11-06 14:30:00', status: 'PLANNED', executionId: null, executionStatus: null }
const LOADING = { ...TASK, tripId: 8, tripCode: 'TRIP-20261106-B2', departureTime: '2026-11-06 09:00:00', status: 'LOADING', executionId: 4, executionStatus: 'IN_PROGRESS' }
const LOADED = { ...LOADING, tripId: 9, tripCode: 'TRIP-20261106-C3', departureTime: '2026-11-06 08:00:00', executionId: 5, executionStatus: 'COMPLETED' }

const step = (placementId: number, sequence: number, extra: Record<string, unknown> = {}) => ({
  placementId, packageId: placementId * 10, packageName: `Kiện ${placementId}`, packageCode: null, trackingBarcode: `LB-${placementId}`,
  qrToken: `qr-${placementId}`, posX: 10.4, posY: 0, posZ: 0, packedLength: 60, packedWidth: 40, packedHeight: 30, rotation: 0, weightKg: 12.5, sequence,
  stopId: 31, stopSequence: 1, stopName: 'Co.opmart Biên Hoà', status: 'PENDING', ...extra,
})

const SESSION = {
  executionId: 1, loadPlanId: 3, tripId: 7, tripCode: 'TRIP-20261106-A1', vehicleInfo: null, licensePlate: '51C-284.19', vehicleTypeName: 'Isuzu',
  innerLength: 600, innerWidth: 240, innerHeight: 240, doorWidth: null, doorHeight: null, maxPayloadKg: 2500, totalPackages: 2, confirmedCount: 0, deviationCount: 0,
  pendingCount: 2, status: 'IN_PROGRESS', startedAt: '2026-11-06 10:00:00', completedAt: null,
  placements: [step(102, 2), step(101, 1)],
}

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('danh sách: một lượt gọi tasks; trạng thái chuyến và phiên quyết nhóm', async () => {
  const { calls } = stubBackend({ 'GET /api/warehouse/tasks': { body: envelope([TASK, LOADING, LOADED]) } })
  const rows = await createWarehouseBackend().fetchTrips()
  expect(rows.map((row) => [row.id, row.stage])).toEqual([['9', 'loaded'], ['8', 'loading'], ['7', 'waiting']])
  expect(rows[2]).toMatchObject({ code: 'TRIP-20261106-A1', vehicle: 'Isuzu 51C-284.19', packageCount: 2, departureAt: '2026-11-06T07:30:00.000Z' })
  expect(calls.map((call) => call.path)).toEqual(['/api/warehouse/tasks'])
  expect(calls[0]?.query).toEqual({ includeAwaitingReplan: 'true' })
})

test('danh sách: chuyến chờ điều phối tối ưu lại thành nhóm riêng kèm lý do', async () => {
  const stale = { ...TASK, tripId: 11, tripCode: 'TRIP-11', totalPackages: null, loadPlanId: null, status: 'DRAFT', awaitingReplan: true, replanReason: 'STAGING_SHORTAGE' }
  const damaged = { ...stale, tripId: 12, tripCode: 'TRIP-12', status: 'PLANNED', replanReason: 'DAMAGED_PACKAGE' }
  stubBackend({ 'GET /api/warehouse/tasks': { body: envelope([TASK, stale, damaged]) } })
  const rows = await createWarehouseBackend().fetchTrips()
  expect(rows.find((row) => row.id === '11')).toMatchObject({ stage: 'stale', status: 'DRAFT', replanReason: 'shortage', packageCount: null })
  expect(rows.find((row) => row.id === '12')).toMatchObject({ stage: 'stale', status: 'PLANNED', replanReason: 'damaged' })
  expect(rows.find((row) => row.id === '7')).toMatchObject({ stage: 'waiting', replanReason: null })
})

test('mở lại phiên: GET theo chuyến, kiện theo thứ tự xếp, kết quả từng kiện và lòng thùng theo máy chủ', async () => {
  stubBackend({ 'GET /api/warehouse/tasks/8': { body: envelope({ ...SESSION, tripId: 8, placements: [step(102, 2), step(101, 1, { status: 'DEVIATION' })] }) } })
  const session = await createWarehouseBackend().fetchSession('8')
  expect(session.placements.map((placement) => placement.id)).toEqual(['101', '102'])
  expect(session.placements[0]).toMatchObject({ packageId: '1010', barcode: 'LB-101', qrToken: 'qr-101', x: 10.4, lengthCm: 60, weightKg: 12.5, sequence: 1, stopSequence: 1, stopName: 'Co.opmart Biên Hoà' })
  expect(session.maxPayloadKg).toBe(2500)
  expect(session.outcomes).toEqual({ 101: 'deviation' })
  expect(session.vehicle).toBe('51C-284.19')
  // Loại xe chưa khai cửa: cửa là mặt cắt lòng thùng
  expect(session.box).toEqual({ innerLengthCm: 600, innerWidthCm: 240, innerHeightCm: 240, doorWidthCm: 240, doorHeightCm: 240 })
  expect(serverLoadingView(session).current?.id).toBe('102')
})

test('mở lại phiên của chuyến không còn đang xếp: giữ mã của máy chủ', async () => {
  stubBackend({ 'GET /api/warehouse/tasks/7': { status: 409, body: { success: false, code: 'TRIP_NOT_LOADING', message: 'x' } } })
  const error = await createWarehouseBackend().fetchSession('7').catch((caught: unknown) => caught)
  expect(isApiError(error) && error.code).toBe('TRIP_NOT_LOADING')
})

test('bắt đầu: POST start; chuyến đã bắt đầu ở nơi khác thì mở lại phiên đó', async () => {
  const first = stubBackend({ 'POST /api/warehouse/tasks/7/start': { body: envelope(SESSION) } })
  expect((await createWarehouseBackend().start('7')).placements).toHaveLength(2)
  expect(first.calls.map((call) => call.path)).toEqual(['/api/warehouse/tasks/7/start'])

  const again = stubBackend({
    'POST /api/warehouse/tasks/7/start': { status: 409, body: { success: false, code: 'TRIP_ALREADY_LOADING', message: 'x' } },
    'GET /api/warehouse/tasks/7': { body: envelope({ ...SESSION, placements: [step(101, 1, { status: 'CONFIRMED' }), step(102, 2)] }) },
  })
  expect((await createWarehouseBackend().start('7')).outcomes).toEqual({ 101: 'confirmed' })
  expect(again.calls.map((call) => `${call.method} ${call.path}`)).toEqual(['POST /api/warehouse/tasks/7/start', 'GET /api/warehouse/tasks/7'])
})

test('xác nhận, sai lệch, hoàn tất: đúng endpoint, rồi đọc lại phiên của máy chủ', async () => {
  let current = SESSION
  const { calls } = stubBackend({
    'GET /api/warehouse/tasks/7': () => ({ body: envelope(current) }),
    'POST /api/warehouse/placements/101/confirm': () => {
      current = { ...current, placements: [step(101, 1, { status: 'CONFIRMED' }), step(102, 2)] }
      return { body: envelope({ placementId: 101, status: 'CONFIRMED' }) }
    },
    // Máy chủ đã ghi sai lệch từ lượt trước: không báo lỗi, đọc lại phiên
    'POST /api/warehouse/placements/102/deviation': () => {
      current = { ...current, placements: [step(101, 1, { status: 'CONFIRMED' }), step(102, 2, { status: 'DEVIATION' })] }
      return { status: 409, body: { success: false, code: 'DEVIATION_ALREADY_RECORDED', message: 'x' } }
    },
    'POST /api/warehouse/tasks/7/complete': () => {
      current = { ...current, status: 'COMPLETED' }
      return { body: envelope({ tripId: 7, totalPackages: 2, totalDeviations: 1 }) }
    },
  })
  const backend = createWarehouseBackend()
  expect((await backend.confirm('7', '101')).outcomes).toEqual({ 101: 'confirmed' })
  const afterDeviation = await backend.deviation('7', '102', { x: 12.6, y: 0.4, z: 0, reason: '  vướng vách  ' })
  expect(calls.find((call) => call.path.endsWith('/deviation'))?.body).toEqual({ actualPosX: 13, actualPosY: 0, actualPosZ: 0, reason: 'vướng vách' })
  expect(serverLoadingView(afterDeviation)).toMatchObject({ done: 2, total: 2, current: undefined })
  expect((await backend.complete('7')).completed).toBe(true)
})

test('hoàn tất khi còn kiện: mã INCOMPLETE_LOADING của máy chủ giữ nguyên; 400 không mã cũng đọc là INCOMPLETE_LOADING', async () => {
  stubBackend({ 'POST /api/warehouse/tasks/7/complete': { status: 400, body: { success: false, code: 'INCOMPLETE_LOADING', message: 'Còn 2 kiện' } } })
  const coded = await createWarehouseBackend().complete('7').catch((caught: unknown) => caught)
  expect(isApiError(coded) && coded.code).toBe('INCOMPLETE_LOADING')
  stubBackend({ 'POST /api/warehouse/tasks/7/complete': { status: 400, body: { success: false, message: 'Còn 2 kiện' } } })
  const bare = await createWarehouseBackend().complete('7').catch((caught: unknown) => caught)
  expect(isApiError(bare) && bare.code).toBe('INCOMPLETE_LOADING')
})

const PLACEMENT: ServerPlacement = {
  id: '1', packageId: '1010', name: 'Kiện', barcode: 'LB-PK-0001', packageCode: 'DH-88', qrToken: '63abd059-f710-4bf5-abe1-a1c120f2c6d9',
  x: 0, y: 0, z: 0, lengthCm: 1, widthCm: 1, heightCm: 1, rotation: 0, weightKg: null, sequence: 1, stopSequence: 1, stopName: null,
}

test('mã quét hoặc gõ khớp mã QR, mã vạch, mã của bên gửi hoặc mã kho kiện, không phân biệt hoa thường', () => {
  expect(codeMatches(PLACEMENT, '63ABD059-F710-4BF5-ABE1-A1C120F2C6D9')).toBe(true)
  expect(codeMatches(PLACEMENT, ' lb-pk-0001 ')).toBe(true)
  expect(codeMatches(PLACEMENT, 'dh-88')).toBe(true)
  expect(codeMatches(PLACEMENT, '1010')).toBe(true)
  expect(codeMatches(PLACEMENT, 'LB-PK-0002')).toBe(false)
  expect(codeMatches(PLACEMENT, '  ')).toBe(false)
})

test('khung 3D: dựng từ lòng thùng, tải trọng và chỗ, khối lượng từng kiện; thiếu lòng thùng hoặc số điểm giao thì không có khung', async () => {
  stubBackend({ 'GET /api/warehouse/tasks/7': { body: envelope({ ...SESSION, placements: [step(101, 1), step(102, 2, { stopSequence: 2, stopName: 'Kho Dĩ An' })] }) } })
  const session = await createWarehouseBackend().fetchSession('7')
  const scene = serverSessionScene(session)
  expect(scene?.model.vehicle).toMatchObject({ innerLengthCm: 600, doorWidthCm: 240, maxPayloadKg: 2500 })
  expect(scene?.model.stops.map((stop) => [stop.number, stop.name, stop.packageCount])).toEqual([[1, 'Co.opmart Biên Hoà', 1], [2, 'Kho Dĩ An', 1]])
  expect(scene?.model.isMockResult).toBe(false)
  const sceneId = scene?.sceneIdOf.get('102')
  expect(sceneId).toBe('LB-102')
  expect(scene?.model.placementById.get(sceneId ?? '')).toMatchObject({ step: 2, stop: 2, weightKg: 12.5, position: { x: 10.4, y: 0, z: 0 } })

  // Máy chủ không trả khối lượng, tải trọng: 0, khung vẫn vẽ
  const bare = serverSessionScene({ ...session, maxPayloadKg: null, placements: session.placements.map((item) => ({ ...item, weightKg: null })) })
  expect(bare?.model.vehicle.maxPayloadKg).toBe(0)
  expect(bare?.model.placementById.get(sceneId ?? '')?.weightKg).toBe(0)

  expect(serverSessionScene({ ...session, box: null })).toBeNull()
  expect(serverSessionScene({ ...session, placements: session.placements.map((item) => ({ ...item, stopSequence: null })) })).toBeNull()
})
