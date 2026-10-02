import { expect, test } from 'vitest'
import { createMockDb } from '@/lib/mock-db'
import { twoCartonRequest, twoCartonResult, twoCartonTrip } from '@/test/mock-db-samples'

/** Kho của Long Bình và Phương Nam, chép từ `seed-depots.ts`. */
const LONG_BINH_DEPOT = { name: 'Kho Long Bình', address: '9 Đường 3A, KCN Biên Hoà 2, Biên Hoà, Đồng Nai', lat: 10.9294, lng: 106.8747 }
const PHUONG_NAM_DEPOT = { name: 'Kho Phú Thuận', address: '102 Nguyễn Văn Quỳ, P. Phú Thuận, Quận 7, TP. Hồ Chí Minh', lat: 10.7308, lng: 106.7353 }

test('a created trip gets the next trip id, starts planning at input version 1 and is stamped with the time it was created', async () => {
  const db = createMockDb({ now: () => new Date('2026-09-15T02:00:00.000Z') })
  // no session: the new trip belongs to the default company LOG-001 (FE-0-02)
  expect(await db.createTrip(twoCartonTrip())).toStrictEqual({
    ...twoCartonTrip(), id: 'TRIP-015', companyId: 'LOG-001', inputVersion: 1, driverId: null, phase: 'planning', createdAt: '2026-09-15T02:00:00.000Z',
    // Nơi tạo chỉ đưa ngày chạy: xuất phát 08:00 giờ Việt Nam, từ kho của công ty
    departureAt: '2026-09-15T01:00:00.000Z', depot: LONG_BINH_DEPOT,
  })
  const ids = (await db.listTrips()).map(({ id }) => id)
  // the sample trip comes first, then the 14 seeded trips of Long Bình in creation order, the 2 of Phương Nam (`TRIP-PN-…` ids that
  // `nextId` does not count), and the new one
  expect([ids[0], ids.at(-1), ids.length]).toStrictEqual(['TRIP-2026-0914', 'TRIP-015', 18])
})

test('an update changes only the fields it gives and never the id or the input version', async () => {
  const db = createMockDb()
  const before = await db.getTrip('TRIP-2026-0914')
  const renamed = await db.updateTrip(before.id, { name: 'Tuyến Dĩ An – Biên Hoà' })
  expect(renamed).toStrictEqual({ ...before, name: 'Tuyến Dĩ An – Biên Hoà' })
  // A caller spreading an old copy of the trip must not reset the version that revisions are compared with
  const spreadOldCopy = { ...renamed, id: 'TRIP-999', inputVersion: 0 }
  expect(await db.updateTrip(before.id, spreadOldCopy)).toStrictEqual(renamed)
})

test('a trip must exist to be updated and must use an existing vehicle', async () => {
  const db = createMockDb()
  await expect(db.updateTrip('TRIP-404', { name: 'Tuyến mới' })).rejects.toMatchObject({
    code: 'NOT_FOUND',
    params: { collection: 'trips', id: 'TRIP-404' },
  })
  const missingVehicle = { code: 'NOT_FOUND', params: { collection: 'vehicles', id: 'VEHICLE-404' } }
  await expect(db.createTrip({ ...twoCartonTrip(), vehicleId: 'VEHICLE-404' })).rejects.toMatchObject(missingVehicle)
  await expect(db.updateTrip('TRIP-2026-0914', { vehicleId: 'VEHICLE-404' })).rejects.toMatchObject(missingVehicle)
})

test('revisions cannot be listed or added for a trip that does not exist', async () => {
  const db = createMockDb()
  const missingTrip = { code: 'NOT_FOUND', params: { collection: 'trips', id: 'TRIP-404' } }
  await expect(db.listRevisions('TRIP-404')).rejects.toMatchObject(missingTrip)
  const newRevision = { tripId: 'TRIP-404', request: twoCartonRequest(), result: twoCartonResult() }
  await expect(db.addRevision(newRevision)).rejects.toMatchObject(missingTrip)
})

test('an edit that changes one value logs it before → after; an edit of several values logs only the field names', async () => {
  const db = createMockDb()
  const trip = await db.getTrip('TRIP-2026-0914')
  const latest = async () => (await db.listEvents({ targetId: trip.id }))[0]

  await db.updateTrip(trip.id, { name: 'Tuyến Dĩ An – Biên Hoà' })
  expect((await latest())?.params).toStrictEqual({ fields: 'name', before: trip.name, after: 'Tuyến Dĩ An – Biên Hoà' })

  await db.updateTrip(trip.id, { driverId: null })
  expect((await latest())?.params).toStrictEqual({ fields: 'driverId', before: trip.driverId, after: '' })

  const [first, ...rest] = trip.packages
  await db.updateTrip(trip.id, { packages: [{ ...first!, quantity: 40 }, ...rest] })
  expect((await latest())?.params).toStrictEqual({ fields: 'packages', packageId: 'PKG-001', field: 'quantity', before: 38, after: 40 })

  // Hướng đặt là danh sách: chỉ ghi mã kiện
  await db.updateTrip(trip.id, { packages: [{ ...first!, quantity: 40, allowedOrientations: ['LWH'] }, ...rest] })
  expect((await latest())?.params).toStrictEqual({ fields: 'packages', packageId: 'PKG-001' })

  // Hai dòng kiện đổi, hoặc hai trường chuyến đổi: không có trước → sau
  await db.updateTrip(trip.id, { packages: trip.packages.map((pkg) => ({ ...pkg, quantity: pkg.quantity + 1 })) })
  expect((await latest())?.params).toStrictEqual({ fields: 'packages' })
  await db.updateTrip(trip.id, { name: 'Tuyến Q.7', scheduledDate: '2026-09-30' })
  expect((await latest())?.params).toStrictEqual({ fields: 'name,scheduledDate' })
})

test('a trip has a departure time and a departure depot: the run date follows the time, the depot defaults to the depot of the company', async () => {
  const db = createMockDb()
  // Seed: chuyến chính đi 13:30 ngày neo, các chuyến khác 08:00 ngày chạy (giờ Việt Nam), đều từ kho của công ty
  expect((await db.listTrips()).slice(0, 2).map((trip) => [trip.id, trip.scheduledDate, trip.departureAt, trip.depot.name])).toStrictEqual([
    ['TRIP-2026-0914', '2026-09-14', '2026-09-14T06:30:00.000Z', 'Kho Long Bình'], ['TRIP-001', '2026-08-18', '2026-08-18T01:00:00.000Z', 'Kho Long Bình'],
  ])
  expect((await db.getTrip('TRIP-PN-001')).depot).toStrictEqual(PHUONG_NAM_DEPOT)

  // 23:30 ngày 15/09 giờ Việt Nam còn là 16:30 UTC cùng ngày; 00:30 ngày 16/09 giờ Việt Nam là 17:30 UTC ngày 15/09
  const depot = { name: ' Bãi xe Tân Vạn ', address: ' QL1A, Dĩ An ', lat: 10.9, lng: 106.82 }
  const created = await db.createTrip({ ...twoCartonTrip(), scheduledDate: '2026-09-20', departureAt: '2026-09-16T00:30:00+07:00', depot })
  expect([created.scheduledDate, created.departureAt, created.depot]).toStrictEqual([
    '2026-09-16', '2026-09-15T17:30:00.000Z', { name: 'Bãi xe Tân Vạn', address: 'QL1A, Dĩ An', lat: 10.9, lng: 106.82 },
  ])
  db.restoreSession('US-PN-03')
  expect((await db.createTrip({ ...twoCartonTrip(), vehicleId: 'VEHICLE-PN-02' })).depot).toStrictEqual(PHUONG_NAM_DEPOT)
  db.restoreSession('US-0001')

  const invalid = (input: Parameters<typeof db.createTrip>[0], field: string) =>
    expect(db.createTrip(input)).rejects.toMatchObject({ code: 'TRIP_INVALID', params: { tripId: 'TRIP-017', field } })
  await invalid({ ...twoCartonTrip(), departureAt: 'sáng mai' }, 'departureAt')
  await invalid({ ...twoCartonTrip(), depot: { ...depot, name: '  ' } }, 'depot')
  await invalid({ ...twoCartonTrip(), depot: { ...depot, lat: 91 } }, 'depot')
})

test('moving the run date keeps the time of day; a new departure time moves the run date; neither makes the plan stale', async () => {
  const db = createMockDb()
  const trip = await db.getTrip('TRIP-2026-0914')
  const latest = async () => (await db.listEvents({ targetId: trip.id }))[0]

  const moved = await db.updateTrip(trip.id, { scheduledDate: '2026-09-30' })
  expect([moved.scheduledDate, moved.departureAt, moved.inputVersion]).toStrictEqual(['2026-09-30', '2026-09-30T06:30:00.000Z', trip.inputVersion])
  expect((await latest())?.params).toStrictEqual({ fields: 'scheduledDate', before: '2026-09-14', after: '2026-09-30' })

  // Chỉ đổi giờ trong ngày: ngày chạy giữ nguyên
  const later = await db.updateTrip(trip.id, { departureAt: '2026-09-30T15:00:00+07:00' })
  expect([later.scheduledDate, later.departureAt]).toStrictEqual(['2026-09-30', '2026-09-30T08:00:00.000Z'])
  expect((await latest())?.params).toStrictEqual({ fields: 'departureAt' })

  // Giờ xuất phát sang ngày khác kéo ngày chạy theo, dù nơi gọi gửi ngày chạy cũ
  const next = await db.updateTrip(trip.id, { scheduledDate: '2026-09-30', departureAt: '2026-10-01T06:00:00+07:00' })
  expect([next.scheduledDate, next.departureAt]).toStrictEqual(['2026-10-01', '2026-09-30T23:00:00.000Z'])
  expect((await latest())?.params).toStrictEqual({ fields: 'scheduledDate,departureAt' })

  const depot = { name: 'Bãi xe Tân Vạn', address: 'QL1A, Dĩ An', lat: 10.9, lng: 106.82 }
  const rehomed = await db.updateTrip(trip.id, { depot })
  expect([rehomed.depot, rehomed.inputVersion]).toStrictEqual([depot, trip.inputVersion])
  expect((await latest())?.params).toStrictEqual({ fields: 'departureDepot' })
  // Lưu lại đúng dữ liệu đang có: không ghi gì
  const events = (await db.listEvents()).length
  expect(await db.updateTrip(trip.id, { departureAt: '2026-10-01T06:00:00+07:00', scheduledDate: '2026-10-01', depot })).toStrictEqual(rehomed)
  expect(await db.listEvents()).toHaveLength(events)
  await expect(db.updateTrip(trip.id, { depot: { ...depot, lng: 181 } })).rejects.toMatchObject({ code: 'TRIP_INVALID', params: { tripId: trip.id, field: 'depot' } })
  await expect(db.updateTrip(trip.id, { departureAt: 'x' })).rejects.toMatchObject({ code: 'TRIP_INVALID', params: { field: 'departureAt' } })

  // Kho đang xếp (TRIP-011): còn đổi giờ xuất phát, không đổi kho đi
  expect((await db.updateTrip('TRIP-011', { departureAt: '2026-09-14T09:15:00+07:00' })).departureAt).toBe('2026-09-14T02:15:00.000Z')
  await expect(db.updateTrip('TRIP-011', { depot })).rejects.toMatchObject({ code: 'TRIP_LOCKED', params: { tripId: 'TRIP-011', phase: 'loading' } })
})

test('the seeded stale trip logs which package line changed after approval, before → after', async () => {
  const db = createMockDb()
  const edit = (await db.listEvents({ targetId: 'TRIP-013' })).find((event) => event.action === 'trip.updated')
  expect(edit?.params).toStrictEqual({ fields: 'packages', packageId: 'PKG-001', field: 'quantity', before: 80, after: 86 })
})
