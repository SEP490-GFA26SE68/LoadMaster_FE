import { expect, test } from 'vitest'
import type { OptimizationRequest } from '@/domain/models'
import { canTransitionPackage, createMockDb, PACKAGE_STATUSES, type MockDb, type PackageInput, type PackageStatus } from '@/lib/mock-db'
import { runMockOptimization } from '@/services/optimization'

/**
 * Kho kiện theo mô hình backend (FE-3b-01, D-68, D-70, D-92): trường của kiện, mã QR cấp một lần, trạng thái ghi thật theo bảng chuyển,
 * cờ chặn chọn kiện. Số và mã của seed chép tay từ `seed-sourcing.ts`, `seed-packages.ts`, không tính lại theo cách kho tính.
 */

const TOKEN = /^LM-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/

/** Mã `PK-NNNN` từ `from` tới `to`. */
const pk = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => `PK-${String(from + index).padStart(4, '0')}`)

const crate: PackageInput = { lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 18, handlingClass: 'STANDARD', destination: 'KCN Hoà Khánh, Q. Liên Chiểu, Đà Nẵng' }

function dispatcher(): MockDb {
  const db = createMockDb()
  db.restoreSession('US-0001')
  return db
}

test('the seed pool of Long Bình: 48 packages converted from registered packages with the sizes of their type, 40 imported ones, all IMPORTED', async () => {
  const db = dispatcher()
  const packages = await db.listPackages()
  expect(packages.map((pkg) => pkg.id)).toStrictEqual(pk(1, 88))
  expect(new Set(packages.map((pkg) => pkg.status))).toStrictEqual(new Set(['IMPORTED']))
  expect(new Set(packages.map((pkg) => pkg.companyId))).toStrictEqual(new Set(['LOG-001']))
  expect(new Set(packages.map((pkg) => pkg.createdBy))).toStrictEqual(new Set(['US-0001']))
  expect(new Set(packages.map((pkg) => pkg.qrToken)).size).toBe(88)
  expect(packages.every((pkg) => TOKEN.test(pkg.qrToken))).toBe(true)

  // Kiện đăng ký cũ: thêm tay theo loại kiện, kích thước và khối lượng của loại kiện (thùng nước suối 50 × 35 × 25 cm, 13 kg)
  const idsOf = (source: string) => packages.filter((pkg) => pkg.source === source).map((pkg) => pkg.id)
  expect(idsOf('MANUAL')).toStrictEqual(pk(1, 48))
  expect(packages[0]).toStrictEqual({
    id: 'PK-0001', companyId: 'LOG-001', packageCode: 'MP-NS24-0911-01', qrToken: packages[0]?.qrToken, lengthCm: 50, widthCm: 35, heightCm: 25, weightKg: 13,
    handlingClass: 'STANDARD', destination: '30 Đại lộ Bình Dương, Thủ Dầu Một', packageTypeId: 'PT-001', status: 'IMPORTED', flags: [], source: 'MANUAL',
    orderId: 'ORD-001', createdAt: '2026-09-11T02:00:00.000Z', createdBy: 'US-0001',
  })
  // Hai đơn chờ gán giữ 22 kiện đầu
  expect(packages.filter((pkg) => pkg.orderId !== undefined).map((pkg) => pkg.id)).toStrictEqual(pk(1, 22))

  // 40 kiện nhập file: không gắn loại kiện, tám điểm đến mỗi nơi 5 kiện, đủ năm loại hàng, chưa vào đơn hay chuyến nào
  const imported = packages.filter((pkg) => pkg.source === 'IMPORT')
  expect(imported.map((pkg) => pkg.id)).toStrictEqual(pk(49, 88))
  expect(imported.filter((pkg) => pkg.packageTypeId !== undefined || pkg.orderId !== undefined || pkg.tripId !== undefined)).toStrictEqual([])
  expect(imported[0]).toMatchObject({ packageCode: 'HK-DNG-2609-01', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 18, handlingClass: 'STANDARD', destination: 'KCN Hoà Khánh, Q. Liên Chiểu, Đà Nẵng' })
  const count = (values: string[]) => Object.fromEntries([...new Set(values)].map((value) => [value, values.filter((item) => item === value).length]))
  expect(count(imported.map((pkg) => pkg.handlingClass))).toStrictEqual({ STANDARD: 20, FRAGILE: 5, HIGH_VALUE: 5, REFRIGERATED: 5, HAZARDOUS: 5 })
  expect(Object.values(count(imported.map((pkg) => pkg.destination)))).toStrictEqual([5, 5, 5, 5, 5, 5, 5, 5])
  // Hai kiện mang cờ để demo gỡ cờ
  expect(packages.filter((pkg) => pkg.flags.length > 0).map((pkg) => [pkg.id, pkg.flags])).toStrictEqual([['PK-0063', ['NOT_FOUND']], ['PK-0078', ['DAMAGED']]])
})

test('Phương Nam keeps its small pool: 10 packages, all IMPORTED, four held by its pending order', async () => {
  const db = createMockDb()
  db.restoreSession('US-PN-03')
  const packages = await db.listPackages()
  expect(packages.map((pkg) => [pkg.id, pkg.status, pkg.orderId])).toStrictEqual([
    ['PK-PN-0001', 'IMPORTED', 'ORD-PN-001'], ['PK-PN-0002', 'IMPORTED', 'ORD-PN-001'], ['PK-PN-0003', 'IMPORTED', 'ORD-PN-001'],
    ['PK-PN-0004', 'IMPORTED', 'ORD-PN-001'], ['PK-PN-0005', 'IMPORTED', undefined], ['PK-PN-0006', 'IMPORTED', undefined],
    ['PK-PN-0007', 'IMPORTED', undefined], ['PK-PN-0008', 'IMPORTED', undefined], ['PK-PN-0009', 'IMPORTED', undefined],
    ['PK-PN-0010', 'IMPORTED', undefined],
  ])
  // Thùng linh kiện 50 × 40 × 30 cm, 9 kg; kiện vải cuộn 120 × 40 × 40 cm, 28 kg
  expect(packages[0]).toMatchObject({ packageCode: 'PN-LK-0912-01', lengthCm: 50, widthCm: 40, heightCm: 30, weightKg: 9, packageTypeId: 'PT-PN-01', companyId: 'LOG-002' })
  expect(packages[9]).toMatchObject({ packageCode: 'PN-VC-0914-04', lengthCm: 120, widthCm: 40, heightCm: 40, weightKg: 28, packageTypeId: 'PT-PN-02' })
})

test('creating packages: IMPORTED, no flag, a QR token issued at once; one bad row writes nothing', async () => {
  const db = dispatcher()
  const one = await db.createPackage({ ...crate, packageCode: ' DN-7781 ', lengthCm: 60.04, destination: '  KCN Hoà Khánh, Q. Liên Chiểu, Đà Nẵng ' })
  expect(one).toStrictEqual({
    id: 'PK-0089', companyId: 'LOG-001', packageCode: 'DN-7781', qrToken: one.qrToken, lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 18,
    handlingClass: 'STANDARD', destination: 'KCN Hoà Khánh, Q. Liên Chiểu, Đà Nẵng', status: 'IMPORTED', flags: [], source: 'MANUAL',
    createdAt: one.createdAt, createdBy: 'US-0001',
  })
  expect(one.qrToken).toMatch(TOKEN)
  expect(one.qrToken).not.toContain('PK')
  expect(await db.findPackageByQr(one.qrToken.toLowerCase().replaceAll('-', ' '))).toMatchObject({ id: 'PK-0089' })
  await expect(db.findPackageByQr('LM-0000-0000-0000')).rejects.toMatchObject({ code: 'QR_UNKNOWN', params: { token: 'LM-0000-0000-0000' } })

  // Nhập nhiều dòng: không có mã của bên gửi thì lấy mã của kho; một lần ghi một sự kiện
  const many = await db.createPackages([crate, { ...crate, handlingClass: 'FRAGILE', packageTypeId: 'PT-006' }, { ...crate, packageCode: 'DN-7784' }], 'IMPORT')
  expect(many.map((pkg) => [pkg.id, pkg.packageCode, pkg.source, pkg.packageTypeId])).toStrictEqual([
    ['PK-0090', 'PK-0090', 'IMPORT', undefined], ['PK-0091', 'PK-0091', 'IMPORT', 'PT-006'], ['PK-0092', 'DN-7784', 'IMPORT', undefined],
  ])
  const [event] = await db.listEvents()
  expect(event).toMatchObject({ action: 'package.registered', actorId: 'US-0001', target: { type: 'package', id: 'PK-0090' }, params: { count: 3, packageTypeId: 'PT-006', lastPackageId: 'PK-0092' } })
  const tokens = (await db.listPackages()).map((pkg) => pkg.qrToken)
  expect(new Set(tokens).size).toBe(92)

  const events = (await db.listEvents()).length
  const bad: [Partial<PackageInput>, string][] = [
    [{ lengthCm: 0 }, 'lengthCm'], [{ widthCm: -3 }, 'widthCm'], [{ heightCm: Number.NaN }, 'heightCm'], [{ weightKg: 0 }, 'weightKg'],
    [{ handlingClass: 'FROZEN' as never }, 'handlingClass'], [{ destination: '   ' }, 'destination'],
  ]
  for (const [change, field] of bad) {
    await expect(db.createPackages([crate, { ...crate, ...change }])).rejects.toMatchObject({ code: 'PACKAGE_INVALID', params: { field } })
  }
  await expect(db.createPackages([crate, { ...crate, packageTypeId: 'PT-404' }])).rejects.toMatchObject({ code: 'NOT_FOUND' })
  await expect(db.createPackages([])).rejects.toMatchObject({ code: 'PACKAGES_REQUIRED' })
  await expect(db.createPackages(Array.from({ length: 1001 }, () => crate))).rejects.toMatchObject({ code: 'QUANTITY_INVALID', params: { min: 1, max: 1000 } })
  expect(await db.listPackages()).toHaveLength(92)
  expect(await db.listEvents()).toHaveLength(events)
})

test('the QR token never changes when other fields are edited; only a package still in the pool can be edited', async () => {
  const db = dispatcher()
  const before = await db.getPackage('PK-0049')
  const edited = await db.updatePackage('PK-0049', { packageCode: 'HK-DNG-2609-91', weightKg: 19.456, destination: 'KCN Liên Chiểu, Đà Nẵng', handlingClass: 'FRAGILE', packageTypeId: 'PT-006' })
  expect(edited).toStrictEqual({
    ...before, packageCode: 'HK-DNG-2609-91', weightKg: 19.46, destination: 'KCN Liên Chiểu, Đà Nẵng', handlingClass: 'FRAGILE', packageTypeId: 'PT-006',
  })
  expect(edited.qrToken).toBe(before.qrToken)
  expect(await db.updatePackage('PK-0049', { packageTypeId: null })).not.toHaveProperty('packageTypeId')
  expect((await db.findPackageByQr(before.qrToken)).id).toBe('PK-0049')
  await expect(db.updatePackage('PK-0049', { heightCm: 0 })).rejects.toMatchObject({ code: 'PACKAGE_INVALID', params: { field: 'heightCm' } })
  await db.updatePackageStatus('PK-0049', 'ASSIGNED')
  await expect(db.updatePackage('PK-0049', { destination: 'Huế' })).rejects.toMatchObject({ code: 'PACKAGE_UNAVAILABLE', params: { packageId: 'PK-0049', status: 'ASSIGNED' } })
  expect((await db.getPackage('PK-0049')).qrToken).toBe(before.qrToken)
})

test('the transition table: forward along the trip, back to the pool before departure, delivered or returned at the end', () => {
  const allowed: Record<PackageStatus, PackageStatus[]> = {
    IMPORTED: ['ASSIGNED'],
    ASSIGNED: ['STAGED', 'IMPORTED'],
    STAGED: ['LOADED', 'IMPORTED'],
    LOADED: ['IN_TRANSIT', 'IMPORTED'],
    IN_TRANSIT: ['DELIVERED', 'RETURNED'],
    DELIVERED: [],
    RETURNED: [],
  }
  for (const from of PACKAGE_STATUSES) {
    for (const to of PACKAGE_STATUSES) expect(canTransitionPackage(from, to), `${from} → ${to}`).toBe(allowed[from].includes(to))
  }
})

test('the store moves a package only along the table and rejects anything else with INVALID_PACKAGE_STATUS_TRANSITION', async () => {
  const db = dispatcher()
  await expect(db.updatePackageStatus('PK-0049', 'LOADED')).rejects.toMatchObject({
    code: 'INVALID_PACKAGE_STATUS_TRANSITION', params: { packageId: 'PK-0049', from: 'IMPORTED', to: 'LOADED' },
  })
  await expect(db.updatePackageStatus('PK-0049', 'IMPORTED')).rejects.toMatchObject({ code: 'INVALID_PACKAGE_STATUS_TRANSITION' })
  expect((await db.getPackage('PK-0049')).status).toBe('IMPORTED')

  for (const status of ['ASSIGNED', 'STAGED', 'LOADED', 'IN_TRANSIT', 'DELIVERED'] as const) {
    expect((await db.updatePackageStatus('PK-0049', status)).status).toBe(status)
  }
  await expect(db.updatePackageStatus('PK-0049', 'IMPORTED')).rejects.toMatchObject({ params: { from: 'DELIVERED', to: 'IMPORTED' } })
  await expect(db.updatePackageStatus('PK-0049', 'RETURNED')).rejects.toMatchObject({ code: 'INVALID_PACKAGE_STATUS_TRANSITION' })
  const [event] = await db.listEvents()
  expect(event).toMatchObject({ action: 'package.statusChanged', target: { type: 'package', id: 'PK-0049' }, params: { before: 'IN_TRANSIT', after: 'DELIVERED' } })

  // Bỏ khỏi chuyến trước khi xe chạy: về kho kiện; khách không nhận: hoàn trả
  await db.updatePackageStatus('PK-0050', 'ASSIGNED')
  await db.updatePackageStatus('PK-0050', 'STAGED')
  expect((await db.updatePackageStatus('PK-0050', 'IMPORTED')).status).toBe('IMPORTED')
  for (const status of ['ASSIGNED', 'STAGED', 'LOADED', 'IN_TRANSIT', 'RETURNED'] as const) await db.updatePackageStatus('PK-0051', status)
  await expect(db.updatePackageStatus('PK-0051', 'DELIVERED')).rejects.toMatchObject({ params: { from: 'RETURNED', to: 'DELIVERED' } })
})

test('a flagged package cannot go into an order or a trip until the dispatcher clears the flag, and clearing is logged', async () => {
  const db = dispatcher()
  const order = (packageIds: string[]) => ({ customerName: 'Nhà hàng Hương Việt', deliveryAddress: '203 Lê Văn Sỹ, P. 13, Q.3', packageIds })
  // PK-0063 mang cờ "Không tìm thấy" từ seed
  await expect(db.createOrder(order(['PK-0062', 'PK-0063']))).rejects.toMatchObject({ code: 'PACKAGE_FLAGGED', params: { packageId: 'PK-0063', flag: 'NOT_FOUND' } })
  const created = await db.createOrder(order(['PK-0062']))
  await expect(db.updateOrder(created.id, { packageIds: ['PK-0062', 'PK-0078'] })).rejects.toMatchObject({ code: 'PACKAGE_FLAGGED', params: { packageId: 'PK-0078', flag: 'DAMAGED' } })

  // Kiện đã nằm trong đơn chờ gán bị gắn cờ: đơn không gán vào chuyến được
  expect((await db.flagPackage('PK-0013', 'DAMAGED')).flags).toStrictEqual(['DAMAGED'])
  expect((await db.flagPackage('PK-0013', 'DAMAGED')).flags).toStrictEqual(['DAMAGED'])
  await expect(db.assignOrder('ORD-002', 'TRIP-014', 'STOP-02')).rejects.toMatchObject({ code: 'PACKAGE_FLAGGED', params: { packageId: 'PK-0013', flag: 'DAMAGED' } })
  expect((await db.getTrip('TRIP-014')).packages.map((pkg) => pkg.id)).toStrictEqual(['PKG-001', 'PKG-002', 'PKG-003'])

  // Nhân viên kho không gỡ được cờ; điều phối viên gỡ, nhật ký ghi người gỡ
  db.restoreSession('US-0003')
  await expect(db.clearPackageFlag('PK-0013', 'DAMAGED')).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED', params: { role: 'warehouse' } })
  db.restoreSession('US-0001')
  await expect(db.clearPackageFlag('PK-0013', 'NOT_FOUND')).rejects.toMatchObject({ code: 'PACKAGE_FLAG_NOT_SET', params: { packageId: 'PK-0013', flag: 'NOT_FOUND' } })
  expect((await db.clearPackageFlag('PK-0013', 'DAMAGED')).flags).toStrictEqual([])
  const [event] = await db.listEvents()
  expect(event).toMatchObject({ action: 'package.flagCleared', actorId: 'US-0001', target: { type: 'package', id: 'PK-0013' }, params: { flag: 'DAMAGED' } })
  expect((await db.assignOrder('ORD-002', 'TRIP-014', 'STOP-02')).order.status).toBe('assigned')

  // Cờ chỉ gắn trên kiện còn ở kho kiện
  await expect(db.flagPackage('PK-0013', 'NOT_FOUND')).rejects.toMatchObject({ code: 'PACKAGE_UNAVAILABLE', params: { packageId: 'PK-0013', status: 'ASSIGNED' } })
  expect((await db.clearPackageFlag('PK-0063', 'NOT_FOUND')).flags).toStrictEqual([])
  expect((await db.updateOrder(created.id, { packageIds: ['PK-0062', 'PK-0063'] })).packageIds).toStrictEqual(['PK-0062', 'PK-0063'])
})

test('a package follows its trip by written transitions: assigned, staged, loaded or flagged missing, in transit, delivered or returned', async () => {
  const db = createMockDb()
  // Chuyến mới một điểm giao, chưa có kiện: đơn ORD-002 (10 thùng mì PK-0013…0022) thành dòng PKG-001, instance PKG-001-01…10
  const created = await db.createTrip({
    name: 'Tuyến Dĩ An', vehicleId: 'VEHICLE-005', scheduledDate: '2026-09-15', packages: [],
    stops: [{ id: 'STOP-01', name: 'Kho Bách Hoá Xanh Dĩ An', address: '215 Quốc lộ 1K, P. Đông Hoà, Dĩ An' }],
  })
  const { trip } = await db.assignOrder('ORD-002', created.id, 'STOP-01')
  const request: OptimizationRequest = {
    vehicle: await db.getVehicle(trip.vehicleId),
    packages: trip.packages,
    settings: { method: 'MOCK', timeLimitSeconds: 30, randomSeed: 20_260_915, enforceLifo: true, prioritizeLowCenterOfGravity: false },
  }
  const revision = await db.addRevision({ tripId: trip.id, request, result: runMockOptimization(request, { clock: () => 0 }) })
  await db.approveRevision(revision.id, [])
  const instances = Array.from({ length: 10 }, (_, index) => `PKG-001-${String(index + 1).padStart(2, '0')}`)
  const statuses = async () => (await db.listPackages()).filter((pkg) => pkg.orderId === 'ORD-002').map((pkg) => [pkg.id, pkg.status])
  const all = (status: string, to = 22) => pk(13, to).map((id) => [id, status])
  expect(await statuses()).toStrictEqual(all('ASSIGNED'))
  expect(await db.getPackage('PK-0013')).toMatchObject({ tripId: trip.id, stopId: 'STOP-01' })

  await db.startLoading(trip.id)
  expect(await statuses()).toStrictEqual(all('STAGED'))
  // Từng bước xếp còn sửa lại được nên chưa đổi trạng thái; kho xếp xong mới chốt: chín kiện đã xếp, kiện thứ mười báo thiếu
  for (const id of instances.slice(0, 9)) await db.recordLoadingStep(trip.id, { packageInstanceId: id, outcome: 'loaded' })
  await db.recordLoadingStep(trip.id, { packageInstanceId: 'PKG-001-10', outcome: 'missing' })
  expect(await statuses()).toStrictEqual(all('STAGED'))
  await db.completeLoading(trip.id)
  expect(await statuses()).toStrictEqual([...all('LOADED', 21), ['PK-0022', 'IMPORTED']])
  const missing = await db.getPackage('PK-0022')
  expect(missing.flags).toStrictEqual(['NOT_FOUND'])
  expect(missing).not.toHaveProperty('tripId')
  expect(missing).not.toHaveProperty('stopId')

  await db.startDelivery(trip.id)
  expect(await statuses()).toStrictEqual([...all('IN_TRANSIT', 21), ['PK-0022', 'IMPORTED']])
  // Tài xế dỡ tám kiện, khách từ chối kiện thứ chín; hoàn tất điểm mới chốt
  for (const id of instances.slice(0, 8)) await db.recordUnload(trip.id, 1, id, true)
  await db.reportDeliveryIssue(trip.id, { stopNumber: 1, packageInstanceId: 'PKG-001-09', kind: 'refused', note: '' })
  expect(await statuses()).toStrictEqual([...all('IN_TRANSIT', 21), ['PK-0022', 'IMPORTED']])
  await db.completeStop(trip.id, 1)
  expect(await statuses()).toStrictEqual([...all('DELIVERED', 20), ['PK-0021', 'RETURNED'], ['PK-0022', 'IMPORTED']])
  expect((await db.getOrder('ORD-002')).status).toBe('delivered')
})

test('cancelling a trip before departure sends its packages back to the pool; unassigning the order then keeps them IMPORTED', async () => {
  const db = createMockDb()
  await db.assignOrder('ORD-001', 'TRIP-014', 'STOP-01')
  expect(await db.getPackage('PK-0001')).toMatchObject({ status: 'ASSIGNED', tripId: 'TRIP-014', stopId: 'STOP-01' })
  await db.cancelTrip('TRIP-014', 'Khách dời lịch nhận')
  const released = await db.getPackage('PK-0001')
  expect(released).toMatchObject({ status: 'IMPORTED', orderId: 'ORD-001' })
  expect(released).not.toHaveProperty('tripId')
  expect((await db.unassignOrder('ORD-001')).status).toBe('pending')
  expect((await db.getPackage('PK-0012')).status).toBe('IMPORTED')
})

test('a platform account creates and reads no package; each dispatcher creates for the own company only', async () => {
  const db = createMockDb()
  await db.authenticate('quantri@loadmaster.vn', 'loadmaster')
  await expect(db.createPackage(crate)).rejects.toMatchObject({ code: 'COMPANY_REQUIRED' })
  await expect(db.listPackages()).rejects.toMatchObject({ code: 'COMPANY_REQUIRED' })
  await db.authenticate('dieuphoi@phuongnam.vn', 'loadmaster')
  expect(await db.createPackage({ ...crate, packageTypeId: 'PT-PN-01' })).toMatchObject({ id: 'PK-0089', companyId: 'LOG-002', createdBy: 'US-PN-03' })
  await expect(db.createPackage({ ...crate, packageTypeId: 'PT-001' })).rejects.toMatchObject({ code: 'FORBIDDEN_COMPANY', params: { collection: 'packageTypes', id: 'PT-001' } })
  db.restoreSession('US-0001')
  expect(await db.listPackages()).toHaveLength(88)
})
