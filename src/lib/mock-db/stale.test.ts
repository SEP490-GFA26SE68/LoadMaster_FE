import { afterEach, expect, test, vi } from 'vitest'
import { createMockDb, isStale } from '@/lib/mock-db'
import { optimizedTwoCartonTrip, twoCartonRequest, twoCartonResult } from '@/test/mock-db-samples'

afterEach(() => {
  vi.useRealTimers()
})

test('a result is added as a revision stamped with the input version of the trip and the time it was added', async () => {
  vi.setSystemTime(new Date('2026-09-15T08:30:00.000Z'))
  const db = createMockDb()
  const { trip, revision } = await optimizedTwoCartonTrip(db)
  expect(revision).toStrictEqual({
    // the seed already holds REV-001 … REV-027 as numbered ids of its 14 optimized trips (the other candidates carry a letter suffix)
    id: 'REV-028',
    jobId: 'MOCK-JOB-001',
    tripId: trip.id,
    request: twoCartonRequest(),
    result: twoCartonResult(),
    inputVersion: 1,
    createdAt: '2026-09-15T08:30:00.000Z',
    manuallyEdited: false,
    ordersRecomputed: false,
    // LM-104: nơi gọi không chọn thì kho ghi mục tiêu và thuật toán mặc định; kết quả lưu lẻ là một lần chạy một phương án
    run: { objective: 'MAX_VOLUME', algorithm: 'EP_DBLF' },
    runId: 'RUN-016',
  })
  expect(await db.listRevisions(trip.id)).toStrictEqual([revision])
  expect(await db.getRevision(revision.id)).toStrictEqual(revision)
  expect(isStale(revision, trip)).toBe(false)
})

test('saving the same packages again, even with their fields in another order, keeps the revision fresh', async () => {
  const db = createMockDb()
  const { trip, revision } = await optimizedTwoCartonTrip(db)
  // A form hands back the same values but not necessarily in the order they were stored
  const reordered = trip.packages.map(({ id, name, ...rest }) => ({ ...rest, name, id }))
  const saved = await db.updateTrip(trip.id, { name: 'Tuyến Thủ Đức – Biên Hoà', packages: reordered })
  expect(isStale(revision, saved)).toBe(false)
})

test('editing a package after the result makes the revision stale', async () => {
  const db = createMockDb()
  const { trip, revision } = await optimizedTwoCartonTrip(db)
  const heavier = trip.packages.map((pkg) => (pkg.id === 'PKG-002' ? { ...pkg, weightKg: 35 } : pkg))
  const edited = await db.updateTrip(trip.id, { packages: heavier })
  expect(isStale(revision, edited)).toBe(true)
  expect(await db.getRevision(revision.id)).toStrictEqual(revision)
})

test('editing the vehicle of the trip makes the revision stale but leaves trips on other vehicles as they were', async () => {
  const db = createMockDb()
  const { trip, revision } = await optimizedTwoCartonTrip(db)
  const otherTrip = await db.getTrip('TRIP-2026-0914')
  const truck = await db.getVehicle(trip.vehicleId)
  await db.updateVehicle(truck)
  expect(isStale(revision, await db.getTrip(trip.id))).toBe(false)
  await db.updateVehicle({ ...truck, doorHeightCm: 220 })
  expect(isStale(revision, await db.getTrip(trip.id))).toBe(true)
  expect(await db.getTrip(otherTrip.id)).toStrictEqual(otherTrip)
})

test('moving the trip to another vehicle makes the revision stale', async () => {
  const db = createMockDb()
  const { trip, revision } = await optimizedTwoCartonTrip(db)
  expect(isStale(revision, await db.updateTrip(trip.id, { vehicleId: 'VEHICLE-002' }))).toBe(true)
})
