import { expect, test } from 'vitest'
import { SPEC_CARTON_A, SPEC_CARTON_A_PLACEMENT, SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import { optimizationRequestSchema, optimizationResultSchema, packagePlacementSchema } from '@/domain/models'

/** Issues for the Spec placement with some fields replaced; the zod message is the issue code, asserted with its path. */
function placementIssuesWith(changes: Record<string, unknown>) {
  const { error } = packagePlacementSchema.safeParse({ ...SPEC_CARTON_A_PLACEMENT, ...changes })
  return (error?.issues ?? []).map(({ message, path }) => ({ code: message, path }))
}

test('the Spec §12 sample placement of "PKG-001-01" parses unchanged', () => {
  expect(packagePlacementSchema.parse(SPEC_CARTON_A_PLACEMENT)).toStrictEqual(SPEC_CARTON_A_PLACEMENT)
})

test('every placed size must be greater than 0 cm', () => {
  const notPositive = (field: string) => ({ code: 'placement.dimension.positive', path: [field] })
  expect(placementIssuesWith({ placedLengthCm: 0, placedWidthCm: -60, placedHeightCm: 0 })).toStrictEqual([
    notPositive('placedLengthCm'),
    notPositive('placedWidthCm'),
    notPositive('placedHeightCm'),
  ])
})

test('a support ratio above 1 is rejected, but one that only drifts above 1 in floating point is not', () => {
  // a 60.1 × 60.3 cm base resting fully on supports 38 cm and 22.1 cm long evaluates to 1.0000000000000002
  const fullyResting = (38 * 60.3 + 22.1 * 60.3) / (60.1 * 60.3)
  expect([placementIssuesWith({ supportRatio: 1.2 }), placementIssuesWith({ supportRatio: fullyResting })]).toStrictEqual([
    [{ code: 'placement.supportRatio.range', path: ['supportRatio'] }],
    [],
  ])
})

test('a MOCK optimization request for the Spec sample truck and carton parses unchanged', () => {
  const request = {
    vehicle: SPEC_TRUCK_6M,
    packages: [SPEC_CARTON_A],
    settings: { method: 'MOCK', timeLimitSeconds: 10, randomSeed: 42, enforceLifo: true, prioritizeLowCenterOfGravity: true },
  }
  expect(optimizationRequestSchema.parse(request)).toStrictEqual(request)
})

test('a partial MOCK result with the Spec placement and a package that misses the door parses unchanged', () => {
  const result = {
    jobId: 'MOCK-42',
    status: 'COMPLETED',
    method: 'MOCK',
    isMockResult: true,
    placements: [SPEC_CARTON_A_PLACEMENT],
    // PKG-003 is the Spec §13 package that does not fit the 220 × 230 cm door
    unplacedPackages: [{ packageInstanceId: 'PKG-003-01', reasonCode: 'DOOR_TOO_SMALL', message: 'DOOR_TOO_SMALL' }],
    metrics: {
      totalVehicleVolumeCm3: 36_000_000,
      usedVolumeCm3: 324_000,
      volumeUtilizationPercent: 0.9,
      maxPayloadKg: 5000,
      usedPayloadKg: 30,
      payloadUtilizationPercent: 0.6,
      placedCount: 1,
      unplacedCount: 1,
      centerOfGravityCm: { x: 180, y: 30, z: 22.5 },
      runtimeMs: 8,
    },
  }
  expect(optimizationResultSchema.parse(result)).toStrictEqual(result)
})

test('a package left out for a constraint parses unchanged with the issues that stopped it; axle loads are optional metrics', () => {
  const overload = { code: 'AXLE_OVERLOAD', severity: 'error', params: { group: 'rear', loadKg: 6240.5, limitKg: 6000, overKg: 240.5 } }
  const result = {
    jobId: 'MOCK-42',
    status: 'COMPLETED',
    method: 'MOCK',
    isMockResult: true,
    placements: [SPEC_CARTON_A_PLACEMENT],
    unplacedPackages: [{ packageInstanceId: 'PKG-002-01', reasonCode: 'CONSTRAINT_VIOLATED', message: 'CONSTRAINT_VIOLATED', violatedConstraints: [overload] }],
    metrics: {
      totalVehicleVolumeCm3: 36_000_000, usedVolumeCm3: 324_000, volumeUtilizationPercent: 0.9, maxPayloadKg: 5000, usedPayloadKg: 30,
      payloadUtilizationPercent: 0.6, placedCount: 1, unplacedCount: 1, centerOfGravityCm: { x: 180, y: 30, z: 22.5 },
      frontAxleLoadKg: 2015.52, rearAxleLoadKg: 1814.48, runtimeMs: 8,
    },
  }
  expect(optimizationResultSchema.parse(result)).toStrictEqual(result)
})

test('violated constraints that are not a list of issues are rejected with a registered code', () => {
  const unplaced = (violatedConstraints: unknown) => ({ packageInstanceId: 'PKG-002-01', reasonCode: 'CONSTRAINT_VIOLATED', message: '', violatedConstraints })
  const issuesOf = (violatedConstraints: unknown) => {
    const { error } = optimizationResultSchema.safeParse({ unplacedPackages: [unplaced(violatedConstraints)] })
    return (error?.issues ?? []).filter(({ path }) => path.at(-1) === 'violatedConstraints').map(({ message, path }) => ({ code: message, path }))
  }
  const path = ['unplacedPackages', 0, 'violatedConstraints']
  expect([issuesOf('AXLE_OVERLOAD'), issuesOf(['AXLE_OVERLOAD']), issuesOf([{ code: 'AXLE_OVERLOAD' }])]).toStrictEqual([
    [{ code: 'common.array.invalid', path }],
    [{ code: 'common.array.invalid', path }],
    [{ code: 'common.array.invalid', path }],
  ])
})
