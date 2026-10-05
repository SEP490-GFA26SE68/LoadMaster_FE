import { expect, test } from 'vitest'
import { SPEC_CARTON_A } from '@/domain/fixtures/spec-samples'
import { createMockDb, tripStatus, tripSubStatus } from '@/lib/mock-db'

/**
 * Đổi xe của chuyến Đã lập kế hoạch (FE-5b-08, D-80). Số của seed chép tay từ `seed-vehicles.ts`, `seed-trips.ts`: chuyến chính
 * `TRIP-2026-0914` chở 132 kiện nặng 5.844 kg trên `VEHICLE-002`; `VEHICLE-004` (tải 6.000 kg, có dàn lạnh) sẵn sàng và chở được;
 * `VEHICLE-001` (5.000 kg) sẵn sàng nhưng thiếu tải; `VEHICLE-007` đang xếp chuyến `TRIP-011`; `VEHICLE-008` đang bảo dưỡng.
 */

const NOW = new Date('2026-09-14T03:00:00.000Z')
const HERO = 'TRIP-2026-0914'

function dispatcher() {
  const db = createMockDb({ now: () => NOW })
  db.restoreSession('US-0001')
  return db
}

test('changing to a ready vehicle that takes the cargo makes every plan of the trip stale, keeps the route, and writes the event', async () => {
  const db = dispatcher()
  const before = await db.getTrip(HERO)
  const changed = await db.changeTripVehicle(HERO, 'VEHICLE-004')
  expect(changed).toStrictEqual({ ...before, vehicleId: 'VEHICLE-004', inputVersion: 2 })
  expect(await db.getTrip(HERO)).toStrictEqual(changed)
  // Tuyến không đổi nên chuyến vẫn Đã lập kế hoạch; phương án đã duyệt hết hiệu lực — phải tối ưu lại rồi duyệt
  const revisions = await db.listRevisions(HERO)
  expect([tripStatus(changed), tripSubStatus(changed, revisions)]).toStrictEqual(['PLANNED', { kind: 'stale' }])
  await expect(db.approveRevision('REV-001', [])).rejects.toMatchObject({ code: 'REVISION_STALE' })
  await expect(db.startLoading(HERO)).rejects.toMatchObject({ code: 'REVISION_STALE' })
  const [event] = await db.listEvents({ targetId: HERO })
  expect([event?.action, event?.actorId, event?.at, event?.params]).toStrictEqual([
    'trip.vehicleChanged', 'US-0001', '2026-09-14T03:00:00.000Z', { fields: 'vehicleId', before: 'VEHICLE-002', after: 'VEHICLE-004' },
  ])
})

test('a vehicle that cannot take the cargo, is not ready, or is the one already on the trip is rejected with the reason; nothing changes', async () => {
  const db = dispatcher()
  const before = { trip: await db.getTrip(HERO), events: (await db.listEvents()).length }
  await expect(db.changeTripVehicle(HERO, 'VEHICLE-001')).rejects.toMatchObject({
    code: 'VEHICLE_UNFIT',
    params: { vehicleId: 'VEHICLE-001', reasons: ['CARGO_WEIGHT_EXCEEDED'] },
  })
  await expect(db.changeTripVehicle(HERO, 'VEHICLE-008')).rejects.toMatchObject({ code: 'VEHICLE_IN_MAINTENANCE', params: { vehicleId: 'VEHICLE-008' } })
  await expect(db.changeTripVehicle(HERO, 'VEHICLE-007')).rejects.toMatchObject({ code: 'VEHICLE_BUSY', params: { vehicleId: 'VEHICLE-007', tripId: 'TRIP-011' } })
  await expect(db.changeTripVehicle(HERO, 'VEHICLE-002')).rejects.toMatchObject({ code: 'VEHICLE_UNCHANGED', params: { vehicleId: 'VEHICLE-002' } })
  await expect(db.changeTripVehicle(HERO, 'VEHICLE-404')).rejects.toMatchObject({ code: 'NOT_FOUND', params: { collection: 'vehicles', id: 'VEHICLE-404' } })
  expect({ trip: await db.getTrip(HERO), events: (await db.listEvents()).length }).toStrictEqual(before)
})

test('only a planned trip changes its vehicle here: a draft has no route yet, a trip being loaded is locked', async () => {
  const db = dispatcher()
  // TRIP-014: nháp, chưa tối ưu tuyến; TRIP-011: kho đang xếp
  await expect(db.changeTripVehicle('TRIP-014', 'VEHICLE-004')).rejects.toMatchObject({ code: 'TRIP_NOT_PLANNED', params: { tripId: 'TRIP-014' } })
  await expect(db.changeTripVehicle('TRIP-011', 'VEHICLE-004')).rejects.toMatchObject({ code: 'TRIP_LOCKED', params: { tripId: 'TRIP-011', phase: 'loading' } })
  expect((await db.getTrip('TRIP-014')).vehicleId).toBe('VEHICLE-001')
})

test('cargo class is a warning of the vehicle, not a reason to refuse it: chilled cargo may move to a truck without a cooling unit (D-74)', async () => {
  const db = dispatcher()
  const created = await db.createTrip({
    name: 'Tuyến hàng lạnh Dĩ An', vehicleId: 'VEHICLE-004', scheduledDate: '2026-09-16',
    stops: [{ id: 'STOP-01', name: 'Kho Bách Hoá Xanh Dĩ An', address: '215 Quốc lộ 1K, P. Đông Hoà, Dĩ An', lat: 10.8953, lng: 106.7694 }],
    packages: [{ ...SPEC_CARTON_A, id: 'PKG-001', quantity: 4, deliveryStop: 1, handlingClass: 'REFRIGERATED' }],
  })
  await db.optimizeTripRoute(created.id)
  // VEHICLE-001 (Truck 6m) không có dàn lạnh
  expect((await db.changeTripVehicle(created.id, 'VEHICLE-001')).vehicleId).toBe('VEHICLE-001')
  expect((await db.getTripSegregation(created.id)).vehicleWarnings).toStrictEqual([{ code: 'REFRIGERATION_MISSING', severity: 'warning', params: { count: 4 } }])
})
