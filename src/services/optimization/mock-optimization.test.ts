import { describe, expect, test } from 'vitest'
import { createConstraintEngine } from '@/domain/constraints'
import { SPEC_CARTON_A, SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import type { CargoPackage, OptimizationRequest, VehicleConfig } from '@/domain/models'
import { MockOptimizationService, runMockOptimization, type OptimizationProgress } from '@/services/optimization'

const SPEC_REQUEST: OptimizationRequest = {
  vehicle: SPEC_TRUCK_6M,
  packages: [SPEC_CARTON_A],
  settings: { method: 'MOCK', timeLimitSeconds: 10, randomSeed: 42, enforceLifo: true, prioritizeLowCenterOfGravity: false },
}

/** A clock that advances 5 ms per reading, so runtimeMs is deterministic. */
function fakeClock(): () => number {
  let now = 1_000
  return () => (now += 5)
}

function run(request: OptimizationRequest) {
  return runMockOptimization(request, { clock: fakeClock() })
}

test('the Spec §12 request completes as a mock result with all four Carton A placed and no error in the constraint engine', () => {
  const result = run(SPEC_REQUEST)
  const { issues } = createConstraintEngine({ ...SPEC_REQUEST, placements: result.placements }).evaluateAll()
  expect({
    status: result.status,
    method: result.method,
    isMockResult: result.isMockResult,
    placed: result.placements.map(({ packageInstanceId }) => packageInstanceId).sort(),
    unplaced: result.unplacedPackages,
    errors: issues.filter(({ severity }) => severity === 'error'),
  }).toStrictEqual({
    status: 'COMPLETED',
    method: 'MOCK',
    isMockResult: true,
    placed: ['PKG-001-01', 'PKG-001-02', 'PKG-001-03', 'PKG-001-04'],
    unplaced: [],
    errors: [],
  })
})

test('Carton A stacks three high beside the wheel arch (maxStackCount 3), the fourth opens a second column, metrics follow', () => {
  const { placements, metrics } = run(SPEC_REQUEST)
  // the arch fills y 0..30 at x 0..120, so the first column starts at y = 30; the second at y = 30 + 60
  expect({
    spots: placements.map(({ xCm, yCm, zCm, orientation }) => [xCm, yCm, zCm, orientation]),
    metrics: { ...metrics, runtimeMs: 'fake' },
  }).toStrictEqual({
    spots: [[0, 30, 0, 'LWH'], [0, 30, 45, 'LWH'], [0, 30, 90, 'LWH'], [0, 90, 0, 'LWH']],
    metrics: {
      totalVehicleVolumeCm3: 36_000_000,
      usedVolumeCm3: 1_296_000, // 4 × 120 × 60 × 45
      volumeUtilizationPercent: 3.6,
      maxPayloadKg: 5000,
      usedPayloadKg: 120,
      payloadUtilizationPercent: 2.4,
      placedCount: 4,
      unplacedCount: 0,
      centerOfGravityCm: { x: 60, y: 75, z: 56.25 }, // centres y 60, 60, 60, 120 and z 22.5, 67.5, 112.5, 22.5
      rehandlingCount: 0, // one stop, one zone over the whole box
      runtimeMs: 'fake',
    },
  })
})

test('orders come from the support relation: the floor carton of column 2 first, then column 1 bottom up; unloading reverses', () => {
  const { placements } = run(SPEC_REQUEST)
  expect(placements.map(({ zCm, yCm, loadingOrder, unloadingOrder }) => [yCm, zCm, loadingOrder, unloadingOrder])).toStrictEqual([
    [30, 0, 2, 4],
    [30, 45, 3, 2],
    [30, 90, 4, 1],
    [90, 0, 1, 3],
  ])
})

test('the same request and seed give the same result; another seed gives another job ID', () => {
  const again = run(SPEC_REQUEST)
  const otherSeed = run({ ...SPEC_REQUEST, settings: { ...SPEC_REQUEST.settings, randomSeed: 7 } })
  expect({ same: again, otherJob: otherSeed.jobId === again.jobId }).toStrictEqual({ same: run(SPEC_REQUEST), otherJob: false })
})

describe('priority decides what gets on board, delivery stops decide where it goes', () => {
  const line = (id: string, deliveryStop: number, priority: number, overrides: Partial<CargoPackage> = {}): CargoPackage => ({
    ...SPEC_CARTON_A,
    id,
    name: `Hàng giao điểm ${deliveryStop}`,
    quantity: 9,
    deliveryStop,
    priority,
    mustLoad: false,
    ...overrides,
  })
  // Nine Carton A fill the first wall three high beside the wheel arch; the next nine fill the second wall in front of them
  const packages = [line('PKG-001', 1, 3), line('PKG-002', 3, 0)]

  test('with enforceLifo the later stop goes in deep first even at a lower priority, so the mock result has no LIFO block', () => {
    const result = run({ ...SPEC_REQUEST, packages })
    const { issues } = createConstraintEngine({ ...SPEC_REQUEST, packages, placements: result.placements }).evaluateAll()
    expect({ placed: result.placements.length, lifo: issues.filter(({ code }) => code.startsWith('LIFO')) }).toStrictEqual({ placed: 18, lifo: [] })
  })

  test('with enforceLifo off, priority also orders positions: the stop 1 cargo takes the deep wall', () => {
    const request = { ...SPEC_REQUEST, packages, settings: { ...SPEC_REQUEST.settings, enforceLifo: false } }
    const deepest = (prefix: string) => Math.min(...run(request).placements.filter(({ packageInstanceId }) => packageInstanceId.startsWith(prefix)).map(({ xCm }) => xCm))
    expect([deepest('PKG-001'), deepest('PKG-002')]).toStrictEqual([0, 120])
  })

  test('with enforceLifo off the zones are not packed by, only measured against: the nine stop 1 cartons in the stop 3 zone are rehandling', () => {
    const { stopZones, metrics, placements } = run({ ...SPEC_REQUEST, packages, settings: { ...SPEC_REQUEST.settings, enforceLifo: false } })
    expect({ zones: stopZones?.map(({ stopId, startXCm, endXCm }) => [stopId, startXCm, endXCm]), sitIn: [...new Set(placements.map(({ stopZoneId }) => stopZoneId))], rehandlingCount: metrics.rehandlingCount })
      .toStrictEqual({ zones: [[1, 305, 600], [3, 0, 295]], sitIn: ['ZONE-3'], rehandlingCount: 9 })
  })

  test('over the payload, the higher priority line keeps its place even though the other line is loaded first by stop', () => {
    // 100 kg van: priority 3 (stop 1, 2 × 30 kg) is chosen first, then one 40 kg carton of priority 0 (stop 3) fits, the other does not
    const heavyLate = line('PKG-001', 3, 0, { quantity: 2, weightKg: 40 })
    const lightEarly = line('PKG-002', 1, 3, { quantity: 2, weightKg: 30 })
    const unplaced = run({ ...SPEC_REQUEST, vehicle: { ...SPEC_TRUCK_6M, maxPayloadKg: 100 }, packages: [heavyLate, lightEarly] }).unplacedPackages
    expect(unplaced.map(({ packageInstanceId, reasonCode }) => [packageInstanceId.slice(0, 7), reasonCode])).toStrictEqual([['PKG-001', 'OVER_PAYLOAD']])
  })
})

describe('packing by delivery-stop zone (FE-5b-02)', () => {
  const openTruck: VehicleConfig = { ...SPEC_TRUCK_6M, obstacles: [] }
  /** 100 × 200 cm on the floor, one per row of the 240 cm wide box, never rotated, nothing on top. */
  const flat = (id: string, deliveryStop: number, heightCm: number, quantity: number): CargoPackage => ({
    ...SPEC_CARTON_A,
    id,
    name: `Hàng giao điểm ${deliveryStop}`,
    lengthCm: 100,
    widthCm: 200,
    heightCm,
    quantity,
    allowedOrientations: ['LWH'],
    stackable: false,
    maxTopLoadKg: 0,
    deliveryStop,
    mustLoad: false,
  })
  const zoned = (packages: CargoPackage[]) => {
    const request = { ...SPEC_REQUEST, vehicle: openTruck, packages }
    const result = run(request)
    const { issues } = createConstraintEngine({ ...request, placements: result.placements }).evaluateAll()
    return {
      zones: result.stopZones,
      spots: result.placements.map(({ packageInstanceId, xCm, stopZoneId }) => [packageInstanceId.slice(0, 7), xCm, stopZoneId]).sort((a, b) => Number(a[1]) - Number(b[1])),
      unplaced: result.unplacedPackages,
      rehandlingCount: result.metrics.rehandlingCount,
      blocking: issues.filter(({ severity }) => severity !== 'warning'),
    }
  }

  test('each stop is packed from the deep edge of its own zone, the last stop deepest; nothing is outside its zone', () => {
    // Hai điểm cùng thể tích trên thùng 600 cm: (600 − 10) / 2 = 295 cm mỗi vùng; điểm 3 ở 0..295, đệm, điểm 1 ở 305..600
    const packages = [{ ...SPEC_CARTON_A, quantity: 9, deliveryStop: 1, mustLoad: false }, { ...SPEC_CARTON_A, id: 'PKG-002', quantity: 9, deliveryStop: 3, mustLoad: false }]
    const result = run({ ...SPEC_REQUEST, packages })
    const starts = (prefix: string) => [...new Set(result.placements.filter(({ packageInstanceId }) => packageInstanceId.startsWith(prefix)).map(({ xCm, stopZoneId }) => `${xCm} ${stopZoneId}`))]
    expect({ zones: result.stopZones, stop1: starts('PKG-001'), stop3: starts('PKG-002'), rehandlingCount: result.metrics.rehandlingCount }).toStrictEqual({
      zones: [{ id: 'ZONE-1', stopId: 1, startXCm: 305, endXCm: 600 }, { id: 'ZONE-3', stopId: 3, startXCm: 0, endXCm: 295 }],
      stop1: ['305 ZONE-1'],
      stop3: ['0 ZONE-3'],
      rehandlingCount: 0,
    })
  })

  test('cargo that does not fit its zone goes into the free tail of the next deeper zone and counts as rehandling', () => {
    // Thể tích 2.000.000 : 600.000 → vùng điểm 2 là 590 × 10 / 13 = 453,8 cm (0..453,8), vùng điểm 1 là 463,8..600 (136,2 cm).
    // Vùng điểm 1 chỉ đủ một tấm 100 cm; hai tấm còn lại xếp ngay sau thùng của điểm 2, trước đệm — vẫn dỡ được trước điểm 2.
    expect(zoned([flat('PKG-001', 1, 10, 3), flat('PKG-002', 2, 100, 1)])).toStrictEqual({
      zones: [{ id: 'ZONE-1', stopId: 1, startXCm: 463.8, endXCm: 600 }, { id: 'ZONE-2', stopId: 2, startXCm: 0, endXCm: 453.8 }],
      spots: [['PKG-002', 0, 'ZONE-2'], ['PKG-001', 100, 'ZONE-2'], ['PKG-001', 200, 'ZONE-2'], ['PKG-001', 463.8, 'ZONE-1']],
      unplaced: [],
      rehandlingCount: 2,
      blocking: [],
    })
  })

  test('when a stop needs more floor than its zone and no free tail is left, the lanes move back so everything is still loaded', () => {
    // Hai điểm cùng thể tích: vùng điểm 2 là 0..295, điểm 1 là 305..600. Bốn tấm của điểm 2 cần 400 cm sàn: xếp theo đúng vùng thì hai
    // tấm tràn sang vùng điểm 1 và thùng của điểm 1 hết chỗ. Mock lùi dải: điểm 2 ở 0..400, điểm 1 ở 400..500 — tấm thứ tư (tâm 350)
    // nằm trong vùng điểm 1 nên là một lần dỡ-xếp lại.
    expect(zoned([flat('PKG-001', 1, 40, 1), flat('PKG-002', 2, 10, 4)])).toStrictEqual({
      zones: [{ id: 'ZONE-1', stopId: 1, startXCm: 305, endXCm: 600 }, { id: 'ZONE-2', stopId: 2, startXCm: 0, endXCm: 295 }],
      spots: [['PKG-002', 0, 'ZONE-2'], ['PKG-002', 100, 'ZONE-2'], ['PKG-002', 200, 'ZONE-2'], ['PKG-002', 300, 'ZONE-1'], ['PKG-001', 400, 'ZONE-1']],
      unplaced: [],
      rehandlingCount: 1,
      blocking: [],
    })
  })

  test('more cargo than the box holds: the mock packs one continuous lane instead, so it never loads fewer than wall-by-wall packing', () => {
    // 2.000 thùng 40 × 30 × 25 cm cho 5 điểm giao (400 thùng mỗi điểm) trên Truck 6m: 15 vách sâu 40 cm, mỗi vách 8 cột × 10 tầng;
    // ba vách đầu mất một cột vì hốc bánh xe (x 0..120, y 0..30) → 3 × 70 + 12 × 80 = 1.170 thùng. Xếp đúng vùng thì mỗi điểm chỉ
    // được 118 cm (hai vách, 160 thùng trừ hốc bánh xe) và vài thùng xếp nhờ: ít hơn.
    const packages = Array.from({ length: 5 }, (_, index): CargoPackage => ({
      ...SPEC_CARTON_A, id: `PKG-00${index + 1}`, lengthCm: 40, widthCm: 30, heightCm: 25, weightKg: 0.5, quantity: 400, maxTopLoadKg: 60,
      maxStackCount: 10, deliveryStop: index + 1, mustLoad: false,
    }))
    const request = { ...SPEC_REQUEST, packages }
    const result = run(request)
    const { issues } = createConstraintEngine({ ...request, placements: result.placements }).evaluateAll()
    expect({
      placed: result.metrics.placedCount,
      unplaced: result.metrics.unplacedCount,
      reasons: [...new Set(result.unplacedPackages.map(({ reasonCode }) => reasonCode))],
      zones: result.stopZones?.length,
      blocking: issues.filter(({ severity }) => severity !== 'warning'),
    }).toStrictEqual({ placed: 1170, unplaced: 830, reasons: ['NO_SPACE'], zones: 5, blocking: [] })
  })

  test('a failed request has no zones and no rehandling count', () => {
    const result = run({ ...SPEC_REQUEST, packages: [{ ...SPEC_CARTON_A, quantity: 0 }] })
    expect([result.stopZones, result.metrics.rehandlingCount]).toStrictEqual([undefined, undefined])
  })
})

/** A small van: 130 × 70 cm floor, rear door as large as the interior. */
function van(heightCm: number, maxPayloadKg = 5000): VehicleConfig {
  return {
    ...SPEC_TRUCK_6M,
    id: 'VEHICLE-VAN',
    name: 'Xe van 1 tấn',
    innerLengthCm: 130,
    innerWidthCm: 70,
    innerHeightCm: heightCm,
    doorWidthCm: 70,
    doorHeightCm: heightCm,
    maxPayloadKg,
    obstacles: [],
  }
}

function reasons(vehicle: VehicleConfig, packages: CargoPackage[]) {
  return run({ ...SPEC_REQUEST, vehicle, packages }).unplacedPackages.map(({ packageInstanceId, reasonCode }) => [packageInstanceId, reasonCode])
}

describe('packages left behind say why', () => {
  const carton = (overrides: Partial<CargoPackage>): CargoPackage => ({ ...SPEC_CARTON_A, mustLoad: false, ...overrides })

  test('a package no orientation brings through the 220 × 230 cm door: DOOR_TOO_SMALL for every instance', () => {
    const crate = carton({ id: 'PKG-009', name: 'Kiện máy phát', lengthCm: 250, widthCm: 235, heightCm: 235, quantity: 2, keepUpright: false, allowedOrientations: ['LWH', 'WLH', 'LHW', 'WHL', 'HLW', 'HWL'] })
    expect(reasons(SPEC_TRUCK_6M, [crate])).toStrictEqual([['PKG-009-01', 'DOOR_TOO_SMALL'], ['PKG-009-02', 'DOOR_TOO_SMALL']])
  })

  test('cartons beyond a 100 kg payload: OVER_PAYLOAD once three 30 kg cartons are in', () => {
    expect(reasons(van(200, 100), [carton({ quantity: 5, maxStackCount: 5, maxTopLoadKg: 200 })]).map(([, reason]) => reason)).toStrictEqual(['OVER_PAYLOAD', 'OVER_PAYLOAD'])
  })

  test('a second carton with no floor left and no headroom to stack: NO_SPACE', () => {
    expect(reasons(van(50), [carton({ quantity: 2 })]).map(([, reason]) => reason)).toStrictEqual(['NO_SPACE'])
  })

  test('a second carton that would fit on top of a non-stackable one: STACKING_VIOLATION', () => {
    expect(reasons(van(100), [carton({ quantity: 2, stackable: false, maxTopLoadKg: 0 })]).map(([, reason]) => reason)).toStrictEqual(['STACKING_VIOLATION'])
  })
})

describe('MockOptimizationService behind the OptimizationService interface', () => {
  test('resolves to the pure mock result and reports progress up to every instance', async () => {
    const progress: OptimizationProgress[] = []
    const result = await new MockOptimizationService(fakeClock()).optimize(SPEC_REQUEST, { onProgress: (step) => progress.push(step) })
    expect({ result, last: progress.at(-1) }).toStrictEqual({ result: run(SPEC_REQUEST), last: { placed: 4, total: 4 } })
  })

  test('an already aborted signal rejects without running', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(new MockOptimizationService(fakeClock()).optimize(SPEC_REQUEST, { signal: controller.signal })).rejects.toThrow()
  })
})

describe('requests the mock cannot run at all fail as a mock result', () => {
  test('a request breaking the LM-010 schema fails with nothing placed', () => {
    const result = run({ ...SPEC_REQUEST, packages: [{ ...SPEC_CARTON_A, quantity: 0 }] })
    expect([result.status, result.isMockResult, result.placements, result.unplacedPackages]).toStrictEqual(['FAILED', true, [], []])
  })

  test('must-load cargo alone over the payload fails, every instance left UNKNOWN', () => {
    const result = run({ ...SPEC_REQUEST, vehicle: { ...SPEC_TRUCK_6M, maxPayloadKg: 100 } })
    expect([result.status, result.unplacedPackages.map(({ reasonCode }) => reasonCode), result.metrics.unplacedCount]).toStrictEqual([
      'FAILED',
      ['UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN'],
      4,
    ])
  })
})

describe('a vehicle that declares axles', () => {
  // Trục trước dưới cabin (x −120, rỗng 2.000 kg), hai trục sau ở 400 và 520 → nhóm sau tại 460, rỗng 1.800 kg; hai nhóm cách nhau 580 cm.
  const axles = [
    { id: 'AXLE-01', name: 'Trục trước', positionXCm: -120, emptyLoadKg: 2000, maxLoadKg: 3000 },
    { id: 'AXLE-02', name: 'Trục sau 1', positionXCm: 400, emptyLoadKg: 900, maxLoadKg: 4500 },
    { id: 'AXLE-03', name: 'Trục sau 2', positionXCm: 520, emptyLoadKg: 900, maxLoadKg: 4500 },
  ]

  test('gets front and rear axle loads in the metrics', () => {
    // Bốn Carton A 30 kg đều ở x 0..120 (tâm 60): 120 kg cách trục trước 180 cm → sau 120 × 180 / 580 = 37,24; trước 82,76.
    const { metrics, unplacedPackages } = run({ ...SPEC_REQUEST, vehicle: { ...SPEC_TRUCK_6M, axles } })
    expect([unplacedPackages, metrics.frontAxleLoadKg, metrics.rearAxleLoadKg]).toStrictEqual([[], 2082.76, 1837.24])
  })

  test('leaves out the packages that would overload an axle group, each with the AXLE_OVERLOAD it would cause', () => {
    // Mỗi thùng dồn 30 × 400 / 580 = 20,69 kg lên trục trước: hai thùng 2.041,38 kg, thùng thứ ba 2.062,07 kg > 2.050 kg.
    const result = run({ ...SPEC_REQUEST, vehicle: { ...SPEC_TRUCK_6M, axles, frontAxleLimitKg: 2050 } })
    const overload = { code: 'AXLE_OVERLOAD', severity: 'error', params: { group: 'front', loadKg: 2062.07, limitKg: 2050, overKg: 12.07 } }
    // Bốn thùng giống nhau: thùng nào lên xe trước do seed phá hoà quyết định, nên chỉ so số thùng và lý do
    expect({
      placed: result.placements.length,
      unplaced: result.unplacedPackages.map(({ packageInstanceId: _id, ...reason }) => reason),
      loads: [result.metrics.frontAxleLoadKg, result.metrics.rearAxleLoadKg],
    }).toStrictEqual({
      placed: 2,
      unplaced: [
        { reasonCode: 'CONSTRAINT_VIOLATED', message: 'CONSTRAINT_VIOLATED', violatedConstraints: [overload] },
        { reasonCode: 'CONSTRAINT_VIOLATED', message: 'CONSTRAINT_VIOLATED', violatedConstraints: [overload] },
      ],
      loads: [2041.38, 1818.62],
    })
    const { issues } = createConstraintEngine({ ...SPEC_REQUEST, vehicle: { ...SPEC_TRUCK_6M, axles, frontAxleLimitKg: 2050 }, placements: result.placements }).evaluateAll()
    expect(issues.filter(({ severity }) => severity === 'error')).toStrictEqual([])
  })
})
