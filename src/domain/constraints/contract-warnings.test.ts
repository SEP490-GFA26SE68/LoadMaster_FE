import { expect, test } from 'vitest'
import { fromContractWarnings, toContractWarnings, type ConstraintIssue } from '@/domain/constraints'

function overlap(packageInstanceId: string, otherId: string): ConstraintIssue {
  return { code: 'OVERLAP', severity: 'error', packageInstanceId, relatedIds: [otherId], params: {} }
}

/** PKG-006 rests on a base supported over 62% of its area while it needs 80%. */
const PKG_006_UNDER_SUPPORTED: ConstraintIssue = {
  code: 'SUPPORT_BELOW_MIN',
  severity: 'warning',
  packageInstanceId: 'PKG-006',
  params: { ratio: 0.62, required: 0.8 },
}

test('the issues of a placement are written to constraintWarnings as their bare codes, in order (D-28)', () => {
  expect(toContractWarnings([overlap('PKG-006', 'PKG-007'), PKG_006_UNDER_SUPPORTED])).toStrictEqual([
    'OVERLAP',
    'SUPPORT_BELOW_MIN',
  ])
})

test('a placement overlapping two others lists OVERLAP once: a bare code cannot say which other it overlaps', () => {
  const issues = [overlap('PKG-006', 'PKG-007'), PKG_006_UNDER_SUPPORTED, overlap('PKG-006', 'PKG-009')]
  expect(toContractWarnings(issues)).toStrictEqual(['OVERLAP', 'SUPPORT_BELOW_MIN'])
})

test('an issue comes back from the contract as its code alone: ratio 0.62 and required 0.80 do not survive', () => {
  expect(fromContractWarnings(toContractWarnings([PKG_006_UNDER_SUPPORTED]))).toStrictEqual([
    { kind: 'known', code: 'SUPPORT_BELOW_MIN' },
  ])
})

test('strings outside the catalogue come back as explicit unknown entries, in place, instead of failing', () => {
  // a sentence from a backend that does not send codes, a code this frontend does not know yet, an Object property name
  const fromBackend = ['OVERLAP', 'Support ratio is below the required minimum', 'TILT_ANGLE_EXCEEDED', 'constructor']
  expect(fromContractWarnings(fromBackend)).toStrictEqual([
    { kind: 'known', code: 'OVERLAP' },
    { kind: 'unknown', raw: 'Support ratio is below the required minimum' },
    { kind: 'unknown', raw: 'TILT_ANGLE_EXCEEDED' },
    { kind: 'unknown', raw: 'constructor' },
  ])
})
