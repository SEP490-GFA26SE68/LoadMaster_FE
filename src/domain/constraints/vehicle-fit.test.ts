import { expect, test } from 'vitest'
import { vehicleFit } from '@/domain/constraints'
import { SPEC_CARTON_A, SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import type { CargoPackage, VehicleConfig } from '@/domain/models'

/** Truck 6m: cargo space 600 × 240 × 250 cm, door 220 × 230 cm, payload 5,000 kg, no clearance. Carton A: 120 × 60 × 45 cm, 30 kg. */
const line = (id: string, changes: Partial<CargoPackage>): CargoPackage => ({ ...SPEC_CARTON_A, id, quantity: 1, ...changes })

/** Front axle 120 cm ahead of the front wall, rear axle at x 420: the two groups can take (3,000 − 1,800) + (4,000 − 1,200) = 4,000 kg of cargo. */
const TWO_AXLES: VehicleConfig = {
  ...SPEC_TRUCK_6M,
  maxPayloadKg: 8000,
  axles: [
    { id: 'AXLE-1', name: 'Trục trước', positionXCm: -120, emptyLoadKg: 1800, maxLoadKg: 3000 },
    { id: 'AXLE-2', name: 'Trục sau', positionXCm: 420, emptyLoadKg: 1200, maxLoadKg: 4000 },
  ],
}

test('a vehicle whose cargo space, door, payload and axles take the cargo fits, with nothing to report', () => {
  expect(vehicleFit(SPEC_TRUCK_6M, [SPEC_CARTON_A])).toStrictEqual({ fits: true, issues: [] })
  expect(vehicleFit(SPEC_TRUCK_6M, [])).toStrictEqual({ fits: true, issues: [] })
})

test('a package with no allowed orientation that goes through the door and inside the cargo space makes the vehicle unfit', () => {
  const fit = vehicleFit(SPEC_TRUCK_6M, [
    // 700 cm long: LWH is longer than the 600 cm cargo space, WLH is wider than its 240 cm
    line('PKG-LONG', { lengthCm: 700, widthCm: 100, heightCm: 100 }),
    // 225 cm wide and may not turn: inside the 240 cm cargo space, but the door is 220 cm
    line('PKG-WIDE', { lengthCm: 100, widthCm: 225, heightCm: 100, allowedOrientations: ['LWH'] }),
    // 230 cm long: turned (WLH) it would not pass the door, lengthwise (LWH) it does
    line('PKG-TURN', { lengthCm: 230, widthCm: 100, heightCm: 100 }),
  ])
  expect(fit).toStrictEqual({
    fits: false,
    issues: [{ code: 'CARGO_TOO_LARGE', severity: 'error', params: { count: 2, packageIds: ['PKG-LONG', 'PKG-WIDE'] } }],
  })
})

test('door clearance counts: a package as wide as the door passes only when the vehicle asks for no clearance', () => {
  const asWideAsDoor = line('PKG-220', { lengthCm: 100, widthCm: 220, heightCm: 100, allowedOrientations: ['LWH'] })
  expect(vehicleFit(SPEC_TRUCK_6M, [asWideAsDoor]).fits).toBe(true)
  expect(vehicleFit({ ...SPEC_TRUCK_6M, clearanceCm: 2 }, [asWideAsDoor]).issues).toStrictEqual([
    { code: 'CARGO_TOO_LARGE', severity: 'error', params: { count: 1, packageIds: ['PKG-220'] } },
  ])
})

test('cargo with more volume than the cargo space, or more weight than the payload, makes the vehicle unfit', () => {
  // Van 200 × 100 × 100 cm = 2,000,000 cm³; ten 100 × 50 × 50 cm boxes = 2,500,000 cm³, 10 × 30 kg = 300 kg
  const van: VehicleConfig = { ...SPEC_TRUCK_6M, innerLengthCm: 200, innerWidthCm: 100, innerHeightCm: 100, doorWidthCm: 100, doorHeightCm: 100, obstacles: [] }
  expect(vehicleFit(van, [line('PKG-001', { lengthCm: 100, widthCm: 50, heightCm: 50, quantity: 10 })])).toStrictEqual({
    fits: false,
    issues: [{ code: 'CARGO_VOLUME_EXCEEDED', severity: 'error', params: { totalCm3: 2_500_000, cargoCm3: 2_000_000 } }],
  })
  // 200 Carton A = 6,000 kg on a 5,000 kg payload; 200 × 324,000 cm³ = 64,800,000 cm³ in 36,000,000 cm³
  expect(vehicleFit(SPEC_TRUCK_6M, [line('PKG-001', { quantity: 200 })])).toStrictEqual({
    fits: false,
    issues: [
      { code: 'CARGO_VOLUME_EXCEEDED', severity: 'error', params: { totalCm3: 64_800_000, cargoCm3: 36_000_000 } },
      { code: 'CARGO_WEIGHT_EXCEEDED', severity: 'error', params: { totalKg: 6000, maxPayloadKg: 5000, overKg: 1000 } },
    ],
  })
  // exactly the payload is fine: 20 boxes of 250 kg = 5,000 kg
  expect(vehicleFit(SPEC_TRUCK_6M, [line('PKG-001', { weightKg: 250, quantity: 20 })]).fits).toBe(true)
})

test('cargo heavier than what the two axle groups can still take, wherever it sits, makes the vehicle unfit (D-78)', () => {
  const cargo = (weightKg: number) => [line('PKG-001', { weightKg, quantity: 10 })]
  expect(vehicleFit(TWO_AXLES, cargo(450))).toStrictEqual({
    fits: false,
    issues: [{ code: 'AXLE_CAPACITY_EXCEEDED', severity: 'error', params: { totalKg: 4500, capacityKg: 4000, overKg: 500 } }],
  })
  expect(vehicleFit(TWO_AXLES, cargo(400))).toStrictEqual({ fits: true, issues: [] })
  // limits of the vehicle type win over the axles' own: (3,500 − 1,800) + (5,000 − 1,200) = 5,500 kg
  expect(vehicleFit({ ...TWO_AXLES, frontAxleLimitKg: 3500, rearAxleLimitKg: 5000 }, cargo(450))).toStrictEqual({ fits: true, issues: [] })
})

test('a vehicle that declares no axles, or no limit for one group, is not judged on axles', () => {
  const heavy = [line('PKG-001', { weightKg: 450, quantity: 10 })]
  expect(vehicleFit({ ...TWO_AXLES, axles: undefined }, heavy).fits).toBe(true)
  const [front, rear] = TWO_AXLES.axles!
  expect(vehicleFit({ ...TWO_AXLES, axles: [front!, { ...rear!, maxLoadKg: 0 }] }, heavy).fits).toBe(true)
})

test('cargo class is reported as a warning and does not make the vehicle unfit: refrigerated cargo without a cooling unit, hazardous cargo (D-74)', () => {
  const chilled = line('PKG-001', { quantity: 5, handlingClass: 'REFRIGERATED' })
  expect(vehicleFit(SPEC_TRUCK_6M, [chilled])).toStrictEqual({
    fits: true,
    issues: [{ code: 'REFRIGERATION_MISSING', severity: 'warning', params: { count: 5 } }],
  })
  const cooled: VehicleConfig = {
    ...SPEC_TRUCK_6M,
    obstacles: [{ id: 'OBS-001', type: 'COOLING_UNIT', xCm: 0, yCm: 0, zCm: 215, lengthCm: 25, widthCm: 240, heightCm: 35, loadBearing: false }],
  }
  expect(vehicleFit(cooled, [chilled])).toStrictEqual({ fits: true, issues: [] })
  expect(vehicleFit(cooled, [line('PKG-001', { quantity: 3, handlingClass: 'HAZARDOUS' })]).issues).toStrictEqual([
    { code: 'HAZARDOUS_VEHICLE_REQUIRED', severity: 'warning', params: { count: 3 } },
  ])
})
