import { expect, test } from 'vitest'
import { createMockDb, type MockDb } from '@/lib/mock-db'
import type { Role } from '@/types/user'
import { isVisibleTo, myTrips } from './my-trips'

/** Seed neo 14/09 (seed-trips.ts): mọi số kỳ vọng lấy từ dòng kiện và kết cục của từng chuyến seed. */
async function tripsFor(db: MockDb, id: string, role: Role) {
  const [trips, vehicles] = await Promise.all([db.listTrips(), db.listVehicles()])
  const entries = await Promise.all(trips.map(async (trip) => ({ trip, revisions: await db.listRevisions(trip.id) })))
  return myTrips(entries, new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.name])), { id, role })
}

test('the demo driver sees only their trips: the loaded one to deliver, the main trip still at the warehouse, recent completed ones', async () => {
  const groups = await tripsFor(createMockDb(), 'US-0004', 'driver')
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

test('a viewer who is not a driver sees every trip: delivering before loaded, loading before approved, the five latest completed', async () => {
  const groups = await tripsFor(createMockDb(), 'US-0001', 'dispatcher')
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
  const groups = await tripsFor(createMockDb(), 'US-0006', 'driver')
  expect([groups.ready, groups.preparing, groups.recent].map((rows) => rows.map((row) => row.id))).toStrictEqual([
    ['TRIP-009'], [], ['TRIP-006', 'TRIP-001'],
  ])
})

test('visibility: a driver sees trips assigned to them only, other roles see all', () => {
  expect(isVisibleTo({ driverId: 'US-0004' }, { id: 'US-0004', role: 'driver' })).toBe(true)
  expect(isVisibleTo({ driverId: 'US-0006' }, { id: 'US-0004', role: 'driver' })).toBe(false)
  expect(isVisibleTo({ driverId: null }, { id: 'US-0004', role: 'driver' })).toBe(false)
  expect(isVisibleTo({ driverId: null }, { id: 'US-0001', role: 'dispatcher' })).toBe(true)
})
