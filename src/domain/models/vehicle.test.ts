import { expect, test } from 'vitest'
import { SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import { vehicleConfigSchema } from '@/domain/models'

/** Issues for Truck 6m with some fields replaced; the zod message is the issue code, asserted with its path. */
function issuesWith(changes: Record<string, unknown>) {
  const { error } = vehicleConfigSchema.safeParse({ ...SPEC_TRUCK_6M, ...changes })
  return (error?.issues ?? []).map(({ message, path }) => ({ code: message, path }))
}

/** The Spec wheel arch OBS-001 (0, 0, 0, 120 × 30 × 45 cm, not load-bearing) with some fields replaced. */
function wheelArch(changes: Record<string, unknown>) {
  return { ...SPEC_TRUCK_6M.obstacles[0], ...changes }
}

test('the Spec §12 sample vehicle "Truck 6m" parses unchanged', () => {
  expect(vehicleConfigSchema.parse(SPEC_TRUCK_6M)).toStrictEqual(SPEC_TRUCK_6M)
})

test('every interior and door dimension must be greater than 0 cm (Spec §9.2, §13)', () => {
  const notPositive = (field: string) => ({ code: 'vehicle.dimension.positive', path: [field] })
  const dimensions = { innerLengthCm: 0, innerWidthCm: 0, innerHeightCm: 0, doorWidthCm: -220, doorHeightCm: 0 }
  expect(issuesWith(dimensions)).toStrictEqual([
    notPositive('innerLengthCm'),
    notPositive('innerWidthCm'),
    notPositive('innerHeightCm'),
    notPositive('doorWidthCm'),
    notPositive('doorHeightCm'),
  ])
})

test('a door wider or taller than the interior is rejected at that door field, a flush door is not (Spec §13)', () => {
  expect([
    issuesWith({ doorWidthCm: 250 }),
    issuesWith({ doorHeightCm: 260 }),
    issuesWith({ doorWidthCm: 240, doorHeightCm: 250 }),
  ]).toStrictEqual([
    [{ code: 'vehicle.door.exceedsInner', path: ['doorWidthCm'] }],
    [{ code: 'vehicle.door.exceedsInner', path: ['doorHeightCm'] }],
    [],
  ])
})

test('an invalid inner width is reported alone, without the door and obstacle checks that depend on it', () => {
  expect(issuesWith({ innerWidthCm: 0 })).toStrictEqual([{ code: 'vehicle.dimension.positive', path: ['innerWidthCm'] }])
})

test('the maximum payload must be greater than 0 kg (Spec §9.2)', () => {
  expect(issuesWith({ maxPayloadKg: 0 })).toStrictEqual([{ code: 'vehicle.maxPayloadKg.positive', path: ['maxPayloadKg'] }])
})

test('the clearance gap may be 0 cm, as in the Spec sample, but not negative', () => {
  expect(issuesWith({ clearanceCm: -1 })).toStrictEqual([{ code: 'vehicle.clearanceCm.nonNegative', path: ['clearanceCm'] }])
})

test('optional floor limits must not be negative, each with its own code because their units differ', () => {
  expect(issuesWith({ floorMaxLoadKg: -1, floorPressureLimitKgPerCm2: -0.5 })).toStrictEqual([
    { code: 'vehicle.floorMaxLoadKg.nonNegative', path: ['floorMaxLoadKg'] },
    { code: 'vehicle.floorPressureLimitKgPerCm2.nonNegative', path: ['floorPressureLimitKgPerCm2'] },
  ])
})

test('an obstacle sticking out of the interior is rejected at its index (Spec §9.2)', () => {
  const pastRightWall = wheelArch({ yCm: 220 })
  const beforeFrontWall = wheelArch({ id: 'OBS-002', xCm: -10 })
  expect(issuesWith({ obstacles: [pastRightWall, beforeFrontWall] })).toStrictEqual([
    { code: 'vehicle.obstacle.outsideInterior', path: ['obstacles', 0] },
    { code: 'vehicle.obstacle.outsideInterior', path: ['obstacles', 1] },
  ])
})

test('an obstacle flush with a wall stays inside even when its far edge drifts in floating point', () => {
  // right-hand wheel arch in a 230.1 cm wide interior: 199.8 + 30.3 evaluates to 230.10000000000002
  const flushRight = wheelArch({ yCm: 199.8, widthCm: 30.3 })
  expect(issuesWith({ innerWidthCm: 230.1, obstacles: [flushRight] })).toStrictEqual([])
})

test('an obstacle row that arrives as null gets the object type code at its index', () => {
  expect(issuesWith({ obstacles: [null] })).toStrictEqual([{ code: 'common.object.invalid', path: ['obstacles', 0] }])
})

test('every obstacle dimension must be greater than 0 cm, reported inside that obstacle row', () => {
  const notPositive = (field: string) => ({ code: 'obstacle.dimension.positive', path: ['obstacles', 0, field] })
  expect(issuesWith({ obstacles: [wheelArch({ lengthCm: 0, widthCm: 0, heightCm: -45 })] })).toStrictEqual([
    notPositive('lengthCm'),
    notPositive('widthCm'),
    notPositive('heightCm'),
  ])
})

test('an obstacle that is not load-bearing cannot declare a top load above 0 kg; a load-bearing one can', () => {
  expect([
    issuesWith({ obstacles: [wheelArch({ maxTopLoadKg: 500 })] }),
    issuesWith({ obstacles: [wheelArch({ maxTopLoadKg: 0 })] }),
    issuesWith({ obstacles: [wheelArch({ loadBearing: true, maxTopLoadKg: 500 })] }),
  ]).toStrictEqual([[{ code: 'obstacle.maxTopLoadKg.notLoadBearing', path: ['obstacles', 0, 'maxTopLoadKg'] }], [], []])
})

test('the top load a load-bearing obstacle declares must not be negative', () => {
  expect(issuesWith({ obstacles: [wheelArch({ loadBearing: true, maxTopLoadKg: -1 })] })).toStrictEqual([
    { code: 'obstacle.maxTopLoadKg.nonNegative', path: ['obstacles', 0, 'maxTopLoadKg'] },
  ])
})

test('axle loads must not be negative, each reported inside that axle row', () => {
  const rearAxle = { id: 'AXLE-02', name: 'AXLE-02', positionXCm: 420, emptyLoadKg: -1, maxLoadKg: -1 }
  expect(issuesWith({ axles: [rearAxle] })).toStrictEqual([
    { code: 'axle.emptyLoadKg.nonNegative', path: ['axles', 0, 'emptyLoadKg'] },
    { code: 'axle.maxLoadKg.nonNegative', path: ['axles', 0, 'maxLoadKg'] },
  ])
})

test('the limits a vehicle takes from its type parse unchanged; axle limits must be above 0 and the offset ratio within (0, 0.5]', () => {
  const limited = { ...SPEC_TRUCK_6M, frontAxleLimitKg: 3000, rearAxleLimitKg: 9000, maxCogOffsetRatio: 0.15 }
  expect(vehicleConfigSchema.parse(limited)).toStrictEqual(limited)
  expect(vehicleConfigSchema.parse({ ...SPEC_TRUCK_6M, maxCogOffsetRatio: 0.5 }).maxCogOffsetRatio).toBe(0.5)
  expect(issuesWith({ frontAxleLimitKg: 0, rearAxleLimitKg: -1, maxCogOffsetRatio: 0 })).toStrictEqual([
    { code: 'vehicle.axleLimitKg.positive', path: ['frontAxleLimitKg'] },
    { code: 'vehicle.axleLimitKg.positive', path: ['rearAxleLimitKg'] },
    { code: 'vehicle.maxCogOffsetRatio.range', path: ['maxCogOffsetRatio'] },
  ])
  expect(issuesWith({ maxCogOffsetRatio: 0.51 })).toStrictEqual([{ code: 'vehicle.maxCogOffsetRatio.range', path: ['maxCogOffsetRatio'] }])
})
