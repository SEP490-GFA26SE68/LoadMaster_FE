import { describe, expect, test } from 'vitest'
import { SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import type { VehicleAxle, VehicleConfig } from '@/domain/models'
import { vehicleFacts } from './vehicle-facts'

const axle = (id: string, positionXCm: number, emptyLoadKg: number, maxLoadKg: number): VehicleAxle =>
  ({ id, name: id, positionXCm, emptyLoadKg, maxLoadKg })

describe('vehicleFacts', () => {
  test('the Spec truck without axles: interior, door, payload, no clearance, one wheel arch, axles not declared', () => {
    expect(vehicleFacts(SPEC_TRUCK_6M)).toStrictEqual({
      name: 'Truck 6m',
      interior: { lengthCm: 600, widthCm: 240, heightCm: 250, volumeCm3: 36_000_000 },
      door: { widthCm: 220, heightCm: 230 },
      clearanceCm: null,
      payloadKg: 5000,
      axles: { status: 'missing' },
      obstacles: [{ type: 'WHEEL_ARCH', count: 1 }],
    })
  })

  test('two axles take the vehicle-type limits first, the axle maxima otherwise; a 0 kg maximum is not a limit', () => {
    const vehicle: VehicleConfig = {
      ...SPEC_TRUCK_6M, clearanceCm: 2,
      axles: [axle('A2', 420, 1800, 0), axle('A1', -100, 2200, 6000), axle('A3', 460, 1500, 0)],
      rearAxleLimitKg: 11_000,
    }
    const facts = vehicleFacts(vehicle)
    expect(facts.clearanceCm).toBe(2)
    expect(facts.axles).toStrictEqual({ status: 'computed', count: 3, frontLimitKg: 6000, rearLimitKg: 11_000 })
    expect(vehicleFacts({ ...vehicle, rearAxleLimitKg: undefined }).axles).toStrictEqual({ status: 'computed', count: 3, frontLimitKg: 6000 })
  })

  test('one axle, or axles at the same spot, are counted but cannot carry limits', () => {
    expect(vehicleFacts({ ...SPEC_TRUCK_6M, axles: [axle('A1', 0, 1000, 5000)] }).axles)
      .toStrictEqual({ status: 'unavailable', count: 1, reason: 'SINGLE_AXLE' })
    expect(vehicleFacts({ ...SPEC_TRUCK_6M, axles: [axle('A1', 50, 1000, 5000), axle('A2', 50, 1000, 5000)] }).axles)
      .toStrictEqual({ status: 'unavailable', count: 2, reason: 'AXLES_COINCIDE' })
  })

  test('obstacles are counted per type in contract order, types without obstacles left out', () => {
    const [arch] = SPEC_TRUCK_6M.obstacles
    const vehicle = { ...SPEC_TRUCK_6M, obstacles: [
      { ...arch!, id: 'O1', type: 'COOLING_UNIT' as const }, arch!, { ...arch!, id: 'O3' }, { ...arch!, id: 'O4', type: 'OTHER' as const },
    ] }
    expect(vehicleFacts(vehicle).obstacles).toStrictEqual([
      { type: 'WHEEL_ARCH', count: 2 }, { type: 'COOLING_UNIT', count: 1 }, { type: 'OTHER', count: 1 },
    ])
    expect(vehicleFacts({ ...SPEC_TRUCK_6M, obstacles: [] }).obstacles).toStrictEqual([])
  })
})
