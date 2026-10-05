import { expect, test } from 'vitest'
import { SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import type { CargoPackage } from '@/domain/models'
import { tripReadiness } from './trip-readiness'

// Xe Spec mục 12: 600 × 240 × 250 cm, 5.000 kg → 36.000.000 cm³
const box = (id: string, overrides: Partial<CargoPackage> = {}): CargoPackage => ({
  id, name: id, lengthCm: 100, widthCm: 100, heightCm: 100, weightKg: 100, quantity: 1,
  allowedOrientations: ['LWH'], keepUpright: true, fragilityLevel: 'NONE', stackable: true, maxTopLoadKg: 100,
  minSupportRatio: 0.8, deliveryStop: 1, priority: 1, mustLoad: true, ...overrides,
})

const statusOf = (readiness: ReturnType<typeof tripReadiness>) => Object.fromEntries(readiness.checks.map((check) => [check.code, check.status]))

test('a trip with a vehicle, valid packages on existing stops and within limits is ready', () => {
  const readiness = tripReadiness({ vehicle: SPEC_TRUCK_6M, vehicleInMaintenance: false, routePlanned: true, stopCount: 2, packages: [box('PKG-001'), box('PKG-002', { deliveryStop: 2 })] })
  expect(readiness.ready).toBe(true)
  expect(statusOf(readiness)).toStrictEqual({
    VEHICLE_ASSIGNED: 'pass', PACKAGES_PRESENT: 'pass', PACKAGES_VALID: 'pass', STOPS_VALID: 'pass', CARGO_SEGREGATED: 'pass', ROUTE_PLANNED: 'pass',
    WEIGHT_WITHIN_PAYLOAD: 'pass', VOLUME_WITHIN_CARGO: 'pass',
  })
  expect(readiness.checks.find((check) => check.code === 'WEIGHT_WITHIN_PAYLOAD')?.params).toStrictEqual({ totalKg: 200, payloadKg: 5000 })
})

test('no vehicle, a vehicle in maintenance or no packages is not ready', () => {
  expect(statusOf(tripReadiness({ vehicle: undefined, vehicleInMaintenance: false, routePlanned: true, stopCount: 1, packages: [box('PKG-001')] })).VEHICLE_ASSIGNED).toBe('fail')
  expect(statusOf(tripReadiness({ vehicle: SPEC_TRUCK_6M, vehicleInMaintenance: true, routePlanned: true, stopCount: 1, packages: [box('PKG-001')] })).VEHICLE_ASSIGNED).toBe('fail')
  const empty = tripReadiness({ vehicle: SPEC_TRUCK_6M, vehicleInMaintenance: false, routePlanned: true, stopCount: 1, packages: [] })
  expect(empty.ready).toBe(false)
  expect(statusOf(empty).PACKAGES_PRESENT).toBe('fail')
})

test('invalid packages and packages on a missing stop fail, a stop without packages only warns', () => {
  const readiness = tripReadiness({
    vehicle: SPEC_TRUCK_6M, vehicleInMaintenance: false, routePlanned: true, stopCount: 3,
    packages: [box('PKG-001', { lengthCm: 0 }), box('PKG-002', { deliveryStop: 4 })],
  })
  expect(statusOf(readiness).PACKAGES_VALID).toBe('fail')
  expect(readiness.checks.find((check) => check.code === 'STOPS_VALID')).toMatchObject({ status: 'fail', params: { stops: 3, outside: 1, empty: 2 } })
  const warn = tripReadiness({ vehicle: SPEC_TRUCK_6M, vehicleInMaintenance: false, routePlanned: true, stopCount: 2, packages: [box('PKG-001')] })
  expect(warn.checks.find((check) => check.code === 'STOPS_VALID')).toMatchObject({ status: 'warn', params: { stops: 2, outside: 0, empty: 1 } })
  expect(warn.ready).toBe(true)
})

test('total weight above payload and total volume above the cargo space fail', () => {
  // 51 × 100 kg = 5.100 kg > 5.000 kg; 37 × 1.000.000 cm³ > 36.000.000 cm³
  const heavy = tripReadiness({ vehicle: SPEC_TRUCK_6M, vehicleInMaintenance: false, routePlanned: true, stopCount: 1, packages: [box('PKG-001', { quantity: 51 })] })
  expect(statusOf(heavy).WEIGHT_WITHIN_PAYLOAD).toBe('fail')
  const bulky = tripReadiness({ vehicle: SPEC_TRUCK_6M, vehicleInMaintenance: false, routePlanned: true, stopCount: 1, packages: [box('PKG-001', { quantity: 37, weightKg: 1 })] })
  expect(bulky.checks.find((check) => check.code === 'VOLUME_WITHIN_CARGO')).toMatchObject({ status: 'fail', params: { totalCm3: 37_000_000, cargoCm3: 36_000_000 } })
  // Đúng bằng tải trọng vẫn đạt
  const exact = tripReadiness({ vehicle: SPEC_TRUCK_6M, vehicleInMaintenance: false, routePlanned: true, stopCount: 1, packages: [box('PKG-001', { quantity: 50 })] })
  expect(statusOf(exact).WEIGHT_WITHIN_PAYLOAD).toBe('pass')
})

test('packages of another handling class block until an override reason is recorded', () => {
  const packages = [box('PKG-001'), box('PKG-002', { handlingClass: 'FRAGILE', quantity: 3 }), box('PKG-003', { handlingClass: 'HAZARDOUS' })]
  const blocked = tripReadiness({ vehicle: SPEC_TRUCK_6M, vehicleInMaintenance: false, routePlanned: true, stopCount: 1, packages })
  expect(blocked.ready).toBe(false)
  expect(blocked.checks.find((check) => check.code === 'CARGO_SEGREGATED')).toStrictEqual({ code: 'CARGO_SEGREGATED', status: 'fail', params: { lines: 2, packages: 4 } })
  const overridden = tripReadiness({ vehicle: SPEC_TRUCK_6M, vehicleInMaintenance: false, routePlanned: true, stopCount: 1, packages, overrideReason: 'Khách gom chung một xe' })
  expect(overridden.ready).toBe(true)
  expect(overridden.checks.find((check) => check.code === 'CARGO_SEGREGATED')).toStrictEqual({ code: 'CARGO_SEGREGATED', status: 'warn', params: { lines: 2, packages: 4 } })
})

test('a trip whose route is not optimized yet is not ready: 3D loading follows the stop order of the route (FE-5b-05)', () => {
  const draft = tripReadiness({ vehicle: SPEC_TRUCK_6M, vehicleInMaintenance: false, routePlanned: false, stopCount: 2, packages: [box('PKG-001'), box('PKG-002', { deliveryStop: 2 })] })
  expect(draft.ready).toBe(false)
  expect(draft.checks.filter((check) => check.status === 'fail')).toStrictEqual([{ code: 'ROUTE_PLANNED', status: 'fail', params: { stops: 2 } }])
})
