import { expect, test } from 'vitest'
import { createMockDb, type MockDb, type Revision, type Trip } from '@/lib/mock-db'
import { tripRecord, twoCartonRequest, twoCartonResult } from '@/test/mock-db-samples'
import { warehouseGroups, warehouseTripRows, type TripRevisions } from './warehouse-trips'

async function entries(db: MockDb): Promise<TripRevisions[]> {
  const trips = await db.listTrips()
  return Promise.all(trips.map(async (trip) => ({ trip, revisions: await db.listRevisions(trip.id) })))
}

async function vehicleNames(db: MockDb) {
  return new Map((await db.listVehicles()).map((vehicle) => [vehicle.id, vehicle.name]))
}

/** Kho seed đọc dưới phiên của một nhân viên kho, như ở màn `/kho`: kho chỉ trả chuyến của công ty người đó (FE-0-02). */
function warehouseDb(userId: 'US-0003' | 'US-0015') {
  const db = createMockDb()
  db.restoreSession(userId)
  return db
}

test('the Phương Nam warehouse sees only the approved trip of its own company (FE-0-02)', async () => {
  const db = warehouseDb('US-0015')
  // seed-phuong-nam.ts: TRIP-PN-001 = 30 thùng linh kiện + 12 kiện vải cuộn đã duyệt, chờ xếp; TRIP-PN-002 là nháp nên không hiện
  expect(warehouseTripRows(await entries(db), await vehicleNames(db))).toStrictEqual([
    { id: 'TRIP-PN-001', name: 'Tuyến Quận 7 – Nhà Bè', scheduledDate: '2026-09-14', vehicleName: 'Isuzu QKR 230 · 51C-907.41', status: 'PLANNED', sub: { kind: 'approved' }, manualSub: null, stage: 'waiting', total: 42, recorded: 0, missing: 0, recheck: 0, seal: undefined },
  ])
})

test('seed on 14/09, grouped by status (FE-6-01): loading, waiting to be staged, loaded, then the stale approved trip; nothing awaiting approval or past the warehouse', async () => {
  const db = warehouseDb('US-0003')
  const rows = warehouseTripRows(await entries(db), await vehicleNames(db))
  const rest = { manualSub: null, missing: 0, recheck: 0, seal: undefined }
  // seed-trips.ts: TRIP-011 = 80 + 60 + 80 + 60 kiện, kho đã ghi 110 bước; TRIP-010 = 80 + 40 + 45 + 45 kiện, xếp xong chưa ghi seal;
  // TRIP-013 duyệt 80 + 60 + 60 kiện rồi mới sửa số lượng. TRIP-012 (chờ duyệt), TRIP-014 (nháp), chuyến đang vận chuyển, đã giao và đã
  // huỷ không hiện.
  expect(rows).toStrictEqual([
    { id: 'TRIP-011', name: 'Tuyến Tân Bình – Q.1 – Q.7', scheduledDate: '2026-09-14', vehicleName: 'Isuzu FVR 900 · 51D-622.14', status: 'LOADING', sub: { kind: 'loading', recorded: 110, total: 280 }, stage: 'loading', total: 280, recorded: 110, ...rest },
    { id: 'TRIP-2026-0914', name: 'Tuyến Q.7 – Thủ Dầu Một – Dĩ An – Biên Hoà', scheduledDate: '2026-09-14', vehicleName: 'Hyundai HD210 · 60C-446.32', status: 'PLANNED', sub: { kind: 'approved' }, stage: 'waiting', total: 132, recorded: 0, ...rest },
    { id: 'TRIP-010', name: 'Tuyến Thủ Đức – An Phú – Phú Nhuận', scheduledDate: '2026-09-14', vehicleName: 'Isuzu NQR 550 · 51C-284.19', status: 'LOADING', sub: { kind: 'loaded' }, stage: 'loaded', total: 210, recorded: 210, ...rest },
    { id: 'TRIP-013', name: 'Tuyến Biên Hoà – Long Bình Tân', scheduledDate: '2026-09-15', vehicleName: 'Truck 6m', status: 'PLANNED', sub: { kind: 'stale' }, stage: 'stale', total: 200, recorded: 0, ...rest },
  ])
  expect(warehouseGroups(rows).map((group) => [group.stage, group.rows.map((row) => row.id)])).toStrictEqual([
    ['loading', ['TRIP-011']], ['waiting', ['TRIP-2026-0914']], ['loaded', ['TRIP-010']], ['stale', ['TRIP-013']],
  ])
})

test('a started trip counts loaded and missing packages; once loading is complete it waits to depart, with its seal; it leaves when the truck departs', async () => {
  const db = warehouseDb('US-0003')
  await db.startLoading('TRIP-2026-0914')
  const plan = await db.getRevision('REV-002')
  const [first, second] = plan.result.placements.toSorted((a, b) => a.loadingOrder - b.loadingOrder).map((p) => p.packageInstanceId)
  await db.recordLoadingStep('TRIP-2026-0914', { packageInstanceId: first ?? '', outcome: 'loaded' })
  await db.recordLoadingStep('TRIP-2026-0914', { packageInstanceId: second ?? '', outcome: 'missing' })

  const rows = warehouseTripRows(await entries(db), await vehicleNames(db))
  expect(rows.map(({ id, stage, recorded, missing }) => [id, stage, recorded, missing])).toStrictEqual([
    ['TRIP-011', 'loading', 110, 0],
    ['TRIP-2026-0914', 'loading', 2, 1],
    ['TRIP-010', 'loaded', 210, 0],
    ['TRIP-013', 'stale', 0, 0],
  ])

  for (const placement of plan.result.placements) {
    await db.recordLoadingStep('TRIP-2026-0914', { packageInstanceId: placement.packageInstanceId, outcome: 'loaded' })
  }
  await db.completeLoading('TRIP-2026-0914')
  await db.recordSeal('TRIP-2026-0914', 'SEAL-0914')
  const loaded = warehouseTripRows(await entries(db), await vehicleNames(db))
  expect(loaded.map((row) => [row.id, row.stage, row.seal])).toStrictEqual([
    ['TRIP-011', 'loading', undefined], ['TRIP-010', 'loaded', undefined], ['TRIP-2026-0914', 'loaded', 'SEAL-0914'], ['TRIP-013', 'stale', undefined],
  ])
  db.restoreSession('US-0004')
  await db.startDelivery('TRIP-2026-0914')
  db.restoreSession('US-0003')
  expect(warehouseTripRows(await entries(db), await vehicleNames(db)).map((row) => row.id)).toStrictEqual(['TRIP-011', 'TRIP-010', 'TRIP-013'])
})

test('manual confirmations show on the row (FE-6-04): the count waiting for the dispatcher, then the packages to check again after a rejection', async () => {
  const db = warehouseDb('US-0003')
  await db.startLoading('TRIP-2026-0914')
  const plan = await db.getRevision('REV-002')
  const [first] = plan.result.placements.toSorted((a, b) => a.loadingOrder - b.loadingOrder).map((p) => p.packageInstanceId)
  await db.confirmLoadingManually('TRIP-2026-0914', { packageInstanceId: first ?? '', reason: 'LABEL_DAMAGED' })
  const row = async () => warehouseTripRows(await entries(db), await vehicleNames(db)).find((item) => item.id === 'TRIP-2026-0914')
  expect(await row()).toMatchObject({ recorded: 1, manualSub: { kind: 'manualPending', count: 1 }, recheck: 0 })
  db.restoreSession('US-0001')
  await db.rejectManualConfirmation('TRIP-2026-0914', 'VF-001', 'Sai kiện')
  db.restoreSession('US-0003')
  expect(await row()).toMatchObject({ recorded: 0, manualSub: null, recheck: 1 })
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

/** Tuyến đã tối ưu (FE-4b-09): chuyến còn lập kế hoạch mang nó là Đã lập kế hoạch. */
const ROUTED: Pick<Trip, 'routePlan'> = {
  routePlan: { stops: [], missedStopIds: [], totalKm: 0, totalMinutes: 0, optimizedAt: '2026-09-13T08:15:00.000Z', optimizedBy: null, isMockResult: true },
}

test('a planned trip whose plan still awaits approval is not listed; once approved it waits for the warehouse', () => {
  const trip: Trip = { ...tripRecord('TRIP-A'), ...ROUTED }
  expect(warehouseTripRows([{ trip, revisions: [revision('REV-001', 1, false)] }], new Map())).toStrictEqual([])
  const rows = warehouseTripRows([{ trip, revisions: [revision('REV-001', 1, false), revision('REV-002', 1, true)] }], new Map())
  expect(rows.map((row) => [row.id, row.status, row.sub, row.stage])).toStrictEqual([['TRIP-A', 'PLANNED', { kind: 'approved' }, 'waiting']])
})

test('same status: earlier run date first, then trip id; an unknown vehicle shows its id', () => {
  const later = { ...tripRecord('TRIP-A'), ...ROUTED, scheduledDate: '2026-09-16' }
  const earlierB = { ...tripRecord('TRIP-C'), ...ROUTED, scheduledDate: '2026-09-15' }
  const earlierA = { ...tripRecord('TRIP-B'), ...ROUTED, scheduledDate: '2026-09-15' }
  const rows = warehouseTripRows(
    [later, earlierB, earlierA].map((trip) => ({ trip, revisions: [revision('REV-001', 1, true)] })),
    new Map(),
  )
  expect(rows.map((row) => [row.id, row.status, row.vehicleName, row.total])).toStrictEqual([
    ['TRIP-B', 'PLANNED', 'VEHICLE-001', 2],
    ['TRIP-C', 'PLANNED', 'VEHICLE-001', 2],
    ['TRIP-A', 'PLANNED', 'VEHICLE-001', 2],
  ])
})
