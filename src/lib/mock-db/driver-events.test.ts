import { expect, test } from 'vitest'
import { createMockDb, type AuditEvent, type MockDb } from '@/lib/mock-db'

/**
 * Kho nêu tài xế của chuyến trong sự kiện (tham số `driverId` — chuông của tài xế đọc nó) chỉ khi chuyến đang hiện ở "Chuyến của tôi" của
 * họ: từ lúc kho bắt đầu soạn hàng (FE-6-01). Đổi tài xế lúc đó nêu cả người vừa bị thay (`previousDriverId`). Kho neo 14/09.
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
})
