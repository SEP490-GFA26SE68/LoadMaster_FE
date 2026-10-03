import { expect, test } from 'vitest'
import { expandPackages } from '@/domain/cargo'
import { createConstraintEngine, type ConstraintCode } from '@/domain/constraints'
import { SPEC_CARTON_A, SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import { gt, ORIENTATION_CODES, roundCm, UPRIGHT_ORIENTATIONS } from '@/domain/geometry'
import {
  optimizationRequestSchema,
  optimizationResultSchema,
  type CargoPackage,
  type OptimizationRequest,
  type VehicleObstacle,
} from '@/domain/models'
import { runMockOptimization } from '@/services/optimization'
import { seededRandom } from '@/test/placements'

/** Codes that would mean a placement the mock returned is invalid, not merely a warning about the plan. */
const INVALID_PLACEMENT: ReadonlySet<ConstraintCode> = new Set([
  'EXCEEDS_BOUNDARY',
  'OVERLAP',
  'OBSTACLE_OVERLAP',
  'NON_BEARING_SUPPORT',
  'SUPPORT_BELOW_MIN',
  'TOP_LOAD_EXCEEDED',
  'NOT_STACKABLE',
  'STACK_COUNT_EXCEEDED',
  'ORIENTATION_NOT_ALLOWED',
  'ORIENTATION_MISMATCH',
  'LOADING_ORDER_INFEASIBLE',
])

const [WHEEL_ARCH] = SPEC_TRUCK_6M.obstacles as [VehicleObstacle]
const COOLING_UNIT: VehicleObstacle = { id: 'OBS-002', type: 'COOLING_UNIT', xCm: 0, yCm: 60, zCm: 200, lengthCm: 60, widthCm: 120, heightCm: 50, loadBearing: false }

function randomRequest(random: () => number, index: number): OptimizationRequest {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T
  const between = (min: number, max: number, step = 1) => min + step * Math.floor(random() * ((max - min) / step + 1))
  const obstacles = [
    ...(random() < 0.5 ? [{ ...WHEEL_ARCH, loadBearing: random() < 0.5 }] : []),
    ...(random() < 0.3 ? [COOLING_UNIT] : []),
  ]
  const packages = Array.from({ length: between(1, 8) }, (_, line): CargoPackage => {
    const keepUpright = random() < 0.5
    const pool = keepUpright ? UPRIGHT_ORIENTATIONS : ORIENTATION_CODES
    const allowed = pool.filter(() => random() < 0.6)
    const stackable = random() < 0.8
    return {
      ...SPEC_CARTON_A,
      id: `PKG-${index}-${line}`,
      name: `Kiện ${line + 1}`,
      lengthCm: between(20, 150, 5),
      widthCm: between(20, 120, 5),
      heightCm: between(15, 120, 5),
      weightKg: between(1, 80),
      quantity: between(1, 12),
      allowedOrientations: allowed.length > 0 ? allowed : [pick(pool)],
      keepUpright,
      stackable,
      maxTopLoadKg: stackable ? between(0, 300, 10) : 0,
      maxStackCount: random() < 0.5 ? undefined : between(1, 5),
      minSupportRatio: pick([0.5, 0.7, 0.8, 1]),
      deliveryStop: between(1, 5),
      priority: between(0, 3),
      mustLoad: random() < 0.1,
    }
  })
  return {
    vehicle: { ...SPEC_TRUCK_6M, maxPayloadKg: between(300, 5000, 100), clearanceCm: pick([0, 2, 5]), obstacles },
    packages,
    settings: { method: 'MOCK', timeLimitSeconds: 10, randomSeed: between(0, 1000), enforceLifo: random() < 0.5, prioritizeLowCenterOfGravity: random() < 0.5 },
  }
}

test('500 deterministic random requests: every placement valid, every instance accounted for, same result when run again', () => {
  const random = seededRandom(24_092_026)
  let completed = 0
  let placed = 0
  let rehandled = 0
  for (let index = 0; index < 500; index += 1) {
    const request = randomRequest(random, index)
    expect(optimizationRequestSchema.safeParse(request).success).toBe(true)
    const runOnce = () => {
      let now = 0
      return runMockOptimization(request, { clock: () => (now += 1) })
    }
    const result = runOnce()
    expect(optimizationResultSchema.safeParse(result).success).toBe(true)
    const instances = expandPackages(request.packages).instances.length
    expect([result.placements.length + result.unplacedPackages.length, result.metrics.placedCount + result.metrics.unplacedCount]).toStrictEqual([instances, instances])
    if (index % 50 === 0) expect(runOnce()).toStrictEqual(result)
    if (result.status === 'FAILED') continue

    const { issues } = createConstraintEngine({ ...request, placements: result.placements }).evaluateAll()
    expect(issues.filter(({ code }) => INVALID_PLACEMENT.has(code))).toStrictEqual([])
    expect(gt(result.metrics.usedPayloadKg, request.vehicle.maxPayloadKg)).toBe(false)
    // zones (FE-5b-02): they and their 10 cm buffers cover the box exactly, every placement sits in one, and the count is the
    // number of placements sitting in the zone of another stop; packing by zone never puts cargo behind a later stop
    const zones = result.stopZones ?? []
    const stopOf = new Map(expandPackages(request.packages).instances.map(({ packageInstanceId, deliveryStop }) => [packageInstanceId, deliveryStop]))
    const zoneStop = new Map(zones.map(({ id, stopId }) => [id, stopId]))
    if (zones.length > 0) expect(roundCm(zones.reduce((sum, { startXCm, endXCm }) => sum + endXCm - startXCm, 0) + (zones.length - 1) * 10)).toBe(request.vehicle.innerLengthCm)
    expect(result.placements.filter(({ stopZoneId }) => stopZoneId === undefined || !zoneStop.has(stopZoneId))).toStrictEqual([])
    expect(result.metrics.rehandlingCount).toBe(result.placements.filter(({ packageInstanceId, stopZoneId }) => zoneStop.get(stopZoneId ?? '') !== stopOf.get(packageInstanceId)).length)
    if (request.settings.enforceLifo) expect(issues.filter(({ code }) => code === 'LIFO_BLOCKED')).toStrictEqual([])
    rehandled += result.metrics.rehandlingCount ?? 0
    completed += 1
    placed += result.placements.length
  }
  // most requests must really run and place cargo, or "nothing invalid" proves little
  expect({ mostCompleted: completed > 400, enoughPlaced: placed > 5000, someRehandled: rehandled > 0 }).toStrictEqual({ mostCompleted: true, enoughPlaced: true, someRehandled: true })}, 120_000)
