import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend } from '@/test/fake-backend'
import { fetchJobPlans, fetchTripLoadPlans } from './load-plans-backend-api'

/**
 * Điểm J của phương án và lý do đặt của từng chỗ xếp (dịch vụ tối ưu chấm sau cờ `PLAN_SCORE_J`): đọc theo mã, bỏ mã lạ, giữ nguyên mã hồ
 * sơ lạ; máy chủ không trả thì kiểu của màn không có khoá nào — màn không vẽ gì.
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

const BOX = { packageId: 301, packageCode: 'PK-301', weightKg: '20', posX: '0', posY: '0', posZ: '0', packedLength: '100', packedWidth: '50',
  packedHeight: '40', rotationType: 1, stepSequence: 1, stopId: 91, stopSequence: 1 }

const PLAN = (id: number, label: string, extra: object = {}, placements: readonly object[] = [{ ...BOX, id: id * 10 }]) => ({
  id, tripId: 42, jobUuid: 'job-1', objective: null, candidateLabel: label, algorithmName: 'EP_DBLF', computationMs: null,
  volumeUtilization: '0.6', weightUtilization: null, approved: false, approvedByName: null, rehandlingCount: 0, placements, unplaced: [],
  ...extra,
})

test('điểm J: hồ sơ, trọng số tạm, hai khoản cộng, khoản trừ theo mã — mã lạ và khoản thiếu số bị bỏ', async () => {
  stubBackend({
    'GET /api/trips/optimization-jobs/job-1/plans': { body: envelope([PLAN(1, 'A', {
      candidateProfile: 'A',
      planScore: { profile: 'A', profileName: 'Max volume', assumedWeights: true, j: '5.17', uVol: '0.625', uN: '0.9', wVol: '0.6', wN: '0.4',
        components: [
          { code: 'S3', name: 'Axle', value: null, weight: '0.1', contribution: null, computed: false },
          { code: 'S1', name: 'Rehandling', value: '0.25', weight: '0.3', contribution: '-7.5', computed: true },
          { code: 'S9', name: 'New', value: '0.1', weight: '0.1', contribution: '-1', computed: true },
          { code: 'S2', name: 'Lateral', value: null, weight: '0.1', contribution: null, computed: true },
        ] },
    })]) },
  })
  const [plan] = await fetchJobPlans('job-1')
  expect(plan?.score).toEqual({
    profile: 'A', assumedWeights: true, j: 5.17, volume: { ratio: 0.625, weight: 0.6 }, count: { ratio: 0.9, weight: 0.4 },
    components: [
      { code: 'S1', computed: true, value: 0.25, weight: 0.3, contribution: -7.5 },
      { code: 'S3', computed: false },
    ],
  })
})

test('hồ sơ lạ giữ nguyên mã; không có hồ sơ thì lấy hồ sơ của ứng viên; J không đọc được thì không có điểm', async () => {
  stubBackend({
    'GET /api/trips/optimization-jobs/job-1/plans': { body: envelope([
      PLAN(1, 'A', { planScore: { profile: 'X9', j: 3 } }),
      PLAN(2, 'B', { candidateProfile: 'B', planScore: { j: '1.5', uVol: '0.5' } }),
      PLAN(3, 'C', { candidateProfile: 'C', planScore: { profile: 'C', j: null } }),
    ]) },
  })
  const [a, b, c] = await fetchJobPlans('job-1')
  expect(a?.score).toMatchObject({ profile: 'X9', assumedWeights: false, j: 3 })
  expect(b?.score).toEqual({ profile: 'B', assumedWeights: false, j: 1.5, volume: null, count: null, components: [] })
  expect(c).not.toHaveProperty('score')
})

test('ứng viên trùng cách xếp nói trùng với ứng viên nào; chính mình hay nhãn lạ thì bỏ', async () => {
  stubBackend({
    'GET /api/trips/optimization-jobs/job-1/plans': { body: envelope([
      PLAN(1, 'A', { duplicateOf: 'Z' }), PLAN(2, 'B', { duplicateOf: 'A' }), PLAN(3, 'C', { duplicateOf: 'C' }),
    ]) },
  })
  const plans = await fetchJobPlans('job-1')
  expect(plans.map((plan) => plan.duplicateOf ?? null)).toEqual([null, 'A', null])
  expect(plans.filter((plan) => 'duplicateOf' in plan)).toHaveLength(1)
})

test('lý do đặt và số đo của chỗ xếp: mã lạ, trùng, ZONE_STOP_0 bị bỏ; σ null là không nhận tải trên mặt; số ngoài khoảng bị bỏ', async () => {
  stubBackend({
    'GET /api/trips/42/load-plans': { body: envelope({ tripId: 42, approvedPlanId: null, plans: [PLAN(1, 'A', {}, [
      { ...BOX, id: 11, reasonCodes: ['ZONE_STOP_2', 'HEAVY_LOW', 'NEW_CODE', 'ZONE_STOP_0', 'HEAVY_LOW'],
        stackPressureKgM2: '120', topLoadCapacityKgM2: null, supportRatio: '0.85', distanceToDoorCm: '120.04' },
      { ...BOX, id: 12, reasonCodes: ['PINNED'], stackPressureKgM2: '0', topLoadCapacityKgM2: '800', supportRatio: '1.4', distanceToDoorCm: '-3' },
      { ...BOX, id: 13, reasonCodes: ['NEW_CODE'], stackPressureKgM2: null, topLoadCapacityKgM2: '800', supportRatio: null, distanceToDoorCm: null },
      { ...BOX, id: 14, stackPressureKgM2: '50' },
    ])] }) },
  })
  const { plans: [plan] } = await fetchTripLoadPlans('42')
  const [full, pinned, unknown, pressureOnly] = plan?.placements ?? []
  expect(full?.why).toEqual({
    reasons: [{ kind: 'ZONE_STOP', stop: 2 }, { kind: 'HEAVY_LOW' }],
    stack: { pressureKgM2: 120, capacityKgM2: null }, supportRatio: 0.85, distanceToDoorCm: 120,
  })
  expect(pinned?.why).toEqual({ reasons: [{ kind: 'PINNED' }], stack: { pressureKgM2: 0, capacityKgM2: 800 } })
  expect(unknown).not.toHaveProperty('why')
  expect(pressureOnly?.why).toEqual({ reasons: [], stack: { pressureKgM2: 50 } })
})

test('máy chủ chưa chấm (cờ tắt, máy chủ cũ): phương án và chỗ xếp không có khoá mới nào', async () => {
  stubBackend({
    'GET /api/trips/optimization-jobs/job-1/plans': { body: envelope([PLAN(1, 'A', { candidateProfile: null, duplicateOf: null, planScore: null })]) },
  })
  const [plan] = await fetchJobPlans('job-1')
  expect(plan).not.toHaveProperty('score')
  expect(plan).not.toHaveProperty('duplicateOf')
  expect(plan?.placements[0]).not.toHaveProperty('why')
})
