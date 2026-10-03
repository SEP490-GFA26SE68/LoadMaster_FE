import { expect, test } from 'vitest'
import { SPEC_CARTON_A } from '@/domain/fixtures/spec-samples'
import { createMockDb, tripRouteSubStatus, tripStatus, tripSubStatus, type MockDb, type NewTrip } from '@/lib/mock-db'
import { twoCartonResult } from '@/test/mock-db-samples'
import { reorderStops, stopsWithoutCoordinates } from './trip-route'

/**
 * Tối ưu tuyến của chuyến ở kho (FE-4b-09, D-76, PRD v2 mục 7.1). Chuyến thử đi từ Kho Long Bình (10,9294 · 106,8747) tới ba điểm
 * cùng vĩ độ, cách kho 0,3° · 0,1° · 0,2° kinh độ về phía tây: mỗi 0,1° kinh độ ở vĩ độ này là 10,92 km đường chim bay → 14,19 km
 * đường ước lượng (× 1,3) → 17 phút 01,9 giây ở 50 km/h; mỗi điểm dừng 15 phút. Thứ tự gần nhất trước là B (0,1°) → C (0,2°) → A (0,3°).
 */

const NOW = new Date('2026-09-14T05:00:00.000Z')
const LAT = 10.9294

function threeStopTrip(): NewTrip {
  return {
    name: 'Tuyến thử ba điểm', vehicleId: 'VEHICLE-001', scheduledDate: '2026-09-15',
    stops: [
      { id: 'STOP-01', name: 'Điểm A', address: 'A', lat: LAT, lng: 106.5747 },
      { id: 'STOP-02', name: 'Điểm B', address: 'B', lat: LAT, lng: 106.7747 },
      { id: 'STOP-03', name: 'Điểm C', address: 'C', lat: LAT, lng: 106.6747 },
    ],
    packages: [
      { ...SPEC_CARTON_A, id: 'PKG-001', quantity: 1, deliveryStop: 1 },
      { ...SPEC_CARTON_A, id: 'PKG-002', quantity: 1, deliveryStop: 2 },
    ],
  }
}

function dispatcher(): MockDb {
  const db = createMockDb({ now: () => NOW })
  db.restoreSession('US-0001')
  return db
}

test('stops without coordinates are named by id and number; reordering renumbers the package lines', () => {
  const { stops, packages } = threeStopTrip()
  expect(stopsWithoutCoordinates(stops)).toStrictEqual([])
  expect(stopsWithoutCoordinates([stops[0]!, { id: 'STOP-02', name: 'Điểm B', address: 'B' }, { id: 'STOP-03', name: 'Điểm C', address: 'C', lat: LAT }])).toStrictEqual([
    { stopId: 'STOP-02', number: 2 }, { stopId: 'STOP-03', number: 3 },
  ])
  const same = reorderStops(stops, packages, ['STOP-01', 'STOP-02', 'STOP-03'])
  expect([same.changed, same.stops, same.packages]).toStrictEqual([false, stops, packages])
  const moved = reorderStops(stops, packages, ['STOP-02', 'STOP-03', 'STOP-01'])
  expect(moved.changed).toBe(true)
  expect(moved.stops.map((stop) => stop.id)).toStrictEqual(['STOP-02', 'STOP-03', 'STOP-01'])
  expect(moved.packages.map((line) => [line.id, line.deliveryStop])).toStrictEqual([['PKG-001', 3], ['PKG-002', 1]])
})

test('optimizing the route orders the stops, stores arrival times and makes a draft trip planned', async () => {
  const db = dispatcher()
  const draft = await db.createTrip(threeStopTrip())
  expect([tripStatus(draft), await db.getTripEta(draft.id)]).toStrictEqual(['DRAFT', null])
  const trip = await db.optimizeTripRoute(draft.id)
  expect(tripStatus(trip)).toBe('PLANNED')
  expect(trip.stops.map((stop) => stop.name)).toStrictEqual(['Điểm B', 'Điểm C', 'Điểm A'])
  // Dòng kiện đi theo điểm của nó: PKG-001 (điểm A) thành điểm 3, PKG-002 (điểm B) thành điểm 1; đầu vào tối ưu xếp hàng đổi
  expect(trip.packages.map((line) => [line.id, line.deliveryStop])).toStrictEqual([['PKG-001', 3], ['PKG-002', 1]])
  expect(trip.inputVersion).toBe(draft.inputVersion + 1)
  expect(trip.routePlan).toStrictEqual({
    stops: [
      { stopId: 'STOP-02', eta: '2026-09-15T01:17:01.906Z' },
      { stopId: 'STOP-03', eta: '2026-09-15T01:49:03.812Z' },
      { stopId: 'STOP-01', eta: '2026-09-15T02:21:05.718Z' },
    ],
    missedStopIds: [], totalKm: 42.6, totalMinutes: 96, optimizedAt: '2026-09-14T05:00:00.000Z', optimizedBy: 'US-0001', isMockResult: true,
  })
  expect((await db.getTripEta(trip.id))?.stops.map((stop) => [stop.number, stop.stopId, stop.deadline, stop.deadlineStatus])).toStrictEqual([
    [1, 'STOP-02', undefined, undefined], [2, 'STOP-03', undefined, undefined], [3, 'STOP-01', undefined, undefined],
  ])
  expect((await db.listEvents())[0]).toMatchObject({
    action: 'trip.routeOptimized', actorId: 'US-0001', target: { type: 'trip', id: trip.id }, params: { stops: 3, totalKm: 42.6, totalMinutes: 96, lateStops: 0 },
  })
  // Kiện kho kiện của dòng vẫn ở đúng điểm giao của nó
  const pooled = (await db.listPackages()).filter((pkg) => pkg.tripId === trip.id).map((pkg) => [pkg.packageCode, pkg.stopId])
  expect(pooled).toStrictEqual([['PKG-001-01', 'STOP-01'], ['PKG-002-01', 'STOP-02']])
  // Tối ưu lại khi thứ tự đã đúng: không đổi đầu vào tối ưu xếp hàng
  expect((await db.optimizeTripRoute(trip.id)).inputVersion).toBe(trip.inputVersion)
})

test('a route cannot be optimized without stops, with a stop that has no coordinates, or once the warehouse started', async () => {
  const db = dispatcher()
  const empty = await db.createTrip({ ...threeStopTrip(), stops: [], packages: [] })
  await expect(db.optimizeTripRoute(empty.id)).rejects.toMatchObject({ code: 'ROUTE_STOPS_REQUIRED', params: { tripId: empty.id } })
  // seed: điểm 1 của TRIP-014 (Điện máy Xanh Tân An) chưa có toạ độ
  await expect(db.optimizeTripRoute('TRIP-014')).rejects.toMatchObject({ code: 'MISSING_STOP_COORDINATES', params: { tripId: 'TRIP-014', stopIds: ['STOP-01'], stopNumbers: [1] } })
  expect(tripStatus(await db.getTrip('TRIP-014'))).toBe('DRAFT')
  await expect(db.optimizeTripRoute('TRIP-011')).rejects.toMatchObject({ code: 'TRIP_LOCKED', params: { phase: 'loading' } })
})

test('reordering the stops by hand keeps the trip planned, recomputes the arrival times and makes the load plan stale', async () => {
  const db = dispatcher()
  const trip = await db.optimizeTripRoute((await db.createTrip(threeStopTrip())).id)
  const revision = await db.addRevision({ tripId: trip.id, request: { vehicle: await db.getVehicle('VEHICLE-001'), packages: trip.packages, settings: { method: 'MOCK', timeLimitSeconds: 10, randomSeed: 42, enforceLifo: true, prioritizeLowCenterOfGravity: false } }, result: twoCartonResult() })
  expect(tripSubStatus(trip, [revision])).toStrictEqual({ kind: 'awaitingApproval' })
  // Điểm A lên đầu: kho → A (0,3°) → B (0,2° từ A) → C (0,1° từ B)
  const order = ['STOP-01', 'STOP-02', 'STOP-03']
  const moved = reorderStops(trip.stops, trip.packages, order)
  const reordered = await db.updateTrip(trip.id, { stops: [...moved.stops], packages: [...moved.packages] })
  expect(tripStatus(reordered)).toBe('PLANNED')
  expect(reordered.routePlan?.stops).toStrictEqual([
    { stopId: 'STOP-01', eta: '2026-09-15T01:51:05.719Z' },
    { stopId: 'STOP-02', eta: '2026-09-15T02:40:09.532Z' },
    { stopId: 'STOP-03', eta: '2026-09-15T03:12:11.438Z' },
  ])
  expect([reordered.routePlan?.totalKm, reordered.routePlan?.totalMinutes, reordered.routePlan?.optimizedAt]).toStrictEqual([85.2, 147, '2026-09-14T05:00:00.000Z'])
  expect(tripSubStatus(reordered, [revision])).toStrictEqual({ kind: 'stale' })
  // Dời giờ xuất phát một giờ: giờ đến dời theo, chuyến vẫn Đã lập kế hoạch
  const later = await db.updateTrip(trip.id, { departureAt: '2026-09-15T02:00:00.000Z' })
  expect(later.routePlan?.stops[0]).toStrictEqual({ stopId: 'STOP-01', eta: '2026-09-15T02:51:05.719Z' })
})

test('adding or removing a stop after the route was optimized sends the trip back to draft', async () => {
  const db = dispatcher()
  const trip = await db.optimizeTripRoute((await db.createTrip(threeStopTrip())).id)
  const added = await db.updateTrip(trip.id, { stops: [...trip.stops, { id: 'STOP-04', name: 'Điểm D', address: 'D', lat: LAT, lng: 106.4747 }] })
  expect([tripStatus(added), added.routePlan, await db.getTripEta(trip.id)]).toStrictEqual(['DRAFT', undefined, null])
  const again = await db.optimizeTripRoute(trip.id)
  expect([tripStatus(again), again.routePlan?.stops.map((stop) => stop.stopId)]).toStrictEqual(['PLANNED', ['STOP-02', 'STOP-03', 'STOP-01', 'STOP-04']])
  // Bỏ điểm D (chưa có kiện): chuyến lại về Nháp
  const removed = await db.updateTrip(trip.id, { stops: again.stops.filter((stop) => stop.id !== 'STOP-04') })
  expect(tripStatus(removed)).toBe('DRAFT')
  // Đưa kiện kho kiện vào một điểm tay mới cũng là thêm điểm
  const planned = await db.optimizeTripRoute(trip.id)
  const withPool = await db.addTripPackages(planned.id, ['PK-0029'], { newStop: { name: 'Điểm E', address: 'E', lat: LAT, lng: 106.4 } })
  expect(tripStatus(withPool)).toBe('DRAFT')
})

test('a requirement merged into a planned stop keeps the trip planned and gives the stop a deadline status; a new stop sends it back to draft', async () => {
  const db = createMockDb({ now: () => NOW })
  db.restoreSession('US-0002')
  // seed: chuyến chính đã tối ưu tuyến, xuất phát 13:30 ngày 14/09; REQ-005 tới Co.opmart Bình Dương (điểm 2), hạn 16:00 ngày 16/09
  const hero = await db.getTrip('TRIP-2026-0914')
  expect([tripStatus(hero), hero.routePlan?.stops.map((stop) => stop.stopId), hero.routePlan?.missedStopIds]).toStrictEqual(['PLANNED', ['STOP-01', 'STOP-02', 'STOP-03', 'STOP-04'], []])
  db.restoreSession('US-0001')
  const { trip } = await db.assignDeliveryRequirement('REQ-005', 'TRIP-2026-0914')
  expect(tripStatus(trip)).toBe('PLANNED')
  expect(trip.routePlan?.stops[1]).toMatchObject({ stopId: 'STOP-02', deadlineStatus: 'OK' })
  expect(tripRouteSubStatus(trip)).toBeNull()
  // Quản lý kéo hạn về 14:00 ngày chạy — xe tới điểm 2 sau giờ đó: điểm trễ hạn dự kiến
  db.restoreSession('US-0002')
  await db.updateDeliveryRequirement('REQ-005', { deadline: '2026-09-14T14:00:00+07:00' })
  const late = await db.getTrip('TRIP-2026-0914')
  expect([late.routePlan?.stops[1]?.deadlineStatus, late.routePlan?.missedStopIds]).toStrictEqual(['MISSED', ['STOP-02']])
  expect(tripRouteSubStatus(late)).toStrictEqual({ kind: 'lateStops', count: 1 })
  expect((await db.getTripEta('TRIP-2026-0914'))?.stops[1]).toMatchObject({ number: 2, deadline: '2026-09-14T07:00:00.000Z', deadlineStatus: 'MISSED' })
  // REQ-001 đi KCN Hoà Khánh: chuyến thêm một điểm mới nên về Nháp
  db.restoreSession('US-0001')
  expect(tripStatus((await db.assignDeliveryRequirement('REQ-001', 'TRIP-2026-0914')).trip)).toBe('DRAFT')
})

test('seed: every trip that has a load plan has an optimized route in the order of its stops; the draft trips have none', async () => {
  const db = createMockDb()
  const trips = await db.listTrips()
  const routed = trips.filter((trip) => trip.routePlan !== undefined).map((trip) => trip.id)
  // TRIP-004 đã huỷ và hai chuyến nháp TRIP-014, TRIP-PN-002 còn điểm chưa có toạ độ
  expect(trips.filter((trip) => trip.routePlan === undefined).map((trip) => trip.id)).toStrictEqual(['TRIP-004', 'TRIP-014', 'TRIP-PN-002'])
  expect(routed).toHaveLength(14)
  for (const trip of trips) {
    if (!trip.routePlan) continue
    expect(trip.routePlan.stops.map((stop) => stop.stopId), trip.id).toStrictEqual(trip.stops.map((stop) => stop.id))
    expect([trip.routePlan.isMockResult, trip.routePlan.missedStopIds], trip.id).toStrictEqual([true, []])
  }
})
