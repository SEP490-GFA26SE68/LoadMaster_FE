import { expect, test } from 'vitest'
import { createMockDb, type PackageTypeInput } from '@/lib/mock-db'

/**
 * Nguồn hàng của công ty logistics (LM-104, FE-0-06): loại kiện và công ty; không còn nhà sản xuất, lô hàng hay luồng quét nhận. Kiện
 * của kho kiện: `packages.test.ts`. Số của seed chép tay từ `seed-sourcing.ts`, không tính lại theo cách kho tính.
 */

const carton: PackageTypeInput = {
  name: 'Thùng nước tăng lực 24 lon', lengthCm: 40, widthCm: 27, heightCm: 13, weightKg: 8.6, fragilityLevel: 'NONE',
  allowedOrientations: ['LWH', 'WLH'], keepUpright: true, stackable: true, maxStackCount: 6, maxTopLoadKg: 45,
}

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
  // 12 thùng nước suối của kho kiện gắn loại PT-001; 40 kiện nhập file không gắn loại nào
  await expect(db.deletePackageType('PT-001')).rejects.toMatchObject({ code: 'PACKAGE_TYPE_IN_USE', params: { packageTypeId: 'PT-001', count: 12 } })
  await db.deletePackageType('PT-009')
  await expect(db.getPackageType('PT-009')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  const actions = (await db.listEvents()).slice(0, 3).map((event) => event.action)
  expect(actions).toStrictEqual(['packageType.deleted', 'packageType.updated', 'packageType.created'])
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

test('the registered-package model of Review 1 is gone: no RPK id, no derived status, no register function (FE-3b-01)', async () => {
  const db = createMockDb()
  expect(Object.keys(db).filter((name) => /register/i.test(name))).toStrictEqual([])
  const packages = await db.listPackages()
  expect(packages.filter((pkg) => pkg.id.includes('RPK') || 'ownerCompanyId' in pkg || 'registeredAt' in pkg)).toStrictEqual([])
  expect((await db.listEvents()).filter((event) => event.target.id.includes('RPK') || Object.values(event.params).some((value) => String(value).includes('RPK')))).toStrictEqual([])
})
