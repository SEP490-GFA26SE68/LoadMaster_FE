import { expect, test } from 'vitest'
import { createMockDb } from '@/lib/mock-db'
import { isVisibleTo, myTrips, type TripRevisions } from './my-trips'

/**
 * Seed neo 14/09 (seed-trips.ts): mọi số kỳ vọng lấy từ dòng kiện và kết cục của từng chuyến seed. Kho đọc dưới phiên của `sessionId`
 * như ở màn tài xế (kho chỉ trả chuyến của công ty người đó, FE-0-02); `reassign` gán mọi chuyến đọc được cho người xem.
 */
async function tripsFor(viewerId: string, { sessionId = viewerId, reassign = false } = {}) {
  const db = createMockDb()
  db.restoreSession(sessionId)
  const [trips, vehicles] = await Promise.all([db.listTrips(), db.listVehicles()])
  const entries: TripRevisions[] = await Promise.all(trips.map(async (trip) => ({
    trip: reassign ? { ...trip, driverId: viewerId } : trip,
    revisions: await db.listRevisions(trip.id),
  })))
  return myTrips(entries, new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.name])), { id: viewerId })
}

test('the demo driver sees only their trips, grouped by status (FE-6-01): the loaded one to depart with and the recent delivered ones; a planned trip is not listed', async () => {
  const groups = await tripsFor('US-0004')
  // TRIP-010: 80 + 40 + 45 + 45 kiện, 3 điểm, đã xếp xong
  expect(groups.loaded).toStrictEqual([{
    id: 'TRIP-010', name: 'Tuyến Thủ Đức – An Phú – Phú Nhuận', scheduledDate: '2026-09-14', vehicleName: 'Isuzu NQR 550 · 51C-284.19',
    status: 'LOADING', sub: { kind: 'loaded' }, manualSub: null, stopCount: 3, packageCount: 210, currentStop: undefined,
    completedAt: undefined, issueCount: 0, recheck: 0,
  }])
  // TRIP-2026-0914 (Đã lập kế hoạch, đã duyệt, kho chưa bắt đầu) cũng gán cho tài xế này nhưng không còn hiện
  expect([groups.inTransit, groups.preparing]).toStrictEqual([[], []])
  // Đã giao mới nhất trước: TRIP-007 (7 ngày trước, 1 sự cố khách từ chối) rồi TRIP-002 (24 ngày trước)
  expect(groups.recent.map((row) => [row.id, row.status, row.issueCount])).toStrictEqual([['TRIP-007', 'DELIVERED', 1], ['TRIP-002', 'DELIVERED', 0]])
})

test('every Long Bình trip given to one driver: in transit, loaded, being loaded (view only), and the five latest delivered', async () => {
  const groups = await tripsFor('US-0004', { reassign: true })
  expect(groups.inTransit.map((row) => [row.id, row.status, row.currentStop])).toStrictEqual([['TRIP-009', 'IN_TRANSIT', 2]])
  expect(groups.loaded.map((row) => [row.id, row.status, row.sub])).toStrictEqual([['TRIP-010', 'LOADING', { kind: 'loaded' }]])
  expect(groups.preparing.map((row) => [row.id, row.status, row.sub])).toStrictEqual([
    ['TRIP-011', 'LOADING', { kind: 'loading', recorded: 110, total: 280 }],
  ])
  // Huỷ (TRIP-004) và mọi chuyến còn lập kế hoạch — đã duyệt (TRIP-2026-0914), chờ duyệt (TRIP-012), lỗi thời (TRIP-013), nháp
  // (TRIP-014) — không hiện; TRIP-003 có 1 kiện kho báo thiếu
  expect(groups.recent.map((row) => [row.id, row.packageCount])).toStrictEqual([
    ['TRIP-008', 400], ['TRIP-007', 85], ['TRIP-006', 175], ['TRIP-005', 200], ['TRIP-003', 144],
  ])
})

test('another driver sees none of the demo driver trips', async () => {
  const groups = await tripsFor('US-0006')
  expect([groups.inTransit, groups.loaded, groups.preparing, groups.recent].map((rows) => rows.map((row) => row.id))).toStrictEqual([
    ['TRIP-009'], [], [], ['TRIP-006', 'TRIP-001'],
  ])
})

test('the Phương Nam driver sees their trip once the Phú Thuận warehouse starts loading it, never a Long Bình trip (FE-0-02)', async () => {
  // TRIP-PN-001 (30 thùng linh kiện + 12 kiện vải cuộn, 2 điểm) đã duyệt nhưng kho chưa bắt đầu: chưa hiện
  expect(await tripsFor('US-PN-04')).toStrictEqual({ inTransit: [], loaded: [], preparing: [], recent: [] })
  const db = createMockDb()
  db.restoreSession('US-0015')
  await db.startLoading('TRIP-PN-001')
  db.restoreSession('US-PN-04')
  const entries: TripRevisions[] = await Promise.all((await db.listTrips()).map(async (trip) => ({ trip, revisions: await db.listRevisions(trip.id) })))
  const groups = myTrips(entries, new Map((await db.listVehicles()).map((vehicle) => [vehicle.id, vehicle.name])), { id: 'US-PN-04' })
  expect(groups.preparing.map((row) => [row.id, row.status, row.sub, row.stopCount, row.packageCount, row.vehicleName])).toStrictEqual([
    ['TRIP-PN-001', 'LOADING', { kind: 'loading', recorded: 0, total: 42 }, 2, 42, 'Isuzu QKR 230 · 51C-907.41'],
  ])
})

test('visibility fails closed: only the driver a trip is assigned to sees it — no role sees every trip, an unassigned trip shows to nobody', async () => {
  expect(isVisibleTo({ driverId: 'US-0004' }, { id: 'US-0004' })).toBe(true)
  expect(isVisibleTo({ driverId: 'US-0006' }, { id: 'US-0004' })).toBe(false)
  expect(isVisibleTo({ driverId: null }, { id: 'US-0004' })).toBe(false)
  // Người không phải tài xế của chuyến nào (điều phối viên) không thấy gì, dù kho trả cho họ mọi chuyến của công ty
  expect(isVisibleTo({ driverId: null }, { id: 'US-0001' })).toBe(false)
  const groups = await tripsFor('US-0001')
  expect(groups).toStrictEqual({ inTransit: [], loaded: [], preparing: [], recent: [] })
})
