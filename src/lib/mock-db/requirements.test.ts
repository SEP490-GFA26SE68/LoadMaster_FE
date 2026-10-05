import { expect, test } from 'vitest'
import {
  createMockDb,
  isRequirementClosed,
  isSelectablePackage,
  REQUIREMENT_CARGO_PRIORITY,
  requirementStatus,
  type MockDb,
  type RequirementInput,
} from '@/lib/mock-db'

/**
 * Yêu cầu giao (FE-4b-01, D-72, D-91 → D-93): mô hình, trạng thái suy, seed, và các hàm của kho. Kỳ vọng chép từ `seed-sourcing.ts`,
 * `seed-phuong-nam.ts` và PRD v2 mục 7.3 — không tính lại theo cách code tính.
 */

/** 12:00 ngày neo, giờ Việt Nam: hạn của seed (sớm nhất 15:00 ngày 15/09) đều ở tương lai. */
const NOW = new Date('2026-09-14T05:00:00.000Z')
const open = () => createMockDb({ now: () => NOW })
const selectable = async (db: MockDb) => (await db.listPackages()).filter(isSelectablePackage)

const HUONG_VIET: RequirementInput = {
  destinationName: ' Nhà hàng Hương Việt ', address: '203 Lê Văn Sỹ, P. 13, Q.3', deadline: '2026-09-16T17:00:00+07:00', priority: 'NORMAL',
  packageIds: ['PK-0023', 'PK-0024'], note: '  ',
}

test('priority maps to the cargo priority of D-93: urgent 4 and must load, high 3, normal 2, low 1', () => {
  expect(REQUIREMENT_CARGO_PRIORITY).toStrictEqual({
    LOW: { priority: 1, mustLoad: false },
    NORMAL: { priority: 2, mustLoad: false },
    HIGH: { priority: 3, mustLoad: false },
    URGENT: { priority: 4, mustLoad: true },
  })
})

test('the shown status adds "delivered" and "delivered short" from the status and flags of the packages', () => {
  const pkg = (status: 'IMPORTED' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'RETURNED', flags: ('NOT_FOUND' | 'DAMAGED')[] = []) => ({ status, flags })
  expect(requirementStatus({ status: 'PENDING' }, [pkg('IMPORTED'), pkg('IMPORTED')])).toBe('PENDING')
  expect(requirementStatus({ status: 'ASSIGNED' }, [pkg('ASSIGNED')])).toBe('ASSIGNED')
  expect(requirementStatus({ status: 'IN_TRIP' }, [pkg('DELIVERED'), pkg('IN_TRANSIT')])).toBe('IN_TRIP')
  expect(requirementStatus({ status: 'IN_TRIP' }, [pkg('DELIVERED'), pkg('DELIVERED')])).toBe('DELIVERED')
  // Giao thiếu: kiện hoàn trả (D-91), kiện không tìm thấy lúc xếp hay hư hỏng (D-92) — kể cả khi yêu cầu còn chờ xếp chuyến
  expect(requirementStatus({ status: 'IN_TRIP' }, [pkg('DELIVERED'), pkg('RETURNED')])).toBe('PARTIAL')
  expect(requirementStatus({ status: 'IN_TRIP' }, [pkg('DELIVERED'), pkg('IMPORTED', ['NOT_FOUND'])])).toBe('PARTIAL')
  expect(requirementStatus({ status: 'PENDING' }, [pkg('IMPORTED', ['DAMAGED']), pkg('IMPORTED')])).toBe('PARTIAL')
  // Đã giao xong: đang giao và không kiện nào còn đi tiếp
  expect(isRequirementClosed({ status: 'IN_TRIP' }, [pkg('DELIVERED'), pkg('RETURNED'), pkg('IMPORTED', ['NOT_FOUND'])])).toBe(true)
  expect(isRequirementClosed({ status: 'IN_TRIP' }, [pkg('DELIVERED'), pkg('IN_TRANSIT')])).toBe(false)
  expect(isRequirementClosed({ status: 'PENDING' }, [pkg('IMPORTED', ['DAMAGED'])])).toBe(false)
})

test('the seed has seven pending requirements to real places, made by the company managers, with deadlines anchored on the seed day', async () => {
  const db = createMockDb()
  const all = await db.listDeliveryRequirements()
  // Mới nhất trước: của Phương Nam nối sau của Long Bình
  expect(all.map((item) => [item.id, item.companyId, item.destinationName, item.priority, item.deadline, item.packageIds.length, item.createdBy])).toStrictEqual([
    ['REQ-PN-001', 'LOG-002', 'Cửa hàng linh kiện Khánh Hội', 'NORMAL', '2026-09-15T08:00:00.000Z', 4, 'US-PN-02'],
    ['REQ-006', 'LOG-001', 'Kho Bách Hoá Xanh Dĩ An', 'HIGH', '2026-09-16T04:00:00.000Z', 10, 'US-0002'],
    ['REQ-005', 'LOG-001', 'Siêu thị Co.opmart Bình Dương', 'NORMAL', '2026-09-16T09:00:00.000Z', 12, 'US-0002'],
    ['REQ-004', 'LOG-001', 'KCN Trà Nóc', 'NORMAL', '2026-09-17T03:00:00.000Z', 2, 'US-0002'],
    ['REQ-003', 'LOG-001', 'KCN Thăng Long', 'URGENT', '2026-09-19T05:00:00.000Z', 2, 'US-0002'],
    ['REQ-002', 'LOG-001', 'KCN Phú Bài', 'HIGH', '2026-09-17T10:00:00.000Z', 2, 'US-0002'],
    ['REQ-001', 'LOG-001', 'KCN Hoà Khánh', 'LOW', '2026-09-18T10:00:00.000Z', 2, 'US-0002'],
  ])
  expect(new Set(all.map((item) => item.status))).toStrictEqual(new Set(['PENDING']))
  expect(all.filter((item) => item.tripId !== undefined)).toStrictEqual([])
  expect(await db.getDeliveryRequirement('REQ-003')).toMatchObject({ address: 'KCN Thăng Long, H. Đông Anh, Hà Nội', lat: 21.1186, lng: 105.7797, packageIds: ['PK-0067', 'PK-0068'] })
  expect((await db.getDeliveryRequirement('REQ-002')).note).toBe('Hàng gốm, giao trong giờ hành chính')
  // Mỗi kiện của yêu cầu ghi mã yêu cầu; không kiện nào thuộc hai yêu cầu
  const held = (await db.listPackages()).filter((pkg) => pkg.requirementId !== undefined)
  expect(held).toHaveLength(34)
  expect(held.filter((pkg) => pkg.requirementId === 'REQ-001').map((pkg) => pkg.id)).toStrictEqual(['PK-0052', 'PK-0053'])
  expect(held.filter((pkg) => pkg.status !== 'IMPORTED' || pkg.flags.length > 0)).toStrictEqual([])
})

test('a requirement takes IMPORTED packages without a flag that no other requirement holds, and a deadline in the future', async () => {
  const db = open()
  db.restoreSession('US-0002')
  // 58 kiện chưa thuộc yêu cầu nào (PK-0023…0088 trừ 8 kiện của REQ-001…004) trừ hai kiện mang cờ PK-0063, PK-0078; cùng 170 kiện của
  // chuyến đã huỷ TRIP-004 đã về kho kiện (nguồn `TRIP`, FE-3b-07)
  const all = await selectable(db)
  expect(all.filter((pkg) => pkg.source === 'TRIP')).toHaveLength(170)
  const free = all.filter((pkg) => pkg.source !== 'TRIP').map((pkg) => pkg.id)
  expect(free).toHaveLength(56)
  expect([free[0], free.at(-1), free.includes('PK-0022'), free.includes('PK-0052'), free.includes('PK-0063'), free.includes('PK-0078')]).toStrictEqual(['PK-0023', 'PK-0088', false, false, false, false])

  const created = await db.createDeliveryRequirement(HUONG_VIET)
  expect(created).toStrictEqual({
    id: 'REQ-007', companyId: 'LOG-001', destinationName: 'Nhà hàng Hương Việt', address: '203 Lê Văn Sỹ, P. 13, Q.3', deadline: '2026-09-16T10:00:00.000Z',
    priority: 'NORMAL', packageIds: ['PK-0023', 'PK-0024'], status: 'PENDING', createdAt: '2026-09-14T05:00:00.000Z', createdBy: 'US-0002',
  })
  expect(await db.getPackage('PK-0023')).toMatchObject({ requirementId: 'REQ-007', status: 'IMPORTED' })
  expect((await db.listEvents())[0]).toMatchObject({ action: 'requirement.created', actorId: 'US-0002', target: { type: 'requirement', id: 'REQ-007' }, params: { destinationName: 'Nhà hàng Hương Việt', count: 2, priority: 'NORMAL' } })

  const base = { ...HUONG_VIET, packageIds: ['PK-0025'] }
  // Kiện đã rời kho kiện; kiện đã thuộc yêu cầu khác; kiện mang cờ; không kiện nào
  await db.updatePackageStatus('PK-0035', 'ASSIGNED')
  await expect(db.createDeliveryRequirement({ ...base, packageIds: ['PK-0035'] })).rejects.toMatchObject({ code: 'PACKAGE_UNAVAILABLE', params: { packageId: 'PK-0035', status: 'ASSIGNED' } })
  await expect(db.createDeliveryRequirement({ ...base, packageIds: ['PK-0001'] })).rejects.toMatchObject({ code: 'PACKAGE_UNAVAILABLE', params: { packageId: 'PK-0001' } })
  await expect(db.createDeliveryRequirement({ ...base, packageIds: ['PK-0025', 'PK-0063'] })).rejects.toMatchObject({ code: 'PACKAGE_FLAGGED', params: { packageId: 'PK-0063', flag: 'NOT_FOUND' } })
  await expect(db.createDeliveryRequirement({ ...base, packageIds: [] })).rejects.toMatchObject({ code: 'PACKAGES_REQUIRED' })
  // Hạn đúng bằng "bây giờ" của kho, hoặc đã qua
  await expect(db.createDeliveryRequirement({ ...base, deadline: '2026-09-14T05:00:00.000Z' })).rejects.toMatchObject({ code: 'REQUIREMENT_DEADLINE_PAST', params: { deadline: '2026-09-14T05:00:00.000Z' } })
  await expect(db.createDeliveryRequirement({ ...base, deadline: '2026-09-13T17:00:00+07:00' })).rejects.toMatchObject({ code: 'REQUIREMENT_DEADLINE_PAST' })
  // Trường sai: tên trường đầu tiên sai
  const invalid = (changes: Partial<RequirementInput>, field: string) =>
    expect(db.createDeliveryRequirement({ ...base, ...changes })).rejects.toMatchObject({ code: 'REQUIREMENT_INVALID', params: { field } })
  await invalid({ destinationName: '  ' }, 'destinationName')
  await invalid({ address: '' }, 'address')
  await invalid({ priority: 'ASAP' as never }, 'priority')
  await invalid({ deadline: 'mai' }, 'deadline')
  await invalid({ lat: 10.78 }, 'coordinates')
  await invalid({ lat: 91, lng: 106.68 }, 'coordinates')
  // Không lần từ chối nào ghi gì: kiện PK-0025 vẫn tự do, mã kế tiếp vẫn là REQ-008
  expect((await db.getPackage('PK-0025')).requirementId).toBeUndefined()
  expect((await db.createDeliveryRequirement({ ...base, lat: 10.7872, lng: 106.6817 }))).toMatchObject({ id: 'REQ-008', lat: 10.7872, lng: 106.6817 })
})

test('a pending requirement edits every field; deleting it frees its packages, and only while pending', async () => {
  const db = open()
  db.restoreSession('US-0002')
  const { id } = await db.createDeliveryRequirement({ ...HUONG_VIET, lat: 10.7872, lng: 106.6817, note: 'Giao cửa sau' })
  const edited = await db.updateDeliveryRequirement(id, { packageIds: ['PK-0024', 'PK-0025'], address: '205 Lê Văn Sỹ, P. 13, Q.3', lat: null, lng: null, note: '' })
  expect(edited).toMatchObject({ packageIds: ['PK-0024', 'PK-0025'], address: '205 Lê Văn Sỹ, P. 13, Q.3', destinationName: 'Nhà hàng Hương Việt' })
  expect([edited.lat, edited.lng, edited.note]).toStrictEqual([undefined, undefined, undefined])
  expect((await db.getPackage('PK-0023')).requirementId).toBeUndefined()
  expect((await db.getPackage('PK-0025')).requirementId).toBe(id)
  expect((await db.listEvents())[0]).toMatchObject({ action: 'requirement.updated', params: { destinationName: 'Nhà hàng Hương Việt', fields: 'address,lat,lng,note,packageIds' } })
  // Lưu lại đúng dữ liệu đang có: không ghi gì, kể cả khi hạn đang có đã qua
  const events = (await db.listEvents()).length
  expect(await db.updateDeliveryRequirement(id, { destinationName: 'Nhà hàng Hương Việt', deadline: edited.deadline })).toStrictEqual(edited)
  expect(await db.listEvents()).toHaveLength(events)
  // Hạn mới phải ở tương lai
  await expect(db.updateDeliveryRequirement(id, { deadline: '2026-09-14T04:59:00.000Z' })).rejects.toMatchObject({ code: 'REQUIREMENT_DEADLINE_PAST' })
  await expect(db.updateDeliveryRequirement(id, { packageIds: ['PK-0024', 'PK-0001'] })).rejects.toMatchObject({ code: 'PACKAGE_UNAVAILABLE', params: { packageId: 'PK-0001' } })

  await db.deleteDeliveryRequirement(id)
  await expect(db.getDeliveryRequirement(id)).rejects.toMatchObject({ code: 'NOT_FOUND', params: { collection: 'requirements', id } })
  expect((await db.getPackage('PK-0024')).requirementId).toBeUndefined()
  expect((await db.listEvents())[0]).toMatchObject({ action: 'requirement.deleted', target: { type: 'requirement', id }, params: { destinationName: 'Nhà hàng Hương Việt', count: 2 } })
  expect(await selectable(db)).toHaveLength(170 + 56)
})

test('putting a requirement on a trip merges it into the stop with its address and coordinates, one package line per group of identical packages', async () => {
  const db = open()
  const before = await db.getTrip('TRIP-014')
  // Điểm 2 của TRIP-014 là Kho Bách Hoá Xanh Dĩ An: cùng địa chỉ và toạ độ với REQ-006. Điểm 1 (Điện máy Xanh Tân An) chưa có toạ độ
  expect(before.stops.map((stop) => [stop.id, stop.lat, stop.lng])).toStrictEqual([['STOP-01', undefined, undefined], ['STOP-02', 10.896, 106.789]])
  const { requirement, trip } = await db.assignDeliveryRequirement('REQ-006', 'TRIP-014')
  const packageIds = ['PK-0013', 'PK-0014', 'PK-0015', 'PK-0016', 'PK-0017', 'PK-0018', 'PK-0019', 'PK-0020', 'PK-0021', 'PK-0022']
  expect(requirement).toMatchObject({ status: 'ASSIGNED', tripId: 'TRIP-014', packageIds })
  expect(requirement).not.toHaveProperty('assignment')
  expect(trip.inputVersion).toBe(before.inputVersion + 1)
  // Không sinh điểm mới: điểm 2 nhận hạn và ưu tiên của yêu cầu, vẫn là điểm thêm tay
  expect(trip.stops.map((stop) => [stop.id, stop.deadline, stop.priority, stop.generated])).toStrictEqual([
    ['STOP-01', undefined, undefined, undefined], ['STOP-02', '2026-09-16T04:00:00.000Z', 'HIGH', undefined],
  ])
  // Yêu cầu ưu tiên Cao: dòng kiện ưu tiên 3, không bắt buộc xếp (D-93)
  expect(trip.packages.at(-1)).toMatchObject({
    id: 'PKG-004', name: 'Thùng mì ăn liền 30 gói', quantity: 10, deliveryStop: 2, groupId: 'REQ-006', lengthCm: 55, weightKg: 3.5, handlingClass: 'STANDARD',
    maxTopLoadKg: 20, maxStackCount: 5, priority: 3, mustLoad: false,
  })
  expect(await db.getPackage('PK-0013')).toMatchObject({ status: 'ASSIGNED', tripId: 'TRIP-014', stopId: 'STOP-02', requirementId: 'REQ-006' })
  // Nhãn QR của kiện trong chuyến là mã của kiện kho kiện
  const labels = await db.listTripLabels('TRIP-014')
  expect(labels.find((item) => item.packageInstanceId === 'PKG-004-01')).toMatchObject({ poolPackageId: 'PK-0013', qrToken: (await db.getPackage('PK-0013')).qrToken })
  // Kiện nhập tay của chuyến mang kiện kho kiện riêng (FE-3b-07)
  expect(labels.find((item) => item.packageInstanceId === 'PKG-001-01')?.poolPackageId).toMatch(/^PK-T\d{5}$/)
  await expect(db.assignDeliveryRequirement('REQ-005', 'TRIP-011')).rejects.toMatchObject({ code: 'TRIP_LOCKED' })
  await expect(db.assignDeliveryRequirement('REQ-006', 'TRIP-014')).rejects.toMatchObject({ code: 'REQUIREMENT_NOT_PENDING', params: { requirementId: 'REQ-006', status: 'ASSIGNED' } })
  await expect(db.deleteDeliveryRequirement('REQ-006')).rejects.toMatchObject({ code: 'REQUIREMENT_NOT_PENDING' })
  await expect(db.unassignDeliveryRequirement('REQ-005')).rejects.toMatchObject({ code: 'REQUIREMENT_STATUS_INVALID', params: { requirementId: 'REQ-005', status: 'PENDING' } })
  const back = await db.unassignDeliveryRequirement('REQ-006')
  expect([back.status, back.tripId]).toStrictEqual(['PENDING', undefined])
  const after = await db.getTrip('TRIP-014')
  expect(after.packages.map((pkg) => pkg.id)).toStrictEqual(['PKG-001', 'PKG-002', 'PKG-003'])
  // Điểm thêm tay ở lại, không còn hạn
  expect(after.stops).toStrictEqual(before.stops)
  const back13 = await db.getPackage('PK-0013')
  expect([back13.status, back13.requirementId, back13.tripId, back13.stopId]).toStrictEqual(['IMPORTED', 'REQ-006', undefined, undefined])
  expect((await db.listEvents()).slice(0, 2).map((event) => [event.action, event.params.tripId, event.params.stopNumber])).toStrictEqual([
    ['requirement.unassigned', 'TRIP-014', undefined], ['requirement.assigned', 'TRIP-014', 2],
  ])
})

test('a requirement to a new place generates a stop at the end; the same address and coordinates share it; an emptied generated stop goes away', async () => {
  const db = open()
  db.restoreSession('US-0002')
  // Hai yêu cầu tới KCN Hoà Khánh: REQ-001 của seed (Thấp, hạn 17:00 ngày 18/09) và một yêu cầu Cao, hạn sớm hơn, địa chỉ viết khác kiểu
  const second = await db.createDeliveryRequirement({
    destinationName: 'Xưởng Hoà Khánh', address: 'kcn hoà khánh - q. liên chiểu;  đà nẵng', lat: 16.0747, lng: 108.1506, deadline: '2026-09-17T09:00:00+07:00', priority: 'HIGH',
    packageIds: ['PK-0023'],
  })
  db.restoreSession('US-0001')
  const first = await db.assignDeliveryRequirement('REQ-001', 'TRIP-014')
  expect(first.trip.stops).toHaveLength(3)
  expect(first.trip.stops[2]).toStrictEqual({
    id: 'STOP-03', name: 'KCN Hoà Khánh', address: 'KCN Hoà Khánh, Q. Liên Chiểu, Đà Nẵng', lat: 16.0747, lng: 108.1506, generated: true,
    deadline: '2026-09-18T10:00:00.000Z', priority: 'LOW',
  })
  expect(first.trip.packages.filter((line) => line.groupId === 'REQ-001').map((line) => [line.id, line.deliveryStop])).toStrictEqual([['PKG-004', 3], ['PKG-005', 3]])
  // Cùng địa chỉ (chuẩn hoá) và toạ độ: gộp vào điểm 3 — hạn sớm nhất, ưu tiên cao nhất; tên điểm giữ của yêu cầu đầu tiên
  const merged = await db.assignDeliveryRequirement(second.id, 'TRIP-014')
  expect(merged.trip.stops).toHaveLength(3)
  expect(merged.trip.stops[2]).toMatchObject({ id: 'STOP-03', name: 'KCN Hoà Khánh', deadline: '2026-09-17T02:00:00.000Z', priority: 'HIGH' })
  expect(await db.getPackage('PK-0023')).toMatchObject({ status: 'ASSIGNED', tripId: 'TRIP-014', stopId: 'STOP-03' })
  // REQ-003 đi KCN Thăng Long: điểm 4
  // Kiện của REQ-003 là hàng giá trị cao, chuyến đang chở hàng thường: cần lý do vượt luật phân tách hàng (FE-4b-06)
  const third = await db.assignDeliveryRequirement('REQ-003', 'TRIP-014', { overrideReason: 'Khách gom chung một xe' })
  expect(third.trip.stops.map((stop) => [stop.id, stop.name, stop.priority])).toStrictEqual([
    ['STOP-01', 'Điện máy Xanh Tân An', undefined], ['STOP-02', 'Kho Bách Hoá Xanh Dĩ An', undefined], ['STOP-03', 'KCN Hoà Khánh', 'HIGH'], ['STOP-04', 'KCN Thăng Long', 'URGENT'],
  ])
  expect((await db.listEvents())[0]).toMatchObject({ action: 'requirement.assigned', params: { destinationName: 'KCN Thăng Long', tripId: 'TRIP-014', stopNumber: 4, count: 2 } })

  // Gỡ yêu cầu Cao: điểm 3 còn REQ-001 nên ở lại, hạn và ưu tiên về của REQ-001
  await db.unassignDeliveryRequirement(second.id)
  expect((await db.getTrip('TRIP-014')).stops[2]).toMatchObject({ id: 'STOP-03', deadline: '2026-09-18T10:00:00.000Z', priority: 'LOW' })
  // Gỡ REQ-001: điểm 3 không còn kiện nào, tự mất; KCN Thăng Long thành điểm 3 và kiện của nó đánh số lại
  const version = (await db.getTrip('TRIP-014')).inputVersion
  await db.unassignDeliveryRequirement('REQ-001')
  const after = await db.getTrip('TRIP-014')
  expect(after.inputVersion).toBe(version + 1)
  expect(after.stops.map((stop) => stop.id)).toStrictEqual(['STOP-01', 'STOP-02', 'STOP-04'])
  expect(after.packages.filter((line) => line.groupId === 'REQ-003').map((line) => line.deliveryStop)).toStrictEqual([3, 3])
  expect(await db.getPackage('PK-0067')).toMatchObject({ status: 'ASSIGNED', stopId: 'STOP-04' })
  // Điểm tự sinh kế tiếp không dùng lại mã đang có
  expect((await db.assignDeliveryRequirement('REQ-004', 'TRIP-014')).trip.stops.at(-1)).toMatchObject({ id: 'STOP-05', name: 'KCN Trà Nóc', generated: true })
})

test('packages without a package type become one line each, named by the sender code; an urgent requirement makes its lines must-load', async () => {
  const db = open()
  db.restoreSession('US-0001')
  // PK-0054, PK-0055: hàng dễ vỡ đi Huế 50 × 40 × 30 cm, 9,5 kg; PK-0064: hàng giá trị cao đi Hà Nội 7,2 kg; PK-0023, PK-0024: thùng sữa PT-004
  const created = await db.createDeliveryRequirement({
    destinationName: 'Công ty Gốm Phú Bài', address: 'KCN Phú Bài, TX. Hương Thuỷ', deadline: '2026-09-18T17:00:00+07:00', priority: 'URGENT',
    packageIds: ['PK-0054', 'PK-0023', 'PK-0055', 'PK-0064', 'PK-0024'],
  })
  // Yêu cầu gồm hàng dễ vỡ và hàng giá trị cao, chuyến đang chở hàng thường: cần lý do vượt luật phân tách hàng (FE-4b-06)
  const { trip } = await db.assignDeliveryRequirement(created.id, 'TRIP-014', { overrideReason: 'Khách gom chung một xe' })
  // Yêu cầu chưa có toạ độ: điểm sinh ra cũng chưa có
  expect(trip.stops.at(-1)).toStrictEqual({ id: 'STOP-03', name: 'Công ty Gốm Phú Bài', address: 'KCN Phú Bài, TX. Hương Thuỷ', generated: true, deadline: '2026-09-18T10:00:00.000Z', priority: 'URGENT' })
  expect(trip.packages.slice(3).map((line) => [line.id, line.name, line.quantity, line.deliveryStop, line.handlingClass, line.stackable, line.maxTopLoadKg, line.weightKg, line.priority, line.mustLoad])).toStrictEqual([
    ['PKG-004', 'PB-HUE-2609-01', 1, 3, 'FRAGILE', false, 0, 9.5, 4, true],
    ['PKG-005', 'Thùng sữa hộp 48 hộp', 2, 3, 'STANDARD', true, 160, 52, 4, true],
    ['PKG-006', 'PB-HUE-2609-02', 1, 3, 'FRAGILE', false, 0, 9.5, 4, true],
    ['PKG-007', 'TL-HNI-2609-01', 1, 3, 'HIGH_VALUE', true, 21.6, 7.2, 4, true],
  ])
  // Nhãn của từng instance là mã QR của đúng kiện kho kiện
  const labels = await db.listTripLabels('TRIP-014')
  expect(labels.filter((label) => label.packageId >= 'PKG-004').map((label) => [label.packageInstanceId, label.poolPackageId])).toStrictEqual([
    ['PKG-004-01', 'PK-0054'], ['PKG-005-01', 'PK-0023'], ['PKG-005-02', 'PK-0024'], ['PKG-006-01', 'PK-0055'], ['PKG-007-01', 'PK-0064'],
  ])
})

test('once on a trip only the deadline and the priority change; they reach the stop, and a new priority reaches the lines and makes the plan stale', async () => {
  const db = open()
  const { trip } = await db.assignDeliveryRequirement('REQ-006', 'TRIP-014')
  await expect(db.updateDeliveryRequirement('REQ-006', { address: '217 Quốc lộ 1K' })).rejects.toMatchObject({ code: 'REQUIREMENT_NOT_PENDING', params: { requirementId: 'REQ-006', status: 'ASSIGNED' } })
  await expect(db.updateDeliveryRequirement('REQ-006', { packageIds: ['PK-0013'] })).rejects.toMatchObject({ code: 'REQUIREMENT_NOT_PENDING' })
  const edited = await db.updateDeliveryRequirement('REQ-006', { deadline: '2026-09-17T11:00:00+07:00', priority: 'URGENT' })
  expect(edited).toMatchObject({ status: 'ASSIGNED', deadline: '2026-09-17T04:00:00.000Z', priority: 'URGENT' })
  const after = await db.getTrip('TRIP-014')
  expect(after.inputVersion).toBe(trip.inputVersion + 1)
  expect(after.packages.map((line) => [line.id, line.priority, line.mustLoad])).toStrictEqual([['PKG-001', 1, true], ['PKG-002', 1, false], ['PKG-003', 1, true], ['PKG-004', 4, true]])
  expect(after.stops[1]).toMatchObject({ id: 'STOP-02', deadline: '2026-09-17T04:00:00.000Z', priority: 'URGENT' })
  // (PKG-002 là thùng nồi cơm điện, không bắt buộc xếp từ seed.) Chỉ đổi hạn: kiện của chuyến không đổi, hạn của điểm đổi theo
  await db.updateDeliveryRequirement('REQ-006', { deadline: '2026-09-18T11:00:00+07:00' })
  const later = await db.getTrip('TRIP-014')
  expect(later.inputVersion).toBe(after.inputVersion)
  expect(later.stops[1]).toMatchObject({ deadline: '2026-09-18T04:00:00.000Z', priority: 'URGENT' })
})

test('the deadline of a stop follows the lines of its requirements when stops are reordered or a line moves to another stop', async () => {
  const db = open()
  const { trip } = await db.assignDeliveryRequirement('REQ-006', 'TRIP-014')
  // Đảo hai điểm (kiện đánh số lại như lớp API làm): Dĩ An thành điểm 1 và vẫn mang hạn của REQ-006
  const swapped = await db.updateTrip('TRIP-014', {
    stops: [trip.stops[1]!, trip.stops[0]!],
    packages: trip.packages.map((line) => ({ ...line, deliveryStop: line.deliveryStop === 1 ? 2 : 1 })),
  })
  expect(swapped.stops.map((stop) => [stop.id, stop.deadline, stop.priority])).toStrictEqual([['STOP-02', '2026-09-16T04:00:00.000Z', 'HIGH'], ['STOP-01', undefined, undefined]])
  // Chuyển dòng kiện của yêu cầu sang điểm kia: hạn, ưu tiên và điểm giao của kiện đi theo dòng
  const moved = await db.updateTrip('TRIP-014', { packages: swapped.packages.map((line) => (line.groupId === 'REQ-006' ? { ...line, deliveryStop: 2 } : line)) })
  expect(moved.stops.map((stop) => [stop.id, stop.deadline, stop.priority])).toStrictEqual([['STOP-02', undefined, undefined], ['STOP-01', '2026-09-16T04:00:00.000Z', 'HIGH']])
  expect(await db.getPackage('PK-0013')).toMatchObject({ status: 'ASSIGNED', stopId: 'STOP-01', packageCode: 'MP-MG30-0911-01', destination: '215 Quốc lộ 1K, P. Đông Hoà, Dĩ An' })
})

test('cancelling the trip before it leaves sends its requirements back to pending and their packages to the pool', async () => {
  const db = open()
  await db.assignDeliveryRequirement('REQ-005', 'TRIP-014')
  await db.assignDeliveryRequirement('REQ-006', 'TRIP-014')
  await db.cancelTrip('TRIP-014', 'Khách dời lịch nhận hàng')
  const back = await Promise.all(['REQ-005', 'REQ-006'].map((id) => db.getDeliveryRequirement(id)))
  expect(back.map((item) => [item.status, item.tripId])).toStrictEqual([['PENDING', undefined], ['PENDING', undefined]])
  expect(await db.getPackage('PK-0001')).toMatchObject({ status: 'IMPORTED', requirementId: 'REQ-005' })
  expect((await db.getPackage('PK-0001')).tripId).toBeUndefined()
  // Yêu cầu đã về "chờ xếp chuyến": đưa sang chuyến khác được ngay — chuyến mới chưa có điểm nào, điểm giao tự sinh là điểm 1
  const created = await db.createTrip({ name: 'Tuyến thay thế', vehicleId: 'VEHICLE-005', stops: [], packages: [], scheduledDate: '2026-09-16' })
  const moved = await db.assignDeliveryRequirement('REQ-006', created.id)
  expect(moved.requirement).toMatchObject({ status: 'ASSIGNED', tripId: 'TRIP-015' })
  expect(moved.trip.stops.map((stop) => [stop.id, stop.name, stop.generated])).toStrictEqual([['STOP-01', 'Kho Bách Hoá Xanh Dĩ An', true]])
})

test('trip labels of hand-entered packages are opaque, unique and the same in every store of the same seed', async () => {
  const labels = await createMockDb().listTripLabels('TRIP-2026-0914')
  expect(labels).toHaveLength(132)
  expect(new Set(labels.map((label) => label.qrToken)).size).toBe(132)
  expect(labels.every((label) => !label.qrToken.includes('PKG'))).toBe(true)
  expect(await createMockDb().listTripLabels('TRIP-2026-0914')).toStrictEqual(labels)
})

test('readiness: a planned trip is ready; the draft only waits for its route; a trip without packages is not ready', async () => {
  const db = createMockDb()
  expect((await db.getTripReadiness('TRIP-012')).ready).toBe(true)
  // TRIP-014 là chuyến nháp của seed: mọi mục đạt trừ "đã tối ưu tuyến" (FE-5b-05)
  const draft = await db.getTripReadiness('TRIP-014')
  expect([draft.ready, draft.checks.filter((check) => check.status === 'fail').map((check) => check.code)]).toStrictEqual([false, ['ROUTE_PLANNED']])
  const created = await db.createTrip({ name: 'Tuyến thử', vehicleId: 'VEHICLE-005', stops: [{ id: 'STOP-01', name: 'Kho A', address: 'Q.1' }], packages: [], scheduledDate: '2026-09-15' })
  const empty = await db.getTripReadiness(created.id)
  expect(empty.ready).toBe(false)
  expect(empty.checks.find((check) => check.code === 'PACKAGES_PRESENT')?.status).toBe('fail')
  // VEHICLE-008 đang bảo dưỡng
  await expect(db.createTrip({ name: 'x', vehicleId: 'VEHICLE-008', stops: [], packages: [], scheduledDate: '2026-09-15' })).rejects.toMatchObject({ code: 'VEHICLE_IN_MAINTENANCE' })
})
