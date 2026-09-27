import { expect, test } from 'vitest'
import { createMockDb } from '@/lib/mock-db'
import {
  filterTripRows, splitVehicleName, TRIP_STATUS_GROUP_SLUGS, tripFilterOptions, tripRow, tripsPerDate, tripTabCounts, UNASSIGNED_DRIVER, type TripRow,
} from './trip-list'

/** Seam: dòng danh sách chuyến dựng từ dữ liệu kho (chuyến + xe + tài xế + revision), không có số nào ngoài kho. */
async function seed() {
  const db = createMockDb()
  const [trip] = await db.listTrips()
  const vehicle = await db.getVehicle(trip!.vehicleId)
  return { db, trip: trip!, vehicle }
}

/** Mọi dòng của seed neo 14/09/2026, dựng như `fetchTrips`. */
async function seedRows(): Promise<TripRow[]> {
  const db = createMockDb()
  const [trips, vehicles, users] = await Promise.all([db.listTrips(), db.listVehicles(), db.listUsers()])
  return Promise.all(trips.map(async (trip) => tripRow(
    trip,
    vehicles.find((vehicle) => vehicle.id === trip.vehicleId),
    await db.listRevisions(trip.id),
    users.find((user) => user.id === trip.driverId),
  )))
}

const NO_FILTER = { 'trang-thai': '', tu: '', den: '', xe: '', 'tai-xe': '' } as const

test('seed trip: approved revision gives its volume utilisation, the "approved" status, run date and driver', async () => {
  const { db, trip, vehicle } = await seed()
  const driver = await db.getUser('US-0004')
  const row = tripRow(trip, vehicle, await db.listRevisions(trip.id), driver)
  expect(row).toMatchObject({
    id: 'TRIP-2026-0914', name: trip.name, vehicleName: vehicle.name, scheduledDate: '2026-09-14',
    driverId: 'US-0004', driverName: 'Phạm Quốc Dũng', packageCount: 132, status: 'da_duyet', phase: 'planning',
  })
  expect(row.volumePercent).toBeCloseTo(40.8, 1)
  expect(row.route).toBe(trip.stops.map((stop) => stop.name).join(' → '))
})

test('a trip without revisions is a draft with no utilisation and no driver', async () => {
  const { db, vehicle } = await seed()
  const created = await db.createTrip({ name: 'Chuyến Q.7', vehicleId: vehicle.id, stops: [{ id: 'S1', name: 'Q.7', address: '' }], packages: [], scheduledDate: '2026-09-15' })
  expect(tripRow(created, vehicle, [])).toMatchObject({ packageCount: 0, volumePercent: null, status: 'nhap', driverName: null })
})

test('changing cargo after optimisation makes the approved plan stale: optimised again, with the stale line (LM-104)', async () => {
  const { db, trip, vehicle } = await seed()
  const changed = await db.updateTrip(trip.id, { packages: trip.packages.slice(1) })
  expect(tripRow(changed, vehicle, await db.listRevisions(trip.id))).toMatchObject({ status: 'da_toi_uu', sub: { kind: 'stale' } })
})

test('an optimised but not yet approved trip is "optimised"', async () => {
  const { db, trip, vehicle } = await seed()
  const [source] = await db.listRevisions(trip.id)
  expect(tripRow(trip, vehicle, [source!]).status).toBe('da_toi_uu')
})

test('warehouse phases stay approved with a progress line; delivering is in transit (LM-104)', async () => {
  const rows = await seedRows()
  const statusOf = (id: string) => rows.find((row) => row.id === id)?.status
  expect([statusOf('TRIP-011'), statusOf('TRIP-010'), statusOf('TRIP-009'), statusOf('TRIP-001'), statusOf('TRIP-004')])
    .toStrictEqual(['da_duyet', 'da_duyet', 'dang_van_chuyen', 'hoan_thanh', 'da_huy'])
  expect([rows.find((row) => row.id === 'TRIP-011')?.sub, rows.find((row) => row.id === 'TRIP-010')?.sub])
    .toStrictEqual([{ kind: 'loading', recorded: 110, total: 280 }, { kind: 'loaded' }])
})

test('search ignores diacritics across name and route: "bien hoa" finds every trip through Biên Hoà and nothing else', async () => {
  const rows = await seedRows()
  const found = filterTripRows(rows, 'bien hoa', NO_FILTER)
  expect(found.length).toBeGreaterThan(0)
  for (const row of found) expect(`${row.name} ${row.route}`).toContain('Biên Hoà')
  expect(found.map((row) => row.id)).toEqual(expect.arrayContaining(['TRIP-2026-0914', 'TRIP-001', 'TRIP-013']))
  expect(rows.filter((row) => `${row.name} ${row.route}`.includes('Biên Hoà'))).toHaveLength(found.length)
})

test('search also matches vehicle and driver names', async () => {
  const rows = await seedRows()
  const byDriver = filterTripRows(rows, 'quoc dung', NO_FILTER)
  expect(byDriver.map((row) => row.id).toSorted()).toStrictEqual(['TRIP-002', 'TRIP-007', 'TRIP-010', 'TRIP-2026-0914'])
  const byVehicle = filterTripRows(rows, 'ollin', NO_FILTER)
  expect(byVehicle.length).toBeGreaterThan(0)
  expect(byVehicle.every((row) => row.vehicleId === 'VEHICLE-006')).toBe(true)
})

test('status, run-date range, vehicle and driver filters combine; "unassigned" finds trips with no driver', async () => {
  const rows = await seedRows()
  const ids = (filters: Partial<Record<keyof typeof NO_FILTER, string>>) =>
    filterTripRows(rows, '', { ...NO_FILTER, ...filters }).map((row) => row.id).toSorted()
  expect(ids({ 'trang-thai': 'dang_van_chuyen' })).toStrictEqual(['TRIP-009'])
  // Liên kết cũ (trước LM-104) vẫn lọc được
  expect(ids({ 'trang-thai': 'dang_giao' })).toStrictEqual(['TRIP-009'])
  expect(ids({ 'trang-thai': 'dang-thuc-hien' })).toStrictEqual(['TRIP-009'])
  expect(ids({ tu: '2026-09-14', den: '2026-09-14' })).toStrictEqual(['TRIP-009', 'TRIP-010', 'TRIP-011', 'TRIP-2026-0914'])
  expect(ids({ xe: 'VEHICLE-006' })).toStrictEqual(['TRIP-004', 'TRIP-005', 'TRIP-009'])
  expect(ids({ 'tai-xe': 'US-0004' })).toStrictEqual(['TRIP-002', 'TRIP-007', 'TRIP-010', 'TRIP-2026-0914'])
  expect(ids({ 'tai-xe': UNASSIGNED_DRIVER })).toStrictEqual(['TRIP-014'])
  expect(ids({ 'tai-xe': 'US-0004', tu: '2026-09-14' })).toStrictEqual(['TRIP-010', 'TRIP-2026-0914'])
})

test('status groups of the tabs (LM-104): "needs action" is optimised (stale included), "upcoming" is approved before the truck leaves', async () => {
  const rows = await seedRows()
  const ids = (status: string) => filterTripRows(rows, '', { ...NO_FILTER, 'trang-thai': status }).map((row) => row.id).toSorted()
  expect(ids(TRIP_STATUS_GROUP_SLUGS.review)).toStrictEqual(['TRIP-012', 'TRIP-013'])
  expect(ids(TRIP_STATUS_GROUP_SLUGS.upcoming)).toStrictEqual(['TRIP-010', 'TRIP-011', 'TRIP-2026-0914'])
  expect(ids('dang_van_chuyen')).toStrictEqual(['TRIP-009'])
})

test('tab counts: every trip, each group, in transit, completed and cancelled — with the draft they add up to all', async () => {
  const rows = await seedRows()
  // Seed neo 14/09/2026: 15 chuyến; TRIP-004 đã huỷ; TRIP-001…008 trừ 004 đã hoàn thành; TRIP-014 nháp chỉ nằm ở Tất cả
  const counts = tripTabCounts(rows)
  expect(counts).toStrictEqual({ all: 15, review: 2, upcoming: 3, transit: 1, completed: 7, cancelled: 1 })
  const drafts = rows.filter((row) => row.status === 'nhap').length
  expect(drafts + counts.review + counts.upcoming + counts.transit + counts.completed + counts.cancelled).toBe(counts.all)
})

test('trips per run date count the whole filtered list, one entry per date', async () => {
  const rows = await seedRows()
  const perDate = tripsPerDate(rows)
  expect(perDate.get('2026-09-14')).toBe(4)
  expect([...perDate.values()].reduce((sum, count) => sum + count, 0)).toBe(rows.length)
})

test('vehicle names split into model and plate at " · "; a name without a plate keeps an empty plate', () => {
  expect(splitVehicleName('Hyundai HD210 · 60C-446.32')).toStrictEqual({ model: 'Hyundai HD210', plate: '60C-446.32' })
  expect(splitVehicleName('Truck 6m')).toStrictEqual({ model: 'Truck 6m', plate: '' })
})

test('each row counts its delivery stops', async () => {
  const { db, trip, vehicle } = await seed()
  expect(tripRow(trip, vehicle, await db.listRevisions(trip.id)).stopCount).toBe(4)
})

test('filter options list only vehicles and drivers used by trips, in Vietnamese alphabetical order', async () => {
  const { vehicles, drivers } = tripFilterOptions(await seedRows())
  expect(vehicles.map((option) => option.value)).not.toContain('VEHICLE-008')
  expect(drivers.map((option) => option.label)).toStrictEqual(['Đặng Hoài Nam', 'Ngô Văn Bảo', 'Phạm Quốc Dũng', 'Trương Văn Lộc'])
})
