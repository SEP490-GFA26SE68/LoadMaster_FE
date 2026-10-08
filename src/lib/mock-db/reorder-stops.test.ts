import { describe, expect, test } from 'vitest'
import { SPEC_CARTON_A } from '@/domain/fixtures/spec-samples'
import { haversineKm } from '@/domain/routing'
import { createMockDb, isStale, stopItemIds, type PickupRequestInput } from '@/lib/mock-db'
import { runMockOptimization } from '@/services/optimization'
import { loadTrip } from '@/test/trip-flow'

/**
 * Đổi thứ tự điểm giao khi xe đang chạy (FE-BL-03, D-87). Chuyến thử có ba điểm, mỗi điểm một kiện hình lập phương cạnh `sizes[i]` cm;
 * mock xếp kiện của điểm 3 sâu nhất, điểm 1 sát cửa (đã chạy thử để xem toạ độ): với cạnh [40, 100, 100] kiện của điểm 1 nhỏ hơn mặt sau
 * của kiện ở sau nó nên đổi thứ tự chỉ che một phần; với [100, 40, 40] kiện sát cửa to hơn nên che kín. `TRIP-009` của seed: điểm 1 đã
 * hoàn tất, xe đã tới điểm 2, còn điểm 3.
 */

const START = new Date('2026-09-14T05:00:00.000Z')
const DISPATCHER = 'US-0001'
const STOPS = [
  { id: 'STOP-01', name: 'Kho Dĩ An', address: '215 Quốc lộ 1K, Dĩ An', lat: 10.8953, lng: 106.7694 },
  { id: 'STOP-02', name: 'Bách Hoá Xanh Thủ Đức', address: 'Thủ Đức', lat: 10.8494, lng: 106.7537 },
  { id: 'STOP-03', name: 'Thủ Dầu Một', address: 'Thủ Dầu Một', lat: 10.9804, lng: 106.6519 },
]

function wallClock() {
  let ms = START.getTime()
  return { now: () => new Date(ms), advance: (byMs: number) => { ms += byMs } }
}

/** Chuyến ba điểm đã duyệt, xếp xong và xe vừa xuất phát; tài xế `US-0006`. */
async function runningTrip(sizes: readonly number[]) {
  const wall = wallClock()
  const db = createMockDb({ now: wall.now })
  db.restoreSession(DISPATCHER)
  const created = await db.createTrip({
    name: 'Tuyến thử', vehicleId: 'VEHICLE-005', scheduledDate: '2026-09-16', driverId: 'US-0006', stops: STOPS,
    packages: sizes.map((size, index) => ({ ...SPEC_CARTON_A, id: `PKG-00${index + 1}`, quantity: 1, deliveryStop: index + 1, lengthCm: size, widthCm: size, heightCm: size, weightKg: 20 })),
  })
  await db.optimizeTripRoute(created.id)
  const trip = await db.getTrip(created.id)
  const request = { vehicle: await db.getVehicle(trip.vehicleId), packages: trip.packages, settings: { method: 'MOCK' as const, timeLimitSeconds: 30, randomSeed: 1, enforceLifo: true, prioritizeLowCenterOfGravity: false } }
  const revision = await db.addRevision({ tripId: trip.id, request, result: runMockOptimization(request, { clock: () => 0 }) })
  await db.approveRevision(revision.id, [], { force: true })
  await loadTrip(db, trip.id)
  await db.startDelivery(trip.id)
  return { db, wall, tripId: trip.id, revisionId: revision.id, ids: (await db.getTrip(trip.id)).stops.map((stop) => stop.id) }
}

const order = (ids: readonly string[], ...positions: number[]) => positions.map((position) => ids[position] as string)

describe('an order the cargo can still be unloaded in is applied', () => {
  test('stops, progress, packages, incidents and the route follow the stops to their new numbers; the plan stays approved and unchanged', async () => {
    const { db, tripId, revisionId, ids } = await runningTrip([40, 100, 100])
    expect(ids).toStrictEqual(['STOP-01', 'STOP-02', 'STOP-03'])
    const before = await db.getTrip(tripId)
    // Sự cố báo ở điểm 1 (điểm chưa giao đầu tiên) đi theo điểm đó khi nó sang vị trí 2
    await db.reportTripException(tripId, { type: 'TRAFFIC', description: 'Kẹt xe', delayMinutes: 10 })

    // Điểm 3 lên trước điểm 2: kiện của điểm 3 (sâu nhất) bị kiện giao sau che một phần — chỉ cảnh báo
    const result = await db.reorderRunningStops(tripId, order(ids, 0, 2, 1))
    expect(result.partial).toStrictEqual([{ packageId: 'PKG-003-01', stopId: 'STOP-03' }])
    const trip = result.trip
    expect(trip.stops.map((stop) => [stop.id, stop.planNumber])).toStrictEqual([['STOP-01', 1], ['STOP-03', 3], ['STOP-02', 2]])
    expect(trip.delivery?.stops.map((stop) => stop.number)).toStrictEqual([1, 2, 3])
    expect(trip.packages.map((pkg) => [pkg.id, pkg.deliveryStop])).toStrictEqual([['PKG-001', 1], ['PKG-002', 3], ['PKG-003', 2]])
    // Phương án đã duyệt vẫn đúng và không lỗi thời; kiện của điểm đổi chỗ đọc ra ở số điểm mới
    expect(trip).toMatchObject({ phase: 'delivering', inputVersion: before.inputVersion })
    const plan = await db.getRevision(revisionId)
    expect(isStale(plan, trip)).toBe(false)
    expect(stopItemIds(trip, plan, 3)).toStrictEqual(stopItemIds(before, plan, 2))
    expect(stopItemIds(trip, plan, 2)).toStrictEqual(stopItemIds(before, plan, 3))
    // Tuyến giữ lại và tính lại theo thứ tự mới
    expect(trip.routePlan?.stops.map((stop) => stop.stopId)).toStrictEqual(['STOP-01', 'STOP-03', 'STOP-02'])
    expect(trip.routePlan?.stops.map((stop) => stop.eta)).not.toStrictEqual(before.routePlan?.stops.map((stop) => stop.eta))
    // Nhật ký, và chuông của tài xế của chuyến
    expect((await db.listEvents())[0]).toMatchObject({ action: 'trip.stopsReordered', target: { id: tripId }, params: { count: 2, driverId: 'US-0006' } })
  })

  test('an incident follows its stop to the new number', async () => {
    const { db, tripId, ids } = await runningTrip([40, 100, 100])
    const exception = await db.reportTripException(tripId, { type: 'TRAFFIC', description: 'Kẹt xe', delayMinutes: 10 })
    expect(exception.stopNumber).toBe(1)
    await db.reorderRunningStops(tripId, order(ids, 1, 0, 2))
    expect((await db.listTripExceptions(tripId))[0]).toMatchObject({ id: exception.id, stopNumber: 2 })
  })

  test('the vehicle goes on from where it is to the new next stop, without jumping', async () => {
    const { db, wall, tripId, ids } = await runningTrip([40, 100, 100])
    wall.advance(10 * 60_000)
    const here = await db.getLatestLocation(tripId)
    if (!here) throw new Error('the vehicle must have a position')
    await db.reorderRunningStops(tripId, order(ids, 2, 1, 0))
    wall.advance(60_000)
    const later = await db.getLatestLocation(tripId)
    // 50 km/h: tối đa chừng 1,25 km trong 90 giây của điểm vị trí; nhảy sang đường tới điểm khác là hàng chục km
    expect(haversineKm(here, later ?? here)).toBeLessThan(1.5)
    const monitoring = await db.getTripMonitoring(tripId)
    expect(monitoring.stops.map((stop) => stop.stopId)).toStrictEqual(order(ids, 2, 1, 0))
  })
})

describe('an order the cargo cannot be unloaded in changes nothing', () => {
  test('a package fully blocked by cargo delivered later is named, with its stop', async () => {
    const { db, tripId, ids } = await runningTrip([100, 40, 40])
    const before = await db.getTrip(tripId)
    await expect(db.reorderRunningStops(tripId, order(ids, 1, 0, 2))).rejects.toMatchObject({
      code: 'STOP_ORDER_BLOCKS_CARGO', params: { tripId, packages: ['PKG-002-01'], stopIds: ['STOP-02'] },
    })
    expect(await db.getTrip(tripId)).toStrictEqual(before)
    expect((await db.listEvents()).some((event) => event.action === 'trip.stopsReordered')).toBe(false)
  })

  test('the dense seed plan cannot be reversed', async () => {
    const db = createMockDb({ now: wallClock().now })
    db.restoreSession(DISPATCHER)
    await loadTrip(db, 'TRIP-2026-0914')
    await db.startDelivery('TRIP-2026-0914')
    const ids = (await db.getTrip('TRIP-2026-0914')).stops.map((stop) => stop.id)
    await expect(db.reorderRunningStops('TRIP-2026-0914', ids.toReversed())).rejects.toMatchObject({ code: 'STOP_ORDER_BLOCKS_CARGO' })
  })
})

describe('what cannot move, and who can ask', () => {
  const seedDb = (user = DISPATCHER) => {
    const db = createMockDb({ now: () => START })
    db.restoreSession(user)
    return db
  }

  test('TRIP-009: the completed stop and the stop the vehicle is standing at stay; a proposal must be a different permutation', async () => {
    const db = seedDb()
    await expect(db.reorderRunningStops('TRIP-009', ['STOP-02', 'STOP-01', 'STOP-03'])).rejects.toMatchObject({ code: 'STOP_NOT_MOVABLE', params: { stopIds: ['STOP-01', 'STOP-02'] } })
    await expect(db.reorderRunningStops('TRIP-009', ['STOP-01', 'STOP-02', 'STOP-03'])).rejects.toMatchObject({ code: 'STOP_ORDER_INVALID' })
    await expect(db.reorderRunningStops('TRIP-009', ['STOP-01', 'STOP-02', 'STOP-09'])).rejects.toMatchObject({ code: 'STOP_ORDER_INVALID' })
    await expect(db.reorderRunningStops('TRIP-009', ['STOP-01', 'STOP-02'])).rejects.toMatchObject({ code: 'STOP_ORDER_INVALID' })
  })

  const INPUT: PickupRequestInput = {
    pickup: { name: 'Xưởng may Hoàng Gia', address: 'Đường số 4, KCN VSIP 1, Thuận An, Bình Dương', lat: 10.928, lng: 106.712 },
    delivery: { name: 'Kho Dĩ An', address: '1 Quốc lộ 1K, Dĩ An', lat: 10.9, lng: 106.73 },
    deadline: '2026-09-14T10:30:00.000Z',
    packages: [{ packageCode: 'HG-0501', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 12, handlingClass: 'STANDARD' }],
  }

  test('a pickup stop that has not been reached stays before its own delivery stop, and its package is part of the load', async () => {
    const db = seedDb()
    const request = await db.createPickupRequest('TRIP-009', INPUT)
    await db.approvePickupRequest('TRIP-009', request.id, { overrideReason: 'Khách quen' })
    expect((await db.getTrip('TRIP-009')).stops.map((stop) => stop.id)).toStrictEqual(['STOP-01', 'STOP-02', 'STOP-04', 'STOP-05', 'STOP-03'])
    await expect(db.reorderRunningStops('TRIP-009', ['STOP-01', 'STOP-02', 'STOP-05', 'STOP-04', 'STOP-03'])).rejects.toMatchObject({
      code: 'PICKUP_AFTER_DELIVERY', params: { pickupStopId: 'STOP-04', deliveryStopId: 'STOP-05' },
    })
    // Điểm giao cũ lên sau điểm giao của kiện nhận: được, kiện nhận vẫn còn trong tập kiểm (có kiện của điểm 3 bị che một phần)
    const { trip } = await db.reorderRunningStops('TRIP-009', ['STOP-01', 'STOP-02', 'STOP-04', 'STOP-03', 'STOP-05'])
    expect(trip.stops.map((stop) => [stop.id, stop.kind ?? 'DELIVERY'])).toStrictEqual([['STOP-01', 'DELIVERY'], ['STOP-02', 'DELIVERY'], ['STOP-04', 'PICKUP'], ['STOP-03', 'DELIVERY'], ['STOP-05', 'DELIVERY']])
    expect(await db.getPickupRequest('TRIP-009', request.id)).toMatchObject({ pickupStopId: 'STOP-04', deliveryStopId: 'STOP-05' })
  })

  test.each([
    { who: 'the manager', user: 'US-0002', trip: 'TRIP-009', code: 'ROLE_NOT_ALLOWED' },
    { who: 'the warehouse worker', user: 'US-0003', trip: 'TRIP-009', code: 'ROLE_NOT_ALLOWED' },
    { who: 'the driver of the trip', user: 'US-0006', trip: 'TRIP-009', code: 'ROLE_NOT_ALLOWED' },
    { who: 'the dispatcher, on a trip still being planned', user: DISPATCHER, trip: 'TRIP-2026-0914', code: 'TRIP_PHASE_INVALID' },
    { who: 'the dispatcher, on a trip being loaded', user: DISPATCHER, trip: 'TRIP-011', code: 'TRIP_PHASE_INVALID' },
    { who: 'the dispatcher, on a delivered trip', user: DISPATCHER, trip: 'TRIP-001', code: 'TRIP_PHASE_INVALID' },
  ])('$who: $code', async ({ user, trip, code }) => {
    await expect(seedDb(user).reorderRunningStops(trip, ['STOP-02', 'STOP-01'])).rejects.toMatchObject({ code })
  })
})
