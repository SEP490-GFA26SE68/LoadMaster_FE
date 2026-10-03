import { expect, test } from 'vitest'
import { approvalBlockers, blockerSummary, deadlineReview, type ConstraintIssue } from '@/domain/constraints'
import { SPEC_CARTON_A } from '@/domain/fixtures/spec-samples'
import type { CargoPackage, UnplacedPackage } from '@/domain/models'

const OVERLAP: ConstraintIssue = { code: 'OVERLAP', severity: 'error', packageInstanceId: 'PKG-001-02', relatedIds: ['PKG-001-01'], params: {} }
const LEANING: ConstraintIssue = { code: 'COG_LATERAL', severity: 'warning', params: { offsetCm: 90, limitCm: 24 } }
/** Carton A is mustLoad; the leaflets are not. */
const OPTIONAL: CargoPackage = { ...SPEC_CARTON_A, id: 'PKG-002', name: 'Tờ rơi khuyến mãi', quantity: 2, mustLoad: false }

function unplaced(...ids: string[]): UnplacedPackage[] {
  return ids.map((packageInstanceId) => ({ packageInstanceId, reasonCode: 'NO_SPACE', message: 'Hết chỗ' }))
}

test('a clean, current plan with every must-load package placed can be approved, warnings included', () => {
  expect(approvalBlockers({ issues: [LEANING], packages: [SPEC_CARTON_A], unplacedPackages: [], stale: false })).toStrictEqual({
    canApprove: true,
    issues: [],
    stale: false,
  })
})

test('engine errors block approval', () => {
  expect(approvalBlockers({ issues: [LEANING, OVERLAP], packages: [SPEC_CARTON_A], unplacedPackages: [], stale: false })).toStrictEqual({
    canApprove: false,
    issues: [OVERLAP],
    stale: false,
  })
})

test('unplaced instances of a must-load package block approval once per package; optional packages left behind do not', () => {
  const blockers = approvalBlockers({
    issues: [],
    packages: [SPEC_CARTON_A, OPTIONAL],
    unplacedPackages: unplaced('PKG-001-02', 'PKG-002-01', 'PKG-001-04'),
    stale: false,
  })
  expect(blockers).toStrictEqual({
    canApprove: false,
    issues: [{ code: 'MUST_LOAD_UNPLACED', severity: 'blockApproval', params: { packageId: 'PKG-001' } }],
    stale: false,
  })
})

test('a stale revision cannot be approved even without any issue', () => {
  expect(approvalBlockers({ issues: [], packages: [SPEC_CARTON_A], unplacedPackages: [], stale: true })).toStrictEqual({
    canApprove: false,
    issues: [],
    stale: true,
  })
})

test('an axle overload is an error and blocks approval (D-78)', () => {
  const rearOverload: ConstraintIssue = { code: 'AXLE_OVERLOAD', severity: 'error', params: { group: 'rear', loadKg: 6240.5, limitKg: 6000, overKg: 240.5 } }
  expect(approvalBlockers({ issues: [LEANING, rearOverload], packages: [SPEC_CARTON_A], unplacedPackages: [], stale: false })).toStrictEqual({
    canApprove: false,
    issues: [rearOverload],
    stale: false,
  })
})

test('the blocker summary counts each kind of reason apart: stale, must-load left behind, axle overload, other constraint errors (FE-5b-08)', () => {
  const rearOverload: ConstraintIssue = { code: 'AXLE_OVERLOAD', severity: 'error', params: { group: 'rear', loadKg: 6240.5, limitKg: 6000, overKg: 240.5 } }
  const blockers = approvalBlockers({
    issues: [LEANING, OVERLAP, rearOverload, OVERLAP],
    packages: [SPEC_CARTON_A, { ...OPTIONAL, mustLoad: true }],
    unplacedPackages: unplaced('PKG-001-02', 'PKG-002-01'),
    stale: true,
  })
  expect(blockerSummary(blockers)).toStrictEqual({ stale: true, mustLoadUnplaced: 2, axleOverload: 1, constraintErrors: 2 })
  expect(blockerSummary(approvalBlockers({ issues: [LEANING], packages: [SPEC_CARTON_A], unplacedPackages: [], stale: false }))).toStrictEqual({
    stale: false, mustLoadUnplaced: 0, axleOverload: 0, constraintErrors: 0,
  })
})

test('stops arriving after their deadline need a confirmation before approval; stops close to the deadline are only listed (D-80)', () => {
  type Stop = { stopId: string; deadlineStatus?: 'OK' | 'AT_RISK' | 'MISSED' }
  const onTime: Stop = { stopId: 'STOP-01', deadlineStatus: 'OK' }
  const close: Stop = { stopId: 'STOP-02', deadlineStatus: 'AT_RISK' }
  const late: Stop = { stopId: 'STOP-03', deadlineStatus: 'MISSED' }
  const noDeadline: Stop = { stopId: 'STOP-04' }
  expect(deadlineReview([onTime, close, late, noDeadline])).toStrictEqual({ missed: [late], atRisk: [close], needsConfirmation: true })
  expect(deadlineReview([onTime, close, noDeadline])).toStrictEqual({ missed: [], atRisk: [close], needsConfirmation: false })
  expect(deadlineReview([])).toStrictEqual({ missed: [], atRisk: [], needsConfirmation: false })
})
