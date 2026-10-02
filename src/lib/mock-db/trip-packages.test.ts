import { expect, test } from 'vitest'
import type { CargoPackage } from '@/domain/models'
import { createMockDb, type MockDb, type Package } from '@/lib/mock-db'

/**
 * Kiện thêm ngay trong chuyến tự vào kho kiện (FE-3b-07, D-68): mỗi instance một bản ghi `ASSIGNED` nguồn `TRIP` có mã QR thật; xoá
 * dòng hay giảm số lượng trả kiện về `IMPORTED`. Seed neo 14/09/2026 — số của seed chép tay từ `seed-trips.ts`, `seed-trip.ts`.
 */

const TOKEN = /^LM-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/

const line = (id: string, quantity: number, deliveryStop: number, extra: Partial<CargoPackage> = {}): CargoPackage => ({
  id, name: 'Thùng gốm Bát Tràng', lengthCm: 50, widthCm: 40, heightCm: 30, weightKg: 9.5, quantity, allowedOrientations: ['LWH', 'WLH'],
  keepUpright: true, fragilityLevel: 'NONE', stackable: true, maxTopLoadKg: 20, minSupportRatio: 0.8, deliveryStop, priority: 0, mustLoad: false,
  ...extra,
})

const STOPS = [
  { id: 'STOP-01', name: 'Kho Bách Hoá Xanh Dĩ An', address: '215 Quốc lộ 1K, P. Đông Hoà, Dĩ An' },
  { id: 'STOP-02', name: 'Co.opmart Biên Hoà', address: '121 Phạm Văn Thuận, Biên Hoà' },
]

function dispatcher(): MockDb {
  const db = createMockDb()
  db.restoreSession('US-0001')
  return db
}

const ofTrip = async (db: MockDb, tripId: string) => (await db.listPackages()).filter((pkg) => pkg.tripId === tripId)
const brief = (pkg: Package) => [pkg.id, pkg.packageCode, pkg.status, pkg.stopId]

test('a new trip turns every instance of its hand-entered lines into an ASSIGNED pool package of source TRIP with a QR token', async () => {
  const db = dispatcher()
  const trip = await db.createTrip({
    name: 'Tuyến Dĩ An – Biên Hoà', vehicleId: 'VEHICLE-005', stops: STOPS, scheduledDate: '2026-09-15',
    packages: [line('PKG-001', 2, 1, { handlingClass: 'FRAGILE' }), line('PKG-002', 1, 2)],
    // Hai loại hàng trong một chuyến: cần lý do vượt luật phân tách hàng (FE-4b-06)
    overrideReason: 'Khách gom chung một xe',
  })
  const created = await ofTrip(db, trip.id)
  expect(created.map(brief)).toStrictEqual([
    ['PK-0089', 'PKG-001-01', 'ASSIGNED', 'STOP-01'], ['PK-0090', 'PKG-001-02', 'ASSIGNED', 'STOP-01'], ['PK-0091', 'PKG-002-01', 'ASSIGNED', 'STOP-02'],
  ])
  expect(created[0]).toStrictEqual({
    id: 'PK-0089', companyId: 'LOG-001', packageCode: 'PKG-001-01', qrToken: created[0]?.qrToken, lengthCm: 50, widthCm: 40, heightCm: 30, weightKg: 9.5,
    handlingClass: 'FRAGILE', destination: '215 Quốc lộ 1K, P. Đông Hoà, Dĩ An', status: 'ASSIGNED', flags: [], source: 'TRIP', tripId: trip.id, stopId: 'STOP-01',
    createdAt: created[0]?.createdAt, createdBy: 'US-0001',
    history: [
      { at: created[0]?.createdAt, actorId: 'US-0001', kind: 'created', source: 'TRIP' },
      { at: created[0]?.history[1]?.at, actorId: 'US-0001', kind: 'status', from: 'IMPORTED', to: 'ASSIGNED', tripId: trip.id },
    ],
  })
  // Dòng không khai loại hàng là hàng thường; không kiện nào thuộc đơn hay yêu cầu giao
  expect(created[2]).toMatchObject({ handlingClass: 'STANDARD', destination: '121 Phạm Văn Thuận, Biên Hoà' })
  expect(created.filter((pkg) => pkg.requirementId !== undefined)).toStrictEqual([])
  expect(created.every((pkg) => TOKEN.test(pkg.qrToken))).toBe(true)

  // Nhãn của chuyến là mã QR của chính các kiện đó; tra mã ra đúng kiện
  const labels = await db.listTripLabels(trip.id)
  expect(labels.map((label) => [label.packageInstanceId, label.poolPackageId, label.qrToken])).toStrictEqual([
    ['PKG-001-01', 'PK-0089', created[0]?.qrToken], ['PKG-001-02', 'PK-0090', created[1]?.qrToken], ['PKG-002-01', 'PK-0091', created[2]?.qrToken],
  ])
  expect((await db.findPackageByQr(labels[1]?.qrToken ?? '')).id).toBe('PK-0090')
  // Một lần ghi chuyến, một sự kiện: không thêm sự kiện riêng cho kiện
  expect((await db.listEvents()).slice(0, 1).map((event) => event.action)).toStrictEqual(['trip.created'])
})

test('editing the lines of a planning trip keeps the pool in step: more instances are created, removed ones go back to IMPORTED', async () => {
  const db = dispatcher()
  const trip = await db.createTrip({ name: 'Tuyến thử', vehicleId: 'VEHICLE-005', stops: STOPS, scheduledDate: '2026-09-15', packages: [line('PKG-001', 2, 1), line('PKG-002', 2, 2)] })
  const tokens = Object.fromEntries((await ofTrip(db, trip.id)).map((pkg) => [pkg.id, pkg.qrToken]))

  // Tăng PKG-001 lên 3, giảm PKG-002 còn 1, đổi kích thước PKG-002 và chuyển PKG-001 sang điểm 2
  await db.updateTrip(trip.id, { packages: [line('PKG-001', 3, 2), line('PKG-002', 1, 2, { lengthCm: 64.5, handlingClass: 'HAZARDOUS' })], overrideReason: 'Khách gom chung một xe' })
  expect((await ofTrip(db, trip.id)).map(brief)).toStrictEqual([
    ['PK-0089', 'PKG-001-01', 'ASSIGNED', 'STOP-02'], ['PK-0090', 'PKG-001-02', 'ASSIGNED', 'STOP-02'], ['PK-0091', 'PKG-002-01', 'ASSIGNED', 'STOP-02'],
    ['PK-0093', 'PKG-001-03', 'ASSIGNED', 'STOP-02'],
  ])
  // Kiện giữ nguyên mã QR khi dòng đổi; kiện thừa về kho kiện, rời chuyến và điểm giao
  expect(await db.getPackage('PK-0091')).toMatchObject({ qrToken: tokens['PK-0091'], lengthCm: 64.5, handlingClass: 'HAZARDOUS', destination: '121 Phạm Văn Thuận, Biên Hoà' })
  expect(await db.getPackage('PK-0089')).toMatchObject({ qrToken: tokens['PK-0089'], destination: '121 Phạm Văn Thuận, Biên Hoà' })
  const released = await db.getPackage('PK-0092')
  expect(released).toMatchObject({ status: 'IMPORTED', source: 'TRIP', qrToken: tokens['PK-0092'], flags: [] })
  expect(released).not.toHaveProperty('tripId')
  expect(released).not.toHaveProperty('stopId')
  expect(released.history.at(-1)).toMatchObject({ kind: 'status', from: 'ASSIGNED', to: 'IMPORTED', tripId: trip.id })

  // Xoá cả dòng PKG-001: ba kiện của dòng về IMPORTED; nhãn của chuyến chỉ còn kiện của PKG-002
  await db.updateTrip(trip.id, { packages: [line('PKG-002', 1, 2, { lengthCm: 64.5, handlingClass: 'HAZARDOUS' })] })
  expect((await ofTrip(db, trip.id)).map((pkg) => pkg.id)).toStrictEqual(['PK-0091'])
  expect((await Promise.all(['PK-0089', 'PK-0090', 'PK-0093'].map((id) => db.getPackage(id)))).map((pkg) => pkg.status)).toStrictEqual(['IMPORTED', 'IMPORTED', 'IMPORTED'])
  expect((await db.listTripLabels(trip.id)).map((label) => label.poolPackageId)).toStrictEqual(['PK-0091'])

  // Sửa tên chuyến không đụng tới kho kiện
  const before = await db.getPackage('PK-0091')
  await db.updateTrip(trip.id, { name: 'Tuyến đổi tên' })
  expect(await db.getPackage('PK-0091')).toStrictEqual(before)
})

test('reordering the stops moves the packages of each line to the stop the line now delivers to', async () => {
  const db = dispatcher()
  const trip = await db.createTrip({ name: 'Tuyến thử', vehicleId: 'VEHICLE-005', stops: STOPS, scheduledDate: '2026-09-15', packages: [line('PKG-001', 1, 1)] })
  // Đảo hai điểm: dòng vẫn giao ở Dĩ An, nay là điểm 2
  await db.updateTrip(trip.id, { stops: [...STOPS].reverse(), packages: [line('PKG-001', 1, 2)] })
  expect(await db.getPackage('PK-0089')).toMatchObject({ stopId: 'STOP-01', destination: '215 Quốc lộ 1K, P. Đông Hoà, Dĩ An', status: 'ASSIGNED' })
})

test('lines of a requirement keep the packages of the requirement; a line whose quantity was edited gets pool packages of its own', async () => {
  const db = dispatcher()
  const trip = await db.createTrip({ name: 'Tuyến thử', vehicleId: 'VEHICLE-005', stops: STOPS, scheduledDate: '2026-09-15', packages: [line('PKG-001', 1, 1)] })
  // REQ-006: mười thùng mì PK-0013…0022 thành dòng PKG-002
  const assigned = await db.assignDeliveryRequirement('REQ-006', trip.id)
  expect((await ofTrip(db, trip.id)).filter((pkg) => pkg.source === 'TRIP').map((pkg) => pkg.id)).toStrictEqual(['PK-0089'])
  expect((await db.listTripLabels(trip.id)).map((label) => label.poolPackageId)).toStrictEqual(['PK-0089', ...assigned.requirement.packageIds])

  // Sửa số lượng dòng của yêu cầu còn 2: dòng mất liên kết với yêu cầu, hai instance được cấp kiện riêng để vẫn có nhãn
  const edited = assigned.trip.packages.map((pkg) => (pkg.id === 'PKG-002' ? { ...pkg, quantity: 2 } : pkg))
  await db.updateTrip(trip.id, { packages: edited })
  expect((await db.listTripLabels(trip.id)).map((label) => [label.packageInstanceId, label.poolPackageId])).toStrictEqual([
    ['PKG-001-01', 'PK-0089'], ['PKG-002-01', 'PK-0090'], ['PKG-002-02', 'PK-0091'],
  ])
  // Gỡ yêu cầu khỏi chuyến gỡ dòng: hai kiện riêng về kho kiện
  await db.unassignDeliveryRequirement('REQ-006')
  expect((await Promise.all(['PK-0090', 'PK-0091'].map((id) => db.getPackage(id)))).map((pkg) => [pkg.status, pkg.tripId])).toStrictEqual([['IMPORTED', undefined], ['IMPORTED', undefined]])
})

test('the pool packages of a hand-entered trip follow it through loading and delivery; a missing one returns flagged', async () => {
  const db = dispatcher()
  // Chuyến chính đã duyệt, 132 kiện nhập tay: kho xếp, báo thiếu một kiện, tài xế giao điểm 1
  const tripId = 'TRIP-2026-0914'
  const labels = await db.listTripLabels(tripId)
  expect(labels).toHaveLength(132)
  expect(new Set(labels.map((label) => label.qrToken)).size).toBe(132)
  const poolIdOf = new Map(labels.map((label) => [label.packageInstanceId, label.poolPackageId]))
  const statusOf = async (instanceId: string) => (await db.getPackage(poolIdOf.get(instanceId) ?? '')).status

  db.restoreSession('US-0003')
  const started = await db.startLoading(tripId)
  const plan = await db.getRevision(started.loading?.revisionId ?? '')
  const order = plan.result.placements.toSorted((a, b) => a.loadingOrder - b.loadingOrder).map((p) => p.packageInstanceId)
  const [first, second, ...rest] = order
  expect(await statusOf(first ?? '')).toBe('STAGED')
  // Quét nhãn của kiện kho kiện xác nhận bước xếp
  await db.confirmLoadingByQr(tripId, labels.find((label) => label.packageInstanceId === first)?.qrToken ?? '')
  await db.recordLoadingStep(tripId, { packageInstanceId: second ?? '', outcome: 'missing' })
  for (const id of rest) await db.recordLoadingStep(tripId, { packageInstanceId: id, outcome: 'loaded' })
  await db.completeLoading(tripId)
  expect(await statusOf(first ?? '')).toBe('LOADED')
  const missing = await db.getPackage(poolIdOf.get(second ?? '') ?? '')
  expect(missing).toMatchObject({ status: 'IMPORTED', flags: ['NOT_FOUND'], source: 'TRIP' })
  expect(missing).not.toHaveProperty('tripId')
  // Nhãn của chuyến vẫn đủ 132 kiện: kiện thiếu giữ mã của nó
  expect(await db.listTripLabels(tripId)).toStrictEqual(labels)

  db.restoreSession('US-0004')
  await db.startDelivery(tripId)
  expect(await statusOf(first ?? '')).toBe('IN_TRANSIT')
})

test('seed trips: every hand-entered instance has a pool package whose status follows the progress of its trip', async () => {
  const db = dispatcher()
  const packages = (await db.listPackages()).filter((pkg) => pkg.source === 'TRIP')
  const trips = await db.listTrips()
  const instances = trips.reduce((sum, trip) => sum + trip.packages.reduce((count, pkg) => count + pkg.quantity, 0), 0)
  expect(packages).toHaveLength(instances)
  expect(packages[0]?.id).toBe('PK-T00001')
  expect(new Set(packages.map((pkg) => pkg.qrToken)).size).toBe(instances)
  for (const trip of trips) expect((await db.listTripLabels(trip.id)).length, trip.id).toBe(trip.packages.reduce((count, pkg) => count + pkg.quantity, 0))

  const statusesOf = (tripId: string) => [...new Set(packages.filter((pkg) => pkg.tripId === tripId).map((pkg) => pkg.status))].toSorted()
  // Nháp, đã duyệt: đã gán chuyến; đang xếp: đã soạn; đã xếp xong: đã xếp; đang giao: đã giao + đang vận chuyển; hoàn thành: đã giao
  expect(statusesOf('TRIP-014')).toStrictEqual(['ASSIGNED'])
  expect(statusesOf('TRIP-2026-0914')).toStrictEqual(['ASSIGNED'])
  expect(statusesOf('TRIP-011')).toStrictEqual(['STAGED'])
  expect(statusesOf('TRIP-010')).toStrictEqual(['LOADED'])
  expect(statusesOf('TRIP-009')).toStrictEqual(['DELIVERED', 'IN_TRANSIT'])
  expect(statusesOf('TRIP-001')).toStrictEqual(['DELIVERED'])
  // Khách từ chối một kiện ở TRIP-007: hoàn trả; hàng móp vẫn nhận ở TRIP-005: đã giao
  expect(statusesOf('TRIP-007')).toStrictEqual(['DELIVERED', 'RETURNED'])
  expect(statusesOf('TRIP-005')).toStrictEqual(['DELIVERED'])
  // Chuyến đã huỷ trả hết kiện về kho kiện; kiện kho báo thiếu của TRIP-003 mang cờ
  expect(statusesOf('TRIP-004')).toStrictEqual([])
  expect(packages.filter((pkg) => pkg.history.some((entry) => entry.kind === 'status' && entry.tripId === 'TRIP-004' && entry.to === 'IMPORTED'))).toHaveLength(170)
  const flagged = packages.filter((pkg) => pkg.flags.includes('NOT_FOUND'))
  expect(flagged.map((pkg) => [pkg.status, pkg.tripId, pkg.history.at(-1)?.kind])).toStrictEqual([['IMPORTED', undefined, 'flagged']])
  expect(flagged[0]?.history.find((entry) => entry.kind === 'status' && entry.to === 'IMPORTED')).toMatchObject({ tripId: 'TRIP-003' })
  // Mã kế tiếp của kho không đổi
  expect((await db.createPackage({ lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 18, handlingClass: 'STANDARD', destination: 'KCN Hoà Khánh' })).id).toBe('PK-0089')
})
