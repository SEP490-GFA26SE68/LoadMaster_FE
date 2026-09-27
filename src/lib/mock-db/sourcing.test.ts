import { expect, test } from 'vitest'
import { createMockDb, type PackageTypeInput } from '@/lib/mock-db'

/** Luồng 1 Review 1 (LM-104): loại kiện, kiện đăng ký + mã QR, lô hàng, logistics quét nhận. */

const TOKEN = /^LM-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/

const carton: PackageTypeInput = {
  name: 'Thùng nước tăng lực 24 lon', lengthCm: 40, widthCm: 27, heightCm: 13, weightKg: 8.6, fragilityLevel: 'NONE',
  allowedOrientations: ['LWH', 'WLH'], keepUpright: true, stackable: true, maxStackCount: 6, maxTopLoadKg: 45,
}

test('package types: create, edit, reject invalid data by model codes, refuse deleting a type still in use', async () => {
  const db = createMockDb()
  expect((await db.listPackageTypes()).map((type) => type.id)).toStrictEqual(['PT-001', 'PT-002', 'PT-003', 'PT-004', 'PT-005', 'PT-006', 'PT-007', 'PT-008'])
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

test('a manufacturer registers one, N or many rows of packages for its own company, each with its own opaque QR token', async () => {
  const db = createMockDb()
  await db.authenticate('sanxuat@loadmaster.vn', 'loadmaster')
  const one = await db.registerPackage({ packageTypeId: 'PT-003', reference: ' MP-DA12-0915 ', ownerCompanyId: 'MFR-002' })
  expect(one).toMatchObject({ id: 'RPK-0049', ownerCompanyId: 'MFR-001', status: 'registered', reference: 'MP-DA12-0915', registeredBy: 'US-0013' })
  expect(one.qrToken).toMatch(TOKEN)
  expect(one.qrToken).not.toContain('RPK')
  const many = await db.registerPackages({ packageTypeId: 'PT-001' }, 5)
  expect(many.map((pkg) => pkg.id)).toStrictEqual(['RPK-0050', 'RPK-0051', 'RPK-0052', 'RPK-0053', 'RPK-0054'])
  const rows = await db.registerPackageRows([{ packageTypeId: 'PT-002', quantity: 2 }, { packageTypeId: 'PT-004', quantity: 1, note: 'Hàng mẫu' }])
  expect(rows.map((pkg) => pkg.packageTypeId)).toStrictEqual(['PT-002', 'PT-002', 'PT-004'])
  const tokens = (await db.listRegisteredPackages()).map((pkg) => pkg.qrToken)
  expect(new Set(tokens).size).toBe(tokens.length)
  expect(await db.findPackageByQr(one.qrToken.toLowerCase().replaceAll('-', ' '))).toMatchObject({ id: 'RPK-0049' })
  // Một đợt ghi một sự kiện
  const [event] = await db.listEvents()
  expect(event).toMatchObject({ action: 'package.registered', actorId: 'US-0013', params: { count: 3, packageTypeId: 'PT-002,PT-004' } })
})

test('registering checks everything first: a bad row or quantity writes nothing', async () => {
  const db = createMockDb()
  const before = (await db.listRegisteredPackages()).length
  await expect(db.registerPackages({ packageTypeId: 'PT-001', ownerCompanyId: 'MFR-001' }, 0)).rejects.toMatchObject({ code: 'QUANTITY_INVALID', params: { min: 1, max: 500 } })
  await expect(db.registerPackageRows([
    { packageTypeId: 'PT-001', quantity: 3, ownerCompanyId: 'MFR-001' },
    { packageTypeId: 'PT-404', quantity: 1, ownerCompanyId: 'MFR-001' },
  ])).rejects.toMatchObject({ code: 'NOT_FOUND' })
  // Không có phiên nhà sản xuất thì phải chỉ rõ công ty, và công ty phải là nhà sản xuất
  await expect(db.registerPackage({ packageTypeId: 'PT-001' })).rejects.toMatchObject({ code: 'COMPANY_REQUIRED' })
  await expect(db.registerPackage({ packageTypeId: 'PT-001', ownerCompanyId: 'LOG-001' })).rejects.toMatchObject({ code: 'COMPANY_KIND_INVALID' })
  expect(await db.listRegisteredPackages()).toHaveLength(before)
})

test('each company only sees its own packages and shipments', async () => {
  const db = createMockDb()
  expect(await db.listRegisteredPackages()).toHaveLength(48)
  await db.authenticate('sanxuat@loadmaster.vn', 'loadmaster')
  expect((await db.listRegisteredPackages()).every((pkg) => pkg.ownerCompanyId === 'MFR-001')).toBe(true)
  expect((await db.listShipments()).map((shipment) => shipment.id)).toStrictEqual(['SHP-002', 'SHP-001'])
  await expect(db.getRegisteredPackage('RPK-0043')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  await db.authenticate('logistics@loadmaster.vn', 'loadmaster')
  expect((await db.listShipments()).map((shipment) => shipment.id)).toStrictEqual(['SHP-002', 'SHP-001'])
  expect(await db.listRegisteredPackages()).toHaveLength(34)
})

test('a draft shipment takes free registered packages of its manufacturer, can be edited or deleted, then is handed over', async () => {
  const db = createMockDb()
  await db.authenticate('sanxuat@loadmaster.vn', 'loadmaster')
  const draft = await db.createShipment({ logisticsCompanyId: 'LOG-001', packageIds: ['RPK-0035', 'RPK-0036', 'RPK-0036'] })
  expect(draft).toMatchObject({ id: 'SHP-004', manufacturerId: 'MFR-001', status: 'draft', packageIds: ['RPK-0035', 'RPK-0036'] })
  expect((await db.getRegisteredPackage('RPK-0035')).shipmentId).toBe('SHP-004')
  // Kiện đã nhận, kiện của công ty khác, lô cho nhà sản xuất: đều bị từ chối
  await expect(db.createShipment({ logisticsCompanyId: 'LOG-001', packageIds: ['RPK-0001'] })).rejects.toMatchObject({ code: 'PACKAGE_UNAVAILABLE' })
  await expect(db.createShipment({ logisticsCompanyId: 'LOG-001', packageIds: ['RPK-0043'] })).rejects.toMatchObject({ code: 'PACKAGE_NOT_OWNED' })
  await expect(db.createShipment({ logisticsCompanyId: 'MFR-002', packageIds: ['RPK-0037'] })).rejects.toMatchObject({ code: 'COMPANY_KIND_INVALID' })
  await expect(db.createShipment({ logisticsCompanyId: 'LOG-001', packageIds: ['RPK-0035'] })).rejects.toMatchObject({ code: 'PACKAGE_UNAVAILABLE' })

  const edited = await db.updateShipment('SHP-004', { packageIds: ['RPK-0036', 'RPK-0037'], note: 'Giao trước 10 giờ' })
  expect(edited).toMatchObject({ packageIds: ['RPK-0036', 'RPK-0037'], note: 'Giao trước 10 giờ' })
  expect((await db.getRegisteredPackage('RPK-0035')).shipmentId).toBeUndefined()
  const handed = await db.handOverShipment('SHP-004')
  expect(handed).toMatchObject({ status: 'handed_over', handedOverBy: 'US-0013' })
  expect((await db.getRegisteredPackage('RPK-0037')).status).toBe('in_shipment')
  await expect(db.updateShipment('SHP-004', { note: '' })).rejects.toMatchObject({ code: 'SHIPMENT_STATUS_INVALID' })
  await expect(db.deleteShipment('SHP-004')).rejects.toMatchObject({ code: 'SHIPMENT_STATUS_INVALID' })

  const other = await db.createShipment({ logisticsCompanyId: 'LOG-002', packageIds: ['RPK-0038'] })
  await db.deleteShipment(other.id)
  expect((await db.getRegisteredPackage('RPK-0038')).shipmentId).toBeUndefined()
})

test('only the assigned logistics company scans packages in; the shipment turns received once every package is in', async () => {
  const db = createMockDb()
  const pending = (await db.getShipment('SHP-002')).packageIds.slice(4)
  const tokenOf = async (id: string) => (await db.getRegisteredPackage(id)).qrToken
  const fanToken = await tokenOf('RPK-0043')
  const tokens = await Promise.all(pending.map(tokenOf))

  await db.authenticate('viet.lam@phuongnam.vn', 'loadmaster')
  await expect(db.receivePackageByQr(tokens[0] ?? '')).rejects.toMatchObject({ code: 'RECEIVING_FORBIDDEN', params: { shipmentId: 'SHP-002' } })

  await db.authenticate('logistics@loadmaster.vn', 'loadmaster')
  await expect(db.receivePackageByQr(fanToken)).rejects.toMatchObject({ code: 'RECEIVING_FORBIDDEN', params: { shipmentId: 'SHP-003' } })
  await expect(db.receivePackageByQr('LM-0000-0000-0000')).rejects.toMatchObject({ code: 'QR_UNKNOWN' })
  const first = await db.receivePackageByQr(` ${(tokens[0] ?? '').toLowerCase()} `)
  expect(first.package).toMatchObject({ id: 'RPK-0027', status: 'received', received: { by: 'US-0014' } })
  expect(first.shipment).toMatchObject({ status: 'partially_received' })
  await expect(db.receivePackageByQr(tokens[0] ?? '')).rejects.toMatchObject({ code: 'PACKAGE_ALREADY_RECEIVED' })
  for (const token of tokens.slice(1)) await db.receivePackageByQr(token)
  const done = await db.getShipment('SHP-002')
  expect(done.status).toBe('received')
  expect(done.receipts).toHaveLength(12)
  expect((await db.listEvents())[0]).toMatchObject({ action: 'shipment.packageReceived', actorId: 'US-0014', params: { received: 12, count: 12 } })
})
