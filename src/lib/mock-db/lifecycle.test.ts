import { expect, test } from 'vitest'
import { createMockDb, tripStatus, tripSubStatus, type MockDb } from '@/lib/mock-db'
import { twoCartonRequest, twoCartonResult, twoCartonTrip } from '@/test/mock-db-samples'
import { loadAll, loadingOrder, stageAll, unloadStop } from '@/test/trip-flow'

/** Kho neo 14/09 với phiên của nhân viên kho demo — sự kiện ghi người làm là phiên. */
async function signedInDb(email = 'kho@loadmaster.vn') {
  const db = createMockDb({ now: () => new Date('2026-09-14T03:00:00.000Z') })
  await db.authenticate(email, 'loadmaster')
  return db
}

/** Trạng thái (không lặp) của các kiện kho kiện đang nối với dòng kiện của chuyến. */
const poolStatuses = async (db: MockDb, tripId: string) => [...new Set((await db.listTripPackages(tripId)).map((item) => item.package.status))]

const tokenOf = async (db: MockDb, tripId: string, packageInstanceId: string) =>
  (await db.listTripLabels(tripId)).find((label) => label.packageInstanceId === packageInstanceId)?.qrToken ?? ''

test('the warehouse starts the latest approved plan, stages then loads every package in loading order, then completes (D-45, D-82, D-83)', async () => {
  const db = await signedInDb()
  const TRIP = 'TRIP-2026-0914'
  const started = await db.startLoading(TRIP)
  expect([started.phase, started.loading?.revisionId, started.loading?.startedBy, started.loading?.stagedIds]).toStrictEqual(['loading', 'REV-002', 'US-0003', []])
  const ids = await loadingOrder(db, TRIP)
  await stageAll(db, TRIP)
  const revisions = await db.listRevisions(TRIP)
  expect(tripSubStatus(await db.getTrip(TRIP), revisions)).toStrictEqual({ kind: 'loading', recorded: 0, total: 132 })
  // Sai thứ tự: kiện của chuyến nhưng không phải kiện của bước hiện tại — không ghi
  await expect(db.confirmLoadingByQr(TRIP, await tokenOf(db, TRIP, ids[1] ?? ''))).rejects.toMatchObject({
    code: 'WRONG_PACKAGE_SCANNED', params: { expected: ids[0], scanned: ids[1] },
  })
  expect((await db.getTrip(TRIP)).loading?.steps).toStrictEqual([])
  await loadAll(db, TRIP, ids.at(-1))
  await expect(db.completeLoading(TRIP)).rejects.toMatchObject({ code: 'LOADING_INCOMPLETE', params: { remaining: 1 } })
  await loadAll(db, TRIP)
  const loaded = await db.completeLoading(TRIP)
  expect(loaded.phase).toBe('loaded')
  const [completed] = await db.listEvents({ targetId: TRIP })
  expect([completed?.action, completed?.params, completed?.actorId]).toStrictEqual(['loading.completed', { loaded: 132, damaged: 0 }, 'US-0003'])
  expect([tripStatus(loaded), tripSubStatus(loaded, revisions)]).toStrictEqual(['LOADING', { kind: 'loaded' }])
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

test('the driver departs, arrives at each stop before unloading by verification, reports a refusal, completes; the last stop completes the trip (D-84)', async () => {
  const db = await signedInDb('taixe@loadmaster.vn')
  // Chỉ xuất phát khi kho đã xếp xong: TRIP-011 còn đang xếp
  await expect(db.startDelivery('TRIP-011')).rejects.toMatchObject({ code: 'TRIP_PHASE_INVALID', params: { phase: 'loading' } })
  // TRIP-010: loaded this morning for the demo driver
  const started = await db.startDelivery('TRIP-010')
  expect([started.phase, started.delivery?.stops]).toStrictEqual(['delivering', [{ number: 1, unloadedIds: [] }, { number: 2, unloadedIds: [] }, { number: 3, unloadedIds: [] }]])
  const revision = await db.getRevision(started.loading?.revisionId ?? '')
  const stopOf = (id: string) => revision.request.packages.find((pkg) => id.startsWith(`${pkg.id}-`))?.deliveryStop
  const items = (stop: number) => revision.result.placements.map((p) => p.packageInstanceId).filter((id) => stopOf(id) === stop)
  const [first] = items(1)
  const firstToken = await tokenOf(db, 'TRIP-010', first ?? '')
  // Chưa bấm "Đã đến": chưa dỡ, chưa báo sự cố theo kiện, chưa hoàn tất điểm
  await expect(db.confirmUnloadByQr('TRIP-010', 1, firstToken)).rejects.toMatchObject({ code: 'STOP_NOT_ARRIVED', params: { tripId: 'TRIP-010', stopNumber: 1 } })
  await expect(db.reportDeliveryIssue('TRIP-010', { stopNumber: 1, packageInstanceId: first, kind: 'damaged', note: '' })).rejects.toMatchObject({ code: 'STOP_NOT_ARRIVED' })
  await expect(db.completeStop('TRIP-010', 1)).rejects.toMatchObject({ code: 'STOP_NOT_ARRIVED' })
  await expect(db.arriveAtStop('TRIP-010', 2)).rejects.toMatchObject({ code: 'STOP_NOT_CURRENT' })
  const arrived = await db.arriveAtStop('TRIP-010', 1)
  expect(arrived.delivery?.stops[0]).toStrictEqual({ number: 1, unloadedIds: [], arrivedAt: '2026-09-14T03:00:00.000Z' })
  expect((await db.listEvents({ targetId: 'TRIP-010' }))[0]).toMatchObject({ action: 'delivery.arrived', actorId: 'US-0004', params: { stopNumber: 1 } })

  await expect(db.confirmUnloadByQr('TRIP-010', 2, firstToken)).rejects.toMatchObject({ code: 'STOP_NOT_CURRENT' })
  await expect(db.confirmUnloadByQr('TRIP-010', 1, await tokenOf(db, 'TRIP-010', items(2)[0] ?? ''))).rejects.toMatchObject({ code: 'QR_WRONG_STOP', params: { stopNumber: 2 } })
  await unloadStop(db, 'TRIP-010', 1)
  await expect(db.reportDeliveryIssue('TRIP-010', { stopNumber: 1, kind: 'other', note: ' ' })).rejects.toMatchObject({ code: 'REASON_REQUIRED' })
  // Khách từ chối một kiện đã dỡ: kiện ở lại xe, không còn tính là đã dỡ
  const refused = await db.reportDeliveryIssue('TRIP-010', { stopNumber: 1, packageInstanceId: first, kind: 'refused', note: 'Khách đổi đơn' })
  expect(refused.delivery?.stops[0]?.unloadedIds.includes(first ?? '')).toBe(false)
  await db.completeStop('TRIP-010', 1)
  const statusOf = async (instanceId: string) => (await db.findPackageByQr(await tokenOf(db, 'TRIP-010', instanceId))).status
  expect([await statusOf(first ?? ''), await statusOf(items(1)[1] ?? ''), await statusOf(items(2)[0] ?? '')]).toStrictEqual(['RETURNED', 'DELIVERED', 'IN_TRANSIT'])
  for (const stop of [2, 3]) {
    await unloadStop(db, 'TRIP-010', stop)
    await db.completeStop('TRIP-010', stop)
  }
  const done = await db.getTrip('TRIP-010')
  expect([done.phase, done.delivery?.issues.map((issue) => [issue.kind, issue.packageInstanceId, issue.reportedBy])]).toStrictEqual([
    'completed', [['refused', first, 'US-0004']],
  ])
  const [event] = await db.listEvents({ targetId: 'TRIP-010' })
  expect([event?.action, event?.params, event?.actorId]).toStrictEqual(['delivery.completed', { stops: 3, issues: 1 }, 'US-0004'])
})

test('a package left at the warehouse as damaged is not on the truck: it cannot be unloaded and is not waited for', async () => {
  const db = createMockDb({ now: () => new Date('2026-09-14T03:00:00.000Z') })
  // Chuyến seed TRIP-003 đã giao xong: kiện ở bước xếp 16 hỏng, bị bỏ lại kho — điểm 3 hoàn tất mà không chờ nó
  const trip = await db.getTrip('TRIP-003')
  const damaged = trip.loading?.steps.filter((step) => step.outcome === 'damaged').map((step) => step.packageInstanceId)
  expect([damaged, trip.phase, trip.delivery?.stops[2]?.unloadedIds.includes('PKG-003-03')]).toStrictEqual([['PKG-003-03'], 'completed', false])
  expect(await db.findPackageByQr(await tokenOf(db, 'TRIP-003', 'PKG-003-03'))).toMatchObject({ status: 'IMPORTED', flags: ['DAMAGED'] })
})

test('cancelling from draft or planned sends packages back to IMPORTED and requirements back to PENDING, with a reason and a log entry (D-91)', async () => {
  const db = await signedInDb('dieuphoi@loadmaster.vn')
  await expect(db.cancelTrip('TRIP-012', '   ')).rejects.toMatchObject({ code: 'REASON_REQUIRED' })
  // TRIP-014 là Nháp, TRIP-012 Đã lập kế hoạch; REQ-001 (PK-0052, PK-0053) vào TRIP-012 trước khi huỷ
  await db.assignDeliveryRequirement('REQ-001', 'TRIP-012')
  expect([(await db.getDeliveryRequirement('REQ-001')).status, (await db.getPackage('PK-0052')).status]).toStrictEqual(['ASSIGNED', 'ASSIGNED'])
  expect([tripStatus(await db.getTrip('TRIP-014')), await poolStatuses(db, 'TRIP-014')]).toStrictEqual(['DRAFT', ['ASSIGNED']])
  const draft = await db.cancelTrip('TRIP-014', 'Khách dời lịch')
  expect([draft.phase, await poolStatuses(db, 'TRIP-014')]).toStrictEqual(['cancelled', ['IMPORTED']])
  const cancelled = await db.cancelTrip('TRIP-012', ' Khách huỷ đơn ')
  expect([cancelled.phase, cancelled.cancellation]).toStrictEqual([
    'cancelled', { at: '2026-09-14T03:00:00.000Z', by: 'US-0001', reason: 'Khách huỷ đơn', fromPhase: 'planning' },
  ])
  expect(tripStatus(cancelled)).toBe('CANCELLED')
  const requirement = await db.getDeliveryRequirement('REQ-001')
  expect([requirement.status, requirement.tripId, (await db.getPackage('PK-0052')).status, (await db.getPackage('PK-0053')).tripId]).toStrictEqual(['PENDING', undefined, 'IMPORTED', undefined])
  expect((await db.listEvents({ targetId: 'TRIP-012' }))[0]).toMatchObject({ action: 'trip.cancelled', actorId: 'US-0001', params: { reason: 'Khách huỷ đơn' } })
  await expect(db.updateTrip('TRIP-012', { name: 'Tuyến mới' })).rejects.toMatchObject({ code: 'TRIP_LOCKED', params: { phase: 'cancelled' } })
})

test('cancelling while loading releases packages the same way and tells the warehouse how many loaded packages to unload (D-91)', async () => {
  const db = await signedInDb('dieuphoi@loadmaster.vn')
  // TRIP-011: kho đã soạn đủ 280 kiện và xếp 110 kiện
  expect([(await db.listTripPackages('TRIP-011')).length, await poolStatuses(db, 'TRIP-011')]).toStrictEqual([280, ['STAGED']])
  const cancelled = await db.cancelTrip('TRIP-011', 'Xe hỏng máy lạnh')
  expect([cancelled.phase, cancelled.cancellation?.fromPhase]).toStrictEqual(['cancelled', 'loading'])
  expect((await db.listEvents({ targetId: 'TRIP-011' }))[0]).toMatchObject({ action: 'trip.cancelled', params: { reason: 'Xe hỏng máy lạnh', loaded: 110 } })
  expect(await poolStatuses(db, 'TRIP-011')).toStrictEqual(['IMPORTED'])
  // Xếp xong chờ xuất phát (TRIP-010) vẫn là Đang xếp hàng: huỷ được
  expect((await db.cancelTrip('TRIP-010', 'Khách huỷ đơn')).cancellation?.fromPhase).toBe('loaded')
})

test('a trip in transit, delivered or already cancelled cannot be cancelled: INVALID_TRIP_STATUS_TRANSITION (D-91)', async () => {
  const db = await signedInDb('dieuphoi@loadmaster.vn')
  // Huỷ chuyến Đang vận chuyển cần sự cố cấp chuyến đang mở (FE-6-11) — chưa có nên luôn bị từ chối
  await expect(db.cancelTrip('TRIP-009', 'Xe hỏng')).rejects.toMatchObject({ code: 'INVALID_TRIP_STATUS_TRANSITION', params: { tripId: 'TRIP-009', from: 'IN_TRANSIT', to: 'CANCELLED' } })
  await expect(db.cancelTrip('TRIP-001', 'Nhầm chuyến')).rejects.toMatchObject({ code: 'INVALID_TRIP_STATUS_TRANSITION', params: { from: 'DELIVERED', to: 'CANCELLED' } })
  await expect(db.cancelTrip('TRIP-004', 'Huỷ lần nữa')).rejects.toMatchObject({ code: 'INVALID_TRIP_STATUS_TRANSITION', params: { from: 'CANCELLED', to: 'CANCELLED' } })
  expect((await db.getTrip('TRIP-009')).phase).toBe('delivering')
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

test('trip status is one of the six backend statuses (FE-0-05): the phase decides; while planning, a trip with an optimized route is planned (FE-4b-09)', () => {
  const routePlan = { stops: [], missedStopIds: [], totalKm: 0, totalMinutes: 0, optimizedAt: '2026-09-14T01:15:00.000Z', optimizedBy: null, isMockResult: true as const }
  // PRD v2 mục 7.1: chuyến sang Đã lập kế hoạch khi tối ưu tuyến xong — có phương án 3D hay chưa không quyết định trạng thái
  expect(tripStatus({ phase: 'planning' })).toBe('DRAFT')
  expect(tripStatus({ phase: 'planning', routePlan })).toBe('PLANNED')
  expect(tripStatus({ phase: 'loading', routePlan })).toBe('LOADING')
  expect(tripStatus({ phase: 'loaded', routePlan })).toBe('LOADING')
  expect(tripStatus({ phase: 'delivering', routePlan })).toBe('IN_TRANSIT')
  expect(tripStatus({ phase: 'completed', routePlan })).toBe('DELIVERED')
  expect(tripStatus({ phase: 'cancelled', routePlan })).toBe('CANCELLED')
  // Huỷ khi chưa tối ưu tuyến vẫn là Đã huỷ, không phải Nháp
  expect(tripStatus({ phase: 'cancelled' })).toBe('CANCELLED')
})

test('secondary line under Planned (FE-0-05): awaiting approval, approved, stale — the latest approved plan decides, else the latest plan', () => {
  const plan = (id: string, inputVersion: number, approved: boolean) => ({
    id, inputVersion, request: twoCartonRequest(), result: twoCartonResult(), ...(approved ? { approvedAt: '2026-09-14T02:00:00.000Z' } : {}),
  })
  const planning = { phase: 'planning' as const, inputVersion: 1 }
  expect(tripSubStatus(planning, [])).toBeNull()
  expect(tripSubStatus(planning, [plan('REV-001', 1, false)])).toStrictEqual({ kind: 'awaitingApproval' })
  expect(tripSubStatus(planning, [plan('REV-001', 1, false), plan('REV-002', 1, true)])).toStrictEqual({ kind: 'approved' })
  // Chạy lại sau khi đã duyệt: bản duyệt còn hiệu lực nên vẫn là đã duyệt
  expect(tripSubStatus(planning, [plan('REV-001', 1, true), plan('REV-002', 1, false)])).toStrictEqual({ kind: 'approved' })
  // Xe / kiện đổi sau lần tối ưu (inputVersion 2): bản chưa duyệt lẫn bản đã duyệt đều lỗi thời
  expect(tripSubStatus({ ...planning, inputVersion: 2 }, [plan('REV-001', 1, false)])).toStrictEqual({ kind: 'stale' })
  expect(tripSubStatus({ ...planning, inputVersion: 2 }, [plan('REV-001', 1, true)])).toStrictEqual({ kind: 'stale' })
  // Tối ưu lại sau khi bản duyệt lỗi thời: vẫn lỗi thời tới khi bản mới được duyệt
  expect(tripSubStatus({ ...planning, inputVersion: 2 }, [plan('REV-001', 1, true), plan('REV-002', 2, false)])).toStrictEqual({ kind: 'stale' })
  expect(tripSubStatus({ ...planning, inputVersion: 2 }, [plan('REV-001', 1, true), plan('REV-002', 2, false), plan('REV-003', 2, true)]))
    .toStrictEqual({ kind: 'approved' })
  // Ngoài pha lập kế hoạch và pha kho: không có dòng phụ
  for (const phase of ['delivering', 'completed', 'cancelled'] as const) {
    expect(tripSubStatus({ phase, inputVersion: 1 }, [plan('REV-001', 1, true)])).toBeNull()
  }
})

test('secondary line on the seed (FE-0-05): plan approval while planning, warehouse progress against the plan loading started with', async () => {
  const db = createMockDb()
  const trips = await db.listTrips()
  const lineOf = async (id: string) => {
    const trip = trips.find((item) => item.id === id)
    if (!trip) throw new Error(id)
    return tripSubStatus(trip, await db.listRevisions(id))
  }
  // seed-trips.ts: chuyến chính đã duyệt chờ kho; TRIP-012 đã tối ưu chưa duyệt; TRIP-013 sửa số lượng sau khi duyệt
  expect(await lineOf('TRIP-2026-0914')).toStrictEqual({ kind: 'approved' })
  expect(await lineOf('TRIP-012')).toStrictEqual({ kind: 'awaitingApproval' })
  expect(await lineOf('TRIP-013')).toStrictEqual({ kind: 'stale' })
  // TRIP-011 kho đã soạn đủ và xếp 110 / 280 kiện; TRIP-010 đã xếp xong
  expect(await lineOf('TRIP-011')).toStrictEqual({ kind: 'loading', recorded: 110, total: 280 })
  expect(await lineOf('TRIP-010')).toStrictEqual({ kind: 'loaded' })
  // Nháp, đang vận chuyển, đã giao, đã huỷ: không có dòng phụ
  for (const id of ['TRIP-014', 'TRIP-009', 'TRIP-001', 'TRIP-004']) expect(await lineOf(id)).toBeNull()
})
