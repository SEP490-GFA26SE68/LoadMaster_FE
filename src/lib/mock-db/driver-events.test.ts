import { expect, test } from 'vitest'
import { SPEC_CARTON_A_PLACEMENT } from '@/domain/fixtures/spec-samples'
import { createMockDb, type AuditEvent, type MockDb } from '@/lib/mock-db'
import { twoCartonRequest, twoCartonResult, twoCartonTrip } from '@/test/mock-db-samples'
import { loadAll, stageAll } from '@/test/trip-flow'

/**
 * Kho nêu tài xế của chuyến trong sự kiện (tham số `driverId` — chuông của tài xế đọc nó) chỉ khi chuyến đang hiện ở "Chuyến của tôi" của
 * họ: từ lúc kho bắt đầu soạn hàng (FE-6-01). Đổi tài xế lúc đó nêu cả người vừa bị thay (`previousDriverId`); chuyến đang xếp quay về Đã
 * lập kế hoạch (FE-6-02, FE-6-05) nêu tài xế để báo chuyến tạm dừng, và tới khi kho soạn lại, đổi tài xế hay huỷ chuyến vẫn nêu tài xế.
 * Kho neo 14/09.
 */

const DISPATCHER = 'US-0001'
const WAREHOUSE = 'US-0003'
const TRIP = 'TRIP-2026-0914'

function storeAs(userId: string): MockDb {
  const db = createMockDb({ now: () => new Date('2026-09-14T05:00:00.000Z') })
  db.restoreSession(userId)
  return db
}

/** Tham số của sự kiện `action` mới nhất của chuyến. */
const paramsOf = async (db: MockDb, tripId: string, action: AuditEvent['action']) =>
  (await db.listEvents({ targetId: tripId })).find((event) => event.action === action)?.params

test('starting to stage names the driver: the trip is new for them; changing the driver names nobody before that, the new and the replaced driver after', async () => {
  const db = storeAs(DISPATCHER)
  // Lập kế hoạch: chuyến chưa hiện với tài xế nào — lần đổi chỉ ghi trường đã sửa, trước → sau
  await db.updateTrip(TRIP, { driverId: 'US-0006' })
  expect(await paramsOf(db, TRIP, 'trip.updated')).toStrictEqual({ fields: 'driverId', before: 'US-0004', after: 'US-0006' })
  await db.updateTrip(TRIP, { driverId: 'US-0004' })

  db.restoreSession(WAREHOUSE)
  await db.startLoading(TRIP)
  expect(await paramsOf(db, TRIP, 'loading.started')).toStrictEqual({ revisionId: 'REV-002', driverId: 'US-0004' })

  db.restoreSession(DISPATCHER)
  await db.updateTrip(TRIP, { driverId: 'US-0006' })
  expect(await paramsOf(db, TRIP, 'trip.updated')).toStrictEqual({ fields: 'driverId', before: 'US-0004', after: 'US-0006', driverId: 'US-0006', previousDriverId: 'US-0004' })
  await db.updateTrip(TRIP, { driverId: null })
  expect(await paramsOf(db, TRIP, 'trip.updated')).toStrictEqual({ fields: 'driverId', before: 'US-0006', after: '', previousDriverId: 'US-0006' })
  await db.updateTrip(TRIP, { driverId: 'US-0007' })
  expect(await paramsOf(db, TRIP, 'trip.updated')).toStrictEqual({ fields: 'driverId', before: '', after: 'US-0007', driverId: 'US-0007' })
  // Sửa trường khác lúc đang xếp không nêu tài xế nào
  await db.updateTrip(TRIP, { name: 'Tuyến chiều' })
  const renamed = await paramsOf(db, TRIP, 'trip.updated')
  expect([renamed?.fields, renamed?.driverId, renamed?.previousDriverId]).toStrictEqual(['name', undefined, undefined])
})

test('a trip with no driver names nobody when the warehouse starts staging it', async () => {
  const db = storeAs(DISPATCHER)
  await db.updateTrip(TRIP, { driverId: null })
  db.restoreSession(WAREHOUSE)
  await db.startLoading(TRIP)
  expect(await paramsOf(db, TRIP, 'loading.started')).toStrictEqual({ revisionId: 'REV-002' })
})

test('cancelling names the driver only of a trip already shown to them: while staging, loaded or in transit, not while still planned', async () => {
  const db = storeAs(DISPATCHER)
  await db.cancelTrip('TRIP-012', 'Khách huỷ đơn')
  await db.cancelTrip('TRIP-011', 'Xe hỏng máy lạnh')
  await db.cancelTrip('TRIP-010', 'Khách hoãn nhận hàng')
  await db.reportTripException('TRIP-009', { type: 'VEHICLE_BREAKDOWN', description: 'Xe hỏng hộp số ở Dĩ An', delayMinutes: 120 })
  await db.cancelTrip('TRIP-009', 'Xe hỏng, chờ cứu hộ')
  const cancelled = await Promise.all(['TRIP-012', 'TRIP-011', 'TRIP-009'].map((id) => paramsOf(db, id, 'trip.cancelled')))
  expect(cancelled).toStrictEqual([
    { reason: 'Khách huỷ đơn' },
    { reason: 'Xe hỏng máy lạnh', loaded: 110, driverId: 'US-0007' },
    { reason: 'Xe hỏng, chờ cứu hộ', returned: 120, driverId: 'US-0006' },
  ])
  expect((await paramsOf(db, 'TRIP-010', 'trip.cancelled'))?.driverId).toBe('US-0004')
})

test('the seed names drivers the same way: every loading event carries the driver of its trip, the trip cancelled while planned names none', async () => {
  const db = createMockDb()
  const drivers = new Map((await db.listTrips()).map((trip) => [trip.id, trip.driverId]))
  const events = await db.listEvents()
  const loading = events.filter((event) => event.action === 'loading.started' || event.action === 'loading.completed')
  expect(loading.filter((event) => event.params.driverId !== drivers.get(event.target.id))).toStrictEqual([])
  expect(loading).toHaveLength(19)
  expect(events.filter((event) => event.action === 'trip.cancelled').map((event) => [event.target.id, event.params.driverId])).toStrictEqual([['TRIP-004', undefined]])
  // Kiện hỏng duy nhất của seed (TRIP-003, bước 16) không có kiện tựa lên: bị bỏ lại kho, kho xếp tiếp — không nêu tài xế
  expect(events.filter((event) => event.action === 'loading.damaged').map((event) => [event.target.id, event.params.driverId])).toStrictEqual([['TRIP-003', undefined]])
})

/**
 * Chuyến hai thùng (`twoCartonTrip`, `TRIP-015`) của tài xế `US-0007`, phương án dựng tay đã duyệt, kho vừa bắt đầu soạn hàng. `stacked`:
 * thùng giao điểm 1 (`PKG-002-01`) đặt lên thùng giao điểm 3 (`PKG-001-01`, xếp trước) — thùng dưới hỏng thì chuyến phải xếp lại.
 */
async function stagingTwoCartons(stacked: boolean) {
  const db = storeAs(DISPATCHER)
  const { id } = await db.createTrip({ ...twoCartonTrip(), driverId: 'US-0007' })
  await approvePlan(db, id, stacked)
  db.restoreSession(WAREHOUSE)
  await db.startLoading(id)
  return { db, tripId: id }
}

/** Điều phối viên duyệt một phương án dựng tay cho mọi kiện hiện có của chuyến (bản đầu, hoặc bản mới sau khi chuyến quay về). */
async function approvePlan(db: MockDb, tripId: string, stacked: boolean) {
  db.restoreSession(DISPATCHER)
  const trip = await db.getTrip(tripId)
  const ids = (await db.listTripLabels(tripId)).map((label) => label.packageInstanceId)
  const placements = ids.map((packageInstanceId, index) => stacked && index === 1
    ? { ...SPEC_CARTON_A_PLACEMENT, packageInstanceId, xCm: 120, yCm: 0, zCm: 45, loadingOrder: 2, unloadingOrder: 1 }
    : { ...SPEC_CARTON_A_PLACEMENT, packageInstanceId, xCm: 120 + index * 120, yCm: 0, zCm: 0, loadingOrder: index + 1, unloadingOrder: ids.length - index })
  const revision = await db.addRevision({ tripId, request: { ...twoCartonRequest(), packages: trip.packages }, result: { ...twoCartonResult(), placements } })
  await db.approveRevision(revision.id, [])
}

test('a damaged package another one rests on sends the trip back to planned: the event names the driver, the trip is on hold for them', async () => {
  const { db, tripId } = await stagingTwoCartons(true)
  await stageAll(db, tripId)
  await db.reportDamagedPackage(tripId, 'PKG-001-01')
  expect((await db.getTrip(tripId)).phase).toBe('planning')
  // Kiện thêm ngay trong chuyến mang mã của bên gửi bằng mã instance (FE-3b-07)
  expect(await paramsOf(db, tripId, 'loading.damaged')).toStrictEqual({ packageInstanceId: 'PKG-001-01', packageCode: 'PKG-001-01', supporting: 1, driverId: 'US-0007' })
})

test('a damaged package nothing rests on is left at the warehouse and loading goes on: nothing changes for the driver, the event names nobody', async () => {
  const { db, tripId } = await stagingTwoCartons(false)
  await stageAll(db, tripId)
  await loadAll(db, tripId, 'PKG-002-01')
  await db.reportDamagedPackage(tripId, 'PKG-002-01')
  expect((await db.getTrip(tripId)).phase).toBe('loading')
  expect(await paramsOf(db, tripId, 'loading.damaged')).toStrictEqual({ packageInstanceId: 'PKG-002-01', packageCode: 'PKG-002-01' })
})

test('dropping a missing package sends the trip back to planned and names the driver; staging it again by a new plan says why it restarts', async () => {
  const { db, tripId } = await stagingTwoCartons(false)
  await db.reportStagingShortage(tripId, 'PKG-001-01')
  db.restoreSession(DISPATCHER)
  await db.resolveStagingShortage(tripId, 'PKG-001-01', 'DROP')
  // Người báo thiếu vẫn được nêu (chuông của nhân viên kho đó), cạnh tài xế của chuyến
  expect(await paramsOf(db, tripId, 'loading.shortageDropped')).toStrictEqual({ packageInstanceId: 'PKG-001-01', packageCode: 'PKG-001-01', requestedBy: WAREHOUSE, driverId: 'US-0007' })

  // Bản đầu REV-028 → duyệt REV-029; sau khi chuyến quay về: REV-030 → duyệt REV-031
  await approvePlan(db, tripId, false)
  db.restoreSession(WAREHOUSE)
  await db.startLoading(tripId)
  expect(await paramsOf(db, tripId, 'loading.started')).toStrictEqual({ revisionId: 'REV-031', replanReason: 'SHORTAGE', driverId: 'US-0007' })
  expect((await db.getTrip(tripId)).replan).toBeUndefined()
})

test('a trip on hold after going back to planned is still known to its driver: changing the driver or cancelling it names them', async () => {
  const { db, tripId } = await stagingTwoCartons(false)
  await db.reportStagingShortage(tripId, 'PKG-001-01')
  db.restoreSession(DISPATCHER)
  await db.resolveStagingShortage(tripId, 'PKG-001-01', 'DROP')
  expect((await db.getTrip(tripId)).phase).toBe('planning')

  await db.updateTrip(tripId, { driverId: 'US-0006' })
  expect(await paramsOf(db, tripId, 'trip.updated')).toStrictEqual({ fields: 'driverId', before: 'US-0007', after: 'US-0006', driverId: 'US-0006', previousDriverId: 'US-0007' })
  // Chuyến chưa lên xe kiện nào (đã về Đã lập kế hoạch): không có số kiện phải dỡ
  await db.cancelTrip(tripId, 'Khách huỷ đơn')
  expect(await paramsOf(db, tripId, 'trip.cancelled')).toStrictEqual({ reason: 'Khách huỷ đơn', driverId: 'US-0006' })
})
