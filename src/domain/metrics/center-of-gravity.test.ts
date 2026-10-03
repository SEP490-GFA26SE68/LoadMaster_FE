import { describe, expect, test } from 'vitest'
import { SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import { checkCenterOfGravity } from '@/domain/metrics'

// Truck 6m: inner 600 × 240 × 250 cm — mid-length x = 300, centre line y = 120. No vehicle type: the default ratio 0.15 applies.
describe('lateral offset against 15% of the inner width (36 cm) by default', () => {
  test.each([
    ['16% towards the right wall', 158.4],
    ['16% towards the left wall', 81.6],
  ])('%s warns with the offset and the limit', (_, y) => {
    expect(checkCenterOfGravity(SPEC_TRUCK_6M, { x: 300, y, z: 22.5 })).toStrictEqual([
      { code: 'COG_LATERAL', severity: 'warning', params: { offsetCm: 38.4, limitCm: 36 } },
    ])
  })

  test.each([
    ['14% towards the right wall', 153.6],
    ['14% towards the left wall', 86.4],
    ['exactly on the limit', 156],
  ])('%s does not warn', (_, y) => {
    expect(checkCenterOfGravity(SPEC_TRUCK_6M, { x: 300, y, z: 22.5 })).toStrictEqual([])
  })
})

describe('longitudinal offset against 15% of the inner length (90 cm) by default', () => {
  test('cargo massed 112.5 cm towards the front wall warns and says which way', () => {
    expect(checkCenterOfGravity(SPEC_TRUCK_6M, { x: 187.5, y: 120, z: 22.5 })).toStrictEqual([
      { code: 'COG_LONGITUDINAL', severity: 'warning', params: { offsetCm: 112.5, limitCm: 90, toward: 'front' } },
    ])
  })

  test('cargo massed 95 cm towards the door warns and says which way', () => {
    expect(checkCenterOfGravity(SPEC_TRUCK_6M, { x: 395, y: 120, z: 22.5 })).toStrictEqual([
      { code: 'COG_LONGITUDINAL', severity: 'warning', params: { offsetCm: 95, limitCm: 90, toward: 'rear' } },
    ])
  })

  test.each([
    ['exactly on the front limit', 210],
    ['exactly on the rear limit', 390],
    ['at mid-length', 300],
  ])('%s does not warn', (_, x) => {
    expect(checkCenterOfGravity(SPEC_TRUCK_6M, { x, y: 120, z: 22.5 })).toStrictEqual([])
  })
})

describe('the ratio of the vehicle type replaces the default on both axes', () => {
  // 0.1 → 24 cm across, 60 cm along; 0.25 → 60 cm across, 150 cm along
  test('a stricter type warns where the default would not', () => {
    const strict = { ...SPEC_TRUCK_6M, maxCogOffsetRatio: 0.1 }
    expect(checkCenterOfGravity(strict, { x: 230, y: 146.4, z: 22.5 })).toStrictEqual([
      { code: 'COG_LATERAL', severity: 'warning', params: { offsetCm: 26.4, limitCm: 24 } },
      { code: 'COG_LONGITUDINAL', severity: 'warning', params: { offsetCm: 70, limitCm: 60, toward: 'front' } },
    ])
    expect(checkCenterOfGravity(SPEC_TRUCK_6M, { x: 230, y: 146.4, z: 22.5 })).toStrictEqual([])
  })

  test('a looser type accepts what the default would flag', () => {
    const loose = { ...SPEC_TRUCK_6M, maxCogOffsetRatio: 0.25 }
    expect(checkCenterOfGravity(loose, { x: 187.5, y: 158.4, z: 22.5 })).toStrictEqual([])
  })
})

describe('height against 50% of the inner height (125 cm), whatever the vehicle type', () => {
  test('a centre of gravity at 137.5 cm warns with the height and the limit', () => {
    expect(checkCenterOfGravity({ ...SPEC_TRUCK_6M, maxCogOffsetRatio: 0.25 }, { x: 300, y: 120, z: 137.5 })).toStrictEqual([
      { code: 'COG_HIGH', severity: 'warning', params: { heightCm: 137.5, limitCm: 125 } },
    ])
  })

  test('a centre of gravity exactly at 125 cm does not warn', () => {
    expect(checkCenterOfGravity(SPEC_TRUCK_6M, { x: 300, y: 120, z: 125 })).toStrictEqual([])
  })
})

test('a load that is off-centre both ways and high gets the three warnings in a fixed order', () => {
  expect(checkCenterOfGravity(SPEC_TRUCK_6M, { x: 187.5, y: 158.4, z: 137.5 }).map((issue) => issue.code))
    .toStrictEqual(['COG_LATERAL', 'COG_LONGITUDINAL', 'COG_HIGH'])
})
