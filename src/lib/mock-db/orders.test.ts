import { expect, test } from 'vitest'
import { createMockDb, tripLabels, type MockDb } from '@/lib/mock-db'

/** Luồng 2 Review 1 (LM-104): đơn hàng từ kiện đã nhận ở kho, gán vào điểm giao của chuyến, kiểm tra "Sẵn sàng tối ưu". */

const received = async (db: MockDb) => (await db.listRegisteredPackages()).filter((pkg) => pkg.status === 'received' && pkg.orderId === undefined)

test('an order takes received packages that no other order holds; edits and cancels only while pending', async () => {
  const db = createMockDb()
  // Điều phối viên Long Bình lập đơn từ kiện của Long Bình (FE-0-02); `restoreSession` không ghi nhật ký
  db.restoreSession('US-0001')
  // FE-0-06: seed ghi thẳng trạng thái — 6 thùng sữa, 6 thùng bánh quy và 6 kiện quạt đã ở kho, chưa vào đơn nào
  expect((await received(db)).map((pkg) => pkg.id)).toStrictEqual([
    'RPK-0023', 'RPK-0024', 'RPK-0025', 'RPK-0026', 'RPK-0027', 'RPK-0028', 'RPK-0029', 'RPK-0030', 'RPK-0031', 'RPK-0032', 'RPK-0033', 'RPK-0034',
    'RPK-0043', 'RPK-0044', 'RPK-0045', 'RPK-0046', 'RPK-0047', 'RPK-0048',
  ])
  const order = await db.createOrder({ customerName: ' Nhà hàng Hương Việt ', deliveryAddress: '203 Lê Văn Sỹ, P. 13, Q.3', phone: '', packageIds: ['RPK-0023', 'RPK-0024'] })
  expect(order).toMatchObject({ id: 'ORD-003', customerName: 'Nhà hàng Hương Việt', status: 'pending', packageIds: ['RPK-0023', 'RPK-0024'] })
  expect(order).not.toHaveProperty('phone')
  expect((await db.getRegisteredPackage('RPK-0023')).orderId).toBe('ORD-003')
  // Kiện mới đăng ký, hàng chưa về kho (thùng dầu ăn RPK-0035); kiện đã thuộc đơn khác
  await expect(db.createOrder({ customerName: 'A', deliveryAddress: 'B', packageIds: ['RPK-0035'] })).rejects.toMatchObject({ code: 'PACKAGE_UNAVAILABLE', params: { packageId: 'RPK-0035', status: 'registered' } })
  await expect(db.createOrder({ customerName: 'A', deliveryAddress: 'B', packageIds: ['RPK-0001'] })).rejects.toMatchObject({ code: 'PACKAGE_UNAVAILABLE' })
  await expect(db.createOrder({ customerName: 'A', deliveryAddress: 'B', packageIds: [] })).rejects.toMatchObject({ code: 'PACKAGES_REQUIRED' })

  const edited = await db.updateOrder('ORD-003', { packageIds: ['RPK-0024', 'RPK-0025'], contactName: 'Chị Linh' })
  expect(edited).toMatchObject({ packageIds: ['RPK-0024', 'RPK-0025'], contactName: 'Chị Linh' })
  expect((await db.getRegisteredPackage('RPK-0023')).orderId).toBeUndefined()
  await expect(db.cancelOrder('ORD-003', '  ')).rejects.toMatchObject({ code: 'REASON_REQUIRED' })
  const cancelled = await db.cancelOrder('ORD-003', 'Khách đổi ngày nhận')
  expect(cancelled).toMatchObject({ status: 'cancelled', cancellation: { reason: 'Khách đổi ngày nhận' } })
  expect(await received(db)).toHaveLength(18)
  await expect(db.updateOrder('ORD-003', { note: 'x' })).rejects.toMatchObject({ code: 'ORDER_STATUS_INVALID' })
})

test('assigning an order to a stop adds one package line per type to the trip, makes old plans stale and plans the packages', async () => {
  const db = createMockDb()
  const before = await db.getTrip('TRIP-014')
  const { order, trip } = await db.assignOrder('ORD-002', 'TRIP-014', 'STOP-02')
  expect(order).toMatchObject({ status: 'assigned', assignment: { tripId: 'TRIP-014', stopId: 'STOP-02', lines: [{ lineId: 'PKG-004', packageIds: (await db.getOrder('ORD-002')).packageIds }] } })
  expect(trip.inputVersion).toBe(before.inputVersion + 1)
  expect(trip.packages.at(-1)).toMatchObject({ id: 'PKG-004', name: 'Thùng mì ăn liền 30 gói', quantity: 10, deliveryStop: 2, groupId: 'ORD-002', lengthCm: 55, weightKg: 3.5 })
  expect((await db.getRegisteredPackage('RPK-0013')).status).toBe('planned')
  // Nhãn QR của kiện trong chuyến là mã của kiện đăng ký
  const labels = await db.listTripLabels('TRIP-014')
  const label = labels.find((item) => item.packageInstanceId === 'PKG-004-01')
  expect(label).toMatchObject({ registeredPackageId: 'RPK-0013', qrToken: (await db.getRegisteredPackage('RPK-0013')).qrToken })
  expect(labels.find((item) => item.packageInstanceId === 'PKG-001-01')?.registeredPackageId).toBeUndefined()

  await expect(db.assignOrder('ORD-001', 'TRIP-014', 'STOP-09')).rejects.toMatchObject({ code: 'STOP_NOT_FOUND' })
  await expect(db.assignOrder('ORD-001', 'TRIP-011', 'STOP-01')).rejects.toMatchObject({ code: 'TRIP_LOCKED' })
  await expect(db.assignOrder('ORD-002', 'TRIP-014', 'STOP-01')).rejects.toMatchObject({ code: 'ORDER_STATUS_INVALID' })

  const back = await db.unassignOrder('ORD-002')
  expect(back.status).toBe('pending')
  expect(back.assignment).toBeUndefined()
  const after = await db.getTrip('TRIP-014')
  expect(after.packages.map((pkg) => pkg.id)).toStrictEqual(['PKG-001', 'PKG-002', 'PKG-003'])
  expect((await db.getRegisteredPackage('RPK-0013')).status).toBe('received')
  expect((await db.listEvents()).slice(0, 2).map((event) => event.action)).toStrictEqual(['order.unassigned', 'order.assigned'])
})

test('trip labels of hand-entered packages are deterministic, opaque and unique', async () => {
  const db = createMockDb()
  const trip = await db.getTrip('TRIP-2026-0914')
  const labels = tripLabels(trip, [], new Map())
  expect(labels).toHaveLength(132)
  expect(new Set(labels.map((label) => label.qrToken)).size).toBe(132)
  expect(labels.every((label) => !label.qrToken.includes('PKG'))).toBe(true)
  expect(await db.listTripLabels('TRIP-2026-0914')).toStrictEqual(labels)
})

test('readiness: the draft trip is ready; a trip without packages or over payload is not', async () => {
  const db = createMockDb()
  const ready = await db.getTripReadiness('TRIP-014')
  expect(ready.ready).toBe(true)
  const created = await db.createTrip({ name: 'Tuyến thử', vehicleId: 'VEHICLE-005', stops: [{ id: 'STOP-01', name: 'Kho A', address: 'Q.1' }], packages: [], scheduledDate: '2026-09-15' })
  const empty = await db.getTripReadiness(created.id)
  expect(empty.ready).toBe(false)
  expect(empty.checks.find((check) => check.code === 'PACKAGES_PRESENT')?.status).toBe('fail')
  // VEHICLE-008 đang bảo dưỡng
  await expect(db.createTrip({ name: 'x', vehicleId: 'VEHICLE-008', stops: [], packages: [], scheduledDate: '2026-09-15' })).rejects.toMatchObject({ code: 'VEHICLE_IN_MAINTENANCE' })
})
