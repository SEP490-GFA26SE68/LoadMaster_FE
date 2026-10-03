import { expect, test } from 'vitest'
import type { OptimizationRequest } from '@/domain/models'
import { canTransitionPackage, createMockDb, isRequirementClosed, PACKAGE_STATUSES, requirementStatus, type MockDb, type PackageInput, type PackageStatus } from '@/lib/mock-db'
import { runMockOptimization } from '@/services/optimization'
import { loadAll, stageAll, unloadStop } from '@/test/trip-flow'

/**
 * Kho kiện theo mô hình backend (FE-3b-01, D-68, D-70, D-92): trường của kiện, mã QR cấp một lần, trạng thái ghi thật theo bảng chuyển,
 * cờ chặn chọn kiện. Số và mã của seed chép tay từ `seed-sourcing.ts`, `seed-packages.ts`, không tính lại theo cách kho tính.
 */

const TOKEN = /^LM-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/

/** Mã `PK-NNNN` từ `from` tới `to`. */
const pk = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => `PK-${String(from + index).padStart(4, '0')}`)

const crate: PackageInput = { lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 18, handlingClass: 'STANDARD', destination: 'KCN Hoà Khánh, Q. Liên Chiểu, Đà Nẵng' }

/** Kiện có từ trước trong kho kiện; kiện của các chuyến seed (nguồn `TRIP`, FE-3b-07) kiểm ở `trip-packages.test.ts`. */
const sourced = async (db: MockDb) => (await db.listPackages()).filter((pkg) => pkg.source !== 'TRIP')

/** 12:00 ngày neo, giờ Việt Nam: đồng hồ của kho cho các test tạo yêu cầu giao (hạn phải ở tương lai). */
const NOW = new Date('2026-09-14T05:00:00.000Z')

function dispatcher(): MockDb {
  const db = createMockDb({ now: () => NOW })
  db.restoreSession('US-0001')
  return db
}

test('the seed pool of Long Bình: 48 packages converted from registered packages with the sizes of their type, 40 imported ones, all IMPORTED', async () => {
  const db = dispatcher()
  const packages = await sourced(db)
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
    requirementId: 'REQ-005', createdAt: '2026-09-11T02:00:00.000Z', createdBy: 'US-0001',
    history: [{ at: '2026-09-11T02:00:00.000Z', actorId: 'US-0001', kind: 'created', source: 'MANUAL' }],
  })
  // Hai yêu cầu giao lập sáng ngày neo giữ 22 kiện đầu; bốn yêu cầu lập hôm trước mỗi yêu cầu giữ hai kiện cuối của một đợt nhập (FE-4b-01)
  expect(packages.filter((pkg) => pkg.requirementId !== undefined).map((pkg) => pkg.id)).toStrictEqual([
    ...pk(1, 22), 'PK-0052', 'PK-0053', 'PK-0057', 'PK-0058', 'PK-0067', 'PK-0068', 'PK-0072', 'PK-0073',
  ])

  // 40 kiện nhập file: không gắn loại kiện, tám điểm đến mỗi nơi 5 kiện, đủ năm loại hàng, chưa vào chuyến nào
  const imported = packages.filter((pkg) => pkg.source === 'IMPORT')
  expect(imported.map((pkg) => pkg.id)).toStrictEqual(pk(49, 88))
  expect(imported.filter((pkg) => pkg.packageTypeId !== undefined || pkg.tripId !== undefined)).toStrictEqual([])
  expect(imported[0]).toMatchObject({ packageCode: 'HK-DNG-2609-01', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 18, handlingClass: 'STANDARD', destination: 'KCN Hoà Khánh, Q. Liên Chiểu, Đà Nẵng' })
  const count = (values: string[]) => Object.fromEntries([...new Set(values)].map((value) => [value, values.filter((item) => item === value).length]))
  expect(count(imported.map((pkg) => pkg.handlingClass))).toStrictEqual({ STANDARD: 20, FRAGILE: 5, HIGH_VALUE: 5, REFRIGERATED: 5, HAZARDOUS: 5 })
  expect(Object.values(count(imported.map((pkg) => pkg.destination)))).toStrictEqual([5, 5, 5, 5, 5, 5, 5, 5])
  // Hai kiện mang cờ để demo gỡ cờ
  expect(packages.filter((pkg) => pkg.flags.length > 0).map((pkg) => [pkg.id, pkg.flags])).toStrictEqual([['PK-0063', ['NOT_FOUND']], ['PK-0078', ['DAMAGED']]])
})

test('Phương Nam keeps its small pool: 10 packages, all IMPORTED, four held by its pending requirement', async () => {
  const db = createMockDb()
  db.restoreSession('US-PN-03')
  const packages = await sourced(db)
  expect(packages.map((pkg) => [pkg.id, pkg.status, pkg.requirementId])).toStrictEqual([
    ['PK-PN-0001', 'IMPORTED', 'REQ-PN-001'], ['PK-PN-0002', 'IMPORTED', 'REQ-PN-001'], ['PK-PN-0003', 'IMPORTED', 'REQ-PN-001'],
    ['PK-PN-0004', 'IMPORTED', 'REQ-PN-001'], ['PK-PN-0005', 'IMPORTED', undefined], ['PK-PN-0006', 'IMPORTED', undefined],
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
    history: [{ at: one.createdAt, actorId: 'US-0001', kind: 'created', source: 'MANUAL' }],
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
  expect(event).toMatchObject({ action: 'package.importConfirmed', actorId: 'US-0001', target: { type: 'package', id: 'PK-0090' }, params: { count: 3, packageTypeId: 'PT-006', lastPackageId: 'PK-0092' } })
  // Thêm lẻ là sự kiện khác với nhập file
  expect((await db.listEvents())[1]).toMatchObject({ action: 'package.created', target: { type: 'package', id: 'PK-0089' }, params: { count: 1 } })
  // 2.863 kiện của các chuyến seed + 88 kiện có từ trước + 4 kiện vừa tạo: không mã nào trùng
  const tokens = (await db.listPackages()).map((pkg) => pkg.qrToken)
  expect(new Set(tokens).size).toBe(2863 + 92)

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
  expect(await sourced(db)).toHaveLength(92)
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

test('a flagged package cannot go into a requirement or a trip until the dispatcher clears the flag, and clearing is logged', async () => {
  const db = dispatcher()
  const requirement = (packageIds: string[]) => ({
    destinationName: 'Nhà hàng Hương Việt', address: '203 Lê Văn Sỹ, P. 13, Q.3', deadline: '2026-09-16T10:00:00.000Z', priority: 'NORMAL' as const, packageIds,
  })
  // PK-0063 mang cờ "Không tìm thấy" từ seed
  await expect(db.createDeliveryRequirement(requirement(['PK-0062', 'PK-0063']))).rejects.toMatchObject({ code: 'PACKAGE_FLAGGED', params: { packageId: 'PK-0063', flag: 'NOT_FOUND' } })
  const created = await db.createDeliveryRequirement(requirement(['PK-0062']))
  await expect(db.updateDeliveryRequirement(created.id, { packageIds: ['PK-0062', 'PK-0078'] })).rejects.toMatchObject({ code: 'PACKAGE_FLAGGED', params: { packageId: 'PK-0078', flag: 'DAMAGED' } })

  // Kiện đã nằm trong yêu cầu chờ xếp chuyến bị gắn cờ: yêu cầu thành "giao thiếu" và không vào chuyến được (D-92)
  expect((await db.flagPackage('PK-0013', 'DAMAGED')).flags).toStrictEqual(['DAMAGED'])
  expect((await db.flagPackage('PK-0013', 'DAMAGED')).flags).toStrictEqual(['DAMAGED'])
  const held = await db.getDeliveryRequirement('REQ-006')
  expect(requirementStatus(held, await Promise.all(held.packageIds.map((id) => db.getPackage(id))))).toBe('PARTIAL')
  await expect(db.assignDeliveryRequirement('REQ-006', 'TRIP-014')).rejects.toMatchObject({ code: 'PACKAGE_FLAGGED', params: { packageId: 'PK-0013', flag: 'DAMAGED' } })
  expect((await db.getTrip('TRIP-014')).packages.map((pkg) => pkg.id)).toStrictEqual(['PKG-001', 'PKG-002', 'PKG-003'])

  // Nhân viên kho không gỡ được cờ; điều phối viên gỡ, nhật ký ghi người gỡ
  db.restoreSession('US-0003')
  await expect(db.clearPackageFlag('PK-0013', 'DAMAGED')).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED', params: { role: 'warehouse' } })
  db.restoreSession('US-0001')
  await expect(db.clearPackageFlag('PK-0013', 'NOT_FOUND')).rejects.toMatchObject({ code: 'PACKAGE_FLAG_NOT_SET', params: { packageId: 'PK-0013', flag: 'NOT_FOUND' } })
  expect((await db.clearPackageFlag('PK-0013', 'DAMAGED')).flags).toStrictEqual([])
  const [event] = await db.listEvents()
  expect(event).toMatchObject({ action: 'package.flagCleared', actorId: 'US-0001', target: { type: 'package', id: 'PK-0013' }, params: { flag: 'DAMAGED' } })
  expect((await db.assignDeliveryRequirement('REQ-006', 'TRIP-014')).requirement.status).toBe('ASSIGNED')

  // Cờ chỉ gắn trên kiện còn ở kho kiện
  await expect(db.flagPackage('PK-0013', 'NOT_FOUND')).rejects.toMatchObject({ code: 'PACKAGE_UNAVAILABLE', params: { packageId: 'PK-0013', status: 'ASSIGNED' } })
  const cleared = await db.clearPackageFlag('PK-0063', 'NOT_FOUND')
  expect(cleared.flags).toStrictEqual([])
  // Lịch sử: nhập file hôm trước 16:20, gắn cờ 17:05 (seed), điều phối viên gỡ cờ bây giờ
  expect(cleared.history.map((entry) => [entry.kind, entry.actorId, 'flag' in entry ? entry.flag : undefined])).toStrictEqual([
    ['created', 'US-0001', undefined], ['flagged', 'US-0001', 'NOT_FOUND'], ['flagCleared', 'US-0001', 'NOT_FOUND'],
  ])
  expect(cleared.history.slice(0, 2).map((entry) => entry.at)).toStrictEqual(['2026-09-13T09:20:00.000Z', '2026-09-13T10:05:00.000Z'])
  expect((await db.updateDeliveryRequirement(created.id, { packageIds: ['PK-0062', 'PK-0063'] })).packageIds).toStrictEqual(['PK-0062', 'PK-0063'])
})

test('a package follows its trip by written transitions: assigned, staged, loaded or flagged damaged, in transit, delivered or returned', async () => {
  const db = createMockDb()
  // Chuyến mới chưa có điểm giao và kiện: yêu cầu REQ-006 (10 thùng mì PK-0013…0022) sinh điểm 1 và dòng PKG-001, instance PKG-001-01…10
  const created = await db.createTrip({
    name: 'Tuyến Dĩ An', vehicleId: 'VEHICLE-005', scheduledDate: '2026-09-15', packages: [], stops: [],
  })
  const { trip } = await db.assignDeliveryRequirement('REQ-006', created.id)
  const request: OptimizationRequest = {
    vehicle: await db.getVehicle(trip.vehicleId),
    packages: trip.packages,
    settings: { method: 'MOCK', timeLimitSeconds: 30, randomSeed: 20_260_915, enforceLifo: true, prioritizeLowCenterOfGravity: false },
  }
  const revision = await db.addRevision({ tripId: trip.id, request, result: runMockOptimization(request, { clock: () => 0 }) })
  await db.approveRevision(revision.id, [])
  const statuses = async () => (await db.listPackages()).filter((pkg) => pkg.requirementId === 'REQ-006').map((pkg) => [pkg.id, pkg.status])
  const all = (status: string, to = 22) => pk(13, to).map((id) => [id, status])
  expect(await statuses()).toStrictEqual(all('ASSIGNED'))
  expect(await db.getPackage('PK-0013')).toMatchObject({ tripId: trip.id, stopId: 'STOP-01' })

  // Bắt đầu chưa đổi gì: kiện sang "đã soạn" khi kho đối chiếu từng kiện vào khu chờ (FE-6-02)
  await db.startLoading(trip.id)
  expect(await statuses()).toStrictEqual(all('ASSIGNED'))
  await stageAll(db, trip.id)
  expect(await statuses()).toStrictEqual(all('STAGED'))
  // Kết quả xếp còn bị gỡ khi xác nhận tay bị từ chối nên "đã xếp" chỉ chốt lúc xếp xong: chín kiện đã xếp; kiện cuối theo thứ tự xếp
  // (PKG-001-10, không kiện nào tựa lên) hỏng — về kho kiện kèm cờ ngay lúc báo
  await loadAll(db, trip.id, 'PKG-001-10')
  expect(await statuses()).toStrictEqual(all('STAGED'))
  await db.reportDamagedPackage(trip.id, 'PKG-001-10')
  expect(await statuses()).toStrictEqual([...all('STAGED', 21), ['PK-0022', 'IMPORTED']])
  await db.completeLoading(trip.id)
  expect(await statuses()).toStrictEqual([...all('LOADED', 21), ['PK-0022', 'IMPORTED']])
  const damaged = await db.getPackage('PK-0022')
  expect(damaged.flags).toStrictEqual(['DAMAGED'])
  expect(damaged).not.toHaveProperty('tripId')
  expect(damaged).not.toHaveProperty('stopId')

  // Yêu cầu theo chuyến: đã vào chuyến cho tới lúc xe xuất phát, rồi đang giao
  expect((await db.getDeliveryRequirement('REQ-006')).status).toBe('ASSIGNED')
  await db.startDelivery(trip.id)
  expect((await db.getDeliveryRequirement('REQ-006')).status).toBe('IN_TRIP')
  expect(await statuses()).toStrictEqual([...all('IN_TRANSIT', 21), ['PK-0022', 'IMPORTED']])
  // Tài xế đến điểm, dỡ tám kiện, khách từ chối kiện thứ chín; hoàn tất điểm mới chốt
  await unloadStop(db, trip.id, 1, ['PKG-001-09'])
  await db.reportDeliveryIssue(trip.id, { stopNumber: 1, packageInstanceId: 'PKG-001-09', kind: 'refused', note: '' })
  expect(await statuses()).toStrictEqual([...all('IN_TRANSIT', 21), ['PK-0022', 'IMPORTED']])
  await db.completeStop(trip.id, 1)
  expect(await statuses()).toStrictEqual([...all('DELIVERED', 20), ['PK-0021', 'RETURNED'], ['PK-0022', 'IMPORTED']])

  // Lịch sử của kiện do kho ghi ở từng mốc (FE-3b-03): tạo → gán chuyến → soạn → xếp → vận chuyển → giao; kiện hỏng về kho kiện kèm cờ
  const steps = async (id: string) => (await db.getPackage(id)).history.map((entry) =>
    entry.kind === 'status' ? `${entry.from}>${entry.to}@${entry.tripId}` : entry.kind === 'created' ? `created:${entry.source}` : `${entry.kind}:${entry.flag}`)
  expect(await steps('PK-0013')).toStrictEqual([
    'created:MANUAL', `IMPORTED>ASSIGNED@${trip.id}`, `ASSIGNED>STAGED@${trip.id}`, `STAGED>LOADED@${trip.id}`, `LOADED>IN_TRANSIT@${trip.id}`,
    `IN_TRANSIT>DELIVERED@${trip.id}`,
  ])
  expect((await steps('PK-0021')).at(-1)).toBe(`IN_TRANSIT>RETURNED@${trip.id}`)
  expect((await steps('PK-0022')).slice(-2)).toStrictEqual([`STAGED>IMPORTED@${trip.id}`, 'flagged:DAMAGED'])
  const history = (await db.getPackage('PK-0013')).history
  expect(history.map((entry) => entry.at)).toStrictEqual(history.map((entry) => entry.at).toSorted())
  // Yêu cầu đã giao xong nhưng thiếu: một kiện hoàn trả, một kiện hỏng lúc xếp — hạn và ưu tiên không sửa được nữa
  const done = await db.getDeliveryRequirement('REQ-006')
  const members = await Promise.all(done.packageIds.map((id) => db.getPackage(id)))
  expect([done.status, requirementStatus(done, members), isRequirementClosed(done, members)]).toStrictEqual(['IN_TRIP', 'PARTIAL', true])
  await expect(db.updateDeliveryRequirement('REQ-006', { priority: 'URGENT' })).rejects.toMatchObject({ code: 'REQUIREMENT_STATUS_INVALID', params: { requirementId: 'REQ-006', status: 'IN_TRIP' } })
})

test('a requirement whose packages were all delivered reads as delivered', async () => {
  const db = createMockDb()
  const created = await db.createTrip({
    name: 'Tuyến Dĩ An', vehicleId: 'VEHICLE-005', scheduledDate: '2026-09-15', packages: [], stops: [],
  })
  const { trip } = await db.assignDeliveryRequirement('REQ-006', created.id)
  const request: OptimizationRequest = {
    vehicle: await db.getVehicle(trip.vehicleId),
    packages: trip.packages,
    settings: { method: 'MOCK', timeLimitSeconds: 30, randomSeed: 20_260_915, enforceLifo: true, prioritizeLowCenterOfGravity: false },
  }
  const revision = await db.addRevision({ tripId: trip.id, request, result: runMockOptimization(request, { clock: () => 0 }) })
  await db.approveRevision(revision.id, [])
  await db.startLoading(trip.id)
  await stageAll(db, trip.id)
  await loadAll(db, trip.id)
  await db.completeLoading(trip.id)
  await db.startDelivery(trip.id)
  await unloadStop(db, trip.id, 1)
  await db.completeStop(trip.id, 1)
  const done = await db.getDeliveryRequirement('REQ-006')
  const members = await Promise.all(done.packageIds.map((id) => db.getPackage(id)))
  expect([done.status, requirementStatus(done, members), isRequirementClosed(done, members)]).toStrictEqual(['IN_TRIP', 'DELIVERED', true])
})

test('cancelling a trip before departure sends its packages back to the pool, still held by their requirement', async () => {
  const db = createMockDb()
  await db.assignDeliveryRequirement('REQ-005', 'TRIP-014')
  // REQ-005 giao tới Co.opmart Bình Dương — chưa là điểm nào của TRIP-014: điểm 3 tự sinh
  expect(await db.getPackage('PK-0001')).toMatchObject({ status: 'ASSIGNED', tripId: 'TRIP-014', stopId: 'STOP-03' })
  await db.cancelTrip('TRIP-014', 'Khách dời lịch nhận')
  const released = await db.getPackage('PK-0001')
  expect(released).toMatchObject({ status: 'IMPORTED', requirementId: 'REQ-005' })
  expect(released).not.toHaveProperty('tripId')
  // Yêu cầu đã về "chờ xếp chuyến" cùng lúc huỷ chuyến (D-91): không còn gì để gỡ
  await expect(db.unassignDeliveryRequirement('REQ-005')).rejects.toMatchObject({ code: 'REQUIREMENT_STATUS_INVALID', params: { status: 'PENDING' } })
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
  expect(await sourced(db)).toHaveLength(88)
})
