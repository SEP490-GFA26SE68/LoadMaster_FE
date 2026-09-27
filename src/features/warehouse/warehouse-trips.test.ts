import { expect, test } from 'vitest'
import { createMockDb, type MockDb, type Revision, type Trip } from '@/lib/mock-db'
import { tripRecord, twoCartonRequest, twoCartonResult } from '@/test/mock-db-samples'
import { warehouseTripRows, type TripRevisions } from './warehouse-trips'

async function entries(db: MockDb): Promise<TripRevisions[]> {
  const trips = await db.listTrips()
  return Promise.all(trips.map(async (trip) => ({ trip, revisions: await db.listRevisions(trip.id) })))
}

async function vehicleNames(db: MockDb) {
  return new Map((await db.listVehicles()).map((vehicle) => [vehicle.id, vehicle.name]))
}

test('seed on 14/09: loading first, then approved waiting, then the stale approved trip; nothing already loaded, planned or finished', async () => {
  const db = createMockDb()
  const rows = warehouseTripRows(await entries(db), await vehicleNames(db))
  // seed-trips.ts: TRIP-011 = 80 + 60 + 80 + 60 kiện, kho đã ghi 110 bước; TRIP-013 duyệt 80 + 60 + 60 kiện rồi mới sửa số lượng
  expect(rows).toStrictEqual([
    { id: 'TRIP-011', name: 'Tuyến Tân Bình – Q.1 – Q.7', scheduledDate: '2026-09-14', vehicleName: 'Isuzu FVR 900 · 51D-622.14', status: 'da_duyet', sub: { kind: 'loading', recorded: 110, total: 280 }, stage: 'loading', total: 280, recorded: 110, missing: 0 },
    { id: 'TRIP-2026-0914', name: 'Tuyến Q.7 – Thủ Dầu Một – Dĩ An – Biên Hoà', scheduledDate: '2026-09-14', vehicleName: 'Hyundai HD210 · 60C-446.32', status: 'da_duyet', sub: null, stage: 'waiting', total: 132, recorded: 0, missing: 0 },
    { id: 'TRIP-013', name: 'Tuyến Biên Hoà – Long Bình Tân', scheduledDate: '2026-09-15', vehicleName: 'Truck 6m', status: 'da_toi_uu', sub: { kind: 'stale' }, stage: 'stale', total: 200, recorded: 0, missing: 0 },
  ])
})

test('a started trip counts loaded and missing packages; the list leaves it once loading is complete', async () => {
  const db = createMockDb()
  await db.startLoading('TRIP-2026-0914')
  const plan = await db.getRevision('REV-002')
  const [first, second] = plan.result.placements.toSorted((a, b) => a.loadingOrder - b.loadingOrder).map((p) => p.packageInstanceId)
  await db.recordLoadingStep('TRIP-2026-0914', { packageInstanceId: first ?? '', outcome: 'loaded' })
  await db.recordLoadingStep('TRIP-2026-0914', { packageInstanceId: second ?? '', outcome: 'missing' })

  const rows = warehouseTripRows(await entries(db), await vehicleNames(db))
  expect(rows.map(({ id, stage, recorded, missing }) => [id, stage, recorded, missing])).toStrictEqual([
    ['TRIP-011', 'loading', 110, 0],
    ['TRIP-2026-0914', 'loading', 2, 1],
    ['TRIP-013', 'stale', 0, 0],
  ])

  for (const placement of plan.result.placements) {
    await db.recordLoadingStep('TRIP-2026-0914', { packageInstanceId: placement.packageInstanceId, outcome: 'loaded' })
  }
  await db.completeLoading('TRIP-2026-0914')
  expect(warehouseTripRows(await entries(db), await vehicleNames(db)).map((row) => row.id)).toStrictEqual(['TRIP-011', 'TRIP-013'])
})

function revision(id: string, inputVersion: number, approved: boolean): Revision {
  return {
    id, jobId: `JOB-${id}`, tripId: 'TRIP-A', request: twoCartonRequest(), result: twoCartonResult(), inputVersion,
    createdAt: '2026-09-14T01:00:00.000Z', manuallyEdited: false, ordersRecomputed: approved,
    ...(approved ? { approvedAt: '2026-09-14T02:00:00.000Z' } : {}),
  }
}

test('a stale trip that was never approved has nothing to load and is not listed', () => {
  const trip: Trip = { ...tripRecord('TRIP-A'), inputVersion: 2 }
  expect(warehouseTripRows([{ trip, revisions: [revision('REV-001', 1, false)] }], new Map())).toStrictEqual([])
})

test('same status: earlier run date first, then trip id; an unknown vehicle shows its id', () => {
  const later = { ...tripRecord('TRIP-A'), scheduledDate: '2026-09-16' }
  const earlierB = { ...tripRecord('TRIP-C'), scheduledDate: '2026-09-15' }
  const earlierA = { ...tripRecord('TRIP-B'), scheduledDate: '2026-09-15' }
  const rows = warehouseTripRows(
    [later, earlierB, earlierA].map((trip) => ({ trip, revisions: [revision('REV-001', 1, true)] })),
    new Map(),
  )
  expect(rows.map((row) => [row.id, row.status, row.vehicleName, row.total])).toStrictEqual([
    ['TRIP-B', 'da_duyet', 'VEHICLE-001', 2],
    ['TRIP-C', 'da_duyet', 'VEHICLE-001', 2],
    ['TRIP-A', 'da_duyet', 'VEHICLE-001', 2],
  ])
})
