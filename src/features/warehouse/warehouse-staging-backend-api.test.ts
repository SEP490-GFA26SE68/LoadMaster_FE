import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth, isApiError } from '@/lib/api-client'
import { envelope, stubBackend } from '@/test/fake-backend'
import { restingCount, serverLoadingView, serverStagingView } from './server-loading'
import { createWarehouseBackend } from './warehouse-backend-api'

/**
 * Soạn hàng, báo thiếu, xác nhận tay, kiện hỏng và seal của kho khi nhóm `warehouse` nối backend (`WarehouseStagingController`): đúng
 * endpoint, rồi đọc lại phiên của máy chủ; phiên mang tiến độ soạn và xác nhận tay của từng kiện.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['warehouse']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'warehouse',
}))

const step = (placementId: number, sequence: number, extra: Record<string, unknown> = {}) => ({
  placementId, packageId: placementId * 10, packageName: `Kiện ${placementId}`, packageCode: `DH-${placementId}`, trackingBarcode: null,
  qrToken: `qr-${placementId}`, posX: 0, posY: 0, posZ: 0, packedLength: 60, packedWidth: 40, packedHeight: 30, rotation: 0, weightKg: 12.5, sequence,
  stopId: 31, stopSequence: 1, stopName: 'Co.opmart Biên Hoà', status: 'PENDING', staged: false, ...extra,
})

const SESSION = {
  executionId: 1, loadPlanId: 3, tripId: 7, tripCode: 'TRIP-20261106-A1', vehicleInfo: 'Isuzu', innerLength: 600, innerWidth: 240, innerHeight: 240,
  totalPackages: 2, status: 'IN_PROGRESS', startedAt: '2026-11-06 10:00:00', stagingRequired: true, stagingComplete: false, pendingManualCount: 0,
  placements: [step(101, 1), step(102, 2)],
}

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('bắt đầu kèm bước soạn hàng; phiên mang tiến độ soạn, báo thiếu và xác nhận tay của từng kiện', async () => {
  const { calls } = stubBackend({
    'POST /api/warehouse/tasks/7/start': {
      body: envelope({
        ...SESSION,
        placements: [
          step(101, 1, { staged: true, stagingMethod: 'QR' }),
          step(102, 2, { shortageStatus: 'OPEN', manualStatus: 'REJECTED', manualStep: 'STAGING', manualRejectReason: ' Không thấy nhãn ' }),
        ],
      }),
    },
  })
  const session = await createWarehouseBackend().start('7')
  expect(calls[0]?.body).toEqual({ staging: true })
  expect(session).toMatchObject({ stagingRequired: true, stagingComplete: false, pendingManual: 0, seal: null })
  expect(session.staging[102]).toEqual({ staged: false, shortage: 'open', manual: { status: 'REJECTED', step: 'STAGING', rejectReason: 'Không thấy nhãn' } })
  const view = serverStagingView(session)
  expect(view).toMatchObject({ total: 2, staged: 1, openShortages: 1 })
  expect(view.pending.map((row) => [row.placement.id, row.shortage, row.rejectReason])).toEqual([['102', 'open', 'Không thấy nhãn']])
})

test('phiên của máy chủ cũ hoặc của app di động: không có bước soạn — coi như đã soạn đủ', async () => {
  const { stagingRequired: _required, stagingComplete: _complete, ...legacy } = SESSION
  stubBackend({ 'GET /api/warehouse/tasks/7': { body: envelope(legacy) } })
  const session = await createWarehouseBackend().fetchSession('7')
  expect(session).toMatchObject({ stagingRequired: false, stagingComplete: true })
})

test('soạn bằng nhãn, xác nhận tay, báo thiếu: đúng endpoint và thân, rồi đọc lại phiên', async () => {
  const { calls } = stubBackend({
    'POST /api/warehouse/tasks/7/staging/packages/1010/confirm': { body: envelope({ packageId: 1010, alreadyStaged: true, stagingComplete: false }) },
    'POST /api/warehouse/tasks/7/staging/packages/1020/manual': { body: envelope({ packageId: 1020, method: 'MANUAL' }) },
    'POST /api/warehouse/tasks/7/staging/packages/1020/shortage': { body: envelope({ id: 5, status: 'OPEN' }) },
    'GET /api/warehouse/tasks/7': { body: envelope(SESSION) },
  })
  const backend = createWarehouseBackend()
  expect((await backend.stage('7', '1010', 'CODE')).alreadyStaged).toBe(true)
  await backend.stageManually('7', '1020', { reason: 'OTHER', note: '  nhãn rách  ' })
  await backend.reportShortage('7', '1020')
  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
    'POST /api/warehouse/tasks/7/staging/packages/1010/confirm', 'GET /api/warehouse/tasks/7',
    'POST /api/warehouse/tasks/7/staging/packages/1020/manual', 'GET /api/warehouse/tasks/7',
    'POST /api/warehouse/tasks/7/staging/packages/1020/shortage', 'GET /api/warehouse/tasks/7',
  ])
  expect(calls[0]?.body).toEqual({ method: 'CODE' })
  expect(calls[2]?.body).toEqual({ reason: 'OTHER', note: 'nhãn rách' })
})

test('xếp: xác nhận tay chờ duyệt chặn hoàn tất; bị từ chối thì kiện kế tiếp mang lý do; kiện hỏng bỏ lại là đã xong', async () => {
  const { calls } = stubBackend({
    'POST /api/warehouse/placements/101/manual': { body: envelope({ id: 9, step: 'LOADING', status: 'PENDING' }) },
    'GET /api/warehouse/tasks/7': {
      body: envelope({
        ...SESSION, stagingComplete: true, pendingManualCount: 1,
        placements: [
          step(101, 1, { status: 'CONFIRMED', staged: true, manualStatus: 'PENDING', manualStep: 'LOADING' }),
          step(102, 2, { status: 'DAMAGED', staged: true }),
          step(103, 3, { staged: true, manualStatus: 'REJECTED', manualStep: 'LOADING', manualRejectReason: 'Sai kiện' }),
        ],
      }),
    },
  })
  const session = await createWarehouseBackend().confirmManually('7', '101', { reason: 'QR_UNREADABLE' })
  expect(calls[0]?.body).toEqual({ reason: 'QR_UNREADABLE' })
  expect(session.pendingManual).toBe(1)
  const view = serverLoadingView(session)
  expect(view.rows.map((row) => [row.state, row.manualPending])).toEqual([['confirmed', true], ['damaged', false], ['current', false]])
  expect(view).toMatchObject({ done: 2, step: 3, currentRejected: { status: 'REJECTED', rejectReason: 'Sai kiện' } })
})

test('kiện hỏng: bỏ lại kho thì đọc lại phiên; chuyến về lập kế hoạch thì không đọc phiên nào', async () => {
  const left = stubBackend({
    'POST /api/warehouse/placements/101/damaged': { body: envelope({ placementId: 101, outcome: 'LEFT_OUT', restingCount: 0, tripStatus: 'LOADING' }) },
    'GET /api/warehouse/tasks/7': { body: envelope({ ...SESSION, placements: [step(101, 1, { status: 'DAMAGED' }), step(102, 2)] }) },
  })
  const result = await createWarehouseBackend().damaged('7', '101')
  expect(result.outcome === 'leftOut' && result.session.outcomes).toEqual({ 101: 'damaged' })
  expect(left.calls).toHaveLength(2)

  const replanned = stubBackend({
    'POST /api/warehouse/placements/101/damaged': { body: envelope({ placementId: 101, outcome: 'REPLANNED', restingCount: 2, tripStatus: 'PLANNED' }) },
  })
  expect(await createWarehouseBackend().damaged('7', '101')).toEqual({ outcome: 'replanned', resting: 2 })
  expect(replanned.calls.map((call) => call.path)).toEqual(['/api/warehouse/placements/101/damaged'])
})

test('seal: gửi số đã bỏ khoảng trắng, phiên mang số seal; máy chủ từ chối thì giữ mã', async () => {
  const { calls } = stubBackend({
    'POST /api/warehouse/tasks/7/seal': { body: envelope({ tripId: 7, sealNumber: 'SEAL-42' }) },
    'GET /api/warehouse/tasks/7': { body: envelope({ ...SESSION, status: 'COMPLETED', sealNumber: 'SEAL-42', sealedAt: '2026-11-06 11:00:00', sealedByName: 'Kho A' }) },
  })
  const session = await createWarehouseBackend().seal('7', '  SEAL-42 ')
  expect(calls[0]?.body).toEqual({ sealNumber: 'SEAL-42' })
  expect(session.seal).toEqual({ number: 'SEAL-42', at: '2026-11-06T04:00:00.000Z', byName: 'Kho A' })

  stubBackend({ 'POST /api/warehouse/tasks/7/seal': { status: 409, body: { success: false, code: 'SEAL_NOT_ALLOWED', message: 'x' } } })
  const error = await createWarehouseBackend().seal('7', 'S-1').catch((caught: unknown) => caught)
  expect(isApiError(error) && error.code).toBe('SEAL_NOT_ALLOWED')
})

test('số kiện tựa lên: đáy chạm nóc và chồng lên nhau trên mặt sàn, như máy chủ đếm', async () => {
  stubBackend({
    'GET /api/warehouse/tasks/7': {
      body: envelope({
        ...SESSION,
        placements: [
          step(101, 1),
          step(102, 2, { posX: 10, posY: 10, posZ: 30, packedLength: 30, packedWidth: 20 }),
          step(103, 3, { posX: 59.8, posZ: 30 }),
          step(104, 4, { posX: 100 }),
        ],
      }),
    },
  })
  const session = await createWarehouseBackend().fetchSession('7')
  const [bottom, top] = session.placements
  // 103 chỉ chạm mép 0,2 cm — dưới dung sai, không tính
  expect(bottom && restingCount(session, bottom)).toBe(1)
  expect(top && restingCount(session, top)).toBe(0)
})
