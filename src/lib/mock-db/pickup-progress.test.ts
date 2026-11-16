import { describe, expect, test } from 'vitest'
import { createMockDb, tripReport, undeliveredCount, type MockDb, type Package } from '@/lib/mock-db'
import { unloadStop } from '@/test/trip-flow'

/**
 * Tài xế nhận và giao kiện nhận dọc đường (FE-7-05, D-88) trên `TRIP-009`. Điều phối viên duyệt một yêu cầu hai kiện (điểm giao dùng
 * lại điểm 3): tuyến thành điểm 1, 2, điểm nhận (3), điểm giao (4). Tài xế `US-0006` xong điểm 2 rồi nhận hàng ở điểm 3.
 */

const NOW = new Date('2026-09-14T05:00:00.000Z')
const TRIP = 'TRIP-009'
const DISPATCHER = 'US-0001'
const DRIVER = 'US-0006'

const BOX = { packageCode: 'HG-0501', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 12, handlingClass: 'STANDARD' as const }
const INPUT = {
  pickup: { name: 'Xưởng may Hoàng Gia', address: 'Đường số 4, KCN VSIP 1, Thuận An, Bình Dương', lat: 10.928, lng: 106.712 },
  delivery: { name: 'Bếp ăn KCN Sóng Thần', address: '12 Đường số 6, KCN Sóng Thần 1, Dĩ An', lat: 10.893, lng: 106.75 },
  packages: [BOX, { ...BOX, packageCode: 'HG-0502' }],
}

/** Kho đã duyệt yêu cầu, tài xế xong điểm 2 và đứng ở điểm nhận (số 3). */
async function atPickupStop(): Promise<{ db: MockDb; packages: Package[]; token: (id: string) => Promise<string> }> {
  const db = createMockDb({ now: () => NOW })
  db.restoreSession(DISPATCHER)
  const request = await db.createPickupRequest(TRIP, INPUT)
  const { packages } = await db.approvePickupRequest(TRIP, request.id, { overrideReason: 'Khách quen' })
  db.restoreSession(DRIVER)
  await unloadStop(db, TRIP, 2)
  await db.completeStop(TRIP, 2)
  await db.arriveAtStop(TRIP, 3)
  const token = async (id: string) => (await db.listTripLabels(TRIP)).find((label) => label.packageInstanceId === id)?.qrToken ?? ''
  return { db, packages, token }
}

describe('the pickup stop', () => {
  test('is completed only once every package is checked, a pending manual confirm blocks it until the dispatcher approves, and then the packages ride and the request is LOADED', async () => {
    const { db, packages, token } = await atPickupStop()
    const [first, second] = packages as [Package, Package]
    await expect(db.completeStop(TRIP, 3)).rejects.toMatchObject({ code: 'STOP_INCOMPLETE', params: { remaining: 2 } })

    // Kiện nhận có nhãn của chuyến; quét ở điểm nhận ghi kiện lên xe ngay
    await db.confirmUnloadByQr(TRIP, 3, await token(first.id))
    expect((await db.getPackage(first.id)).status).toBe('LOADED')
    expect((await db.getTrip(TRIP)).delivery?.stops[2]).toMatchObject({ pickedIds: [first.id] })

    // Xác nhận tay: kiện ghi như đã nhận nhưng chỉ lên xe khi được duyệt
    await db.confirmUnloadManually(TRIP, 3, { packageInstanceId: second.id, reason: 'LABEL_DAMAGED' })
    expect((await db.getPackage(second.id)).status).toBe('ASSIGNED')
    await expect(db.completeStop(TRIP, 3)).rejects.toMatchObject({ code: 'MANUAL_CONFIRM_PENDING', params: { count: 1 } })
    const pending = (await db.getTrip(TRIP)).verifications?.find((entry) => entry.manual?.status === 'MANUAL_PENDING')
    expect(pending).toMatchObject({ context: 'PICKUP', stopNumber: 3, packageInstanceId: second.id })
    db.restoreSession(DISPATCHER)
    await db.approveManualConfirmation(TRIP, pending?.id ?? '')
    expect((await db.getPackage(second.id)).status).toBe('LOADED')

    db.restoreSession(DRIVER)
    await db.completeStop(TRIP, 3)
    expect(await Promise.all([first, second].map(async (pkg) => (await db.getPackage(pkg.id)).status))).toStrictEqual(['IN_TRANSIT', 'IN_TRANSIT'])
    expect(await db.getPickupRequest(TRIP, 'PKR-002')).toMatchObject({ status: 'LOADED', loadedAt: NOW.toISOString() })
    expect((await db.listEvents()).map((event) => event.action)).toContain('pickup.loaded')
  })

  test('a rejected manual confirm sends the package back to be checked again; a package of the delivery stop is refused here with the right stop number', async () => {
    const { db, packages, token } = await atPickupStop()
    const [first] = packages as [Package, Package]
    await db.confirmUnloadManually(TRIP, 3, { packageInstanceId: first.id, reason: 'QR_UNREADABLE' })
    const pending = (await db.getTrip(TRIP)).verifications?.find((entry) => entry.manual?.status === 'MANUAL_PENDING')
    db.restoreSession(DISPATCHER)
    await db.rejectManualConfirmation(TRIP, pending?.id ?? '', 'Chụp lại nhãn')
    db.restoreSession(DRIVER)
    expect((await db.getTrip(TRIP)).delivery?.stops[2]?.pickedIds).toStrictEqual([])
    expect((await db.getPackage(first.id)).status).toBe('ASSIGNED')
    await expect(db.completeStop(TRIP, 3)).rejects.toMatchObject({ code: 'STOP_INCOMPLETE', params: { remaining: 2 } })

    // Kiện của điểm giao (số 4) quét ở điểm nhận: nói điểm đúng, không ghi gì
    const planLabel = (await db.listTripLabels(TRIP)).find((label) => label.deliveryStop === 4 && label.packageInstanceId.startsWith('PKG-'))
    await expect(db.confirmUnloadByQr(TRIP, 3, planLabel?.qrToken ?? '')).rejects.toMatchObject({ code: 'QR_WRONG_STOP', params: { stopNumber: 4 } })
    expect(await token(first.id)).not.toBe('')
  })
})

test('at the delivery stop the pickup packages are unloaded like any package and the request becomes DELIVERED when the last one is delivered', async () => {
  const { db, packages, token } = await atPickupStop()
  for (const pkg of packages) await db.confirmUnloadByQr(TRIP, 3, await token(pkg.id))
  await db.completeStop(TRIP, 3)

  // Điểm 4 là điểm 3 cũ: hàng của phương án vẫn ở đó, kiện nhận thêm vào
  await db.arriveAtStop(TRIP, 4)
  const labels = await db.listTripLabels(TRIP)
  const planIds = labels.filter((label) => label.deliveryStop === 4 && label.packageInstanceId.startsWith('PKG-')).map((label) => label.packageInstanceId)
  expect(planIds.length).toBeGreaterThan(0)
  await expect(db.completeStop(TRIP, 4)).rejects.toMatchObject({ code: 'STOP_INCOMPLETE', params: { remaining: planIds.length + 2 } })
  await unloadStop(db, TRIP, 4)
  await expect(db.completeStop(TRIP, 4)).resolves.toMatchObject({ phase: 'completed' })
  expect(await Promise.all(packages.map(async (pkg) => (await db.getPackage(pkg.id)).status))).toStrictEqual(['DELIVERED', 'DELIVERED'])
  expect(await db.getPickupRequest(TRIP, 'PKR-002')).toMatchObject({ status: 'DELIVERED', deliveredAt: NOW.toISOString() })
  expect((await db.listEvents()).map((event) => event.action)).toEqual(expect.arrayContaining(['pickup.loaded', 'pickup.delivered']))
})

test('cancelling the trip while the pickup stop is still open returns the packages already picked up, and the cancel count and the trip report include them', async () => {
  const { db, packages, token } = await atPickupStop()
  const [first, second] = packages as [Package, Package]
  // Một kiện quét lên xe, một kiện xác nhận tay đang chờ duyệt — cả hai đã ở trên xe; điểm nhận chưa hoàn tất
  await db.confirmUnloadByQr(TRIP, 3, await token(first.id))
  await db.confirmUnloadManually(TRIP, 3, { packageInstanceId: second.id, reason: 'LABEL_DAMAGED' })
  await db.reportTripException(TRIP, { type: 'VEHICLE_BREAKDOWN', description: 'Xe hỏng hộp số', delayMinutes: 120 })
  const before = await db.getTrip(TRIP)
  const loaded = before.loading?.steps.filter((step) => step.outcome === 'loaded').length ?? 0
  const deliveredBefore = before.delivery?.stops.reduce((sum, stop) => sum + (stop.completedAt === undefined ? 0 : stop.unloadedIds.length), 0) ?? 0
  expect(undeliveredCount(before)).toBe(loaded + 2 - deliveredBefore)

  db.restoreSession(DISPATCHER)
  const cancelled = await db.cancelTrip(TRIP, 'Xe hỏng giữa đường')
  expect(await Promise.all([first, second].map(async (pkg) => (await db.getPackage(pkg.id)).status))).toStrictEqual(['RETURNED', 'RETURNED'])
  const event = (await db.listEvents({ targetId: TRIP })).find((item) => item.action === 'trip.cancelled')
  expect(event?.params.returned).toBe(undeliveredCount(before))

  const plan = await db.getRevision(cancelled.loading?.revisionId ?? '')
  const report = tripReport(cancelled, plan, { pickups: await db.listPickupRequests(TRIP) })
  // Kiện nhận phải giao ở điểm 4: hoàn trả ở đó cùng kiện của phương án
  expect(report.stops[3]?.returned).toBe((report.stops[3]?.planned ?? 0) + 2)
  expect(report.packages.returned).toBe(report.stops.reduce((sum, stop) => sum + stop.returned, 0))
})

test('cancelling the trip before any pickup package is picked up rejects the request as trip-cancelled and removes its packages; outside the cancel APPROVED never becomes REJECTED', async () => {
  const { db, packages } = await atPickupStop()
  // Ngoài lối huỷ chuyến, bảng chuyển trạng thái vẫn chặn APPROVED → REJECTED
  db.restoreSession(DISPATCHER)
  await expect(db.updatePickupStatus(TRIP, 'PKR-002', 'REJECTED')).rejects.toMatchObject({ code: 'INVALID_PICKUP_STATUS_TRANSITION', params: { from: 'APPROVED' } })
  await expect(db.rejectPickupRequest(TRIP, 'PKR-002', 'Bên gửi huỷ')).rejects.toMatchObject({ code: 'INVALID_PICKUP_STATUS_TRANSITION' })

  db.restoreSession(DRIVER)
  await db.reportTripException(TRIP, { type: 'VEHICLE_BREAKDOWN', description: 'Xe hỏng hộp số', delayMinutes: 120 })
  const before = await db.getTrip(TRIP)
  db.restoreSession(DISPATCHER)
  const cancelled = await db.cancelTrip(TRIP, 'Xe hỏng giữa đường')

  const request = await db.getPickupRequest(TRIP, 'PKR-002')
  expect(request).toMatchObject({ status: 'REJECTED', rejectCause: 'TRIP_CANCELLED', rejectedAt: NOW.toISOString(), rejectedBy: DISPATCHER, packageIds: [] })
  expect(request.rejectReason).toBeUndefined()
  expect(request.layout).toBeUndefined()
  // Hàng còn ở chỗ bên gửi: kiện kho kiện của yêu cầu bị xoá, không thành Hoàn trả
  for (const pkg of packages) await expect(db.getPackage(pkg.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  expect(await db.listPickupPackages(TRIP)).toStrictEqual([])
  const event = (await db.listEvents({ targetId: TRIP })).find((item) => item.action === 'trip.cancelled')
  expect(event?.params.returned).toBe(undeliveredCount(before))

  const plan = await db.getRevision(cancelled.loading?.revisionId ?? '')
  const report = tripReport(cancelled, plan, { pickups: await db.listPickupRequests(TRIP) })
  expect(report.stops[3]?.returned).toBe(report.stops[3]?.planned)
})
