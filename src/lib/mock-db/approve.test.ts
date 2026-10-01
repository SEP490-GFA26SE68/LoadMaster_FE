import { afterEach, expect, test, vi } from 'vitest'
import type { PlacementPatch } from '@/domain/constraints'
import { SPEC_CARTON_A_PLACEMENT } from '@/domain/fixtures/spec-samples'
import { createMockDb } from '@/lib/mock-db'
import { optimizedTwoCartonTrip, twoCartonResult } from '@/test/mock-db-samples'

afterEach(() => {
  vi.useRealTimers()
})

/**
 * Lifts PKG-001-01 (stop 3) from the floor at x 120 onto PKG-002-01 (stop 1, x 240–360, y 0–60, z 0–45), turned to WLH:
 * 60 × 120 × 45 cm at x 240–300, y 0–120, z 45–90, resting on a 60 × 60 cm contact. x is off the 0.1 cm grid on purpose.
 */
const LIFT_ONTO_PKG_002: PlacementPatch = { packageInstanceId: 'PKG-001-01', xCm: 240.04, yCm: 0, zCm: 45, orientation: 'WLH' }

test('approving with a draft creates a new approved revision and leaves the source revision exactly as it was', async () => {
  vi.setSystemTime(new Date('2026-09-15T08:30:00.000Z'))
  const db = createMockDb()
  const { trip, revision: source } = await optimizedTwoCartonTrip(db)
  vi.setSystemTime(new Date('2026-09-15T10:15:00.000Z'))
  const approved = await db.approveRevision(source.id, [LIFT_ONTO_PKG_002])
  expect(await db.getRevision(source.id)).toStrictEqual(source)
  expect(await db.listRevisions(trip.id)).toStrictEqual([source, approved])
  expect(approved).toMatchObject({
    // REV-001 … REV-027 are seeded, REV-028 the source added above
    id: 'REV-029',
    jobId: source.jobId,
    tripId: trip.id,
    request: source.request,
    inputVersion: source.inputVersion,
    createdAt: '2026-09-15T10:15:00.000Z',
    approvedAt: '2026-09-15T10:15:00.000Z',
    sourceRevisionId: source.id,
    draftPatches: [LIFT_ONTO_PKG_002],
    manuallyEdited: true,
    ordersRecomputed: true,
  })
  expect(approved.result.isMockResult).toBe(true)
})

test('approval applies the draft and recomputes orders, support ratio and warnings: the package underneath loads first', async () => {
  const db = createMockDb()
  const { revision: source } = await optimizedTwoCartonTrip(db)
  const approved = await db.approveRevision(source.id, [LIFT_ONTO_PKG_002])
  // Service orders were PKG-001-01 loaded 1st / unloaded 2nd and PKG-002-01 loaded 2nd / unloaded 1st. Stop 3 still ranks first
  // for loading, but PKG-001-01 now rests on PKG-002-01, so PKG-002-01 must go in first and come out last.
  // The lifted 60 × 120 cm base touches only 60 × 60 cm of PKG-002-01: support ratio 0.5, below Carton A's 0.8.
  expect(approved.result.placements).toStrictEqual([
    {
      ...SPEC_CARTON_A_PLACEMENT,
      packageInstanceId: 'PKG-001-01',
      orientation: 'WLH',
      xCm: 240,
      yCm: 0,
      zCm: 45,
      placedLengthCm: 60,
      placedWidthCm: 120,
      placedHeightCm: 45,
      loadingOrder: 2,
      unloadingOrder: 1,
      supportRatio: 0.5,
      constraintWarnings: ['SUPPORT_BELOW_MIN'],
    },
    { ...SPEC_CARTON_A_PLACEMENT, packageInstanceId: 'PKG-002-01', xCm: 240, yCm: 0, zCm: 0, loadingOrder: 1, unloadingOrder: 2 },
  ])
})

test('approval recomputes the metrics from the patched placements', async () => {
  const db = createMockDb()
  const { revision: source } = await optimizedTwoCartonTrip(db)
  const approved = await db.approveRevision(source.id, [LIFT_ONTO_PKG_002])
  // Same two 30 kg boxes, so volume and payload stay. The lifted carton is centred at (270, 60, 67.5) and the one below at
  // (300, 30, 22.5), which moves the centre of gravity from the service's (240, 30, 22.5) to (285, 45, 45).
  expect(approved.result.metrics).toStrictEqual({ ...source.result.metrics, centerOfGravityCm: { x: 285, y: 45, z: 45 } })
})

test('approving without a draft keeps every result value and the mock flag as they were, and is not a manual edit', async () => {
  const db = createMockDb()
  // Approval keeps isMockResult rather than setting it, so a result that is not a mock stays that way
  const { revision: source } = await optimizedTwoCartonTrip(db, { ...twoCartonResult(), isMockResult: false })
  const approved = await db.approveRevision(source.id, [])
  expect(approved.result).toStrictEqual(source.result)
  expect(approved).toMatchObject({ draftPatches: [], manuallyEdited: false, ordersRecomputed: true })
})

test('approving an approved revision again without a new draft gives the same result and still counts as manually edited', async () => {
  const db = createMockDb()
  const { revision: source } = await optimizedTwoCartonTrip(db)
  const edited = await db.approveRevision(source.id, [LIFT_ONTO_PKG_002])
  const again = await db.approveRevision(edited.id, [])
  expect(again).toMatchObject({ id: 'REV-030', sourceRevisionId: edited.id, draftPatches: [], manuallyEdited: true })
  expect(again.result).toStrictEqual(edited.result)
})

test('a revision made stale by a package edit cannot be approved, and nothing is added', async () => {
  const db = createMockDb()
  const { trip, revision } = await optimizedTwoCartonTrip(db)
  await db.updateTrip(trip.id, { packages: trip.packages.map((pkg) => ({ ...pkg, weightKg: 35 })) })
  await expect(db.approveRevision(revision.id, [LIFT_ONTO_PKG_002])).rejects.toMatchObject({
    code: 'REVISION_STALE',
    params: { revisionId: revision.id },
  })
  expect(await db.listRevisions(trip.id)).toStrictEqual([revision])
})

test('a result that did not complete cannot be approved, and nothing is added', async () => {
  const db = createMockDb()
  const { trip, revision } = await optimizedTwoCartonTrip(db, { ...twoCartonResult(), status: 'FAILED' })
  await expect(db.approveRevision(revision.id, [])).rejects.toMatchObject({
    code: 'REVISION_NOT_COMPLETED',
    params: { revisionId: revision.id },
  })
  expect(await db.listRevisions(trip.id)).toStrictEqual([revision])
})

test('a draft cannot move a package the revision did not place, and an unknown revision cannot be approved', async () => {
  const db = createMockDb()
  // PKG-002-01 did not fit: the editor never creates a placement for an unplaced package
  const { trip, revision } = await optimizedTwoCartonTrip(db, {
    ...twoCartonResult(),
    placements: twoCartonResult().placements.slice(0, 1),
    unplacedPackages: [{ packageInstanceId: 'PKG-002-01', reasonCode: 'NO_SPACE', message: 'NO_SPACE' }],
  })
  const placeUnplaced: PlacementPatch = { packageInstanceId: 'PKG-002-01', xCm: 360, yCm: 0, zCm: 0, orientation: 'LWH' }
  await expect(db.approveRevision(revision.id, [placeUnplaced])).rejects.toMatchObject({
    code: 'PATCH_UNKNOWN_INSTANCE',
    params: { packageInstanceId: 'PKG-002-01' },
  })
  await expect(db.approveRevision('REV-404', [])).rejects.toMatchObject({
    code: 'NOT_FOUND',
    params: { collection: 'revisions', id: 'REV-404' },
  })
  expect(await db.listRevisions(trip.id)).toStrictEqual([revision])
})

test('approval records the signed-in user as the approver, in the revision and in the audit log; without a session there is none', async () => {
  const db = createMockDb()
  const { trip, revision: source } = await optimizedTwoCartonTrip(db)
  expect((await db.approveRevision(source.id, [])).approvedBy).toBeNull()
  await db.authenticate('dieuphoi@loadmaster.vn', 'loadmaster')
  const approved = await db.approveRevision(source.id, [])
  expect(approved.approvedBy).toBe('US-0001')
  expect((await db.listEvents({ targetId: trip.id }))[0]).toMatchObject({
    action: 'revision.approved',
    actorId: 'US-0001',
    params: { revisionId: approved.id, sourceRevisionId: source.id, edits: 0 },
  })
})

test('a hand edit reaches the store only as an approved revision: no saved, unapproved edit is left behind (FE-0-07)', async () => {
  const db = createMockDb()
  const { trip, revision: source } = await optimizedTwoCartonTrip(db)
  const approved = await db.approveRevision(source.id, [LIFT_ONTO_PKG_002])
  const revisions = await db.listRevisions(trip.id)
  expect(revisions.map((revision) => [revision.id, revision.approvedAt !== undefined, revision.manuallyEdited])).toStrictEqual([
    [source.id, false, false],
    [approved.id, true, true],
  ])
  expect('saveEditedRevision' in db).toBe(false)
  expect((await db.listEvents({ targetId: trip.id })).map((event) => event.action)).toStrictEqual(['revision.approved', 'optimization.saved', 'trip.created'])
})
