import { expect, test } from 'vitest'
import { createMockDb } from '@/lib/mock-db'
import {
  filterTripRows, needsAction, normalizeStatusFilter, splitVehicleName, TRIP_LIST_TABS, tripFilterOptions, tripRow, tripsPerDate, tripTabCounts,
  UNASSIGNED_DRIVER, type TripRow,
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

test('seed trip: approved revision gives its volume utilisation, the "planned" status with the "approved" line, run date and driver', async () => {
  const { db, trip, vehicle } = await seed()
  const driver = await db.getUser('US-0004')
  const row = tripRow(trip, vehicle, await db.listRevisions(trip.id), driver)
  expect(row).toMatchObject({
    id: 'TRIP-2026-0914', name: trip.name, vehicleName: vehicle.name, scheduledDate: '2026-09-14',
    driverId: 'US-0004', driverName: 'Phạm Quốc Dũng', packageCount: 132, status: 'PLANNED', sub: { kind: 'approved' }, phase: 'planning',
  })
  expect(row.volumePercent).toBeCloseTo(40.8, 1)
  expect(row.route).toBe(trip.stops.map((stop) => stop.name).join(' → '))
})

test('a trip without revisions is a draft with no secondary line, no utilisation and no driver', async () => {
  const { db, vehicle } = await seed()
  const created = await db.createTrip({ name: 'Chuyến Q.7', vehicleId: vehicle.id, stops: [{ id: 'S1', name: 'Q.7', address: '' }], packages: [], scheduledDate: '2026-09-15' })
  expect(tripRow(created, vehicle, [])).toMatchObject({ packageCount: 0, volumePercent: null, status: 'DRAFT', sub: null, driverName: null })
})

test('changing cargo after optimisation makes the approved plan stale: still planned, with the stale line (FE-0-05)', async () => {
  const { db, trip, vehicle } = await seed()
  const changed = await db.updateTrip(trip.id, { packages: trip.packages.slice(1) })
  expect(tripRow(changed, vehicle, await db.listRevisions(trip.id))).toMatchObject({ status: 'PLANNED', sub: { kind: 'stale' } })
})

test('an optimised but not yet approved trip is planned, awaiting approval', async () => {
  const { db, trip, vehicle } = await seed()
  const [source] = await db.listRevisions(trip.id)
  expect(tripRow(trip, vehicle, [source!])).toMatchObject({ status: 'PLANNED', sub: { kind: 'awaitingApproval' } })
})

test('warehouse phases are "loading" with a progress line; delivering is in transit, completed is delivered (FE-0-05)', async () => {
  const rows = await seedRows()
  const statusOf = (id: string) => rows.find((row) => row.id === id)?.status
  expect([statusOf('TRIP-011'), statusOf('TRIP-010'), statusOf('TRIP-009'), statusOf('TRIP-001'), statusOf('TRIP-004')])
    .toStrictEqual(['LOADING', 'LOADING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'])
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
  expect(ids({ 'trang-thai': 'dang-van-chuyen' })).toStrictEqual(['TRIP-009'])
  expect(ids({ tu: '2026-09-14', den: '2026-09-14' })).toStrictEqual(['TRIP-009', 'TRIP-010', 'TRIP-011', 'TRIP-2026-0914'])
  expect(ids({ xe: 'VEHICLE-006' })).toStrictEqual(['TRIP-004', 'TRIP-005', 'TRIP-009'])
  expect(ids({ 'tai-xe': 'US-0004' })).toStrictEqual(['TRIP-002', 'TRIP-007', 'TRIP-010', 'TRIP-2026-0914'])
  expect(ids({ 'tai-xe': UNASSIGNED_DRIVER })).toStrictEqual(['TRIP-014'])
  expect(ids({ 'tai-xe': 'US-0004', tu: '2026-09-14' })).toStrictEqual(['TRIP-010', 'TRIP-2026-0914'])
})

test('the status filter takes one slug per status, Vietnamese without diacritics (FE-0-05)', async () => {
  const rows = await seedRows()
  const ids = (status: string) => filterTripRows(rows, '', { ...NO_FILTER, 'trang-thai': status }).map((row) => row.id).toSorted()
  // Seed neo 14/09/2026: TRIP-014 nháp; chuyến chính đã duyệt, TRIP-012 chờ duyệt, TRIP-013 lỗi thời; TRIP-011 đang xếp, TRIP-010 xếp xong
  expect(ids('nhap')).toStrictEqual(['TRIP-014'])
  expect(ids('da-lap-ke-hoach')).toStrictEqual(['TRIP-012', 'TRIP-013', 'TRIP-2026-0914'])
  expect(ids('dang-xep-hang')).toStrictEqual(['TRIP-010', 'TRIP-011'])
  expect(ids('dang-van-chuyen')).toStrictEqual(['TRIP-009'])
  expect(ids('da-giao')).toStrictEqual(['TRIP-001', 'TRIP-002', 'TRIP-003', 'TRIP-005', 'TRIP-006', 'TRIP-007', 'TRIP-008'])
  expect(ids('da-huy')).toStrictEqual(['TRIP-004'])
  // Giá trị lạ không khớp chuyến nào
  expect(ids('khong-co')).toStrictEqual([])
})

test('old status values on saved links read as the new slugs and still filter (FE-0-05)', async () => {
  // Sáu trạng thái của LM-104
  expect(['nhap', 'da_toi_uu', 'da_duyet', 'dang_van_chuyen', 'hoan_thanh', 'da_huy'].map(normalizeStatusFilter))
    .toStrictEqual(['nhap', 'da-lap-ke-hoach', 'da-lap-ke-hoach', 'dang-van-chuyen', 'da-giao', 'da-huy'])
  // Hai nhóm tab của LM-104
  expect(['can-xu-ly', 'sap-chay'].map(normalizeStatusFilter)).toStrictEqual(['da-lap-ke-hoach', 'da-lap-ke-hoach'])
  // Trước LM-104: mười trạng thái và nhóm "đang thực hiện"
  expect(['dang-thuc-hien', 'dang_giao', 'dang_xep_hang', 'da_xep_xong', 'can_xem_lai', 'dang_toi_uu'].map(normalizeStatusFilter))
    .toStrictEqual(['dang-van-chuyen', 'dang-van-chuyen', 'dang-xep-hang', 'dang-xep-hang', 'da-lap-ke-hoach', 'da-lap-ke-hoach'])
  // Slug mới và rỗng giữ nguyên
  expect(['', 'da-lap-ke-hoach', 'dang-xep-hang', 'da-giao'].map(normalizeStatusFilter)).toStrictEqual(['', 'da-lap-ke-hoach', 'dang-xep-hang', 'da-giao'])

  const rows = await seedRows()
  const ids = (status: string) => filterTripRows(rows, '', { ...NO_FILTER, 'trang-thai': status }).map((row) => row.id).toSorted()
  expect(ids('da_duyet')).toStrictEqual(['TRIP-012', 'TRIP-013', 'TRIP-2026-0914'])
  expect(ids('hoan_thanh')).toHaveLength(7)
  expect(ids('dang_giao')).toStrictEqual(['TRIP-009'])
  expect(ids('da_xep_xong')).toStrictEqual(['TRIP-010', 'TRIP-011'])
})

test('tabs are "all" then the six statuses in lifecycle order, each with its URL slug; their counts add up to all', async () => {
  expect(TRIP_LIST_TABS).toStrictEqual([
    { key: 'all', value: '' },
    { key: 'DRAFT', value: 'nhap' },
    { key: 'PLANNED', value: 'da-lap-ke-hoach' },
    { key: 'LOADING', value: 'dang-xep-hang' },
    { key: 'IN_TRANSIT', value: 'dang-van-chuyen' },
    { key: 'DELIVERED', value: 'da-giao' },
    { key: 'CANCELLED', value: 'da-huy' },
  ])
  const rows = await seedRows()
  // Seed neo 14/09/2026: 15 chuyến; TRIP-004 đã huỷ; TRIP-001…008 trừ 004 đã giao; TRIP-014 nháp
  expect(tripTabCounts(rows)).toStrictEqual({ all: 15, DRAFT: 1, PLANNED: 3, LOADING: 2, IN_TRANSIT: 1, DELIVERED: 7, CANCELLED: 1 })
})

test('trips that need the user: planned with a plan awaiting approval or a stale plan — not the approved one, not warehouse phases', async () => {
  const rows = await seedRows()
  expect(rows.filter(needsAction).map((row) => row.id).toSorted()).toStrictEqual(['TRIP-012', 'TRIP-013'])
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
