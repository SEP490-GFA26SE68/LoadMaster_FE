import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend } from '@/test/fake-backend'
import { fetchJobPlans, fetchOptimizationJob, fetchTripLoadPlans, startLoadingOptimization } from './load-plans-backend-api'
import { approveBackendLoadPlan } from '@/features/viewer3d/viewer-backend-api'
import { removeBackendRequirement, cancelBackendTrip, updateBackendTrip } from '@/features/trips/trip-edit-backend-api'

/**
 * Chuyến và phương án xếp hàng nối backend (`usesBackend('trips')`): mỗi hàm gọi đúng endpoint, đổi DTO camelCase của máy chủ sang kiểu
 * của màn; số máy chủ không trả là `null`, không phải 0.
 */
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

const PLAN = (id: number, label: string | null, objective: string | null) => ({
  id, tripId: 42, jobUuid: 'job-1', objective, candidateLabel: label, algorithmName: 'EP_DBLF', computationMs: 840,
  volumeUtilization: '0.625', weightUtilization: null, approved: false, approvedByName: null, cogX: null, cogY: null, cogZ: null,
  frontAxleLoad: null, rearAxleLoad: null, rehandlingCount: 2,
  placements: [{ id: id * 10, packageId: 301, packageCode: 'PK-301', weightKg: '20.5', posX: '0', posY: '0', posZ: '0',
    packedLength: '100', packedWidth: '50', packedHeight: '40', rotationType: 1, stepSequence: 1, stopId: 91, stopSequence: 1 }],
  unplaced: [{ packageId: 302, trackingBarcode: 'BC-302', reason: 'OUT_OF_SPACE' }],
})

test('chạy tối ưu gửi một lần chạy và đọc trạng thái job tới khi xong', async () => {
  const backend = stubBackend({
    'POST /api/trips/42/optimize-loading': { body: envelope({ jobId: 'job-1', tripId: 42 }) },
    'GET /api/trips/optimization-jobs/job-1': { body: envelope({ jobId: 'job-1', status: 'NO_SOLUTION', computationMs: 1200, packedPlanCount: 0 }) },
  })
  await expect(startLoadingOptimization('42')).resolves.toEqual({ jobId: 'job-1' })
  await expect(fetchOptimizationJob('job-1')).resolves.toMatchObject({ status: 'NO_SOLUTION', finished: true, computationMs: 1200, packedPlanCount: 0 })
  expect(backend.calls.map((call) => `${call.method} ${call.path}`)).toEqual(['POST /api/trips/42/optimize-loading', 'GET /api/trips/optimization-jobs/job-1'])
})

test('trạng thái cũ TIMEOUT đọc là FAILED; job đang chạy chưa xong', async () => {
  stubBackend({
    'GET /api/trips/optimization-jobs/a': { body: envelope({ jobId: 'a', status: 'TIMEOUT' }) },
    'GET /api/trips/optimization-jobs/b': { body: envelope({ jobId: 'b', status: 'RUNNING' }) },
  })
  await expect(fetchOptimizationJob('a')).resolves.toMatchObject({ status: 'FAILED', finished: true, packedPlanCount: null })
  await expect(fetchOptimizationJob('b')).resolves.toMatchObject({ status: 'RUNNING', finished: false })
})

test('phương án của một lần chạy theo thứ tự A · B · C, kèm mục tiêu; số vắng là null', async () => {
  stubBackend({
    'GET /api/trips/optimization-jobs/job-1/plans': { body: envelope([PLAN(3, 'C', 'MIN_REHANDLING'), PLAN(1, 'A', 'MAX_VOLUME'), PLAN(2, 'B', 'AXLE_BALANCE')]) },
  })
  const plans = await fetchJobPlans('job-1')
  expect(plans.map((plan) => [plan.id, plan.label, plan.objective])).toEqual([['1', 'A', 'MAX_VOLUME'], ['2', 'B', 'AXLE_BALANCE'], ['3', 'C', 'MIN_REHANDLING']])
  const [first] = plans
  expect(first).toMatchObject({ volumePercent: 62.5, payloadPercent: null, frontAxleLoadKg: null, centerOfGravityCm: null, rehandlingCount: 2, computationMs: 840 })
  expect(first?.placements[0]).toMatchObject({ code: 'PK-301', weightKg: 20.5, lengthCm: 100, rotationType: 1, stopId: '91', stopSequence: 1 })
  expect(first?.unplaced).toEqual([{ packageId: '302', code: 'BC-302', reason: 'OUT_OF_SPACE' }])
})

test('phương án của chuyến kèm phương án đã duyệt; Duyệt gọi endpoint của phương án', async () => {
  const backend = stubBackend({
    'GET /api/trips/42/load-plans': { body: envelope({ tripId: 42, approvedPlanId: 2, plans: [PLAN(1, 'A', 'MAX_VOLUME'), PLAN(2, 'B', 'AXLE_BALANCE')] }) },
    'POST /api/load-plans/1/approve': { body: envelope({ ...PLAN(1, 'A', 'MAX_VOLUME'), approved: true, approvedByName: 'Nguyễn Văn An' }) },
  })
  const trip = await fetchTripLoadPlans('42')
  expect(trip.approvedPlanId).toBe('2')
  expect(trip.plans).toHaveLength(2)
  await expect(approveBackendLoadPlan('1')).resolves.toMatchObject({ id: '1', approved: true, approvedByName: 'Nguyễn Văn An' })
  expect(backend.calls.at(-1)).toMatchObject({ method: 'POST', path: '/api/load-plans/1/approve' })
})

test('sửa chuyến chỉ gửi trường đã đổi; bỏ tài xế là unassignDriver; giờ là giờ Việt Nam không múi giờ', async () => {
  const backend = stubBackend({
    'PATCH /api/trips/42': { body: envelope(null) },
    'POST /api/trips/42/cancel': { body: envelope(null) },
    'DELETE /api/trips/42/delivery-requirements/7': { body: envelope(null) },
  })
  await updateBackendTrip('42', { name: '  Tuyến Thủ Đức  ', driverId: null })
  await updateBackendTrip('42', { departureAt: '2026-11-06T01:30:00.000Z', vehicleId: '5', driverId: '9' })
  await cancelBackendTrip('42', ' Khách hoãn giao ')
  await removeBackendRequirement('42', '7')
  expect(backend.calls.map((call) => call.body ?? null)).toEqual([
    { tripName: 'Tuyến Thủ Đức', unassignDriver: true },
    { departureTime: expect.stringMatching(/^2026-11-06T08:30(:00)?$/), vehicleId: 5, driverId: 9 },
    { reason: 'Khách hoãn giao' },
    null,
  ])
  expect(backend.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
    'PATCH /api/trips/42', 'PATCH /api/trips/42', 'POST /api/trips/42/cancel', 'DELETE /api/trips/42/delivery-requirements/7',
  ])
})
