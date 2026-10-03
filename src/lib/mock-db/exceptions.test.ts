import { describe, expect, test } from 'vitest'
import type { OptimizationRequest } from '@/domain/models'
import { createMockDb, type MockDb } from '@/lib/mock-db'
import { runMockOptimization } from '@/services/optimization'

/**
 * Sự cố cấp chuyến, tuyến thay thế và gia hạn ở tầng kho (FE-6-11, FE-6-12, D-87). Thời gian chạy từng chặng tính tay như ở
 * `tracking.test.ts` (định lý cos cầu × 1,3 ÷ 50 km/h):
 *   Kho Long Bình → Kho Bách Hoá Xanh Dĩ An 942.288 ms · Kho Long Bình → Bách Hoá Xanh Thủ Đức 1.490.848 ms (20,706 km đường)
 * ETA tính từ vị trí đã làm tròn 6 chữ số lẻ nên lệch vài ms: so trong 1 giây.
 */

function wallClock(start: string) {
  let ms = Date.parse(start)
  return { now: () => new Date(ms), set: (iso: string) => { ms = Date.parse(iso) }, advance: (byMs: number) => { ms += byMs } }
}

const MINUTE = 60_000
const DISPATCHER = 'US-0001'
const MANAGER = 'US-0002'
const plus = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString()
const near = (actual: string | undefined, expected: string) => Math.abs(Date.parse(actual ?? '') - Date.parse(expected)) < 1000
const TRAFFIC = { type: 'TRAFFIC' as const, description: 'Kẹt xe ở ngã tư Vũng Tàu', delayMinutes: 30 }
const actionsOf = async (db: MockDb, tripId: string, action: string) => (await db.listEvents({ targetId: tripId })).filter((event) => event.action === action).toReversed()

/** Chuyến một điểm giao từ yêu cầu `REQ-006` (hạn `deadline`), giờ đến dự kiến theo kế hoạch 01:15:42,288; tài xế xuất phát lúc `departAt`. */
async function departedTrip(deadline: string, departAt: string) {
  const wall = wallClock('2026-09-14T03:00:00.000Z')
  const db = createMockDb({ now: wall.now })
  db.restoreSession(DISPATCHER)
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
  return { db, wall, tripId: trip.id }
}

const DEADLINE = '2026-09-16T01:55:42.288Z'
const DEPART = '2026-09-16T01:00:00.000Z'

describe('reporting a trip incident holds the simulated vehicle for exactly the expected delay', () => {
  test('the vehicle stands still from the report, the ETA slides with the position, and it arrives 30 minutes later than planned', async () => {
    const { db, wall, tripId } = await departedTrip(DEADLINE, DEPART)
    wall.set('2026-09-16T01:05:10.000Z')
    const exception = await db.reportTripException(tripId, TRAFFIC)
    expect(exception).toStrictEqual({
      id: 'EXC-001', tripId, type: 'TRAFFIC', description: 'Kẹt xe ở ngã tư Vũng Tàu', delayMinutes: 30, status: 'OPEN', stopNumber: 1,
      reportedAt: '2026-09-16T01:05:10.000Z', reportedBy: DISPATCHER,
    })
    expect((await actionsOf(db, tripId, 'exception.reported')).map(({ actorId, params }) => ({ actorId, params }))).toStrictEqual([{
      actorId: DISPATCHER, params: { exceptionId: 'EXC-001', exceptionType: 'TRAFFIC', delayMinutes: 30, stopNumber: 1, note: 'Kẹt xe ở ngã tư Vũng Tàu' },
    }])

    // 01:15:00 — xe đứng từ 01:05:10 (đã đi 310.000 / 942.288 ms của chặng): còn 632.288 ms, ETA = bây giờ + 632.288 ms, vẫn kịp hạn
    wall.set('2026-09-16T01:15:00.000Z')
    const held = await db.getTripMonitoring(tripId)
    const history = await db.getLocationHistory(tripId)
    const standing = history.filter((point) => point.recordedAt >= '2026-09-16T01:05:30.000Z')
    expect(new Set(standing.map((point) => `${point.lat},${point.lng},${point.speedKmh}`)).size).toBe(1)
    expect(held.location?.speedKmh).toBe(0)
    expect(near(held.stops[0]?.eta, '2026-09-16T01:25:32.288Z')).toBe(true)
    expect([held.stops[0]?.deadlineStatus, held.alerts]).toStrictEqual(['OK', []])
    expect(held.exceptions).toStrictEqual([exception])

    // 01:15:30 — ETA 01:26:02 đã qua mốc hạn − 30 phút (01:25:42): sát hạn, kho báo một lần
    wall.set('2026-09-16T01:15:30.000Z')
    const risky = await db.getTripMonitoring(tripId)
    expect(risky.alerts.map(({ at, stopNumber, status }) => ({ at, stopNumber, status }))).toStrictEqual([{ at: '2026-09-16T01:15:30.000Z', stopNumber: 1, status: 'AT_RISK' }])

    // 01:50:00 — hết 30 phút lúc 01:35:10, chạy nốt 632.288 ms: tới nơi 01:45:42,288 = giờ theo kế hoạch + đúng 30 phút
    wall.set('2026-09-16T01:50:00.000Z')
    expect((await db.getTripMonitoring(tripId)).stops).toStrictEqual([
      { stopId: 'STOP-01', number: 1, eta: '2026-09-16T01:45:42.288Z', deadline: DEADLINE, deadlineStatus: 'AT_RISK', arrived: true },
    ])
  })

  test('only the dispatcher or the driver of the trip reports, for a trip in transit, with a type, a description and whole minutes', async () => {
    const { db, tripId } = await departedTrip(DEADLINE, DEPART)
    await expect(db.reportTripException(tripId, { ...TRAFFIC, type: 'FLOOD' as never })).rejects.toMatchObject({ code: 'EXCEPTION_INVALID', params: { field: 'type' } })
    await expect(db.reportTripException(tripId, { ...TRAFFIC, description: '   ' })).rejects.toMatchObject({ code: 'EXCEPTION_INVALID', params: { field: 'description' } })
    for (const delayMinutes of [-1, 1.5, 481]) {
      await expect(db.reportTripException(tripId, { ...TRAFFIC, delayMinutes })).rejects.toMatchObject({ code: 'EXCEPTION_INVALID', params: { field: 'delayMinutes' } })
    }
    await expect(db.reportTripException('TRIP-2026-0914', TRAFFIC)).rejects.toMatchObject({ code: 'TRIP_PHASE_INVALID', params: { phase: 'planning' } })
    db.restoreSession(MANAGER)
    await expect(db.reportTripException(tripId, TRAFFIC)).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED', params: { role: 'manager' } })
    // TRIP-009 đang vận chuyển, tài xế là US-0006: tài xế khác không báo được
    db.restoreSession('US-0004')
    await expect(db.reportTripException('TRIP-009', TRAFFIC)).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED', params: { role: 'driver' } })
    db.restoreSession('US-0006')
    expect(await db.reportTripException('TRIP-009', { type: 'VEHICLE_BREAKDOWN', description: 'Nổ lốp sau', delayMinutes: 0 })).toMatchObject({ id: 'EXC-001', tripId: 'TRIP-009', reportedBy: 'US-0006', stopNumber: 2 })
    expect(await db.listTripExceptions(tripId)).toStrictEqual([])
    expect((await db.listTripMonitoring()).map((item) => [item.tripId, item.exceptions.map((exception) => exception.id)])).toStrictEqual([['TRIP-009', ['EXC-001']], [tripId, []]])
  })
})

describe('an incident nobody handles for 30 minutes of the simulated clock goes to the manager', () => {
  const T = '2026-09-14T03:00:00.000Z'

  test('with the clock 60 times faster that is 30 real seconds; the system logs it once, at the 30-minute mark', async () => {
    const wall = wallClock(T)
    const db = createMockDb({ now: wall.now, speed: 60 })
    await db.startDelivery('TRIP-010')
    await db.reportTripException('TRIP-010', TRAFFIC)
    wall.advance(29_000)
    expect((await db.listTripExceptions('TRIP-010')).map((item) => item.status)).toStrictEqual(['OPEN'])
    expect(await actionsOf(db, 'TRIP-010', 'exception.escalated')).toStrictEqual([])

    wall.advance(1000)
    expect((await db.getTripMonitoring('TRIP-010')).exceptions).toStrictEqual([{
      id: 'EXC-001', tripId: 'TRIP-010', type: 'TRAFFIC', description: 'Kẹt xe ở ngã tư Vũng Tàu', delayMinutes: 30, status: 'ESCALATED', stopNumber: 1,
      reportedAt: T, reportedBy: null, escalation: { reason: 'TIMEOUT', at: plus(T, 30 * MINUTE), by: null },
    }])
    wall.advance(5000)
    await db.listTripExceptions('TRIP-010')
    await db.listTripMonitoring()
    expect((await actionsOf(db, 'TRIP-010', 'exception.escalated')).map(({ actorId, companyId, at, params }) => ({ actorId, companyId, at, params }))).toStrictEqual([{
      actorId: null, companyId: 'LOG-001', at: plus(T, 30 * MINUTE), params: { exceptionId: 'EXC-001', exceptionType: 'TRAFFIC', escalation: 'TIMEOUT' },
    }])
  })

  test('an incident handled or sent up in time is not escalated by the clock; each step is allowed once', async () => {
    const wall = wallClock(T)
    const db = createMockDb({ now: wall.now })
    db.restoreSession(DISPATCHER)
    await db.startDelivery('TRIP-010')
    await db.reportTripException('TRIP-010', TRAFFIC)
    await db.reportTripException('TRIP-010', { type: 'ACCIDENT', description: 'Va chạm nhẹ ở cầu Đồng Nai', delayMinutes: 10 })
    wall.advance(10 * MINUTE)
    expect(await db.resolveTripException('TRIP-010', 'EXC-001', '  Đường đã thông  ')).toMatchObject({
      status: 'RESOLVED', resolution: { at: plus(T, 10 * MINUTE), by: DISPATCHER, note: 'Đường đã thông' },
    })
    expect(await db.escalateTripException('TRIP-010', 'EXC-002')).toMatchObject({
      status: 'ESCALATED', escalation: { reason: 'NO_ROUTE', at: plus(T, 10 * MINUTE), by: DISPATCHER },
    })
    await expect(db.escalateTripException('TRIP-010', 'EXC-002')).rejects.toMatchObject({ code: 'EXCEPTION_STATUS_INVALID', params: { exceptionId: 'EXC-002', status: 'ESCALATED' } })
    await expect(db.resolveTripException('TRIP-010', 'EXC-001')).rejects.toMatchObject({ code: 'EXCEPTION_STATUS_INVALID', params: { status: 'RESOLVED' } })
    await expect(db.resolveTripException('TRIP-010', 'EXC-009')).rejects.toMatchObject({ code: 'NOT_FOUND', params: { collection: 'exceptions', id: 'EXC-009' } })
    db.restoreSession(MANAGER)
    await expect(db.resolveTripException('TRIP-010', 'EXC-002')).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED' })
    await expect(db.escalateTripException('TRIP-010', 'EXC-002')).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED' })

    wall.advance(60 * MINUTE)
    db.restoreSession(DISPATCHER)
    expect((await db.listTripExceptions('TRIP-010')).map((item) => [item.id, item.status])).toStrictEqual([['EXC-001', 'RESOLVED'], ['EXC-002', 'ESCALATED']])
    expect((await actionsOf(db, 'TRIP-010', 'exception.escalated')).map((event) => event.params.escalation)).toStrictEqual(['NO_ROUTE'])
    // điều phối viên xử lý tiếp sự cố đã chuyển lên
    expect((await db.resolveTripException('TRIP-010', 'EXC-002')).status).toBe('RESOLVED')
  })
})

describe('finding another route: mock options to the next stop, the stop order never changes', () => {
  const T = '2026-09-14T03:00:00.000Z'

  test('three options for a long leg; the chosen one ends the hold and the vehicle arrives when the option said', async () => {
    const wall = wallClock(T)
    const db = createMockDb({ now: wall.now })
    await db.startDelivery('TRIP-010')
    await expect(db.confirmReroute('TRIP-010', 0)).rejects.toMatchObject({ code: 'REROUTE_UNAVAILABLE', params: { tripId: 'TRIP-010' } })
    wall.advance(5 * MINUTE)
    await db.reportTripException('TRIP-010', { ...TRAFFIC, delayMinutes: 40 })

    // 03:10 — xe đứng ở 300.000 / 1.490.848 ms của chặng: còn 1.190.848 ms = 16,54 km đường tới điểm 1
    wall.advance(5 * MINUTE)
    const proposal = await db.requestReroute('TRIP-010')
    expect(proposal).toMatchObject({ tripId: 'TRIP-010', requestedAt: plus(T, 10 * MINUTE), stopId: 'STOP-01', stopNumber: 1, isMockResult: true })
    expect(proposal.options.map(({ index, route, distanceKm, durationMinutes }) => ({ index, route, distanceKm, durationMinutes }))).toStrictEqual([
      { index: 0, route: 'BYPASS', distanceKm: 19, durationMinutes: 23 },
      { index: 1, route: 'RING_ROAD', distanceKm: 21.5, durationMinutes: 26 },
      { index: 2, route: 'HIGHWAY', distanceKm: 24.8, durationMinutes: 21 },
    ])
    expect(proposal.options.map((option) => near(option.eta, ['2026-09-14T03:32:49.475Z', '2026-09-14T03:35:48.102Z', '2026-09-14T03:31:15.909Z'][option.index] ?? ''))).toStrictEqual([true, true, true])
    await expect(db.confirmReroute('TRIP-010', 7)).rejects.toMatchObject({ code: 'REROUTE_UNAVAILABLE' })

    const reroute = await db.confirmReroute('TRIP-010', 2)
    expect(reroute).toMatchObject({ index: 2, route: 'HIGHWAY', distanceKm: 24.8, durationMinutes: 21, stopNumber: 1, confirmedAt: plus(T, 10 * MINUTE), confirmedBy: null })
    expect((await actionsOf(db, 'TRIP-010', 'trip.rerouted')).map((event) => event.params)).toStrictEqual([{ route: 'HIGHWAY', stopNumber: 1, totalKm: 24.8, totalMinutes: 21 }])
    // lần tìm đã dùng: xác nhận lại phải tìm tuyến lần nữa
    await expect(db.confirmReroute('TRIP-010', 2)).rejects.toMatchObject({ code: 'REROUTE_UNAVAILABLE' })

    // 03:40 — không đổi tuyến thì xe tới lúc 04:04:50; đi cao tốc tới lúc 03:31:16 như lựa chọn đã báo
    wall.set(plus(T, 40 * MINUTE))
    const after = await db.getTripMonitoring('TRIP-010')
    expect(after.stops[0]).toMatchObject({ stopId: 'STOP-01', number: 1, arrived: true })
    expect(near(after.stops[0]?.eta, '2026-09-14T03:31:15.909Z')).toBe(true)
    expect(after.reroute).toStrictEqual(reroute)
    expect((await db.getTrip('TRIP-010')).stops.map((stop) => stop.id)).toStrictEqual(['STOP-01', 'STOP-02', 'STOP-03'])
    // xe đang đứng ở điểm 1: tuyến khác là của chặng tới điểm 2
    expect((await db.requestReroute('TRIP-010')).stopNumber).toBe(2)
  })

  test('a short leg has two options; only the dispatcher looks for a route', async () => {
    const { db, wall, tripId } = await departedTrip(DEADLINE, DEPART)
    wall.set('2026-09-16T01:05:00.000Z')
    await db.reportTripException(tripId, TRAFFIC)
    // còn 642.288 ms = 8,92 km đường: không có lựa chọn cao tốc
    expect((await db.requestReroute(tripId)).options.map(({ route, distanceKm, durationMinutes }) => ({ route, distanceKm, durationMinutes }))).toStrictEqual([
      { route: 'BYPASS', distanceKm: 10.3, durationMinutes: 12 },
      { route: 'RING_ROAD', distanceKm: 11.6, durationMinutes: 14 },
    ])
    db.restoreSession(MANAGER)
    await expect(db.requestReroute(tripId)).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED' })
    await expect(db.confirmReroute(tripId, 0)).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED' })
  })
})

describe('the company manager contacts the customer and enters a new deadline for an escalated incident', () => {
  const NEW_DEADLINE = '2026-09-16T04:00:00.000Z'
  const NOTE = 'Đã gọi chị Hoa ở kho Dĩ An, đồng ý nhận trước 11 giờ'

  test('the stop deadline and its level are recalculated at once, and the dispatcher is told', async () => {
    // xuất phát trễ 20 phút: giờ đến dự kiến 01:35:42, sát hạn 01:55:42
    const { db, wall, tripId } = await departedTrip(DEADLINE, '2026-09-16T01:20:00.000Z')
    wall.set('2026-09-16T01:21:00.000Z')
    await db.reportTripException(tripId, { type: 'ACCIDENT', description: 'Tai nạn chắn hai làn trên quốc lộ 1K', delayMinutes: 60 })
    const input = { requirementId: 'REQ-006', deadline: NEW_DEADLINE, contactNote: NOTE }
    db.restoreSession(MANAGER)
    await expect(db.renegotiateDeadline(tripId, 'EXC-001', input)).rejects.toMatchObject({ code: 'EXCEPTION_STATUS_INVALID', params: { status: 'OPEN' } })
    db.restoreSession(DISPATCHER)
    await db.escalateTripException(tripId, 'EXC-001')
    await expect(db.renegotiateDeadline(tripId, 'EXC-001', input)).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED', params: { role: 'dispatcher' } })

    db.restoreSession(MANAGER)
    wall.set('2026-09-16T01:22:00.000Z')
    await expect(db.renegotiateDeadline(tripId, 'EXC-001', { ...input, contactNote: ' ' })).rejects.toMatchObject({ code: 'REASON_REQUIRED' })
    await expect(db.renegotiateDeadline(tripId, 'EXC-001', { ...input, requirementId: 'REQ-001' })).rejects.toMatchObject({ code: 'EXCEPTION_INVALID', params: { field: 'requirementId' } })
    await expect(db.renegotiateDeadline(tripId, 'EXC-001', { ...input, deadline: 'chiều nay' })).rejects.toMatchObject({ code: 'EXCEPTION_INVALID', params: { field: 'deadline' } })
    // hạn mới phải sau giờ hiện tại của đồng hồ
    await expect(db.renegotiateDeadline(tripId, 'EXC-001', { ...input, deadline: '2026-09-16T01:22:00.000Z' })).rejects.toMatchObject({ code: 'REQUIREMENT_DEADLINE_PAST' })
    expect((await db.getTripMonitoring(tripId)).stops[0]).toMatchObject({ deadline: DEADLINE, deadlineStatus: 'AT_RISK' })

    const exception = await db.renegotiateDeadline(tripId, 'EXC-001', input)
    expect(exception).toMatchObject({
      status: 'ESCALATED',
      renegotiation: { requirementId: 'REQ-006', previousDeadline: DEADLINE, deadline: NEW_DEADLINE, contactNote: NOTE, at: '2026-09-16T01:22:00.000Z', by: MANAGER },
    })
    expect((await db.getDeliveryRequirement('REQ-006')).deadline).toBe(NEW_DEADLINE)
    expect((await db.getTrip(tripId)).stops[0]?.deadline).toBe(NEW_DEADLINE)
    // cùng thời điểm, chưa có điểm vị trí mới: mức hạn đã theo hạn mới
    expect((await db.getTripMonitoring(tripId)).stops[0]).toMatchObject({ deadline: NEW_DEADLINE, deadlineStatus: 'OK' })
    expect((await actionsOf(db, tripId, 'exception.deadlineRenegotiated')).map(({ actorId, params }) => ({ actorId, params }))).toStrictEqual([{
      actorId: MANAGER, params: { exceptionId: 'EXC-001', requirementId: 'REQ-006', deadline: NEW_DEADLINE, note: NOTE },
    }])

    // điều phối viên xử lý tiếp: sự cố giữ nguyên phần gia hạn
    db.restoreSession(DISPATCHER)
    expect(await db.resolveTripException(tripId, 'EXC-001')).toMatchObject({ status: 'RESOLVED', renegotiation: { deadline: NEW_DEADLINE } })
  })
})
