import { expect, test } from 'vitest'
import { validateRequest } from '@/domain/constraints'
import { SPEC_CARTON_A, SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import type { CargoPackage } from '@/domain/models'
import { buildOptimizationRequest, DEFAULT_SETTINGS, DEFAULT_SETUP, groupRequestIssues } from './optimization-request'

const trip = { id: 'TRIP-TEST', packages: [SPEC_CARTON_A] }

test('the request carries the trip packages, the chosen vehicle and the form settings unchanged', () => {
  const settings = { ...DEFAULT_SETTINGS, randomSeed: 42, enforceLifo: false }
  expect(buildOptimizationRequest(trip, SPEC_TRUCK_6M, settings)).toStrictEqual({
    vehicle: SPEC_TRUCK_6M,
    packages: [SPEC_CARTON_A],
    settings,
  })
  expect(DEFAULT_SETTINGS.method).toBe('MOCK')
})

test('the form carries only the Spec settings: no objective or algorithm to choose (FE-5b-05)', () => {
  expect(Object.keys(DEFAULT_SETUP).toSorted()).toStrictEqual(['enforceLifo', 'method', 'prioritizeLowCenterOfGravity', 'randomSeed', 'timeLimitSeconds'])
  expect(buildOptimizationRequest(trip, SPEC_TRUCK_6M, DEFAULT_SETUP).settings).toStrictEqual(DEFAULT_SETTINGS)
})

test('a package with no usable orientation blocks the run and points at that package', () => {
  const broken: CargoPackage = { ...SPEC_CARTON_A, id: 'PKG-009', allowedOrientations: ['HWL'], keepUpright: true }
  const request = buildOptimizationRequest({ ...trip, packages: [SPEC_CARTON_A, broken] }, SPEC_TRUCK_6M, DEFAULT_SETTINGS)
  const summary = groupRequestIssues(validateRequest(request), { tripId: trip.id, vehicleId: SPEC_TRUCK_6M.id })
  expect(summary.canRun).toBe(false)
  expect(summary.groups.packages.map(({ issue, to }) => [issue.code, to])).toStrictEqual([
    ['NO_ALLOWED_ORIENTATION', '/chuyen/TRIP-TEST?kien=PKG-009'],
  ])
  expect([summary.groups.vehicle.length, summary.groups.payload.length]).toStrictEqual([0, 0])
})

test('going over payload without must-load packages only warns: 5,320 kg on a 5,000 kg truck still runs (D-23)', () => {
  // 133 × 40 kg = 5.320 kg, không kiện nào bắt buộc
  const heavy: CargoPackage = { ...SPEC_CARTON_A, quantity: 133, weightKg: 40, mustLoad: false }
  const request = buildOptimizationRequest({ ...trip, packages: [heavy] }, SPEC_TRUCK_6M, DEFAULT_SETTINGS)
  const summary = groupRequestIssues(validateRequest(request), { tripId: trip.id, vehicleId: SPEC_TRUCK_6M.id })
  expect(summary.canRun).toBe(true)
  expect(summary.groups.payload.map(({ issue, to }) => [issue.code, issue.severity, to])).toStrictEqual([
    ['PAYLOAD_EXCEEDED', 'warning', '/chuyen/TRIP-TEST'],
  ])
})

test('vehicle issues point at the vehicle page, and must-load over payload blocks the run', () => {
  const vehicle = { ...SPEC_TRUCK_6M, doorWidthCm: 250 }
  const heavy: CargoPackage = { ...SPEC_CARTON_A, quantity: 133, weightKg: 40, mustLoad: true }
  const request = buildOptimizationRequest({ ...trip, packages: [heavy] }, vehicle, DEFAULT_SETTINGS)
  const summary = groupRequestIssues(validateRequest(request), { tripId: trip.id, vehicleId: vehicle.id })
  expect(summary.canRun).toBe(false)
  expect(summary.groups.vehicle.map(({ issue, to }) => [issue.code, to])).toStrictEqual([['DOOR_EXCEEDS_INNER', '/doi-xe/VEHICLE-001']])
  expect(summary.groups.payload.map(({ issue }) => issue.code)).toStrictEqual(['MUST_LOAD_PAYLOAD_EXCEEDED', 'PAYLOAD_EXCEEDED'])
})
