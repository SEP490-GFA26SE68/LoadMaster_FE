import { expect, test } from 'vitest'
import { createMockDb, type MockDb } from '@/lib/mock-db'

/**
 * Tra cứu kiện (FE-3b-06, D-63, D-92): tra theo mã người dùng gõ — mã QR, mã của bên gửi hoặc mã của kho — và nhân viên kho quét thấy
 * lại kiện đang mang cờ "Không tìm thấy". Seed neo 14/09/2026: PK-0063 (`BV-VIN-2609-05`) mang cờ `NOT_FOUND`, PK-0078 mang `DAMAGED`.
 */

function signedIn(userId: string): MockDb {
  const db = createMockDb()
  db.restoreSession(userId)
  return db
}

test('lookup by what the user typed: the QR token in any spelling, the sender code or the pool id, without regard to case', async () => {
  const db = signedIn('US-0003')
  const pkg = await db.getPackage('PK-0049')
  expect((await db.lookupPackages(pkg.qrToken.toLowerCase().replaceAll('-', ' '))).map((item) => item.id)).toStrictEqual(['PK-0049'])
  expect((await db.lookupPackages(' hk-dng-2609-01 ')).map((item) => item.id)).toStrictEqual(['PK-0049'])
  expect((await db.lookupPackages('pk-0049')).map((item) => item.id)).toStrictEqual(['PK-0049'])
  // Một phần của mã không khớp: tra cứu là tra đúng mã, không phải tìm kiếm
  await expect(db.lookupPackages('HK-DNG-2609')).rejects.toMatchObject({ code: 'QR_UNKNOWN', params: { token: 'HK-DNG-2609' } })
  await expect(db.lookupPackages('   ')).rejects.toMatchObject({ code: 'QR_UNKNOWN' })
})

test('a sender code shared by several packages returns all of them, newest first', async () => {
  const db = signedIn('US-0001')
  // Kiện nhập tay đầu tiên của mỗi chuyến mang mã PKG-001-01 — 13 trong 15 chuyến của Long Bình (hai chuyến có dòng đầu từ 100 kiện:
  // mã ba chữ số PKG-001-001)
  const found = await db.lookupPackages('PKG-001-01')
  expect(found).toHaveLength(13)
  expect(new Set(found.map((pkg) => pkg.companyId))).toStrictEqual(new Set(['LOG-001']))
  const added = await db.createPackage({ packageCode: 'pkg-001-01', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 18, handlingClass: 'STANDARD', destination: 'KCN Hoà Khánh' })
  expect((await db.lookupPackages('PKG-001-01')).map((pkg) => pkg.id).slice(0, 2)).toStrictEqual([added.id, found[0]?.id])
})

test('a package of another company is not found by any of its codes, exactly like a code that does not exist', async () => {
  const db = createMockDb()
  const foreign = await db.getPackage('PK-PN-0005')
  db.restoreSession('US-0003')
  for (const code of [foreign.qrToken, foreign.packageCode, foreign.id, 'LM-0000-0000-0000']) {
    await expect(db.lookupPackages(code)).rejects.toMatchObject({ code: 'QR_UNKNOWN' })
  }
  await expect(db.reportPackageFound(foreign.qrToken)).rejects.toMatchObject({ code: 'QR_UNKNOWN' })
})

test('the warehouse scanning a package flagged "not found" clears the flag, writes the history and tells the dispatcher', async () => {
  const db = signedIn('US-0003')
  const flagged = await db.getPackage('PK-0063')
  expect(flagged.flags).toStrictEqual(['NOT_FOUND'])
  const events = (await db.listEvents()).length
  const found = await db.reportPackageFound(flagged.qrToken.toLowerCase())
  expect(found).toMatchObject({ id: 'PK-0063', flags: [], status: 'IMPORTED' })
  expect(found.history.at(-1)).toMatchObject({ kind: 'flagCleared', flag: 'NOT_FOUND', actorId: 'US-0003' })
  const log = await db.listEvents()
  expect(log).toHaveLength(events + 1)
  expect(log[0]).toMatchObject({ action: 'package.found', actorId: 'US-0003', target: { type: 'package', id: 'PK-0063' }, params: { flag: 'NOT_FOUND', packageCode: 'BV-VIN-2609-05' } })
  // Kiện lại chọn được vào yêu cầu giao (hạn xa: đồng hồ của kho ở test này là giờ thật)
  db.restoreSession('US-0002')
  const requirement = { destinationName: 'KCN Bắc Vinh', address: 'KCN Bắc Vinh, TP. Vinh, Nghệ An', deadline: '2099-01-01T00:00:00.000Z', priority: 'NORMAL' as const, packageIds: ['PK-0063'] }
  expect((await db.createDeliveryRequirement(requirement)).packageIds).toStrictEqual(['PK-0063'])
})

test('only the warehouse reports a package found, and only a package that carries the flag; a damaged flag stays for the dispatcher', async () => {
  const db = signedIn('US-0001')
  const [missing, damaged, plain] = await Promise.all(['PK-0063', 'PK-0078', 'PK-0049'].map((id) => db.getPackage(id)))
  await expect(db.reportPackageFound(missing?.qrToken ?? '')).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED', params: { role: 'dispatcher' } })
  db.restoreSession('US-0003')
  await expect(db.reportPackageFound(damaged?.qrToken ?? '')).rejects.toMatchObject({ code: 'PACKAGE_FLAG_NOT_SET', params: { packageId: 'PK-0078', flag: 'NOT_FOUND' } })
  await expect(db.reportPackageFound(plain?.qrToken ?? '')).rejects.toMatchObject({ code: 'PACKAGE_FLAG_NOT_SET' })
  expect((await db.getPackage('PK-0078')).flags).toStrictEqual(['DAMAGED'])
  expect((await db.getPackage('PK-0063')).flags).toStrictEqual(['NOT_FOUND'])
})
