import { expect, test } from 'vitest'
import { createMockDb, latestApproved } from '@/lib/mock-db'
import { missingPackages, tripProgress, type ProgressStep } from './trip-progress'

/** Seam: tiến trình dựng từ chuyến, revision và nhật ký của kho seed neo 14/09/2026 (D-44). */
async function progressOf(tripId: string) {
  const db = createMockDb()
  const trip = await db.getTrip(tripId)
  const [revisions, events] = await Promise.all([db.listRevisions(tripId), db.listEvents({ targetId: tripId })])
  const steps = tripProgress(trip, revisions, events.filter((event) => event.target.id === tripId))
  return { trip, revisions, steps }
}

const states = (steps: readonly ProgressStep[]) => steps.map((step) => `${step.kind}:${step.state}`)
const step = (steps: readonly ProgressStep[], kind: ProgressStep['kind']) => steps.find((item) => item.kind === kind)

test('a draft trip has only its creation done, with the time and the dispatcher who created it', async () => {
  const { trip, steps } = await progressOf('TRIP-014')
  expect(states(steps)).toStrictEqual([
    'created:done', 'optimized:pending', 'approved:pending', 'loading:pending', 'loaded:pending', 'delivering:pending', 'completed:pending',
  ])
  expect(step(steps, 'created')).toMatchObject({ at: trip.createdAt, actorId: 'US-0001' })
})

test('while the warehouse loads, loading is the current step with packages loaded out of the approved plan', async () => {
  const { trip, revisions, steps } = await progressOf('TRIP-011')
  const plan = latestApproved(revisions)!
  expect(states(steps).slice(0, 5)).toStrictEqual(['created:done', 'optimized:done', 'approved:done', 'loading:current', 'loaded:pending'])
  expect(step(steps, 'approved')).toMatchObject({ at: plan.approvedAt, actorId: 'US-0001' })
  expect(step(steps, 'loading')).toMatchObject({
    at: trip.loading?.startedAt,
    actorId: 'US-0011',
    loading: { loaded: 110, missing: 0, total: plan.result.placements.length },
  })
})

test('a completed trip with a package missing at the warehouse: every step done, the missing package counted and listed', async () => {
  const { trip, steps } = await progressOf('TRIP-003')
  expect(states(steps)).toStrictEqual([
    'created:done', 'optimized:done', 'approved:done', 'loading:done', 'loaded:done', 'delivering:done', 'completed:done',
  ])
  const loading = step(steps, 'loading')?.loading
  expect(loading?.missing).toBe(1)
  expect((loading?.loaded ?? 0) + (loading?.missing ?? 0)).toBe(loading?.total)
  expect(step(steps, 'delivering')?.delivery).toStrictEqual({ done: 3, total: 3 })
  expect(step(steps, 'completed')).toMatchObject({ at: trip.delivery?.completedAt, actorId: 'US-0007' })

  const missingStep = trip.loading?.steps.find((item) => item.outcome === 'missing')
  const [missing, ...rest] = missingPackages(trip)
  expect(rest).toHaveLength(0)
  expect(missing).toMatchObject({ packageInstanceId: missingStep?.packageInstanceId, at: missingStep?.at })
  expect(trip.packages.map((pkg) => pkg.name)).toContain(missing?.name)
  expect(missing?.deliveryStop).toBeGreaterThanOrEqual(1)
})

test('out for delivery: delivering is current with the stops done so far', async () => {
  const { steps } = await progressOf('TRIP-009')
  expect(step(steps, 'delivering')).toMatchObject({ state: 'current', actorId: 'US-0006', delivery: { done: 1, total: 3 } })
  expect(step(steps, 'completed')?.state).toBe('pending')
})

test('a cancelled trip keeps the steps it reached, then ends with the cancellation, who cancelled and why', async () => {
  const { trip, steps } = await progressOf('TRIP-004')
  expect(states(steps)).toStrictEqual(['created:done', 'optimized:done', 'approved:done', 'cancelled:done'])
  expect(steps.at(-1)).toMatchObject({
    at: trip.cancellation?.at,
    actorId: 'US-0001',
    reason: 'Khách hoãn nhận hàng do kiểm kê kho cuối tháng',
  })
})

test('with nothing in progress, the first step not reached yet is marked as next', async () => {
  const draft = await progressOf('TRIP-014')
  expect(draft.steps.filter((item) => item.note).map((item) => `${item.kind}:${item.note}`)).toStrictEqual(['optimized:next'])
  const approved = await progressOf('TRIP-2026-0914')
  expect(approved.steps.filter((item) => item.note).map((item) => `${item.kind}:${item.note}`)).toStrictEqual(['loading:next'])
  // Đang xếp, đã hoàn thành, đã huỷ: không có "tiếp theo"
  for (const tripId of ['TRIP-011', 'TRIP-007', 'TRIP-004']) {
    expect((await progressOf(tripId)).steps.some((item) => item.note)).toBe(false)
  }
})

test('an approved plan made out of date by an edit marks the approval stale; loading waits for re-approval', async () => {
  const { steps } = await progressOf('TRIP-013')
  expect(step(steps, 'approved')).toMatchObject({ state: 'done', stale: true })
  expect(step(steps, 'loading')).toMatchObject({ state: 'pending', note: 'waitApproval' })
  expect(step((await progressOf('TRIP-2026-0914')).steps, 'approved')?.stale).toBeUndefined()
})

test('cancelling at runtime is recorded with the signed-in user and the reason', async () => {
  const db = createMockDb()
  const user = await db.authenticate('dieuphoi@loadmaster.vn', 'loadmaster')
  const created = await db.createTrip({ name: 'Tuyến thử huỷ', vehicleId: 'VEHICLE-001', stops: [], packages: [], scheduledDate: '2026-09-20' })
  const cancelled = await db.cancelTrip(created.id, '  Khách đổi lịch  ')
  const events = (await db.listEvents({ targetId: created.id })).filter((event) => event.target.id === created.id)
  const steps = tripProgress(cancelled, [], events)
  expect(states(steps)).toStrictEqual(['created:done', 'cancelled:done'])
  expect(steps[0]).toMatchObject({ actorId: user.id })
  expect(steps[1]).toMatchObject({ actorId: user.id, reason: 'Khách đổi lịch' })
})
