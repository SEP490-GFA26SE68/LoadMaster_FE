import { describe, expect, test } from 'vitest'
import type { OptimizationRequest } from '@/domain/models'
import { createMockDb, MAX_LOCATION_POINTS, type MockDb, type Trip } from '@/lib/mock-db'
import { simulatedSnapshot, simulationOf } from '@/lib/mock-db/trip-tracking'
import { runMockOptimization } from '@/services/optimization'

/**
 * Vị trí xe mô phỏng và ETA trực tiếp ở tầng kho (FE-6-08, FE-6-09). Thời gian chạy từng chặng tính tay bằng **định lý cos cầu**
 * (R = 6.371 km) × 1,3 ÷ 50 km/h, làm tròn ms — không dùng haversine của code đang test:
 *   Kho Long Bình → Co.opmart Bình Dương 2.124.680 ms · → Nhà sách Phương Nam 216.077 ms · → Bếp ăn Sóng Thần 1.353.659 ms
 *   Kho Long Bình → Bách Hoá Xanh Thủ Đức 1.490.848 ms · → MM Mega Market An Phú 517.677 ms · → Circle K 626.024 ms
 *   Kho Long Bình → Kho Bách Hoá Xanh Dĩ An 942.288 ms
 * Hướng đi là góc tính theo mặt phẳng quanh vĩ độ giữa, làm tròn độ.
 */

/** Đồng hồ máy giả: test tự đặt giờ. */
function wallClock(start: string) {
  let ms = Date.parse(start)
  return { now: () => new Date(ms), set: (iso: string) => { ms = Date.parse(iso) }, advance: (byMs: number) => { ms += byMs } }
}

const MINUTE = 60_000
const plus = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString()

/** Dỡ hết kiện của điểm `stop` rồi hoàn tất điểm. */
async function deliverStop(db: MockDb, tripId: string, stop: number) {
  const trip = await db.getTrip(tripId)
  const revision = await db.getRevision(trip.loading?.revisionId ?? '')
  const stopOf = (id: string) => revision.request.packages.find((pkg) => id.startsWith(`${pkg.id}-`))?.deliveryStop
  const missing = new Set(trip.loading?.steps.filter((step) => step.outcome === 'missing').map((step) => step.packageInstanceId))
  for (const { packageInstanceId: id } of revision.result.placements) {
    if (stopOf(id) === stop && !missing.has(id)) await db.recordUnload(tripId, stop, id, true)
  }
  return db.completeStop(tripId, stop)
}

describe('the seeded trip in transit stands where its delivery progress puts it at the current time', () => {
  const NOW = '2026-09-14T05:00:00.000Z'
  const STANDING = { lat: 10.9804, lng: 106.6519, speedKmh: 0, heading: 274, source: 'SIMULATED' }

  test('TRIP-009 left at 06:25:30, finished stop 1 at 07:35:30 and has been standing at stop 2 since', async () => {
    const db = createMockDb({ now: () => new Date(NOW) })
    const trip = await db.getTrip('TRIP-009')
    expect([trip.delivery?.startedAt, trip.delivery?.stops.map((stop) => stop.completedAt)]).toStrictEqual([
      '2026-09-13T23:25:30.000Z', ['2026-09-14T00:35:30.000Z', undefined, undefined],
    ])
    const events = (await db.listEvents()).length
    expect(await db.getLatestLocation('TRIP-009')).toStrictEqual({ ...STANDING, recordedAt: NOW })

    // một điểm mỗi 30 giây từ lúc xuất phát: 5 giờ 34 phút 30 giây = 669 nhịp, tính cả điểm lúc xuất phát
    const history = await db.getLocationHistory('TRIP-009')
    expect(history.length).toBe(670)
    expect(history[0]).toStrictEqual({ lat: 10.9294, lng: 106.8747, speedKmh: 50, heading: 284, recordedAt: '2026-09-13T23:25:30.000Z', source: 'SIMULATED' })
    // 00:10:00 — xe đã tới điểm 1 lúc 00:00:54,680 và chờ tài xế hoàn tất điểm
    expect(history[89]).toStrictEqual({ lat: 10.979, lng: 106.673, speedKmh: 0, heading: 284, recordedAt: '2026-09-14T00:10:00.000Z', source: 'SIMULATED' })
    // 00:37:30 — hai phút sau khi rời điểm 1, đang trên chặng 216.077 ms tới điểm 2
    expect(history[144]).toMatchObject({ speedKmh: 50, heading: 274, recordedAt: '2026-09-14T00:37:30.000Z' })
    expect(history.at(-1)).toStrictEqual({ ...STANDING, recordedAt: NOW })
    // đọc vị trí không ghi sự kiện nào: chuyến seed không có điểm nào có hạn
    expect((await db.listEvents()).length).toBe(events)
  })

  test('its monitoring: arrived at stop 2, stop 3 estimated from now because the vehicle has stood for more than 15 minutes', async () => {
    const db = createMockDb({ now: () => new Date(NOW) })
    expect(await db.getTripMonitoring('TRIP-009')).toStrictEqual({
      tripId: 'TRIP-009',
      location: { ...STANDING, recordedAt: NOW },
      stops: [
        { stopId: 'STOP-02', number: 2, eta: '2026-09-14T00:39:06.077Z', arrived: true },
        { stopId: 'STOP-03', number: 3, eta: '2026-09-14T05:22:33.659Z' },
      ],
      alerts: [],
      refreshMs: 30_000,
      isMockResult: true,
    })
    expect((await db.listTripMonitoring()).map((item) => item.tripId)).toStrictEqual(['TRIP-009'])
  })

  test('a trip that has not left has no position; a completed trip keeps its history up to the completion', async () => {
    const db = createMockDb({ now: () => new Date(NOW) })
    expect(await db.getLatestLocation('TRIP-2026-0914')).toBeNull()
    expect(await db.getLocationHistory('TRIP-2026-0914')).toStrictEqual([])
    expect(await db.getTripMonitoring('TRIP-2026-0914')).toStrictEqual({ tripId: 'TRIP-2026-0914', location: null, stops: [], alerts: [], refreshMs: null, isMockResult: true })

    const done = await db.getTrip('TRIP-001')
    const history = await db.getLocationHistory('TRIP-001')
    const last = history.at(-1)
    expect(history[0]?.recordedAt).toBe(done.delivery?.startedAt)
    expect(Date.parse(done.delivery?.completedAt ?? '') - Date.parse(last?.recordedAt ?? '')).toBeLessThan(30_000)
    // điểm cuối của chuyến: Siêu thị Co.opmart Biên Hoà
    expect([last?.lat, last?.lng, last?.speedKmh]).toStrictEqual([10.9574, 106.8427, 0])
    expect(await db.getTripMonitoring('TRIP-001')).toMatchObject({ location: last, stops: [], refreshMs: null })
  })
})

describe('a trip the driver starts: the simulated vehicle follows the clock of the store', () => {
  const T = '2026-09-14T03:00:00.000Z'

  test('it leaves the depot, waits at each stop for the driver, and its history is capped', async () => {
    const wall = wallClock(T)
    const db = createMockDb({ now: wall.now })
    await db.startDelivery('TRIP-010')
    expect(await db.getLatestLocation('TRIP-010')).toStrictEqual({ lat: 10.9294, lng: 106.8747, speedKmh: 50, heading: 236, recordedAt: T, source: 'SIMULATED' })

    // 10 phút: 600.000 / 1.490.848 của chặng kho → Thủ Đức
    wall.advance(10 * MINUTE)
    expect(await db.getLatestLocation('TRIP-010')).toStrictEqual({ lat: 10.897204, lng: 106.826003, speedKmh: 50, heading: 236, recordedAt: plus(T, 10 * MINUTE), source: 'SIMULATED' })
    const history = await db.getLocationHistory('TRIP-010')
    expect(history.length).toBe(21)
    expect(history.map((point) => Date.parse(point.recordedAt) - Date.parse(T))).toStrictEqual(Array.from({ length: 21 }, (_, index) => index * 30_000))
    expect((await db.getTripMonitoring('TRIP-010')).refreshMs).toBe(30_000)
    // giữa hai nhịp: chưa có điểm mới, còn 18 giây tới điểm kế tiếp
    wall.advance(12_000)
    expect((await db.getLatestLocation('TRIP-010'))?.recordedAt).toBe(plus(T, 10 * MINUTE))
    expect((await db.getTripMonitoring('TRIP-010')).refreshMs).toBe(18_000)

    // 3 giờ sau: xe tới điểm 1 lúc 03:24:50,848 và vẫn đứng đó — xe chỉ rời điểm khi tài xế hoàn tất điểm
    wall.set(plus(T, 180 * MINUTE))
    const waiting = await db.getTripMonitoring('TRIP-010')
    expect(waiting.location).toStrictEqual({ lat: 10.8494, lng: 106.7537, speedKmh: 0, heading: 236, recordedAt: plus(T, 180 * MINUTE), source: 'SIMULATED' })
    expect(waiting.stops).toStrictEqual([
      { stopId: 'STOP-01', number: 1, eta: '2026-09-14T03:24:50.848Z', arrived: true },
      { stopId: 'STOP-02', number: 2, eta: '2026-09-14T06:08:37.677Z' },
      { stopId: 'STOP-03', number: 3, eta: '2026-09-14T06:34:03.701Z' },
    ])

    // tài xế hoàn tất điểm 1 lúc 06:00: 4 phút sau xe ở 240.000 / 517.677 của chặng Thủ Đức → An Phú
    await deliverStop(db, 'TRIP-010', 1)
    // điểm vừa hoàn tất không còn trong ETA, dù chưa có điểm vị trí mới
    expect((await db.getTripMonitoring('TRIP-010')).stops.map((stop) => stop.number)).toStrictEqual([2, 3])
    wall.advance(4 * MINUTE)
    const moving = await db.getTripMonitoring('TRIP-010')
    expect(moving.location).toStrictEqual({ lat: 10.827054, lng: 106.747905, speedKmh: 50, heading: 194, recordedAt: plus(T, 184 * MINUTE), source: 'SIMULATED' })
    expect(moving.stops.map((stop) => [stop.stopId, stop.number, stop.arrived])).toStrictEqual([['STOP-02', 2, undefined], ['STOP-03', 3, undefined]])
    expect(Math.abs(Date.parse(moving.stops[0]?.eta ?? '') - Date.parse('2026-09-14T06:08:37.677Z'))).toBeLessThan(1000)

    // ba ngày không ai đọc: lịch sử giữ 2.000 điểm gần nhất
    wall.set(plus(T, 72 * 60 * MINUTE))
    const capped = await db.getLocationHistory('TRIP-010')
    expect(MAX_LOCATION_POINTS).toBe(2000)
    expect([capped.length, capped[0]?.recordedAt, capped.at(-1)?.recordedAt]).toStrictEqual([2000, '2026-09-16T10:20:30.000Z', '2026-09-17T03:00:00.000Z'])
    expect(capped.at(-1)).toMatchObject({ lat: 10.8012, lng: 106.7412, speedKmh: 0 })

    // giao xong: không còn ETA, không cần làm mới, lịch sử dừng ở lúc hoàn thành
    await deliverStop(db, 'TRIP-010', 2)
    await deliverStop(db, 'TRIP-010', 3)
    wall.advance(60 * MINUTE)
    const finished = await db.getTripMonitoring('TRIP-010')
    expect([finished.stops, finished.refreshMs, finished.location?.recordedAt]).toStrictEqual([[], null, '2026-09-17T03:00:00.000Z'])
    expect(await db.listTripMonitoring()).toHaveLength(1)
  })

  test('with the clock 60 times faster one real second is two position points, and screens refresh at most once a second', async () => {
    const wall = wallClock(T)
    const db = createMockDb({ now: wall.now, speed: 60 })
    const started = await db.startDelivery('TRIP-010')
    expect(started.delivery?.startedAt).toBe(T)
    wall.advance(1000)
    const history = await db.getLocationHistory('TRIP-010')
    expect(history.map((point) => point.recordedAt)).toStrictEqual([T, plus(T, 30_000), plus(T, 60_000)])
    expect((await db.getTripMonitoring('TRIP-010')).refreshMs).toBe(1000)
    // 25 giây thật = 25 phút của kho: xe đã tới điểm 1 (24 phút 50,848 giây)
    wall.advance(24_000)
    expect(await db.getLatestLocation('TRIP-010')).toStrictEqual({ lat: 10.8494, lng: 106.7537, speedKmh: 0, heading: 236, recordedAt: plus(T, 25 * MINUTE), source: 'SIMULATED' })
    // sự kiện ghi sau đó mang giờ của kho, không phải giờ máy
    await deliverStop(db, 'TRIP-010', 1)
    expect((await db.getTrip('TRIP-010')).delivery?.stops[0]?.completedAt).toBe(plus(T, 25 * MINUTE))
  })
})

/**
 * Chuyến một điểm giao từ yêu cầu `REQ-006` (tới Kho Bách Hoá Xanh Dĩ An), giờ xuất phát theo kế hoạch 08:00 ngày 16/09 (01:00 UTC):
 * giờ đến dự kiến 01:15:42,288. Hạn của yêu cầu là `deadline`; tài xế bấm xuất phát lúc `departAt`.
 */
async function departedTrip(deadline: string, departAt: string) {
  const wall = wallClock('2026-09-14T03:00:00.000Z')
  const db = createMockDb({ now: wall.now })
  db.restoreSession('US-0001')
  const created = await db.createTrip({ name: 'Tuyến Dĩ An', vehicleId: 'VEHICLE-005', scheduledDate: '2026-09-16', packages: [], stops: [] })
  await db.assignDeliveryRequirement('REQ-006', created.id)
  await db.optimizeTripRoute(created.id)
  await db.updateDeliveryRequirement('REQ-006', { deadline })
  const trip = await db.getTrip(created.id)
  const request: OptimizationRequest = {
    vehicle: await db.getVehicle(trip.vehicleId),
    packages: trip.packages,
    settings: { method: 'MOCK', timeLimitSeconds: 30, randomSeed: 20_260_916, enforceLifo: true, prioritizeLowCenterOfGravity: false },
  }
  const revision = await db.addRevision({ tripId: trip.id, request, result: runMockOptimization(request, { clock: () => 0 }) })
  const approved = await db.approveRevision(revision.id, [], { force: true })
  await db.startLoading(trip.id)
  for (const { packageInstanceId } of approved.result.placements) await db.recordLoadingStep(trip.id, { packageInstanceId, outcome: 'loaded' })
  await db.completeLoading(trip.id)
  wall.set(departAt)
  await db.startDelivery(trip.id)
  return { db, wall, tripId: trip.id, planned: trip.routePlan }
}

const etaRisk = async (db: MockDb, tripId: string) => (await db.listEvents({ targetId: tripId })).filter((event) => event.action === 'delivery.etaRisk').toReversed()

describe('live ETA and the late-risk event (ETA_RISK)', () => {
  const DEADLINE = '2026-09-16T01:55:42.288Z'

  test('a trip that leaves on time keeps its planned level: nothing is reported', async () => {
    const { db, wall, tripId, planned } = await departedTrip(DEADLINE, '2026-09-16T01:00:00.000Z')
    expect(planned?.stops).toStrictEqual([{ stopId: 'STOP-01', eta: '2026-09-16T01:15:42.288Z', deadlineStatus: 'OK' }])
    expect((await db.getTripMonitoring(tripId)).stops).toStrictEqual([
      { stopId: 'STOP-01', number: 1, eta: '2026-09-16T01:15:42.288Z', deadline: DEADLINE, deadlineStatus: 'OK' },
    ])
    wall.advance(10 * MINUTE)
    expect((await db.getTripMonitoring(tripId)).alerts).toStrictEqual([])
    expect(await etaRisk(db, tripId)).toStrictEqual([])
  })

  test('leaving 20 minutes late puts the stop at risk: one system event, once, however often the position is read', async () => {
    const { db, wall, tripId } = await departedTrip(DEADLINE, '2026-09-16T01:20:00.000Z')
    const first = await db.getTripMonitoring(tripId)
    expect(first.stops).toStrictEqual([{ stopId: 'STOP-01', number: 1, eta: '2026-09-16T01:35:42.288Z', deadline: DEADLINE, deadlineStatus: 'AT_RISK' }])
    const events = await etaRisk(db, tripId)
    expect(events.map(({ action, actorId, companyId, target, params, at }) => ({ action, actorId, companyId, target, params, at }))).toStrictEqual([{
      action: 'delivery.etaRisk', actorId: null, companyId: 'LOG-001', target: { type: 'trip', id: tripId }, at: '2026-09-16T01:20:00.000Z',
      params: { stopNumber: 1, deadlineStatus: 'AT_RISK', eta: '2026-09-16T01:35:42.288Z', deadline: DEADLINE },
    }])
    expect(first.alerts).toStrictEqual([{
      eventId: events[0]?.id, at: '2026-09-16T01:20:00.000Z', tripId, stopId: 'STOP-01', stopNumber: 1, status: 'AT_RISK',
      eta: '2026-09-16T01:35:42.288Z', deadline: DEADLINE,
    }])
    for (let read = 0; read < 4; read += 1) {
      wall.advance(MINUTE)
      await db.listTripMonitoring()
      await db.getLocationHistory(tripId)
    }
    expect((await etaRisk(db, tripId)).length).toBe(1)
  })

  test('each worsening is reported once; an improvement is not; real GPS points drive the ETA and hold the simulated vehicle', async () => {
    const { db, wall, tripId } = await departedTrip(DEADLINE, '2026-09-16T01:20:00.000Z')
    const statuses = async () => (await etaRisk(db, tripId)).map((event) => event.params.deadlineStatus)
    await db.getTripMonitoring(tripId)
    expect(await statuses()).toStrictEqual(['AT_RISK'])

    // 01:21 — GPS thật báo xe ở cách điểm giao 68,5 km: 6.415.139 ms nữa mới tới, quá hạn
    wall.set('2026-09-16T01:21:00.000Z')
    const far = { lat: 10.35, lng: 107.08, speedKmh: 42, heading: 310 }
    expect(await db.postDriverLocation(tripId, far)).toStrictEqual({ ...far, recordedAt: '2026-09-16T01:21:00.000Z', source: 'GPS' })
    expect((await db.getTripMonitoring(tripId)).stops[0]).toMatchObject({ eta: '2026-09-16T03:07:55.139Z', deadlineStatus: 'MISSED' })
    expect(await statuses()).toStrictEqual(['AT_RISK', 'MISSED'])
    wall.advance(30_000)
    await db.postDriverLocation(tripId, far)
    expect(await statuses()).toStrictEqual(['AT_RISK', 'MISSED'])

    // 01:22 — xe ở ngay điểm giao: kịp hạn, không báo; rồi lại ở xa: báo lần nữa
    wall.advance(30_000)
    await db.postDriverLocation(tripId, { lat: 10.896, lng: 106.789 })
    expect((await db.getTripMonitoring(tripId)).stops[0]).toMatchObject({ eta: '2026-09-16T01:22:00.000Z', deadlineStatus: 'OK' })
    expect(await statuses()).toStrictEqual(['AT_RISK', 'MISSED'])
    wall.advance(30_000)
    await db.postDriverLocation(tripId, far)
    expect(await statuses()).toStrictEqual(['AT_RISK', 'MISSED', 'MISSED'])

    // còn nhận GPS thật thì xe mô phỏng không ghi điểm nào; ngừng gửi quá 90 giây (tới 01:24:00) thì xe mô phỏng ghi tiếp
    wall.set('2026-09-16T01:23:30.000Z')
    const held = await db.getLocationHistory(tripId)
    expect(held.map((point) => [point.recordedAt.slice(11, 19), point.source])).toStrictEqual([
      ['01:20:00', 'SIMULATED'], ['01:20:30', 'SIMULATED'], ['01:21:00', 'SIMULATED'],
      ['01:21:00', 'GPS'], ['01:21:30', 'GPS'], ['01:22:00', 'GPS'], ['01:22:30', 'GPS'],
    ])
    wall.set('2026-09-16T01:25:00.000Z')
    const resumed = await db.getLocationHistory(tripId)
    expect(resumed.slice(7).map((point) => [point.recordedAt.slice(11, 19), point.source])).toStrictEqual([
      ['01:24:00', 'SIMULATED'], ['01:24:30', 'SIMULATED'], ['01:25:00', 'SIMULATED'],
    ])
    // xe mô phỏng vẫn tới nơi 01:35:42: sát hạn là tốt hơn trễ hạn, không báo
    expect(await statuses()).toStrictEqual(['AT_RISK', 'MISSED', 'MISSED'])
  })

  test('a stop that was already late in the plan is not reported again when the trip runs', async () => {
    // hạn 08:01 sớm hơn mọi giờ đến: trễ hạn từ lúc lập kế hoạch, người duyệt đã xác nhận
    const { db, wall, tripId, planned } = await departedTrip('2026-09-16T01:01:00.000Z', '2026-09-16T01:00:00.000Z')
    expect(planned?.stops[0]?.deadlineStatus).toBe('MISSED')
    wall.advance(5 * MINUTE)
    expect((await db.getTripMonitoring(tripId)).stops[0]?.deadlineStatus).toBe('MISSED')
    expect(await etaRisk(db, tripId)).toStrictEqual([])
  })

  test('a position is only taken for a trip in transit, with valid coordinates, speed and heading', async () => {
    const { db, tripId } = await departedTrip(DEADLINE, '2026-09-16T01:00:00.000Z')
    await expect(db.postDriverLocation('TRIP-2026-0914', { lat: 10.9, lng: 106.8 })).rejects.toMatchObject({ code: 'TRIP_PHASE_INVALID', params: { phase: 'planning' } })
    await expect(db.postDriverLocation(tripId, { lat: 91, lng: 106.8 })).rejects.toMatchObject({ code: 'LOCATION_INVALID', params: { field: 'coordinates' } })
    await expect(db.postDriverLocation(tripId, { lat: 10.9, lng: 106.8, speedKmh: -1 })).rejects.toMatchObject({ code: 'LOCATION_INVALID', params: { field: 'speedKmh' } })
    await expect(db.postDriverLocation(tripId, { lat: 10.9, lng: 106.8, heading: 360 })).rejects.toMatchObject({ code: 'LOCATION_INVALID', params: { field: 'heading' } })
    expect((await db.getLocationHistory(tripId)).map((point) => point.source)).toStrictEqual(['SIMULATED'])
  })
})

describe('what the driver recorded, read as of a moment (trip-tracking)', () => {
  const T = '2026-09-14T03:00:00.000Z'
  const trip: Pick<Trip, 'stops' | 'depot' | 'delivery'> = {
    depot: { name: 'Kho Long Bình', address: 'KCN Biên Hoà 2', lat: 10.9294, lng: 106.8747 },
    stops: [
      { id: 'STOP-01', name: 'Bách Hoá Xanh Thủ Đức', address: 'Thủ Đức', lat: 10.8494, lng: 106.7537 },
      { id: 'STOP-02', name: 'MM Mega Market An Phú', address: 'An Phú', lat: 10.8012, lng: 106.7412, deadline: plus(T, 120 * MINUTE) },
    ],
    delivery: {
      startedAt: T, startedBy: 'US-0004', issues: [],
      stops: [{ number: 1, unloadedIds: [], arrivedAt: plus(T, 10 * MINUTE), completedAt: plus(T, 40 * MINUTE) }, { number: 2, unloadedIds: [] }],
    },
  }

  test('"arrived" puts the simulated vehicle at the stop; it leaves when the stop is completed; the route is cut at the first open stop', () => {
    expect(simulationOf(trip)?.stops.map((stop) => stop.stopId)).toStrictEqual(['STOP-01', 'STOP-02'])
    expect(simulationOf({ ...trip, delivery: { ...trip.delivery!, stops: [{ number: 1, unloadedIds: [] }, { number: 2, unloadedIds: [] }] } })?.stops.map((stop) => stop.stopId)).toStrictEqual(['STOP-01'])

    // trước khi bấm "Đã đến": xe còn trên đường (10 phút đầu của chặng 24 phút 50,848 giây)
    expect(simulatedSnapshot(trip, plus(T, 9 * MINUTE))?.vehicle).toMatchObject({ speedKmh: 50, stopId: 'STOP-01' })
    // bấm "Đã đến" lúc 03:10: xe ở điểm 1, ETA của điểm 1 là giờ đến thật; điểm 2 = đến + 15 phút + 517.677 ms
    expect(simulatedSnapshot(trip, plus(T, 12 * MINUTE))).toStrictEqual({
      vehicle: { lat: 10.8494, lng: 106.7537, speedKmh: 0, heading: 236, recordedAt: plus(T, 12 * MINUTE), stopId: 'STOP-01', arrivedAt: plus(T, 10 * MINUTE) },
      stops: [
        { stopId: 'STOP-01', number: 1, eta: plus(T, 10 * MINUTE), arrived: true },
        { stopId: 'STOP-02', number: 2, eta: plus(T, 25 * MINUTE + 517_677), deadline: plus(T, 120 * MINUTE), deadlineStatus: 'OK' },
      ],
    })
    // hoàn tất điểm 1 lúc 03:40: xe rời điểm, điểm 1 không còn là điểm chưa xong
    const leaving = simulatedSnapshot(trip, plus(T, 40 * MINUTE))
    expect(leaving?.vehicle).toStrictEqual({ lat: 10.8494, lng: 106.7537, speedKmh: 50, heading: 194, recordedAt: plus(T, 40 * MINUTE), stopId: 'STOP-02' })
    expect(leaving?.stops).toStrictEqual([{ stopId: 'STOP-02', number: 2, eta: plus(T, 40 * MINUTE + 517_677), deadline: plus(T, 120 * MINUTE), deadlineStatus: 'OK' }])
  })

  test('a trip that has not left, or with a stop without coordinates, cannot be simulated', () => {
    expect(simulationOf({ ...trip, delivery: undefined })).toBeNull()
    expect(simulatedSnapshot({ ...trip, stops: [{ id: 'STOP-01', name: 'Điện máy Xanh Tân An', address: 'Tân An' }] }, T)).toBeNull()
  })
})
