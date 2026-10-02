import { expect, test } from 'vitest'
import { createMockDb, isSelectablePackage, tripLabels, type MockDb } from '@/lib/mock-db'

/** Luồng 2 Review 1 (LM-104): đơn hàng từ kiện còn ở kho kiện, gán vào điểm giao của chuyến, kiểm tra "Sẵn sàng tối ưu". */

const selectable = async (db: MockDb) => (await db.listPackages()).filter(isSelectablePackage)

test('an order takes IMPORTED packages without a flag that no other order holds; edits and cancels only while pending', async () => {
  const db = createMockDb()
  // Điều phối viên Long Bình lập đơn từ kiện của Long Bình (FE-0-02); `restoreSession` không ghi nhật ký
  db.restoreSession('US-0001')
  // 66 kiện chưa vào đơn nào (PK-0023…0088) trừ hai kiện mang cờ PK-0063, PK-0078
  const free = (await selectable(db)).map((pkg) => pkg.id)
  expect(free).toHaveLength(64)
  expect([free[0], free.at(-1), free.includes('PK-0022'), free.includes('PK-0063'), free.includes('PK-0078')]).toStrictEqual(['PK-0023', 'PK-0088', false, false, false])
  const order = await db.createOrder({ customerName: ' Nhà hàng Hương Việt ', deliveryAddress: '203 Lê Văn Sỹ, P. 13, Q.3', phone: '', packageIds: ['PK-0023', 'PK-0024'] })
  expect(order).toMatchObject({ id: 'ORD-003', customerName: 'Nhà hàng Hương Việt', status: 'pending', packageIds: ['PK-0023', 'PK-0024'] })
  expect(order).not.toHaveProperty('phone')
  expect(await db.getPackage('PK-0023')).toMatchObject({ orderId: 'ORD-003', status: 'IMPORTED' })
  // Kiện đã rời kho kiện (đã gán chuyến); kiện đã thuộc đơn khác
  await db.updatePackageStatus('PK-0035', 'ASSIGNED')
  await expect(db.createOrder({ customerName: 'A', deliveryAddress: 'B', packageIds: ['PK-0035'] })).rejects.toMatchObject({ code: 'PACKAGE_UNAVAILABLE', params: { packageId: 'PK-0035', status: 'ASSIGNED' } })
  await expect(db.createOrder({ customerName: 'A', deliveryAddress: 'B', packageIds: ['PK-0001'] })).rejects.toMatchObject({ code: 'PACKAGE_UNAVAILABLE' })
  await expect(db.createOrder({ customerName: 'A', deliveryAddress: 'B', packageIds: [] })).rejects.toMatchObject({ code: 'PACKAGES_REQUIRED' })

  const edited = await db.updateOrder('ORD-003', { packageIds: ['PK-0024', 'PK-0025'], contactName: 'Chị Linh' })
  expect(edited).toMatchObject({ packageIds: ['PK-0024', 'PK-0025'], contactName: 'Chị Linh' })
  expect((await db.getPackage('PK-0023')).orderId).toBeUndefined()
  await expect(db.cancelOrder('ORD-003', '  ')).rejects.toMatchObject({ code: 'REASON_REQUIRED' })
  const cancelled = await db.cancelOrder('ORD-003', 'Khách đổi ngày nhận')
  expect(cancelled).toMatchObject({ status: 'cancelled', cancellation: { reason: 'Khách đổi ngày nhận' } })
  // Đơn huỷ trả cả hai kiện về; PK-0035 đã gán chuyến nên không còn chọn được
  expect(await selectable(db)).toHaveLength(63)
  await expect(db.updateOrder('ORD-003', { note: 'x' })).rejects.toMatchObject({ code: 'ORDER_STATUS_INVALID' })
})

test('assigning an order to a stop adds one package line per group of identical packages, makes old plans stale and assigns the packages', async () => {
  const db = createMockDb()
  const before = await db.getTrip('TRIP-014')
  const { order, trip } = await db.assignOrder('ORD-002', 'TRIP-014', 'STOP-02')
  expect(order).toMatchObject({ status: 'assigned', assignment: { tripId: 'TRIP-014', stopId: 'STOP-02', lines: [{ lineId: 'PKG-004', packageIds: (await db.getOrder('ORD-002')).packageIds }] } })
  expect(trip.inputVersion).toBe(before.inputVersion + 1)
  expect(trip.packages.at(-1)).toMatchObject({ id: 'PKG-004', name: 'Thùng mì ăn liền 30 gói', quantity: 10, deliveryStop: 2, groupId: 'ORD-002', lengthCm: 55, weightKg: 3.5, handlingClass: 'STANDARD', maxTopLoadKg: 20, maxStackCount: 5 })
  expect(await db.getPackage('PK-0013')).toMatchObject({ status: 'ASSIGNED', tripId: 'TRIP-014', stopId: 'STOP-02' })
  // Nhãn QR của kiện trong chuyến là mã của kiện kho kiện
  const labels = await db.listTripLabels('TRIP-014')
  const label = labels.find((item) => item.packageInstanceId === 'PKG-004-01')
  expect(label).toMatchObject({ poolPackageId: 'PK-0013', qrToken: (await db.getPackage('PK-0013')).qrToken })
  expect(labels.find((item) => item.packageInstanceId === 'PKG-001-01')?.poolPackageId).toBeUndefined()

  await expect(db.assignOrder('ORD-001', 'TRIP-014', 'STOP-09')).rejects.toMatchObject({ code: 'STOP_NOT_FOUND' })
  await expect(db.assignOrder('ORD-001', 'TRIP-011', 'STOP-01')).rejects.toMatchObject({ code: 'TRIP_LOCKED' })
  await expect(db.assignOrder('ORD-002', 'TRIP-014', 'STOP-01')).rejects.toMatchObject({ code: 'ORDER_STATUS_INVALID' })

  const back = await db.unassignOrder('ORD-002')
  expect(back.status).toBe('pending')
  expect(back.assignment).toBeUndefined()
  const after = await db.getTrip('TRIP-014')
  expect(after.packages.map((pkg) => pkg.id)).toStrictEqual(['PKG-001', 'PKG-002', 'PKG-003'])
  const back13 = await db.getPackage('PK-0013')
  expect([back13.status, back13.orderId, back13.tripId, back13.stopId]).toStrictEqual(['IMPORTED', 'ORD-002', undefined, undefined])
  expect((await db.listEvents()).slice(0, 2).map((event) => event.action)).toStrictEqual(['order.unassigned', 'order.assigned'])
})

test('packages without a package type become one line each, named by the sender code and constrained by their handling class', async () => {
  const db = createMockDb()
  db.restoreSession('US-0001')
  // PK-0054, PK-0055: hàng dễ vỡ đi Huế 50 × 40 × 30 cm, 9,5 kg; PK-0064: hàng giá trị cao đi Hà Nội 7,2 kg; PK-0023, PK-0024: thùng sữa PT-004
  const order = await db.createOrder({ customerName: 'Công ty Gốm Phú Bài', deliveryAddress: 'KCN Phú Bài, TX. Hương Thuỷ', packageIds: ['PK-0054', 'PK-0023', 'PK-0055', 'PK-0064', 'PK-0024'] })
  const { trip, order: assigned } = await db.assignOrder(order.id, 'TRIP-014', 'STOP-01')
  expect(assigned.assignment?.lines).toStrictEqual([
    { lineId: 'PKG-004', packageIds: ['PK-0054'] }, { lineId: 'PKG-005', packageIds: ['PK-0023', 'PK-0024'] },
    { lineId: 'PKG-006', packageIds: ['PK-0055'] }, { lineId: 'PKG-007', packageIds: ['PK-0064'] },
  ])
  expect(trip.packages.slice(3).map((line) => [line.id, line.name, line.quantity, line.handlingClass, line.stackable, line.maxTopLoadKg, line.weightKg])).toStrictEqual([
    ['PKG-004', 'PB-HUE-2609-01', 1, 'FRAGILE', false, 0, 9.5],
    ['PKG-005', 'Thùng sữa hộp 48 hộp', 2, 'STANDARD', true, 160, 52],
    ['PKG-006', 'PB-HUE-2609-02', 1, 'FRAGILE', false, 0, 9.5],
    ['PKG-007', 'TL-HNI-2609-01', 1, 'HIGH_VALUE', true, 21.6, 7.2],
  ])
  // Nhãn của từng instance là mã QR của đúng kiện kho kiện
  const labels = await db.listTripLabels('TRIP-014')
  expect(labels.filter((label) => label.poolPackageId !== undefined).map((label) => [label.packageInstanceId, label.poolPackageId])).toStrictEqual([
    ['PKG-004-01', 'PK-0054'], ['PKG-005-01', 'PK-0023'], ['PKG-005-02', 'PK-0024'], ['PKG-006-01', 'PK-0055'], ['PKG-007-01', 'PK-0064'],
  ])
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
