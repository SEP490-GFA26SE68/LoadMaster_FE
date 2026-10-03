import { expect, test } from 'vitest'
import type { LoadingOutcome, TripPhase } from '@/lib/mock-db'
import { sceneBox } from '@/test/scene'
import { twoCartonRequest, twoCartonResult } from '@/test/mock-db-samples'
import { loadingProgress, loadingStep, stagingProgress, warehouseSession } from './loading-session'

const approved = (id: string, inputVersion = 1) => ({ id, inputVersion, approvedAt: '2026-09-14T02:00:00.000Z' })
const optimized = (id: string, inputVersion = 1) => ({ id, inputVersion })
const trip = (phase: TripPhase, inputVersion = 1, revisionId?: string) => ({
  phase,
  inputVersion,
  ...(revisionId ? { loading: { revisionId, startedAt: '2026-09-14T04:45:00.000Z', startedBy: null, stagedIds: [], steps: [] } } : {}),
})

test('a planned trip starts on the latest approved plan; a newer optimisation that is not approved is ignored', () => {
  expect(warehouseSession(trip('planning'), [approved('REV-001'), approved('REV-002'), optimized('REV-003')]))
    .toStrictEqual({ kind: 'start', plan: approved('REV-002') })
})

test('a stale approved plan blocks the start; no approved plan at all is a different case', () => {
  expect(warehouseSession(trip('planning', 2), [approved('REV-001', 1)])).toStrictEqual({ kind: 'stale', plan: approved('REV-001', 1) })
  expect(warehouseSession(trip('planning'), [optimized('REV-001')])).toStrictEqual({ kind: 'no-plan' })
  expect(warehouseSession(trip('planning'), [])).toStrictEqual({ kind: 'no-plan' })
})

test('once loading started, the plan is the one recorded at the start, and later phases show the finished loading', () => {
  const revisions = [approved('REV-001'), approved('REV-002')]
  expect(warehouseSession(trip('loading', 1, 'REV-001'), revisions)).toStrictEqual({ kind: 'loading', plan: approved('REV-001') })
  for (const phase of ['loaded', 'delivering', 'completed'] as const) {
    expect(warehouseSession(trip(phase, 1, 'REV-001'), revisions)).toStrictEqual({ kind: 'finished', plan: approved('REV-001') })
  }
  expect(warehouseSession(trip('cancelled', 1, 'REV-001'), revisions)).toStrictEqual({ kind: 'cancelled' })
})

/** Bốn kiện theo thứ tự xếp 1…4, khai báo lộn xộn để chắc chắn thứ tự đến từ `step`. */
const placements = [sceneBox('PKG-C', 0, 0, 0, { step: 3 }), sceneBox('PKG-A', 0, 0, 0, { step: 1 }), sceneBox('PKG-D', 0, 0, 0, { step: 4 }), sceneBox('PKG-B', 0, 0, 0, { step: 2 })]
const steps = (...recorded: [string, LoadingOutcome][]) => ({
  steps: recorded.map(([packageInstanceId, outcome]) => ({ packageInstanceId, outcome, at: '2026-09-14T05:00:00.000Z' })),
})

test('nothing recorded: the first package in loading order is current, the second is next', () => {
  expect(loadingProgress(placements, undefined)).toMatchObject({ current: { id: 'PKG-A' }, next: { id: 'PKG-B' }, total: 4, recorded: 0, loaded: 0, damaged: [] })
})

test('reopening resumes at the first package without a result; loaded and damaged both count as recorded', () => {
  const progress = loadingProgress(placements, steps(['PKG-A', 'loaded'], ['PKG-B', 'damaged']))
  expect(progress).toMatchObject({ current: { id: 'PKG-C' }, next: { id: 'PKG-D' }, total: 4, recorded: 2, loaded: 1 })
  expect(progress.damaged.map((p) => p.id)).toStrictEqual(['PKG-B'])
  // Ghi lệch thứ tự (kiện 2 trước kiện 1): vẫn quay về kiện 1, kiện kế tiếp bỏ qua kiện đã ghi
  expect(loadingProgress(placements, steps(['PKG-B', 'loaded']))).toMatchObject({ current: { id: 'PKG-A' }, next: { id: 'PKG-C' } })
  expect(loadingProgress(placements, steps(['PKG-A', 'loaded'], ['PKG-B', 'loaded'], ['PKG-C', 'loaded']))).toMatchObject({ current: { id: 'PKG-D' }, next: undefined })
})

test('every package recorded: no current package; damaged ones listed in loading order', () => {
  const progress = loadingProgress(placements, steps(['PKG-D', 'damaged'], ['PKG-A', 'loaded'], ['PKG-C', 'loaded'], ['PKG-B', 'damaged']))
  expect(progress).toMatchObject({ current: undefined, next: undefined, total: 4, recorded: 4, loaded: 2 })
  expect(progress.damaged.map((p) => p.id)).toStrictEqual(['PKG-B', 'PKG-D'])
})

test('staging (FE-6-02): packages not staged are listed in loading order whatever order they were staged in; reported shortages are flagged', () => {
  expect(stagingProgress(placements, undefined)).toMatchObject({ total: 4, staged: 0 })
  const progress = stagingProgress(placements, { stagedIds: ['PKG-D', 'PKG-A'], shortages: [{ packageInstanceId: 'PKG-C', at: '2026-09-14T05:00:00.000Z', by: 'US-0003' }] })
  expect([progress.total, progress.staged, progress.pending.map((p) => p.id), [...progress.shortageIds]]).toStrictEqual([4, 2, ['PKG-B', 'PKG-C'], ['PKG-C']])
})

test('the step of a trip at the warehouse: staging while a planned package is not staged, loading once every one is', () => {
  // twoCartonResult: PKG-001-01 và PKG-002-01
  const plan = { request: twoCartonRequest(), result: twoCartonResult() }
  const at = (stagedIds: string[]) => ({ loading: { revisionId: 'REV-001', startedAt: '2026-09-14T04:45:00.000Z', startedBy: null, stagedIds, steps: [] } })
  expect(loadingStep(at([]), plan)).toBe('staging')
  expect(loadingStep(at(['PKG-002-01']), plan)).toBe('staging')
  expect(loadingStep(at(['PKG-002-01', 'PKG-001-01']), plan)).toBe('loading')
})
