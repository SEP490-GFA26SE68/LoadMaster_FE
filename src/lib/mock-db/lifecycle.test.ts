import { expect, test } from 'vitest'
import { createMockDb, tripStatus, tripSubStatus, type MockDb } from '@/lib/mock-db'
import { twoCartonTrip } from '@/test/mock-db-samples'

/** Kho neo 14/09 với phiên của nhân viên kho demo — sự kiện ghi người làm là phiên. */
async function signedInDb(email = 'kho@loadmaster.vn') {
  const db = createMockDb({ now: () => new Date('2026-09-14T03:00:00.000Z') })
  await db.authenticate(email, 'loadmaster')
  return db
}

/** Kiện của bản duyệt theo thứ tự xếp. */
async function planIds(db: MockDb, tripId: string) {
  const trip = await db.getTrip(tripId)
  const revision = await db.getRevision(trip.loading?.revisionId ?? '')
  return revision.result.placements.toSorted((a, b) => a.loadingOrder - b.loadingOrder).map((p) => p.packageInstanceId)
}

test('the warehouse starts loading the latest approved plan, records each package, then completes the loading (D-45, D-47)', async () => {
  const db = await signedInDb()
  const started = await db.startLoading('TRIP-2026-0914')
  expect([started.phase, started.loading?.revisionId, started.loading?.startedBy]).toStrictEqual(['loading', 'REV-002', 'US-0003'])
  const ids = await planIds(db, 'TRIP-2026-0914')
  await expect(db.recordLoadingStep('TRIP-2026-0914', { packageInstanceId: 'PKG-404-01', outcome: 'loaded' })).rejects.toMatchObject({ code: 'INSTANCE_NOT_IN_PLAN' })
  await db.recordLoadingStep('TRIP-2026-0914', { packageInstanceId: ids[0] ?? '', outcome: 'missing' })
  await expect(db.completeLoading('TRIP-2026-0914')).rejects.toMatchObject({ code: 'LOADING_INCOMPLETE', params: { remaining: 131 } })
  for (const id of ids.slice(1)) await db.recordLoadingStep('TRIP-2026-0914', { packageInstanceId: id, outcome: 'loaded' })
  const loaded = await db.completeLoading('TRIP-2026-0914')
  expect(loaded.phase).toBe('loaded')
  const [completed, missing] = await db.listEvents({ targetId: 'TRIP-2026-0914' })
  expect([completed?.action, completed?.params, completed?.actorId]).toStrictEqual(['loading.completed', { loaded: 131, missing: 1 }, 'US-0003'])
  expect([missing?.action, missing?.params]).toStrictEqual(['loading.missing', { packageInstanceId: ids[0] }])
  const revisions = await db.listRevisions(loaded.id)
  expect([tripStatus(loaded, revisions), tripSubStatus(loaded, revisions)]).toStrictEqual(['da_duyet', { kind: 'loaded' }])
})

test('once loading starts, vehicle, stops and packages are locked; name, date and driver can still change (D-45)', async () => {
  const db = await signedInDb()
  const trip = await db.startLoading('TRIP-2026-0914')
  const locked = { code: 'TRIP_LOCKED', params: { tripId: trip.id, phase: 'loading' } }
  await expect(db.updateTrip(trip.id, { packages: trip.packages.slice(1) })).rejects.toMatchObject(locked)
  await expect(db.updateTrip(trip.id, { vehicleId: 'VEHICLE-001' })).rejects.toMatchObject(locked)
  await expect(db.approveRevision('REV-001', [])).rejects.toMatchObject(locked)
  const [revision] = await db.listRevisions(trip.id)
  await expect(db.addRevision({ tripId: trip.id, request: revision!.request, result: revision!.result })).rejects.toMatchObject(locked)
  await expect(db.updateVehicle({ ...(await db.getVehicle('VEHICLE-002')), maxPayloadKg: 1 })).rejects.toMatchObject({ code: 'VEHICLE_LOCKED', params: { tripId: trip.id } })
  expect((await db.updateTrip(trip.id, { name: 'Tuyến sáng', driverId: 'US-0006' })).name).toBe('Tuyến sáng')
})

test('the warehouse cannot start a stale, unapproved or already started trip', async () => {
  const db = createMockDb()
  await expect(db.startLoading('TRIP-013')).rejects.toMatchObject({ code: 'REVISION_STALE' })
  await expect(db.startLoading('TRIP-012')).rejects.toMatchObject({ code: 'NO_APPROVED_REVISION' })
  await expect(db.startLoading('TRIP-014')).rejects.toMatchObject({ code: 'NO_APPROVED_REVISION' })
  await expect(db.startLoading('TRIP-011')).rejects.toMatchObject({ code: 'TRIP_PHASE_INVALID', params: { phase: 'loading' } })
})

test('the driver delivers stop by stop: unload, report an issue, complete; the last stop completes the trip', async () => {
  const db = await signedInDb('taixe@loadmaster.vn')
  // TRIP-010: loaded this morning for the demo driver
  const started = await db.startDelivery('TRIP-010')
  expect([started.phase, started.delivery?.stops.map((stop) => stop.number)]).toStrictEqual(['delivering', [1, 2, 3]])
  const revision = await db.getRevision(started.loading?.revisionId ?? '')
  const stopOf = (id: string) => revision.request.packages.find((pkg) => id.startsWith(`${pkg.id}-`))?.deliveryStop
  const items = (stop: number) => revision.result.placements.map((p) => p.packageInstanceId).filter((id) => stopOf(id) === stop)
  const [first, ...rest] = items(1)
  await expect(db.recordUnload('TRIP-010', 2, items(2)[0] ?? '', true)).rejects.toMatchObject({ code: 'STOP_NOT_CURRENT' })
  await expect(db.recordUnload('TRIP-010', 1, items(2)[0] ?? '', true)).rejects.toMatchObject({ code: 'INSTANCE_NOT_IN_PLAN' })
  for (const id of rest) await db.recordUnload('TRIP-010', 1, id, true)
  await expect(db.completeStop('TRIP-010', 1)).rejects.toMatchObject({ code: 'STOP_INCOMPLETE', params: { remaining: 1 } })
  await expect(db.reportDeliveryIssue('TRIP-010', { stopNumber: 1, kind: 'other', note: ' ' })).rejects.toMatchObject({ code: 'REASON_REQUIRED' })
  await db.reportDeliveryIssue('TRIP-010', { stopNumber: 1, packageInstanceId: first, kind: 'refused', note: 'Khách đổi đơn' })
  await db.completeStop('TRIP-010', 1)
  for (const stop of [2, 3]) {
    for (const id of items(stop)) await db.recordUnload('TRIP-010', stop, id, true)
    await db.completeStop('TRIP-010', stop)
  }
  const done = await db.getTrip('TRIP-010')
  expect([done.phase, done.delivery?.issues.map((issue) => [issue.kind, issue.packageInstanceId, issue.reportedBy])]).toStrictEqual([
    'completed', [['refused', first, 'US-0004']],
  ])
  const [event] = await db.listEvents({ targetId: 'TRIP-010' })
  expect([event?.action, event?.params, event?.actorId]).toStrictEqual(['delivery.completed', { stops: 3, issues: 1 }, 'US-0004'])
})

test('a package missing at the warehouse is not on the truck: it cannot be unloaded and is not waited for', async () => {
  const db = await signedInDb()
  await db.startLoading('TRIP-2026-0914')
  const ids = await planIds(db, 'TRIP-2026-0914')
  const missing = ids[0] ?? ''
  for (const id of ids) await db.recordLoadingStep('TRIP-2026-0914', { packageInstanceId: id, outcome: id === missing ? 'missing' : 'loaded' })
  await db.completeLoading('TRIP-2026-0914')
  const trip = await db.startDelivery('TRIP-2026-0914')
  const revision = await db.getRevision(trip.loading?.revisionId ?? '')
  const stopOf = (id: string) => revision.request.packages.find((pkg) => id.startsWith(`${pkg.id}-`))?.deliveryStop ?? 0
  // the first package loaded sits deepest in the truck: it belongs to the last stop
  expect(stopOf(missing)).toBe(4)
  for (const stop of [1, 2, 3, 4]) {
    const items = ids.filter((id) => stopOf(id) === stop && id !== missing)
    for (const id of items) await db.recordUnload(trip.id, stop, id, true)
    if (stop === 4) await expect(db.recordUnload(trip.id, 4, missing, true)).rejects.toMatchObject({ code: 'INSTANCE_NOT_LOADED' })
    await db.completeStop(trip.id, stop)
  }
  expect((await db.getTrip(trip.id)).phase).toBe('completed')
})

test('a trip is cancelled with a reason before it leaves, never after (D-45)', async () => {
  const db = await signedInDb('dieuphoi@loadmaster.vn')
  await expect(db.cancelTrip('TRIP-012', '   ')).rejects.toMatchObject({ code: 'REASON_REQUIRED' })
  await expect(db.cancelTrip('TRIP-009', 'Xe hỏng')).rejects.toMatchObject({ code: 'TRIP_PHASE_INVALID', params: { phase: 'delivering' } })
  const cancelled = await db.cancelTrip('TRIP-012', ' Khách huỷ đơn ')
  expect([cancelled.phase, cancelled.cancellation]).toStrictEqual([
    'cancelled', { at: '2026-09-14T03:00:00.000Z', by: 'US-0001', reason: 'Khách huỷ đơn', fromPhase: 'planning' },
  ])
  expect(tripStatus(cancelled, await db.listRevisions(cancelled.id))).toBe('da_huy')
  await expect(db.updateTrip('TRIP-012', { name: 'Tuyến mới' })).rejects.toMatchObject({ code: 'TRIP_LOCKED', params: { phase: 'cancelled' } })
})

test('a vehicle in maintenance cannot take a trip; a running vehicle cannot go to maintenance (D-53)', async () => {
  const db = createMockDb()
  const state = await db.setVehicleMaintenance('VEHICLE-001', ' Thay dầu ')
  expect([state.status, state.maintenance?.note]).toStrictEqual(['maintenance', 'Thay dầu'])
  await expect(db.createTrip(twoCartonTrip())).rejects.toMatchObject({ code: 'VEHICLE_IN_MAINTENANCE', params: { vehicleId: 'VEHICLE-001' } })
  await expect(db.updateTrip('TRIP-012', { vehicleId: 'VEHICLE-001' })).rejects.toMatchObject({ code: 'VEHICLE_IN_MAINTENANCE' })
  await expect(db.setVehicleMaintenance('VEHICLE-003', 'Kiểm tra')).rejects.toMatchObject({ code: 'VEHICLE_LOCKED', params: { tripId: 'TRIP-010' } })
  expect((await db.setVehicleMaintenance('VEHICLE-001', null)).status).toBe('available')
})

test('only an active driver can be assigned to a trip', async () => {
  const db = createMockDb()
  await expect(db.createTrip({ ...twoCartonTrip(), driverId: 'US-0001' })).rejects.toMatchObject({ code: 'DRIVER_INVALID', params: { userId: 'US-0001' } })
  await expect(db.updateTrip('TRIP-012', { driverId: 'US-9999' })).rejects.toMatchObject({ code: 'DRIVER_INVALID' })
  expect((await db.updateTrip('TRIP-012', { driverId: 'US-0006' })).driverId).toBe('US-0006')
})

test('trip status follows the backend (LM-104): warehouse phases stay approved, a stale plan is optimized again', () => {
  const approved = { approvedAt: '2026-09-14T02:00:00.000Z', inputVersion: 1 }
  const planning = { phase: 'planning' as const, inputVersion: 1 }
  expect(tripStatus(planning, [])).toBe('nhap')
  expect(tripStatus(planning, [{ inputVersion: 1 }])).toBe('da_toi_uu')
  expect(tripStatus(planning, [{ inputVersion: 1 }, approved])).toBe('da_duyet')
  expect(tripStatus({ ...planning, inputVersion: 2 }, [approved])).toBe('da_toi_uu')
  expect(tripStatus({ phase: 'loading', inputVersion: 1 }, [approved])).toBe('da_duyet')
  expect(tripStatus({ phase: 'loaded', inputVersion: 1 }, [approved])).toBe('da_duyet')
  expect(tripStatus({ phase: 'delivering', inputVersion: 1 }, [approved])).toBe('dang_van_chuyen')
  expect(tripStatus({ phase: 'completed', inputVersion: 1 }, [approved])).toBe('hoan_thanh')
  expect(tripStatus({ phase: 'cancelled', inputVersion: 1 }, [approved])).toBe('da_huy')
})

test('secondary line (LM-104): stale plan while planning, warehouse progress against the plan loading started with, fully loaded', async () => {
  const db = createMockDb()
  const trips = await db.listTrips()
  const lineOf = async (id: string) => {
    const trip = trips.find((item) => item.id === id)
    if (!trip) throw new Error(id)
    return tripSubStatus(trip, await db.listRevisions(id))
  }
  // seed-trips.ts: TRIP-011 kho đã ghi 110 / 280 kiện; TRIP-010 đã xếp xong; TRIP-013 sửa số lượng sau khi duyệt
  expect(await lineOf('TRIP-011')).toStrictEqual({ kind: 'loading', recorded: 110, total: 280 })
  expect(await lineOf('TRIP-010')).toStrictEqual({ kind: 'loaded' })
  expect(await lineOf('TRIP-013')).toStrictEqual({ kind: 'stale' })
  for (const id of ['TRIP-2026-0914', 'TRIP-012', 'TRIP-014', 'TRIP-009', 'TRIP-001', 'TRIP-004']) expect(await lineOf(id)).toBeNull()
})
