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

test('the demo driver sees only their trips: the loaded one to deliver, the main trip still at the warehouse, recent completed ones', async () => {
  const groups = await tripsFor('US-0004')
  // TRIP-010: 80 + 40 + 45 + 45 kiện, 3 điểm, đã xếp xong
  expect(groups.ready).toStrictEqual([{
    id: 'TRIP-010', name: 'Tuyến Thủ Đức – An Phú – Phú Nhuận', scheduledDate: '2026-09-14', vehicleName: 'Isuzu NQR 550 · 51C-284.19',
    status: 'LOADING', sub: { kind: 'loaded' }, stopCount: 3, packageCount: 210, currentStop: undefined,
    completedAt: undefined, issueCount: 0,
  }])
  expect(groups.preparing.map((row) => [row.id, row.status, row.sub, row.stopCount, row.packageCount])).toStrictEqual([
    ['TRIP-2026-0914', 'PLANNED', { kind: 'approved' }, 4, 132],
  ])
  // Đã giao mới nhất trước: TRIP-007 (7 ngày trước, 1 sự cố khách từ chối) rồi TRIP-002 (24 ngày trước)
  expect(groups.recent.map((row) => [row.id, row.status, row.issueCount])).toStrictEqual([['TRIP-007', 'DELIVERED', 1], ['TRIP-002', 'DELIVERED', 0]])
})

test('order within the groups, with every Long Bình trip given to one driver: delivering before loaded, loading before approved, the five latest completed', async () => {
  const groups = await tripsFor('US-0004', { reassign: true })
  expect(groups.ready.map((row) => [row.id, row.status, row.currentStop])).toStrictEqual([
    ['TRIP-009', 'IN_TRANSIT', 2],
    ['TRIP-010', 'LOADING', undefined],
  ])
  expect(groups.preparing.map((row) => [row.id, row.status, row.sub])).toStrictEqual([
    ['TRIP-011', 'LOADING', { kind: 'loading', recorded: 110, total: 280 }],
    ['TRIP-2026-0914', 'PLANNED', { kind: 'approved' }],
  ])
  // Huỷ (TRIP-004), chờ duyệt (TRIP-012), lỗi thời (TRIP-013), nháp (TRIP-014) không hiện; TRIP-003 có 1 kiện kho báo thiếu
  expect(groups.recent.map((row) => [row.id, row.packageCount])).toStrictEqual([
    ['TRIP-008', 400], ['TRIP-007', 85], ['TRIP-006', 175], ['TRIP-005', 200], ['TRIP-003', 144],
  ])
})

test('another driver sees none of the demo driver trips', async () => {
  const groups = await tripsFor('US-0006')
  expect([groups.ready, groups.preparing, groups.recent].map((rows) => rows.map((row) => row.id))).toStrictEqual([
    ['TRIP-009'], [], ['TRIP-006', 'TRIP-001'],
  ])
})

test('the Phương Nam driver sees the one approved trip of their company, waiting at the Phú Thuận depot (FE-0-02)', async () => {
  const groups = await tripsFor('US-PN-04')
  expect(groups.ready).toStrictEqual([])
  // TRIP-PN-001: 30 thùng linh kiện + 12 kiện vải cuộn, 2 điểm, đã duyệt chờ kho xếp
  expect(groups.preparing.map((row) => [row.id, row.status, row.sub, row.stopCount, row.packageCount, row.vehicleName])).toStrictEqual([
    ['TRIP-PN-001', 'PLANNED', { kind: 'approved' }, 2, 42, 'Isuzu QKR 230 · 51C-907.41'],
  ])
  expect(groups.recent).toStrictEqual([])
})

test('visibility fails closed: only the driver a trip is assigned to sees it — no role sees every trip, an unassigned trip shows to nobody', async () => {
  expect(isVisibleTo({ driverId: 'US-0004' }, { id: 'US-0004' })).toBe(true)
  expect(isVisibleTo({ driverId: 'US-0006' }, { id: 'US-0004' })).toBe(false)
  expect(isVisibleTo({ driverId: null }, { id: 'US-0004' })).toBe(false)
  // Người không phải tài xế của chuyến nào (điều phối viên) không thấy gì, dù kho trả cho họ mọi chuyến của công ty
  expect(isVisibleTo({ driverId: null }, { id: 'US-0001' })).toBe(false)
  const groups = await tripsFor('US-0001')
  expect([groups.ready, groups.preparing, groups.recent]).toStrictEqual([[], [], []])
})
