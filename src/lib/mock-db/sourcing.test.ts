import { expect, test } from 'vitest'
import type { OptimizationRequest } from '@/domain/models'
import { createMockDb, type PackageTypeInput } from '@/lib/mock-db'
import { runMockOptimization } from '@/services/optimization'

/**
 * Nguồn hàng của công ty logistics (LM-104, FE-0-06): loại kiện, kiện đăng ký + mã QR. Kiện thuộc công ty của người đăng ký; không còn
 * nhà sản xuất, lô hàng hay luồng quét nhận. Số của seed chép tay từ `seed-sourcing.ts`, không tính lại theo cách kho tính.
 */

const TOKEN = /^LM-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/

const carton: PackageTypeInput = {
  name: 'Thùng nước tăng lực 24 lon', lengthCm: 40, widthCm: 27, heightCm: 13, weightKg: 8.6, fragilityLevel: 'NONE',
  allowedOrientations: ['LWH', 'WLH'], keepUpright: true, stackable: true, maxStackCount: 6, maxTopLoadKg: 45,
}

/** Mã `RPK-NNNN` từ `from` tới `to`. */
const rpk = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => `RPK-${String(from + index).padStart(4, '0')}`)

test('package types: create, edit, reject invalid data by model codes, refuse deleting a type still in use', async () => {
  const db = createMockDb()
  // Kho không có phiên trả danh mục của cả hai công ty (FE-0-02): 8 loại kiện của Long Bình rồi 2 của Phương Nam
  expect((await db.listPackageTypes()).map((type) => type.id)).toStrictEqual([
    'PT-001', 'PT-002', 'PT-003', 'PT-004', 'PT-005', 'PT-006', 'PT-007', 'PT-008', 'PT-PN-01', 'PT-PN-02',
  ])
  const created = await db.createPackageType(carton)
  expect(created).toMatchObject({ id: 'PT-009', name: 'Thùng nước tăng lực 24 lon', weightKg: 8.6 })
  await expect(db.updatePackageType('PT-009', { ...carton, lengthCm: 0 })).rejects.toMatchObject({ code: 'PACKAGE_TYPE_INVALID', params: { codes: ['package.dimension.positive'] } })
  // giữ đứng mà cho nằm ngang là dữ liệu mâu thuẫn (D-25)
  await expect(db.createPackageType({ ...carton, allowedOrientations: ['LHW'] })).rejects.toMatchObject({ code: 'PACKAGE_TYPE_INVALID' })
  expect((await db.updatePackageType('PT-009', { ...carton, weightKg: 9 })).weightKg).toBe(9)
  await expect(db.deletePackageType('PT-001')).rejects.toMatchObject({ code: 'PACKAGE_TYPE_IN_USE', params: { packageTypeId: 'PT-001', count: 12 } })
  await db.deletePackageType('PT-009')
  await expect(db.getPackageType('PT-009')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  const actions = (await db.listEvents()).slice(0, 3).map((event) => event.action)
  expect(actions).toStrictEqual(['packageType.deleted', 'packageType.updated', 'packageType.created'])
})

test('the seed holds 48 registered packages of Long Bình written directly: 40 in stock, 8 still to arrive, none tied to a shipment (FE-0-06)', async () => {
  const db = createMockDb()
  db.restoreSession('US-0001')
  const packages = await db.listRegisteredPackages()
  const idsWith = (status: string) => packages.filter((pkg) => pkg.status === status).map((pkg) => pkg.id)
  expect(packages.map((pkg) => pkg.id)).toStrictEqual(rpk(1, 48))
  // 12 nước suối + 10 mì + 6 sữa + 6 bánh quy + 6 quạt đã ở kho; 8 thùng dầu ăn đăng ký sáng ngày neo, hàng chưa về
  expect(idsWith('received')).toStrictEqual([...rpk(1, 34), ...rpk(43, 48)])
  expect(idsWith('registered')).toStrictEqual(rpk(35, 42))
  expect(new Set(packages.map((pkg) => pkg.status))).toStrictEqual(new Set(['received', 'registered']))
  // Hai đơn chờ gán giữ 22 kiện; 18 kiện còn lại ở kho đưa vào đơn mới được
  expect(packages.filter((pkg) => pkg.orderId !== undefined).map((pkg) => pkg.id)).toStrictEqual(rpk(1, 22))
  expect(packages.filter((pkg) => pkg.status === 'received' && pkg.orderId === undefined).map((pkg) => pkg.id)).toStrictEqual([...rpk(23, 34), ...rpk(43, 48)])
  // Mọi kiện thuộc Long Bình, do điều phối viên của Long Bình đăng ký; không kiện nào còn dấu của lô hàng hay lần quét nhận
  expect(new Set(packages.map((pkg) => pkg.ownerCompanyId))).toStrictEqual(new Set(['LOG-001']))
  expect(new Set(packages.map((pkg) => pkg.registeredBy))).toStrictEqual(new Set(['US-0001']))
  expect(packages.filter((pkg) => 'shipmentId' in pkg || 'received' in pkg)).toStrictEqual([])
  expect(new Set(packages.map((pkg) => pkg.qrToken)).size).toBe(48)
})

test('only the two logistics companies remain; the store has no shipment or receiving function left (FE-0-06)', async () => {
  const db = createMockDb()
  // Mỗi công ty một kho xuất phát kèm toạ độ thật (D-64): KCN Biên Hoà 2 và phường Phú Thuận, Quận 7
  expect(await db.listCompanies()).toStrictEqual([
    {
      id: 'LOG-001', name: 'Công ty TNHH Vận tải Long Bình', address: 'Kho Long Bình, 9 Đường 3A, KCN Biên Hoà 2, Đồng Nai', phone: '0251 383 6120',
      depot: { name: 'Kho Long Bình', address: '9 Đường 3A, KCN Biên Hoà 2, Biên Hoà, Đồng Nai', lat: 10.9294, lng: 106.8747 },
    },
    {
      id: 'LOG-002', name: 'Công ty CP Giao nhận Phương Nam', address: '102 Nguyễn Văn Quỳ, P. Phú Thuận, Q.7, TP. Hồ Chí Minh', phone: '0283 773 9054',
      depot: { name: 'Kho Phú Thuận', address: '102 Nguyễn Văn Quỳ, P. Phú Thuận, Quận 7, TP. Hồ Chí Minh', lat: 10.7308, lng: 106.7353 },
    },
  ])
  expect(Object.keys(db).filter((name) => /shipment|receiv/i.test(name))).toStrictEqual([])
  expect((await db.listEvents()).filter((event) => /^shipment\./.test(event.action) || (event.target.type as string) === 'shipment')).toStrictEqual([])
})

test('a dispatcher registers one, N or many rows of packages for the company of the session, each with its own opaque QR token', async () => {
  const db = createMockDb()
  await db.authenticate('dieuphoi@loadmaster.vn', 'loadmaster')
  const one = await db.registerPackage({ packageTypeId: 'PT-003', reference: ' MP-DA12-0915 ' })
  expect(one).toStrictEqual({
    id: 'RPK-0049', packageTypeId: 'PT-003', ownerCompanyId: 'LOG-001', qrToken: one.qrToken, status: 'registered', reference: 'MP-DA12-0915',
    registeredAt: one.registeredAt, registeredBy: 'US-0001',
  })
  expect(one.qrToken).toMatch(TOKEN)
  expect(one.qrToken).not.toContain('RPK')
  const many = await db.registerPackages({ packageTypeId: 'PT-001' }, 5)
  expect(many.map((pkg) => pkg.id)).toStrictEqual(['RPK-0050', 'RPK-0051', 'RPK-0052', 'RPK-0053', 'RPK-0054'])
  const rows = await db.registerPackageRows([{ packageTypeId: 'PT-002', quantity: 2 }, { packageTypeId: 'PT-004', quantity: 1, note: 'Hàng mẫu' }])
  expect(rows.map((pkg) => pkg.packageTypeId)).toStrictEqual(['PT-002', 'PT-002', 'PT-004'])
  const tokens = (await db.listRegisteredPackages()).map((pkg) => pkg.qrToken)
  expect(new Set(tokens).size).toBe(tokens.length)
  expect(await db.findPackageByQr(one.qrToken.toLowerCase().replaceAll('-', ' '))).toMatchObject({ id: 'RPK-0049' })
  await expect(db.findPackageByQr('LM-0000-0000-0000')).rejects.toMatchObject({ code: 'QR_UNKNOWN', params: { token: 'LM-0000-0000-0000' } })
  // Một đợt ghi một sự kiện
  const [event] = await db.listEvents()
  expect(event).toMatchObject({ action: 'package.registered', actorId: 'US-0001', params: { count: 3, packageTypeId: 'PT-002,PT-004' } })

  // Điều phối viên của Phương Nam đăng ký cho công ty của mình, theo loại kiện của chính Phương Nam (FE-0-02)
  await db.authenticate('dieuphoi@phuongnam.vn', 'loadmaster')
  expect(await db.registerPackage({ packageTypeId: 'PT-PN-01' })).toMatchObject({ id: 'RPK-0058', ownerCompanyId: 'LOG-002', registeredBy: 'US-PN-03' })
  await expect(db.registerPackage({ packageTypeId: 'PT-001' })).rejects.toMatchObject({ code: 'FORBIDDEN_COMPANY', params: { collection: 'packageTypes', id: 'PT-001' } })
})

test('registering checks everything first: a bad row or quantity writes nothing', async () => {
  const db = createMockDb()
  await db.authenticate('dieuphoi@loadmaster.vn', 'loadmaster')
  const before = (await db.listRegisteredPackages()).length
  const events = (await db.listEvents()).length
  await expect(db.registerPackages({ packageTypeId: 'PT-001' }, 0)).rejects.toMatchObject({ code: 'QUANTITY_INVALID', params: { min: 1, max: 500 } })
  await expect(db.registerPackages({ packageTypeId: 'PT-001' }, 501)).rejects.toMatchObject({ code: 'QUANTITY_INVALID' })
  await expect(db.registerPackageRows([{ packageTypeId: 'PT-001', quantity: 3 }, { packageTypeId: 'PT-404', quantity: 1 }])).rejects.toMatchObject({ code: 'NOT_FOUND' })
  await expect(db.registerPackageRows([])).rejects.toMatchObject({ code: 'PACKAGES_REQUIRED' })
  expect(await db.listRegisteredPackages()).toHaveLength(before)
  expect(await db.listEvents()).toHaveLength(events)
})

test('a registered package follows the trip of its order at read time: planned, then loaded, then delivered (LM-104)', async () => {
  const db = createMockDb()
  // Chuyến mới một điểm giao, chưa có kiện: đơn ORD-002 (10 thùng mì RPK-0013…0022) thành dòng PKG-001, instance PKG-001-01…10
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
  const statuses = async () => (await db.listRegisteredPackages()).filter((pkg) => pkg.orderId === 'ORD-002').map((pkg) => [pkg.id, pkg.status])
  const all = (status: string, from = 13) => rpk(from, 22).map((id) => [id, status])
  expect(await statuses()).toStrictEqual(all('planned'))

  // Kho xếp kiện đầu: chỉ kiện đó "đã lên xe" — ở danh sách, khi đọc một kiện và khi tra bằng mã QR
  await db.startLoading(trip.id)
  await db.recordLoadingStep(trip.id, { packageInstanceId: 'PKG-001-01', outcome: 'loaded' })
  expect(await statuses()).toStrictEqual([['RPK-0013', 'loaded'], ...all('planned', 14)])
  const first = await db.getRegisteredPackage('RPK-0013')
  expect([first.status, (await db.findPackageByQr(first.qrToken)).status]).toStrictEqual(['loaded', 'loaded'])

  // Tài xế dỡ kiện đầu ở điểm giao: kiện đó "đã giao", chín kiện còn lại vẫn "đã lên xe"
  for (const id of instances.slice(1)) await db.recordLoadingStep(trip.id, { packageInstanceId: id, outcome: 'loaded' })
  await db.completeLoading(trip.id)
  await db.startDelivery(trip.id)
  await db.recordUnload(trip.id, 1, 'PKG-001-01', true)
  expect(await statuses()).toStrictEqual([['RPK-0013', 'delivered'], ...all('loaded', 14)])

  // Dỡ hết và hoàn tất điểm: chuyến hoàn thành nên đơn cũng "đã giao"
  for (const id of instances.slice(1)) await db.recordUnload(trip.id, 1, id, true)
  await db.completeStop(trip.id, 1)
  expect(await statuses()).toStrictEqual(all('delivered'))
  expect((await db.getOrder('ORD-002')).status).toBe('delivered')
})

test('a package belongs to the company of whoever registers it: a platform account cannot register, and reads no package (FE-0-06, FE-0-02)', async () => {
  const db = createMockDb()
  await db.authenticate('quantri@loadmaster.vn', 'loadmaster')
  await expect(db.registerPackage({ packageTypeId: 'PT-001' })).rejects.toMatchObject({ code: 'COMPANY_REQUIRED' })
  await expect(db.registerPackages({ packageTypeId: 'PT-001' }, 2)).rejects.toMatchObject({ code: 'COMPANY_REQUIRED' })
  await expect(db.listRegisteredPackages()).rejects.toMatchObject({ code: 'COMPANY_REQUIRED' })
  // Không kiện nào được ghi: Long Bình vẫn có đúng 48 kiện của seed
  db.restoreSession('US-0001')
  expect(await db.listRegisteredPackages()).toHaveLength(48)
})
