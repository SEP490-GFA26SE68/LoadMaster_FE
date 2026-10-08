import { describe, expect, test } from 'vitest'
import { createMockDb, stopItemIds, type MockDb, type PickupPackage, type PickupRequestInput } from '@/lib/mock-db'

/**
 * Duyệt và từ chối yêu cầu nhận hàng dọc đường (FE-7-04, D-88): kho kiểm lại mười luật trên chuyến lúc này, tạo kiện kho kiện và chèn
 * điểm vào chuyến đang vận chuyển. `TRIP-009` có ba điểm, xe đứng ở điểm 2, điểm 3 là điểm được bảo vệ. Điểm giao của `INPUT` trùng điểm 3
 * nên dùng lại nó. Chuyến chở hàng thường: kiện dễ vỡ trượt luật 8 (khác loại hàng của chuyến), kiện thường đạt cả mười
 * (số đã kiểm ở `pickups.test.ts`).
 */

const NOW = new Date('2026-09-14T05:00:00.000Z')
const TRIP = 'TRIP-009'
const DISPATCHER = 'US-0001'

const BOX: PickupPackage = { packageCode: 'HG-0501', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 12, handlingClass: 'FRAGILE' }
const INPUT: PickupRequestInput = {
  pickup: { name: 'Xưởng may Hoàng Gia', address: 'Đường số 4, KCN VSIP 1, Thuận An, Bình Dương', lat: 10.928, lng: 106.712 },
  delivery: { name: 'Bếp ăn KCN Sóng Thần', address: '12 Đường số 6, KCN Sóng Thần 1, Dĩ An', lat: 10.893, lng: 106.75 },
  deadline: '2026-09-14T10:30:00.000Z',
  packages: [BOX],
}
/** Điểm giao lệch ~4 km khỏi điểm 3: điểm giao mới, vẫn không vượt điểm được bảo vệ. */
const OTHER_DELIVERY: PickupRequestInput = { ...INPUT, delivery: { name: 'Kho Dĩ An', address: '1 Quốc lộ 1K, Dĩ An', lat: 10.9, lng: 106.73 } }

function newDb(): MockDb {
  const db = createMockDb({ now: () => NOW })
  db.restoreSession(DISPATCHER)
  return db
}

const stopIds = async (db: MockDb) => (await db.getTrip(TRIP)).stops.map((stop) => stop.id)

describe('approvePickupRequest', () => {
  test('a request that fails a rule needs a reason; with one it creates QR packages and inserts the pickup stop, keeping the route and the plan', async () => {
    const db = newDb()
    const before = await db.getTrip(TRIP)
    const request = await db.createPickupRequest(TRIP, INPUT)
    expect(request.status).toBe('PENDING')
    await expect(db.approvePickupRequest(TRIP, request.id)).rejects.toMatchObject({ code: 'REASON_REQUIRED' })
    await expect(db.approvePickupRequest(TRIP, request.id, { overrideReason: '   ' })).rejects.toMatchObject({ code: 'REASON_REQUIRED' })
    expect(await stopIds(db)).toStrictEqual(['STOP-01', 'STOP-02', 'STOP-03'])
    expect(await db.getPickupRequest(TRIP, request.id)).toMatchObject({ status: 'PENDING' })

    const { request: approved, packages } = await db.approvePickupRequest(TRIP, request.id, { overrideReason: '  Khách quen, xe còn chỗ  ' })
    expect(approved).toMatchObject({
      status: 'APPROVED', overrideReason: 'Khách quen, xe còn chỗ', approvedBy: DISPATCHER, pickupStopId: 'STOP-04', deliveryStopId: 'STOP-03', packageIds: [packages[0]?.id],
    })
    expect(approved.validationResults.filter((result) => !result.passed).map((result) => result.rule)).toStrictEqual([8])
    expect(packages).toMatchObject([{ packageCode: 'HG-0501', source: 'PICKUP', status: 'ASSIGNED', tripId: TRIP, stopId: 'STOP-03', weightKg: 12, destination: 'Bếp ăn KCN Sóng Thần' }])
    expect(packages[0]?.qrToken).toMatch(/^LM-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/)

    const trip = await db.getTrip(TRIP)
    // Điểm nhận ngay sau điểm hiện tại (điểm 2), điểm giao dùng lại điểm 3; thứ tự điểm cũ giữ nguyên
    expect(trip.stops.map((stop) => [stop.id, stop.kind ?? 'DELIVERY', stop.planNumber])).toStrictEqual([
      ['STOP-01', 'DELIVERY', 1], ['STOP-02', 'DELIVERY', 2], ['STOP-04', 'PICKUP', null], ['STOP-03', 'DELIVERY', 3],
    ])
    expect(trip.delivery?.stops.map((stop) => stop.number)).toStrictEqual([1, 2, 3, 4])
    expect(trip.delivery?.stops[0]).toMatchObject({ completedAt: before.delivery?.stops[0]?.completedAt })
    expect(trip.delivery?.stops[1]).toMatchObject({ arrivedAt: before.delivery?.stops[1]?.arrivedAt })
    expect(trip.packages.filter((pkg) => pkg.deliveryStop === 4).map((pkg) => pkg.id)).toStrictEqual(before.packages.filter((pkg) => pkg.deliveryStop === 3).map((pkg) => pkg.id))
    // Chuyến vẫn Đang vận chuyển, phương án không lỗi thời, tuyến không bị bỏ — chỉ tính lại theo thứ tự mới
    expect(trip).toMatchObject({ phase: 'delivering', inputVersion: before.inputVersion })
    expect(trip.routePlan?.stops.map((stop) => stop.stopId)).toStrictEqual(['STOP-01', 'STOP-02', 'STOP-04', 'STOP-03'])
    const plan = (await db.listRevisions(TRIP)).find((revision) => revision.id === before.loading?.revisionId)
    if (!plan) throw new Error('chuyến phải có phương án đang làm theo')
    expect(stopItemIds(trip, plan, 4)).toStrictEqual(stopItemIds(before, plan, 3))
    expect(stopItemIds(trip, plan, 3)).toStrictEqual([])
    expect((await db.listEvents())[0]).toMatchObject({ action: 'pickup.approved', params: { pickupId: request.id, count: 1, failedRules: 1, reason: 'Khách quen, xe còn chỗ', driverId: 'US-0006' } })
  })

  test('a request that passes all ten rules is approved without a reason, and a new delivery point is inserted after the pickup point', async () => {
    const db = newDb()
    const request = await db.createPickupRequest(TRIP, { ...OTHER_DELIVERY, packages: [{ ...BOX, handlingClass: 'STANDARD' }] })
    expect(request.status).toBe('VALIDATED')
    const { request: approved } = await db.approvePickupRequest(TRIP, request.id, { overrideReason: 'không cần' })
    expect(approved).toMatchObject({ status: 'APPROVED', pickupStopId: 'STOP-04', deliveryStopId: 'STOP-05' })
    expect(approved.overrideReason).toBeUndefined()
    const trip = await db.getTrip(TRIP)
    expect(trip.stops.map((stop) => [stop.id, stop.planNumber])).toStrictEqual([['STOP-01', 1], ['STOP-02', 2], ['STOP-04', null], ['STOP-05', null], ['STOP-03', 3]])
    expect(trip.stops[3]).toMatchObject({ name: 'Kho Dĩ An', deadline: '2026-09-14T10:30:00.000Z' })
    expect(trip.delivery?.stops.map((stop) => stop.number)).toStrictEqual([1, 2, 3, 4, 5])
  })

  test('TRIP_LOCKED still stands for every other way to edit a trip in transit', async () => {
    const db = newDb()
    const request = await db.createPickupRequest(TRIP, INPUT)
    await db.approvePickupRequest(TRIP, request.id, { overrideReason: 'ok' })
    const trip = await db.getTrip(TRIP)
    await expect(db.updateTrip(TRIP, { stops: trip.stops.toReversed() })).rejects.toMatchObject({ code: 'TRIP_LOCKED' })
    await expect(db.optimizeTripRoute(TRIP)).rejects.toMatchObject({ code: 'TRIP_LOCKED' })
  })
})

describe('rejectPickupRequest', () => {
  test('needs a reason, creates nothing and ends the request; a decided request cannot be decided again', async () => {
    const db = newDb()
    const request = await db.createPickupRequest(TRIP, INPUT)
    const packagesBefore = (await db.listPackages()).length
    await expect(db.rejectPickupRequest(TRIP, request.id, '  ')).rejects.toMatchObject({ code: 'REASON_REQUIRED' })
    const rejected = await db.rejectPickupRequest(TRIP, request.id, 'Xe không còn chỗ')
    expect(rejected).toMatchObject({ status: 'REJECTED', rejectReason: 'Xe không còn chỗ', rejectedBy: DISPATCHER })
    expect(await stopIds(db)).toStrictEqual(['STOP-01', 'STOP-02', 'STOP-03'])
    expect((await db.listPackages()).length).toBe(packagesBefore)
    expect((await db.listEvents())[0]).toMatchObject({ action: 'pickup.rejected', params: { pickupId: request.id, reason: 'Xe không còn chỗ', driverId: 'US-0006' } })
    await expect(db.approvePickupRequest(TRIP, request.id, { overrideReason: 'thử lại' })).rejects.toMatchObject({ code: 'INVALID_PICKUP_STATUS_TRANSITION', params: { from: 'REJECTED', to: 'APPROVED' } })
    await expect(db.rejectPickupRequest(TRIP, request.id, 'lần hai')).rejects.toMatchObject({ code: 'INVALID_PICKUP_STATUS_TRANSITION' })
  })
})

test.each([
  { who: 'the driver of the trip', user: 'US-0006' },
  { who: 'the manager', user: 'US-0002' },
  { who: 'the warehouse worker', user: 'US-0003' },
])('$who cannot approve or reject', async ({ user }) => {
  const db = createMockDb({ now: () => NOW })
  db.restoreSession(user)
  await expect(db.approvePickupRequest(TRIP, 'PKR-001', { overrideReason: 'x' })).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED' })
  await expect(db.rejectPickupRequest(TRIP, 'PKR-001', 'x')).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED' })
  expect(await db.getPickupRequest(TRIP, 'PKR-001')).toMatchObject({ status: 'PENDING' })
})

describe('placing the pickup in the freed zone (FE-BL-01)', () => {
  // TRIP-009: điểm 1 đã giao xong nên vùng X 393,1–610 (cm) trống; hai hốc bánh xe nằm ở X 350–450, Y 0–25 và 190–215.
  // Kiện 60 × 40 × 40 không đặt được sát vách trái (chồng hốc bánh xe) nên nằm sát hốc: Y = 25
  const STANDARD: PickupPackage = { ...BOX, handlingClass: 'STANDARD' }
  const standard = (weightKg = 12): PickupRequestInput => ({ ...OTHER_DELIVERY, packages: [{ ...STANDARD, weightKg }] })
  const ruleThree = (request: { validationResults: { rule: number; params: Readonly<Record<string, string | number>> }[] }) =>
    request.validationResults.find((result) => result.rule === 3)?.params.totalKg as number

  test('approval keeps the place with the request and logs it; the approved plan is not touched', async () => {
    const db = newDb()
    const plans = await db.listRevisions(TRIP)
    const request = await db.createPickupRequest(TRIP, standard())
    const { request: approved } = await db.approvePickupRequest(TRIP, request.id)
    expect(approved.layout).toMatchObject({
      placements: [{ packageIndex: 0, orientation: 'LWH', xCm: 393.1, yCm: 25, zCm: 0, placedLengthCm: 60, placedWidthCm: 40, placedHeightCm: 40 }],
      unplaced: [],
    })
    expect(await db.listRevisions(TRIP)).toStrictEqual(plans)
    const events = await db.listEvents()
    expect(events.map((event) => event.action).slice(0, 2)).toStrictEqual(['pickup.approved', 'pickup.reoptimized'])
    expect(events[1]).toMatchObject({ target: { type: 'trip', id: TRIP }, params: { pickupId: request.id, placed: 1, unplaced: 0 } })
  })

  test('a later request counts the earlier approved one: its weight, and its place is not reused', async () => {
    const db = newDb()
    const first = await db.createPickupRequest(TRIP, standard())
    await db.approvePickupRequest(TRIP, first.id)
    const second = await db.createPickupRequest(TRIP, standard(7))
    expect(ruleThree(second) - ruleThree(first)).toBe(7)
    const { request } = await db.approvePickupRequest(TRIP, second.id)
    expect(request.layout?.placements).toMatchObject([{ xCm: 393.1, yCm: 65, zCm: 0 }])
  })

  test('a package that does not fit is approved only with a reason, gets no place, and its weight still counts for the next request', async () => {
    const db = newDb()
    const tooLong: PickupPackage = { ...STANDARD, lengthCm: 300, widthCm: 150, weightKg: 20 }
    const first = await db.createPickupRequest(TRIP, { ...OTHER_DELIVERY, packages: [tooLong] })
    expect(first.validationResults.filter((result) => !result.passed).map((result) => result.rule)).toStrictEqual([4])
    await expect(db.approvePickupRequest(TRIP, first.id)).rejects.toMatchObject({ code: 'REASON_REQUIRED' })
    const { request, packages } = await db.approvePickupRequest(TRIP, first.id, { overrideReason: 'Xếp tay ở cửa sau' })
    expect(request.layout).toMatchObject({ placements: [], unplaced: [{ packageIndex: 0, reasonCode: 'NO_SPACE' }] })
    expect(packages).toMatchObject([{ status: 'ASSIGNED', tripId: TRIP }])
    expect((await db.listEvents())[1]).toMatchObject({ action: 'pickup.reoptimized', params: { placed: 0, unplaced: 1 } })
    const second = await db.createPickupRequest(TRIP, standard(7))
    // 20 kg đã duyệt nhưng chưa có chỗ vẫn nặng: tổng tải của yêu cầu sau = tổng tải trước (đã gồm 20 kg) + 7 kg của nó
    expect(ruleThree(second) - ruleThree(first)).toBe(7)
  })
})
