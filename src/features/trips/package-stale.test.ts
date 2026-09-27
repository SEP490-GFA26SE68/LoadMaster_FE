import { expect, test } from 'vitest'
import { staleOnSave } from './package-stale'

const planning = { phase: 'planning', inputVersion: 3 } as const

test('an approved revision that is still current becomes stale on save and must be approved again', () => {
  const revisions = [
    { id: 'REV-001', inputVersion: 3 },
    { id: 'REV-002', inputVersion: 3, approvedAt: '2026-09-24T09:00:00+07:00' },
  ]
  expect(staleOnSave(planning, revisions)).toStrictEqual({ revisionId: 'REV-002', approved: true })
})

test('without an approval the latest optimized revision is the one that goes stale', () => {
  expect(staleOnSave(planning, [{ id: 'REV-004', inputVersion: 2 }, { id: 'REV-005', inputVersion: 3 }]))
    .toStrictEqual({ revisionId: 'REV-005', approved: false })
})

test('nothing to warn about: not optimized yet, already stale, or the trip left planning', () => {
  expect(staleOnSave(planning, [])).toBeNull()
  expect(staleOnSave(planning, [{ id: 'REV-002', inputVersion: 2, approvedAt: '2026-09-24T09:00:00+07:00' }])).toBeNull()
  expect(staleOnSave({ phase: 'loading', inputVersion: 3 }, [{ id: 'REV-002', inputVersion: 3 }])).toBeNull()
})
