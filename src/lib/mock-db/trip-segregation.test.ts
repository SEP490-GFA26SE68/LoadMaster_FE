import { expect, test } from 'vitest'
import { createMockDb } from '@/lib/mock-db'

/**
 * Phân tách hàng ở kho (FE-4b-06, D-74): một chuyến một loại hàng, vượt được khi ghi lý do. Kỳ vọng chép từ seed: TRIP-014 là chuyến
 * nháp ba dòng kiện gõ tay PKG-001…003 (40 + 40 + 60 kiện, không ghi loại hàng → hàng thường); REQ-002 đi KCN Phú Bài gồm hai kiện dễ
 * vỡ PK-0057, PK-0058 (`PB-HUE-2609-04`, `-05`); REQ-003 đi KCN Thăng Long gồm hai kiện giá trị cao; REQ-006 gồm mười thùng mì hàng
 * thường; PK-0069…0071 là hàng lạnh, PK-0074…0077 là hàng nguy hiểm, đều chưa thuộc yêu cầu nào. VEHICLE-004 có thiết bị làm lạnh.
 */

const NOW = new Date('2026-09-14T05:00:00.000Z')
const REASON = 'Khách gom chung một xe, đã chèn lót riêng'

function dispatcher() {
  const db = createMockDb({ now: () => NOW })
  db.restoreSession('US-0001')
  return db
}

test('the first package locks the trip; packages of the same class go in without a reason', async () => {
  const db = dispatcher()
  expect(await db.getTripSegregation('TRIP-014')).toStrictEqual({
    lockedClass: 'STANDARD',
    groups: [{ handlingClass: 'STANDARD', packageIds: ['PKG-001', 'PKG-002', 'PKG-003'], count: 140 }],
    conflicts: [],
    vehicleWarnings: [],
  })
  const { trip } = await db.assignDeliveryRequirement('REQ-006', 'TRIP-014')
  expect(trip.overrideReason).toBeUndefined()
  expect((await db.getTripSegregation('TRIP-014')).groups).toStrictEqual([{ handlingClass: 'STANDARD', packageIds: ['PKG-001', 'PKG-002', 'PKG-003', 'PKG-004'], count: 150 }])
})

test('a requirement of another class is refused with the packages named, and nothing is written', async () => {
  const db = dispatcher()
  const before = await db.getTrip('TRIP-014')
  const events = (await db.listEvents()).length
  await expect(db.assignDeliveryRequirement('REQ-002', 'TRIP-014')).rejects.toMatchObject({
    code: 'CARGO_SEGREGATION_CONFLICT',
    params: { tripId: 'TRIP-014', lockedClass: 'STANDARD', packages: ['PB-HUE-2609-04', 'PB-HUE-2609-05'] },
  })
  expect(await db.getTrip('TRIP-014')).toStrictEqual(before)
  expect((await db.getDeliveryRequirement('REQ-002')).status).toBe('PENDING')
  expect((await db.getPackage('PK-0057')).status).toBe('IMPORTED')
  expect(await db.listEvents()).toHaveLength(events)
})

test('with a reason the requirement goes in: the reason is stored on the trip and logged; later packages of another class pass', async () => {
  const db = dispatcher()
  await expect(db.assignDeliveryRequirement('REQ-002', 'TRIP-014', { overrideReason: '   ' })).rejects.toMatchObject({ code: 'REASON_REQUIRED' })
  await expect(db.assignDeliveryRequirement('REQ-002', 'TRIP-014', { overrideReason: 'x'.repeat(501) })).rejects.toMatchObject({ code: 'OVERRIDE_REASON_TOO_LONG', params: { max: 500 } })
  const { trip } = await db.assignDeliveryRequirement('REQ-002', 'TRIP-014', { overrideReason: `  ${REASON} ` })
  expect(trip.overrideReason).toBe(REASON)
  expect((await db.listEvents()).slice(0, 2).map((event) => [event.action, event.actorId, event.params])).toStrictEqual([
    ['requirement.assigned', 'US-0001', { destinationName: 'KCN Phú Bài', tripId: 'TRIP-014', stopNumber: 3, count: 2 }],
    ['trip.segregationOverridden', 'US-0001', { reason: REASON, handlingClass: 'STANDARD', conflictCount: 2 }],
  ])
  const state = await db.getTripSegregation('TRIP-014')
  expect([state.lockedClass, state.overrideReason]).toStrictEqual(['STANDARD', REASON])
  expect(state.conflicts).toStrictEqual([
    { packageId: 'PKG-004', handlingClass: 'FRAGILE', count: 1 },
    { packageId: 'PKG-005', handlingClass: 'FRAGILE', count: 1 },
  ])
  // Chuyến đã có lý do: kiện giá trị cao của REQ-003 đi tiếp, không ghi thêm sự kiện vượt luật
  const events = (await db.listEvents()).length
  expect((await db.assignDeliveryRequirement('REQ-003', 'TRIP-014')).trip.overrideReason).toBe(REASON)
  expect(await db.listEvents()).toHaveLength(events + 1)
  // Kiểm tra trước khi tối ưu: đã ghi lý do thì chỉ cảnh báo
  const readiness = await db.getTripReadiness('TRIP-014')
  expect(readiness.checks.find((check) => check.code === 'CARGO_SEGREGATED')).toStrictEqual({ code: 'CARGO_SEGREGATED', status: 'warn', params: { lines: 4, packages: 4 } })
})

test('the reason goes away with the last package of another class, and is asked again next time', async () => {
  const db = dispatcher()
  await db.assignDeliveryRequirement('REQ-002', 'TRIP-014', { overrideReason: REASON })
  await db.unassignDeliveryRequirement('REQ-002')
  expect((await db.getTrip('TRIP-014')).overrideReason).toBeUndefined()
  await expect(db.assignDeliveryRequirement('REQ-002', 'TRIP-014')).rejects.toMatchObject({ code: 'CARGO_SEGREGATION_CONFLICT' })
})

test('pool packages and hand-typed lines go through the same rule', async () => {
  const db = dispatcher()
  await expect(db.addTripPackages('TRIP-014', ['PK-0069', 'PK-0029'], { stopId: 'STOP-01' })).rejects.toMatchObject({
    code: 'CARGO_SEGREGATION_CONFLICT', params: { tripId: 'TRIP-014', lockedClass: 'STANDARD', packages: ['TN-CTH-2609-01'] },
  })
  const { packages } = await db.getTrip('TRIP-014')
  const [first] = packages
  if (!first) throw new Error('TRIP-014 phải có dòng kiện')
  // Đổi loại hàng của một dòng gõ tay: dòng đó thành kiện khác loại, lỗi gọi tên dòng
  const edited = packages.map((line) => (line.id === 'PKG-003' ? { ...line, handlingClass: 'HAZARDOUS' as const } : line))
  await expect(db.updateTrip('TRIP-014', { packages: edited })).rejects.toMatchObject({ code: 'CARGO_SEGREGATION_CONFLICT', params: { packages: ['PKG-003'] } })
  const saved = await db.updateTrip('TRIP-014', { packages: edited, overrideReason: REASON })
  expect(saved.overrideReason).toBe(REASON)
  expect((await db.getTripSegregation('TRIP-014')).vehicleWarnings).toStrictEqual([{ code: 'HAZARDOUS_VEHICLE_REQUIRED', severity: 'warning', params: { count: 60 } }])
  // Tạo chuyến kèm kiện nhiều loại hàng cũng cần lý do
  const mixed = { name: 'Tuyến thử', vehicleId: 'VEHICLE-005', stops: [{ id: 'STOP-01', name: 'Điểm thử', address: '1 Đường thử' }], scheduledDate: '2026-09-16', packages: [first, { ...first, id: 'PKG-002', handlingClass: 'FRAGILE' as const }] }
  await expect(db.createTrip(mixed)).rejects.toMatchObject({ code: 'CARGO_SEGREGATION_CONFLICT', params: { lockedClass: 'STANDARD', packages: ['PKG-002'] } })
  expect((await db.createTrip({ ...mixed, overrideReason: REASON })).overrideReason).toBe(REASON)
})

test('an emptied trip takes the class of the next first package; refrigerated cargo warns unless the vehicle has a cooling unit', async () => {
  const db = dispatcher()
  const trip = await db.createTrip({ name: 'Tuyến hàng lạnh', vehicleId: 'VEHICLE-005', stops: [], packages: [], scheduledDate: '2026-09-16' })
  expect((await db.getTripSegregation(trip.id)).lockedClass).toBeNull()
  const cold = { newStop: { name: 'Kho lạnh Trà Nóc', address: 'KCN Trà Nóc, Q. Bình Thuỷ, Cần Thơ' } }
  await db.addTripPackages(trip.id, ['PK-0069', 'PK-0070'], cold)
  expect(await db.getTripSegregation(trip.id)).toMatchObject({
    lockedClass: 'REFRIGERATED', conflicts: [], vehicleWarnings: [{ code: 'REFRIGERATION_MISSING', severity: 'warning', params: { count: 2 } }],
  })
  // Hàng thường vào chuyến hàng lạnh là xung đột
  await expect(db.addTripPackages(trip.id, ['PK-0029'], { stopId: 'STOP-01' })).rejects.toMatchObject({ code: 'CARGO_SEGREGATION_CONFLICT', params: { lockedClass: 'REFRIGERATED' } })
  expect((await db.getTripSegregation((await db.updateTrip(trip.id, { vehicleId: 'VEHICLE-004' })).id)).vehicleWarnings).toStrictEqual([])
  // Bỏ hết kiện: khoá tính lại theo kiện đầu tiên của lần đưa vào sau
  await db.removeTripPackage(trip.id, 'PK-0069')
  await db.removeTripPackage(trip.id, 'PK-0070')
  expect((await db.getTripSegregation(trip.id)).lockedClass).toBeNull()
  await db.addTripPackages(trip.id, ['PK-0029'], { stopId: 'STOP-01' })
  expect((await db.getTripSegregation(trip.id)).lockedClass).toBe('STANDARD')
})

test('the reason of a trip that carries another class can be rewritten while planning; a trip without conflicts records nothing', async () => {
  const db = dispatcher()
  await db.assignDeliveryRequirement('REQ-002', 'TRIP-014', { overrideReason: REASON })
  const events = (await db.listEvents()).length
  expect((await db.overrideTripSegregation('TRIP-014', ' Đã báo khách, chèn lót riêng ')).overrideReason).toBe('Đã báo khách, chèn lót riêng')
  expect((await db.listEvents())[0]).toMatchObject({ action: 'trip.segregationOverridden', target: { type: 'trip', id: 'TRIP-014' }, params: { reason: 'Đã báo khách, chèn lót riêng', conflictCount: 2 } })
  // Lý do không đổi, hoặc chuyến không có kiện khác loại: không ghi gì
  await db.overrideTripSegregation('TRIP-014', 'Đã báo khách, chèn lót riêng')
  expect((await db.overrideTripSegregation('TRIP-012', REASON)).overrideReason).toBeUndefined()
  expect(await db.listEvents()).toHaveLength(events + 1)
  await expect(db.overrideTripSegregation('TRIP-014', '')).rejects.toMatchObject({ code: 'REASON_REQUIRED' })
  await expect(db.overrideTripSegregation('TRIP-011', REASON)).rejects.toMatchObject({ code: 'TRIP_LOCKED', params: { phase: 'loading' } })
})
