import { expect, test } from 'vitest'
import { createMockDb } from '@/lib/mock-db'

/**
 * Điều phối viên đưa kiện Đã nhập thẳng vào chuyến (FE-4b-05, D-68 đường 2). Kỳ vọng chép từ seed: PK-0029…0034 là sáu thùng bánh quy
 * (loại kiện PT-005, mã lô `MP-BQ-0913`, đi KCN Tân Bình), PK-0064 là kiện giá trị cao `TL-HNI-2609-01` không gắn loại kiện, PK-0063
 * mang cờ, PK-0013 thuộc yêu cầu REQ-006. TRIP-014 là chuyến nháp hai điểm giao tay, ba dòng kiện PKG-001…003.
 */

const NOW = new Date('2026-09-14T05:00:00.000Z')

function dispatcher() {
  const db = createMockDb({ now: () => NOW })
  db.restoreSession('US-0001')
  return db
}

const TAN_BINH = { name: 'Xưởng bánh kẹo Tân Bình', address: 'KCN Tân Bình, Q. Tân Phú, TP. Hồ Chí Minh', lat: 10.817, lng: 106.62, phone: '0283 811 5530' }

test('IMPORTED packages go straight onto a new hand-added stop: one line per group of identical packages, no deadline, pool data kept', async () => {
  const db = dispatcher()
  const before = await db.getTrip('TRIP-014')
  // PK-0064 là hàng giá trị cao, chuyến đang chở hàng thường: cần lý do vượt luật phân tách hàng (FE-4b-06)
  const trip = await db.addTripPackages('TRIP-014', ['PK-0029', 'PK-0064', 'PK-0030', 'PK-0029'], { newStop: TAN_BINH }, { overrideReason: 'Khách gom chung một xe' })
  expect(trip.inputVersion).toBe(before.inputVersion + 1)
  // Điểm tay mới cuối tuyến: không tự sinh, không hạn, không ưu tiên
  expect(trip.stops.at(-1)).toStrictEqual({ id: 'STOP-03', ...TAN_BINH })
  expect(trip.packages.slice(3).map((line) => [line.id, line.name, line.quantity, line.deliveryStop, line.handlingClass, line.priority, line.mustLoad, line.groupId])).toStrictEqual([
    ['PKG-004', 'Thùng bánh quy', 2, 3, 'STANDARD', 1, true, undefined],
    ['PKG-005', 'TL-HNI-2609-01', 1, 3, 'HIGH_VALUE', 1, true, undefined],
  ])
  // Kiện sang Đã gán chuyến, giữ mã của bên gửi, điểm đến và nguồn của chính nó; không thuộc yêu cầu nào
  const moved = await db.getPackage('PK-0029')
  expect(moved).toMatchObject({ status: 'ASSIGNED', tripId: 'TRIP-014', stopId: 'STOP-03', packageCode: 'MP-BQ-0913-01', source: 'MANUAL', destination: 'KCN Tân Bình, Q. Tân Phú, TP. Hồ Chí Minh' })
  expect(moved.requirementId).toBeUndefined()
  expect(moved.history.at(-1)).toMatchObject({ kind: 'status', from: 'IMPORTED', to: 'ASSIGNED', tripId: 'TRIP-014', actorId: 'US-0001' })
  // Nhãn QR của instance là mã của đúng kiện kho kiện
  const labels = (await db.listTripLabels('TRIP-014')).filter((label) => label.packageId >= 'PKG-004')
  expect(labels.map((label) => [label.packageInstanceId, label.poolPackageId])).toStrictEqual([['PKG-004-01', 'PK-0029'], ['PKG-004-02', 'PK-0030'], ['PKG-005-01', 'PK-0064']])
  expect((await db.listEvents())[0]).toMatchObject({ action: 'trip.packagesAdded', actorId: 'US-0001', target: { type: 'trip', id: 'TRIP-014' }, params: { count: 3, stopNumber: 3 } })
  // Kiện kho kiện của chuyến kèm đường vào chuyến: 140 kiện sinh từ ba dòng nhập tay của seed, ba kiện đưa thẳng từ kho kiện
  const inTrip = await db.listTripPackages('TRIP-014')
  expect(inTrip.filter((item) => item.origin === 'TRIP')).toHaveLength(140)
  expect(inTrip.filter((item) => item.origin === 'POOL').map((item) => [item.package.id, item.lineId, item.deliveryStop])).toStrictEqual([
    ['PK-0029', 'PKG-004', 3], ['PK-0030', 'PKG-004', 3], ['PK-0064', 'PKG-005', 3],
  ])

  // Thêm vào điểm đang có: dòng mới ở điểm đó
  const again = await db.addTripPackages('TRIP-014', ['PK-0031'], { stopId: 'STOP-01' })
  expect(again.stops).toHaveLength(3)
  expect(again.packages.at(-1)).toMatchObject({ id: 'PKG-006', quantity: 1, deliveryStop: 1 })
  expect(await db.getPackage('PK-0031')).toMatchObject({ status: 'ASSIGNED', stopId: 'STOP-01' })
  // Kiện của yêu cầu giao cũng nằm trong danh sách, mang đường vào chuyến riêng
  await db.assignDeliveryRequirement('REQ-004', 'TRIP-014')
  expect((await db.listTripPackages('TRIP-014')).filter((item) => item.origin === 'REQUIREMENT').map((item) => [item.package.id, item.deliveryStop])).toStrictEqual([['PK-0072', 4], ['PK-0073', 4]])
})

test('only IMPORTED packages without a flag and outside every requirement can be added, on a planning trip, to a stop that exists', async () => {
  const db = dispatcher()
  const before = await db.getTrip('TRIP-014')
  const target = { stopId: 'STOP-01' }
  await expect(db.addTripPackages('TRIP-014', ['PK-0029', 'PK-0063'], target)).rejects.toMatchObject({ code: 'PACKAGE_FLAGGED', params: { packageId: 'PK-0063', flag: 'NOT_FOUND' } })
  await expect(db.addTripPackages('TRIP-014', ['PK-0013'], target)).rejects.toMatchObject({ code: 'PACKAGE_UNAVAILABLE', params: { packageId: 'PK-0013', status: 'IMPORTED' } })
  await expect(db.addTripPackages('TRIP-014', [], target)).rejects.toMatchObject({ code: 'PACKAGES_REQUIRED' })
  await expect(db.addTripPackages('TRIP-014', ['PK-0029'], { stopId: 'STOP-09' })).rejects.toMatchObject({ code: 'STOP_NOT_FOUND', params: { tripId: 'TRIP-014', stopId: 'STOP-09' } })
  await expect(db.addTripPackages('TRIP-014', ['PK-0029'], { newStop: { ...TAN_BINH, name: '  ' } })).rejects.toMatchObject({ code: 'TRIP_INVALID', params: { tripId: 'TRIP-014', field: 'stop' } })
  await expect(db.addTripPackages('TRIP-014', ['PK-0029'], { newStop: { ...TAN_BINH, lat: 91 } })).rejects.toMatchObject({ code: 'TRIP_INVALID', params: { field: 'stop' } })
  await expect(db.addTripPackages('TRIP-011', ['PK-0029'], target)).rejects.toMatchObject({ code: 'TRIP_LOCKED', params: { tripId: 'TRIP-011', phase: 'loading' } })
  // Không lần từ chối nào ghi gì
  expect(await db.getTrip('TRIP-014')).toStrictEqual(before)
  expect((await db.getPackage('PK-0029')).status).toBe('IMPORTED')
  // Kiện đã vào chuyến không vào lần nữa
  await db.addTripPackages('TRIP-014', ['PK-0029'], target)
  await expect(db.addTripPackages('TRIP-014', ['PK-0029'], target)).rejects.toMatchObject({ code: 'PACKAGE_UNAVAILABLE', params: { packageId: 'PK-0029', status: 'ASSIGNED' } })
})

test('a package taken off the trip goes back to IMPORTED; its line shrinks and disappears with its last package; the hand-added stop stays', async () => {
  const db = dispatcher()
  await db.addTripPackages('TRIP-014', ['PK-0029', 'PK-0030', 'PK-0032'], { newStop: TAN_BINH })
  const version = (await db.getTrip('TRIP-014')).inputVersion

  const trip = await db.removeTripPackage('TRIP-014', 'PK-0030')
  expect(trip.inputVersion).toBe(version + 1)
  expect(trip.packages.at(-1)).toMatchObject({ id: 'PKG-004', quantity: 2 })
  const back = await db.getPackage('PK-0030')
  expect([back.status, back.tripId, back.stopId]).toStrictEqual(['IMPORTED', undefined, undefined])
  // Kiện còn lại của dòng dồn lên: instance thứ hai nay là PK-0032
  expect((await db.listTripLabels('TRIP-014')).filter((label) => label.packageId === 'PKG-004').map((label) => [label.packageInstanceId, label.poolPackageId])).toStrictEqual([
    ['PKG-004-01', 'PK-0029'], ['PKG-004-02', 'PK-0032'],
  ])
  expect((await db.listEvents())[0]).toMatchObject({ action: 'trip.packageRemoved', target: { type: 'trip', id: 'TRIP-014' }, params: { packageId: 'PK-0030', packageCode: 'MP-BQ-0913-02' } })

  await db.removeTripPackage('TRIP-014', 'PK-0029')
  const emptied = await db.removeTripPackage('TRIP-014', 'PK-0032')
  expect(emptied.packages.map((line) => line.id)).toStrictEqual(['PKG-001', 'PKG-002', 'PKG-003'])
  expect(emptied.stops.map((stop) => stop.id)).toStrictEqual(['STOP-01', 'STOP-02', 'STOP-03'])
  // Kiện về kho kiện lại chọn được cho chuyến hoặc yêu cầu khác
  expect((await db.addTripPackages('TRIP-012', ['PK-0029'], { stopId: 'STOP-01' })).packages.at(-1)).toMatchObject({ quantity: 1, name: 'Thùng bánh quy' })

  // Kiện của yêu cầu giao rời chuyến bằng cách gỡ yêu cầu; kiện không ở chuyến này thì không bỏ được
  await db.assignDeliveryRequirement('REQ-006', 'TRIP-014')
  await expect(db.removeTripPackage('TRIP-014', 'PK-0013')).rejects.toMatchObject({ code: 'PACKAGE_UNAVAILABLE', params: { packageId: 'PK-0013', status: 'ASSIGNED' } })
  await expect(db.removeTripPackage('TRIP-014', 'PK-0033')).rejects.toMatchObject({ code: 'PACKAGE_UNAVAILABLE', params: { packageId: 'PK-0033', status: 'IMPORTED' } })
  await expect(db.removeTripPackage('TRIP-011', 'PK-0033')).rejects.toMatchObject({ code: 'TRIP_LOCKED' })
})

test('editing or moving the line keeps the data of the pool packages; cancelling the trip sends them back to the pool', async () => {
  const db = dispatcher()
  const added = await db.addTripPackages('TRIP-014', ['PK-0064'], { newStop: TAN_BINH }, { overrideReason: 'Khách gom chung một xe' })
  const before = await db.getPackage('PK-0064')
  // Sửa khối lượng của dòng và chuyển dòng sang điểm 1: kiện kho kiện chỉ đổi điểm giao
  await db.updateTrip('TRIP-014', { packages: added.packages.map((line) => (line.id === 'PKG-004' ? { ...line, weightKg: 9, deliveryStop: 1 } : line)) })
  expect(await db.getPackage('PK-0064')).toStrictEqual({ ...before, stopId: 'STOP-01' })
  // Bỏ cả dòng ở bảng kiện của chuyến: kiện về kho kiện
  await db.updateTrip('TRIP-014', { packages: added.packages.filter((line) => line.id !== 'PKG-004') })
  expect((await db.getPackage('PK-0064')).status).toBe('IMPORTED')

  // Chuyến hết kiện khác loại thì lý do vượt luật cũng được gỡ: đưa lại kiện giá trị cao phải ghi lý do lần nữa (FE-4b-06)
  await db.addTripPackages('TRIP-014', ['PK-0064'], { stopId: 'STOP-03' }, { overrideReason: 'Khách gom chung một xe' })
  await db.cancelTrip('TRIP-014', 'Khách dời lịch nhận hàng')
  const released = await db.getPackage('PK-0064')
  expect([released.status, released.tripId, released.packageCode]).toStrictEqual(['IMPORTED', undefined, 'TL-HNI-2609-01'])
})
