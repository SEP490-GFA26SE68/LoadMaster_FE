import { expect, test } from 'vitest'
import { createMockDb } from '@/lib/mock-db'
import { routeProgress, staleReason } from './trip-detail'
import { stopRows } from './trip-summary'

/** Seam: kho seed neo 14/09/2026 (D-44) → chuyến, revision và nhật ký của chuyến. */
async function activityOf(tripId: string, db = createMockDb()) {
  const trip = await db.getTrip(tripId)
  const [revisions, events] = await Promise.all([db.listRevisions(tripId), db.listEvents({ targetId: tripId })])
  return { db, trip, revisions, events: events.filter((event) => event.target.id === tripId) }
}

test('the stale trip says which approved plan is out of date and which package line changed, before → after', async () => {
  const { trip, revisions, events } = await activityOf('TRIP-013')
  const approved = revisions.findLast((revision) => revision.approvedAt !== undefined)
  const reason = staleReason(trip, revisions, events)
  expect(reason).toMatchObject({
    revisionId: approved?.id,
    edit: { actorId: 'US-0001', fields: ['packages'], packageId: 'PKG-001', field: 'quantity', before: 80, after: 86 },
  })
  expect(reason?.edit?.at.localeCompare(approved?.approvedAt ?? '')).toBe(1)
})

test('a trip whose approved plan is current, or that is already loading, has no stale reason', async () => {
  for (const tripId of ['TRIP-2026-0914', 'TRIP-011', 'TRIP-014']) {
    const { trip, revisions, events } = await activityOf(tripId)
    expect(staleReason(trip, revisions, events)).toBeNull()
  }
})

test('an edit of several package lines at once still explains the stale plan, without before → after', async () => {
  const db = createMockDb()
  const hero = await db.getTrip('TRIP-2026-0914')
  await db.updateTrip(hero.id, { packages: hero.packages.map((pkg) => ({ ...pkg, quantity: pkg.quantity + 1 })) })
  const { trip, revisions, events } = await activityOf(hero.id, db)
  expect(staleReason(trip, revisions, events)?.edit).toStrictEqual({ at: expect.any(String), actorId: null, fields: ['packages'] })
})

test('a vehicle change on a planned trip explains the stale plan as an edit of the vehicle (FE-5b-08)', async () => {
  const db = createMockDb({ now: () => new Date('2026-09-14T03:00:00.000Z') })
  db.restoreSession('US-0001')
  // VEHICLE-004: sẵn sàng và đủ tải cho 5.844 kg hàng của chuyến chính
  await db.changeTripVehicle('TRIP-2026-0914', 'VEHICLE-004')
  const { trip, revisions, events } = await activityOf('TRIP-2026-0914', db)
  expect(staleReason(trip, revisions, events)).toStrictEqual({
    revisionId: 'REV-002',
    edit: { at: '2026-09-14T03:00:00.000Z', actorId: 'US-0001', fields: ['vehicleId'] },
  })
})

test('while delivering, the route counts stops done, packages unloaded and issues, per stop too', async () => {
  const { trip } = await activityOf('TRIP-009')
  const stops = stopRows(trip.stops, trip.packages)
  const progress = routeProgress(stops, trip.delivery!)
  const unloaded = trip.delivery!.stops.reduce((sum, stop) => sum + stop.unloadedIds.length, 0)
  expect(progress).toMatchObject({
    stops: { done: 1, total: 3 },
    packages: { done: unloaded, total: stops.reduce((sum, stop) => sum + stop.packageCount, 0) },
    issues: trip.delivery!.issues.length,
    departedAt: trip.delivery!.startedAt,
  })
  expect(progress.completedAt).toBeUndefined()
  expect(progress.byStop.get(1)?.unloaded).toBe(stops[0]?.packageCount)
})

test('a completed trip with a refused package: every stop done, the issue counted at its stop', async () => {
  const { trip } = await activityOf('TRIP-007')
  const progress = routeProgress(stopRows(trip.stops, trip.packages), trip.delivery!)
  const [issue] = trip.delivery!.issues
  expect(progress.stops).toStrictEqual({ done: 3, total: 3 })
  expect(progress.completedAt).toBe(trip.delivery!.completedAt)
  expect(progress.issues).toBe(1)
  expect(progress.byStop.get(issue!.stopNumber)?.issues).toBe(1)
})
