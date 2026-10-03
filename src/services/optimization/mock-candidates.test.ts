import { expect, test } from 'vitest'
import { SPEC_CARTON_A } from '@/domain/fixtures/spec-samples'
import { optimizationResultSchema, type CargoPackage, type OptimizationRequest, type OptimizationResult, type PlanObjective, type VehicleConfig } from '@/domain/models'
import { handleWorkerRequest, MockOptimizationService, runMockCandidates, type CandidateProgress, type WorkerResponse } from '@/services/optimization'
import { EMPTY_TRUCK_6M } from '@/test/placements'

/**
 * Thùng 600 × 240 × 250 cm không vật cản. Trục trước ở −100 cm, trục sau ở 400 cm (cách nhau 500 cm); xe rỗng hai nhóm trục cùng mức
 * dùng (1.000 / 4.000 = 2.000 / 8.000), nên điểm cân tải của hàng là (8.000 × 400 − 4.000 × 100) / 12.000 = 233,33 cm.
 */
const TRUCK: VehicleConfig = {
  ...EMPTY_TRUCK_6M,
  axles: [
    { id: 'AXLE-01', name: 'Trục trước', positionXCm: -100, emptyLoadKg: 1000, maxLoadKg: 4000 },
    { id: 'AXLE-02', name: 'Trục sau', positionXCm: 400, emptyLoadKg: 2000, maxLoadKg: 8000 },
  ],
}

/** Khối 100 cm không xếp chồng: mỗi vách hai khối trên sàn (y 0 và y 100), nên mỗi điểm giao bốn khối chiếm 200 cm chiều dài thùng. */
function cubes(id: string, weightKg: number, deliveryStop: number): CargoPackage {
  return {
    ...SPEC_CARTON_A, id, name: id, lengthCm: 100, widthCm: 100, heightCm: 100, weightKg, quantity: 4, allowedOrientations: ['LWH'],
    stackable: false, maxTopLoadKg: 0, maxStackCount: undefined, deliveryStop, mustLoad: true,
  }
}

/** Điểm 2 (giao sau) 4 × 100 kg, điểm 1 (giao trước) 4 × 30 kg: 520 kg, thể tích hai điểm bằng nhau nên vùng là 0..295 và 305..600. */
const REQUEST: OptimizationRequest = {
  vehicle: TRUCK,
  packages: [cubes('LIGHT', 30, 1), cubes('HEAVY', 100, 2)],
  settings: { method: 'MOCK', timeLimitSeconds: 10, randomSeed: 7, enforceLifo: true, prioritizeLowCenterOfGravity: false },
}

function run(request: OptimizationRequest = REQUEST) {
  return runMockCandidates(request, { clock: () => 0 })
}

function resultOf(objective: PlanObjective, request: OptimizationRequest = REQUEST): OptimizationResult {
  const plan = run(request).plans.find((item) => item.objective === objective)
  if (plan === undefined) throw new Error(`Không có phương án ${objective}`)
  return plan.result
}

/** Khoảng theo X mà các kiện của một dòng chiếm. */
function span(result: OptimizationResult, packageId: string): [number, number] {
  const boxes = result.placements.filter(({ packageInstanceId }) => packageInstanceId.startsWith(`${packageId}-`))
  return [Math.min(...boxes.map(({ xCm }) => xCm)), Math.max(...boxes.map(({ xCm, placedLengthCm }) => xCm + placedLengthCm))]
}

test('one job returns plans A, B, C in order, each a completed mock result under its own job id', () => {
  const { jobId, plans } = run()
  expect(plans.map(({ objective, result }) => ({
    objective, jobId: result.jobId, status: result.status, isMockResult: result.isMockResult, method: result.method,
    valid: optimizationResultSchema.safeParse(result).success, placed: result.metrics.placedCount, unplaced: result.unplacedPackages,
  }))).toStrictEqual([
    { objective: 'MAX_VOLUME', jobId: `${jobId}-A`, status: 'COMPLETED', isMockResult: true, method: 'MOCK', valid: true, placed: 8, unplaced: [] },
    { objective: 'AXLE_BALANCE', jobId: `${jobId}-B`, status: 'COMPLETED', isMockResult: true, method: 'MOCK', valid: true, placed: 8, unplaced: [] },
    { objective: 'MIN_REHANDLING', jobId: `${jobId}-C`, status: 'COMPLETED', isMockResult: true, method: 'MOCK', valid: true, placed: 8, unplaced: [] },
  ])
  expect(jobId).toMatch(/^MOCK-7-[0-9a-f]{8}$/)
})

test('max volume packs one tight lane against the front wall, later stop deepest', () => {
  const result = resultOf('MAX_VOLUME')
  expect([span(result, 'HEAVY'), span(result, 'LIGHT')]).toStrictEqual([[0, 200], [200, 400]])
  // trọng tâm (400 × 100 + 120 × 300) / 520 = 146,15: trước 1.000 + 520 × (400 − 146,15) / 500 = 1.264; sau 2.000 + 256 = 2.256
  expect([result.metrics.frontAxleLoadKg, result.metrics.rearAxleLoadKg]).toStrictEqual([1264, 2256])
  // hai khối của điểm 1 ở x 200..300 có tâm 250, nằm trong vùng 0..295 của điểm 2
  expect(result.metrics.rehandlingCount).toBe(2)
})

test('axle balance moves the same lane toward the door until both axle groups are used alike', () => {
  const result = resultOf('AXLE_BALANCE')
  // lùi 85 cm: trọng tâm 231,15 — mốc lưới 5 cm gần điểm cân 233,33 nhất (lùi 90 thì 236,15)
  expect([span(result, 'HEAVY'), span(result, 'LIGHT')]).toStrictEqual([[85, 285], [285, 485]])
  // trước 1.000 + 520 × (400 − 231,15) / 500 = 1.175,6 (29,39 %); sau 2.000 + 344,4 = 2.344,4 (29,31 %)
  expect([result.metrics.frontAxleLoadKg, result.metrics.rearAxleLoadKg]).toStrictEqual([1175.6, 2344.4])
  expect(result.metrics.rehandlingCount).toBe(0)
})

test('least rehandling keeps every stop inside its own zone', () => {
  const result = resultOf('MIN_REHANDLING')
  expect(result.stopZones).toStrictEqual([
    { id: 'ZONE-1', stopId: 1, startXCm: 305, endXCm: 600 },
    { id: 'ZONE-2', stopId: 2, startXCm: 0, endXCm: 295 },
  ])
  expect([span(result, 'HEAVY'), span(result, 'LIGHT')]).toStrictEqual([[0, 200], [305, 505]])
  // trọng tâm (400 × 100 + 120 × 405) / 520 = 170,38: trước 1.000 + 238,8; sau 2.000 + 281,2
  expect([result.metrics.frontAxleLoadKg, result.metrics.rearAxleLoadKg]).toStrictEqual([1238.8, 2281.2])
  expect(result.metrics.rehandlingCount).toBe(0)
})

test('the three plans load the same cargo: same volume and payload, only the layout differs', () => {
  const metrics = run().plans.map(({ result }) => [result.metrics.usedVolumeCm3, result.metrics.usedPayloadKg])
  expect(metrics).toStrictEqual([[8_000_000, 520], [8_000_000, 520], [8_000_000, 520]])
})

test('a vehicle without axle data balances by centring the cargo along the box', () => {
  const bare = { ...REQUEST, vehicle: EMPTY_TRUCK_6M }
  const [compact, balanced] = [resultOf('MAX_VOLUME', bare), resultOf('AXLE_BALANCE', bare)]
  expect(span(compact, 'HEAVY')).toStrictEqual([0, 200])
  // trọng tâm cách đầu khối hàng 146,15 cm: lùi 155 cm đưa nó tới 301,15 — mốc lưới 5 cm gần giữa thùng (300) nhất (lùi 150 còn 296,15)
  expect([span(balanced, 'HEAVY'), span(balanced, 'LIGHT')]).toStrictEqual([[155, 355], [355, 555]])
  expect(balanced.metrics.frontAxleLoadKg).toBeUndefined()
})

test('cargo that fills the whole floor leaves nothing to move: A and B are the same layout, told apart only by job id', () => {
  // 12 khối cho mỗi điểm: 24 khối × 100 cm = 12 vách = 600 cm, kín chiều dài thùng
  const full: OptimizationRequest = { ...REQUEST, packages: [{ ...cubes('LIGHT', 30, 1), quantity: 12 }, { ...cubes('HEAVY', 100, 2), quantity: 12 }] }
  const [a, b] = [resultOf('MAX_VOLUME', full), resultOf('AXLE_BALANCE', full)]
  expect(b.placements).toStrictEqual(a.placements)
  expect(b.metrics).toStrictEqual(a.metrics)
  expect([a.jobId.at(-1), b.jobId.at(-1)]).toStrictEqual(['A', 'B'])
})

test('same request and seed give the same three plans; a fake clock makes the run times deterministic', () => {
  const timed = () => {
    let now = 0
    return runMockCandidates(REQUEST, { clock: () => (now += 5) })
  }
  expect(timed()).toStrictEqual(timed())
  expect(run()).toStrictEqual(run())
  expect(run().plans.map(({ result }) => result.metrics.runtimeMs)).toStrictEqual([0, 0, 0])
  expect(timed().plans.every(({ result }) => result.metrics.runtimeMs > 0)).toBe(true)
})

test('a request the mock cannot run fails all three plans', () => {
  const broken = { ...REQUEST, vehicle: { ...TRUCK, innerLengthCm: -1 } }
  expect(run(broken).plans.map(({ objective, result }) => [objective, result.status, result.placements.length, result.metrics.unplacedCount])).toStrictEqual([
    ['MAX_VOLUME', 'FAILED', 0, 0],
    ['AXLE_BALANCE', 'FAILED', 0, 0],
    ['MIN_REHANDLING', 'FAILED', 0, 0],
  ])
})

test('progress is reported for every plan, in order A, B, C, each up to every instance', () => {
  const seen: CandidateProgress[] = []
  runMockCandidates(REQUEST, { clock: () => 0, onProgress: (progress) => seen.push(progress) })
  expect(seen).toStrictEqual([
    { objective: 'MAX_VOLUME', placed: 8, total: 8 },
    { objective: 'AXLE_BALANCE', placed: 8, total: 8 },
    { objective: 'MIN_REHANDLING', placed: 8, total: 8 },
  ])
})

test('the service and the worker handler return the same three plans as the pure mock', async () => {
  const fromService = await new MockOptimizationService(() => 0).optimizeCandidates(REQUEST)
  const posted: WorkerResponse[] = []
  handleWorkerRequest({ type: 'start-candidates', request: REQUEST }, (response) => posted.push(response))
  const last = posted.at(-1)
  const stripTime = (result: OptimizationResult) => ({ ...result, metrics: { ...result.metrics, runtimeMs: 0 } })
  expect(fromService).toStrictEqual(run())
  expect(last?.type === 'candidates' ? last.run.plans.map(({ result }) => stripTime(result)) : undefined).toStrictEqual(run().plans.map(({ result }) => result))
  expect(posted.filter(({ type }) => type === 'candidate-progress')).toHaveLength(3)
})
