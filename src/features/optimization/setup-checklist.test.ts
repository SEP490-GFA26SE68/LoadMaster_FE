import { expect, test } from 'vitest'
import { validateRequest } from '@/domain/constraints'
import { SPEC_CARTON_A, SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import type { CargoPackage } from '@/domain/models'
import { buildOptimizationRequest, DEFAULT_SETTINGS, groupRequestIssues } from './optimization-request'
import { buildSetupChecklist } from './setup-checklist'

function checklist(packages: CargoPackage[], routePlanned = true) {
  const request = buildOptimizationRequest({ packages }, SPEC_TRUCK_6M, DEFAULT_SETTINGS)
  const summary = groupRequestIssues(validateRequest(request), { tripId: 'TRIP-TEST', vehicleId: SPEC_TRUCK_6M.id })
  return buildSetupChecklist(packages, SPEC_TRUCK_6M, summary, routePlanned)
}

test('a clean trip passes every check and reports the numbers each check read', () => {
  const small: CargoPackage = { ...SPEC_CARTON_A, id: 'PKG-002', lengthCm: 40, widthCm: 30, heightCm: 20, quantity: 10, weightKg: 5, mustLoad: false }
  const list = checklist([SPEC_CARTON_A, small])
  expect([list.vehicle.state, list.dimensions.state, list.door.state, list.payload.state]).toStrictEqual(['pass', 'pass', 'pass', 'pass'])
  expect(list.dimensions).toMatchObject({ lines: 2, instances: 14 })
  expect(list.door.largest?.id).toBe('PKG-001')
  expect(list.optional).toStrictEqual({ instances: 10, lines: [small] })
  // 4 × 30 kg + 10 × 5 kg; riêng kiện bắt buộc là 120 kg
  expect(list.payload).toMatchObject({ totalKg: 170, mustLoadKg: 120, maxPayloadKg: 5000 })
  expect([list.errorCount, list.errorGroups, list.canRun, list.route.state]).toStrictEqual([0, [], true, 'pass'])
})

test('a trip whose route is not optimized yet cannot run: one error in the Route group, counted before the request errors (FE-5b-05)', () => {
  const draft = checklist([SPEC_CARTON_A], false)
  expect([draft.route.state, draft.errorCount, draft.errorGroups, draft.canRun]).toStrictEqual(['fail', 1, ['route'], false])
  const wardrobe: CargoPackage = { ...SPEC_CARTON_A, id: 'PKG-003', lengthCm: 300, widthCm: 300, heightCm: 300, quantity: 1 }
  const both = checklist([SPEC_CARTON_A, wardrobe], false)
  expect([both.errorCount, both.errorGroups, both.canRun]).toStrictEqual([2, ['route', 'packages'], false])
})

test('a package too big for the door fails only the door check, and counts as one error in the Packages group', () => {
  const wardrobe: CargoPackage = { ...SPEC_CARTON_A, id: 'PKG-003', lengthCm: 300, widthCm: 300, heightCm: 300, quantity: 1 }
  const list = checklist([SPEC_CARTON_A, wardrobe])
  expect(list.door.state).toBe('fail')
  expect(list.door.issues.map(({ issue }) => issue.code)).toStrictEqual(['DOOR_TOO_SMALL'])
  expect(list.dimensions.state).toBe('pass')
  expect(list.optional).toBeNull()
  expect([list.errorCount, list.errorGroups]).toStrictEqual([1, ['packages']])
})

test('must-load cargo over payload fails the payload check; the plain overload stays a warning next to it (D-23)', () => {
  // 180 × 30 kg = 5.400 kg bắt buộc, cộng 20 × 10 kg không bắt buộc
  const heavy: CargoPackage = { ...SPEC_CARTON_A, quantity: 180 }
  const extra: CargoPackage = { ...SPEC_CARTON_A, id: 'PKG-004', quantity: 20, weightKg: 10, mustLoad: false }
  const list = checklist([heavy, extra])
  expect(list.payload.state).toBe('fail')
  expect(list.payload.issues.map(({ issue }) => [issue.code, issue.severity])).toStrictEqual([
    ['MUST_LOAD_PAYLOAD_EXCEEDED', 'error'],
    ['PAYLOAD_EXCEEDED', 'warning'],
  ])
  expect(list.payload).toMatchObject({ totalKg: 5600, mustLoadKg: 5400 })
  expect([list.errorCount, list.errorGroups]).toStrictEqual([1, ['payload']])
})

test('an overload made only of optional cargo is a warning, not a failure', () => {
  const heavy: CargoPackage = { ...SPEC_CARTON_A, quantity: 133, weightKg: 40, mustLoad: false }
  const list = checklist([heavy])
  expect(list.payload.state).toBe('warn')
  expect(list.errorCount).toBe(0)
})
