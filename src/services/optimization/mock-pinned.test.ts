import { describe, expect, test } from 'vitest'
import { pinnedIssues } from '@/domain/constraints'
import { SPEC_CARTON_A } from '@/domain/fixtures/spec-samples'
import { overlaps } from '@/domain/geometry'
import { placementToBox, type CargoPackage, type OptimizationRequest, type PackagePlacement, type VehicleConfig } from '@/domain/models'
import { createMockDb } from '@/lib/mock-db'
import { runMockCandidates } from '@/services/optimization'
import { EMPTY_TRUCK_6M, placed } from '@/test/placements'

/** Thùng 600 × 240 × 250 cm, tải 8.000 kg; khối 100 cm không xếp chồng nên mỗi vách hai khối trên sàn. */
const TRUCK: VehicleConfig = { ...EMPTY_TRUCK_6M, maxPayloadKg: 500 }

function cubes(id: string, quantity: number, deliveryStop = 1, weightKg = 10): CargoPackage {
  return {
    ...SPEC_CARTON_A, id, name: id, lengthCm: 100, widthCm: 100, heightCm: 100, weightKg, quantity, allowedOrientations: ['LWH'],
    stackable: false, maxTopLoadKg: 0, maxStackCount: undefined, deliveryStop, mustLoad: false,
  }
}

const SETTINGS = { method: 'MOCK', timeLimitSeconds: 10, randomSeed: 3, enforceLifo: true, prioritizeLowCenterOfGravity: false } as const

function requestOf(packages: CargoPackage[], pinnedPlacements?: PackagePlacement[]): OptimizationRequest {
  return { vehicle: TRUCK, packages, settings: SETTINGS, ...(pinnedPlacements ? { pinnedPlacements } : {}) }
}

/** Khối 100 cm trên sàn tại (x, y). */
const floor = (id: string, xCm: number, yCm: number, zCm = 0) => placed(id, [xCm, yCm, zCm], [100, 100, 100])

const run = (request: OptimizationRequest) => runMockCandidates(request, { clock: () => 0 }).plans
const first = (request: OptimizationRequest) => (run(request)[0] as ReturnType<typeof run>[number]).result

describe('a run that keeps pinned packages', () => {
  const packages = [cubes('A', 6, 1), cubes('B', 6, 2)]
  const pins = [floor('B-01', 0, 0), floor('B-02', 0, 100), floor('A-01', 100, 0)]

  test('every candidate keeps each pinned package exactly where and how it was, marks it pinned, and packs the rest around it', () => {
    const plans = run(requestOf(packages, pins))
    expect(plans).toHaveLength(3)
    for (const { result } of plans) {
      expect(result.status).toBe('COMPLETED')
      expect(result.unplacedPackages).toStrictEqual([])
      expect(result.metrics.placedCount).toBe(12)
      const byId = new Map(result.placements.map((placement) => [placement.packageInstanceId, placement]))
      for (const pin of pins) {
        expect(byId.get(pin.packageInstanceId)).toMatchObject({ xCm: pin.xCm, yCm: pin.yCm, zCm: pin.zCm, orientation: pin.orientation, pinned: true })
      }
      const free = result.placements.filter(({ pinned }) => pinned !== true)
      expect(free).toHaveLength(9)
      const fixedBoxes = pins.map(placementToBox)
      expect(free.filter((placement) => fixedBoxes.some((box) => overlaps(box, placementToBox(placement))))).toStrictEqual([])
    }
  })

  test('the pinned weight counts against the payload: the rest is reported over payload, the pins stay', () => {
    const result = first(requestOf([cubes('A', 6, 1, 100)], [floor('A-01', 0, 0), floor('A-02', 0, 100)]))
    expect(result.placements.filter(({ pinned }) => pinned === true).map(({ packageInstanceId }) => packageInstanceId)).toStrictEqual(['A-01', 'A-02'])
    // 6 × 100 kg = 600 kg > 500 kg: 2 pinned + 3 more fit, the sixth is over payload
    expect(result.metrics.placedCount).toBe(5)
    expect(result.unplacedPackages.map(({ reasonCode }) => reasonCode)).toStrictEqual(['OVER_PAYLOAD'])
  })

  test('a package that does not fit around the pins is reported unplaced with its reason', () => {
    const wall = Array.from({ length: 12 }, (_, index) => floor(`A-${String(index + 1).padStart(2, '0')}`, Math.floor(index / 2) * 100, (index % 2) * 100))
    const result = first(requestOf([cubes('A', 14)], wall))
    expect(result.metrics.placedCount).toBe(12)
    expect(result.unplacedPackages.map(({ packageInstanceId, reasonCode }) => [packageInstanceId, reasonCode])).toStrictEqual([['A-13', 'NO_SPACE'], ['A-14', 'NO_SPACE']])
  })
})

describe('a pinned set that cannot stand on its own is refused before packing', () => {
  const packages = [cubes('A', 6)]
  test.each([
    ['sticks out of the box', [floor('A-01', 550, 0)], 'EXCEEDS_BOUNDARY'],
    ['overlaps another pinned package', [floor('A-01', 0, 0), floor('A-02', 50, 0)], 'OVERLAP'],
    ['floats with nothing under it', [floor('A-01', 0, 0, 100)], 'SUPPORT_BELOW_MIN'],
    ['is not a package of the trip any more', [floor('A-99', 0, 0)], 'PINNED_INSTANCE_UNKNOWN'],
  ] as const)('a pin that %s', (_, pins, code) => {
    const request = requestOf(packages, [...pins])
    expect(pinnedIssues(request).map((issue) => issue.code)).toContain(code)
    // The service refuses it too, instead of silently repairing the set
    expect(run(request).map(({ result }) => result.status)).toStrictEqual(['FAILED', 'FAILED', 'FAILED'])
  })

  test('pinned weight over the payload is refused with the totals', () => {
    const heavy = [cubes('A', 2, 1, 300)]
    const issues = pinnedIssues(requestOf(heavy, [floor('A-01', 0, 0), floor('A-02', 0, 100)]))
    expect(issues).toContainEqual({ code: 'PAYLOAD_EXCEEDED', severity: 'error', params: { totalKg: 600, maxPayloadKg: 500, overKg: 100 } })
  })
})

test('an empty pin set gives the same three plans as no pin set, on the seed trip', async () => {
  const db = createMockDb()
  const trip = await db.getTrip('TRIP-2026-0914')
  const base: OptimizationRequest = { vehicle: await db.getVehicle(trip.vehicleId), packages: trip.packages, settings: SETTINGS }
  expect(run({ ...base, pinnedPlacements: [] })).toStrictEqual(run(base))
})
