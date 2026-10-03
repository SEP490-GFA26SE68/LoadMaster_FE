import { expect, test } from 'vitest'
import { SPEC_CARTON_A_PLACEMENT, SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import { computeMetrics, type MetricsInput } from '@/domain/metrics'

function metricsOf(input: Partial<MetricsInput>) {
  return computeMetrics({ vehicle: SPEC_TRUCK_6M, placements: [], weightByInstanceId: new Map(), unplacedCount: 0, runtimeMs: 0, ...input })
}

test('the total volume of Truck 6m is its whole inner 600 × 240 × 250 cm, 36,000,000 cm³, without subtracting the wheel arch', () => {
  expect(metricsOf({}).totalVehicleVolumeCm3).toBe(36_000_000)
})

test('the Spec sample placement 120 × 60 × 45 cm uses 324,000 cm³, 0.9% of Truck 6m', () => {
  const { usedVolumeCm3, volumeUtilizationPercent } = metricsOf({
    placements: [SPEC_CARTON_A_PLACEMENT],
    weightByInstanceId: new Map([['PKG-001-01', 30]]),
  })
  expect({ usedVolumeCm3, volumeUtilizationPercent }).toStrictEqual({ usedVolumeCm3: 324_000, volumeUtilizationPercent: 0.9 })
})

test('the 30 kg sample carton loads 30 of 5,000 kg (0.6%) and counts as one placed package', () => {
  const { usedPayloadKg, payloadUtilizationPercent, placedCount, maxPayloadKg } = metricsOf({
    placements: [SPEC_CARTON_A_PLACEMENT],
    weightByInstanceId: new Map([['PKG-001-01', 30]]),
  })
  expect({ usedPayloadKg, payloadUtilizationPercent, placedCount, maxPayloadKg })
    .toStrictEqual({ usedPayloadKg: 30, payloadUtilizationPercent: 0.6, placedCount: 1, maxPayloadKg: 5000 })
})

test('the centre of gravity of a single placement is the centre of its box (Spec §7.9)', () => {
  const { centerOfGravityCm } = metricsOf({ placements: [SPEC_CARTON_A_PLACEMENT], weightByInstanceId: new Map([['PKG-001-01', 30]]) })
  // box x 120–240, y 0–60, z 0–45
  expect(centerOfGravityCm).toStrictEqual({ x: 180, y: 30, z: 22.5 })
})

test('the centre of gravity leans towards the heavier package', () => {
  // 30 kg centred at (180, 30, 22.5) and 10 kg centred at (60, 150, 22.5)
  const light = { ...SPEC_CARTON_A_PLACEMENT, packageInstanceId: 'PKG-002-01', xCm: 0, yCm: 120 }
  const { centerOfGravityCm } = metricsOf({
    placements: [SPEC_CARTON_A_PLACEMENT, light],
    weightByInstanceId: new Map([['PKG-001-01', 30], ['PKG-002-01', 10]]),
  })
  expect(centerOfGravityCm).toStrictEqual({ x: 150, y: 60, z: 22.5 })
})

test('the rehandling count is the one the caller counted against the stop zones, and is absent for a plan without zones', () => {
  expect([metricsOf({ rehandlingCount: 3 }).rehandlingCount, metricsOf({ rehandlingCount: 0 }).rehandlingCount, 'rehandlingCount' in metricsOf({})]).toStrictEqual([3, 0, false])
})

test('an empty load has no centre of gravity rather than NaN coordinates', () => {
  expect(metricsOf({})).not.toHaveProperty('centerOfGravityCm')
})

test('a placement whose weight is unknown fails loudly instead of counting as 0 kg', () => {
  expect(() => metricsOf({ placements: [SPEC_CARTON_A_PLACEMENT] })).toThrow(/PKG-001-01/)
})
