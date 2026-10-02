import { expect, test } from 'vitest'
import { expandPackages } from '@/domain/cargo'
import { approvalBlockers, createConstraintEngine } from '@/domain/constraints'
import { SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import { cargoPackageSchema, vehicleConfigSchema } from '@/domain/models'
import { createMockDb, isStale, tripStatus } from '@/lib/mock-db'

/**
 * Kho ở các test này không có phiên, nên không lọc theo công ty (FE-0-02): danh sách gồm dữ liệu của Long Bình rồi tới bộ nhỏ của
 * Phương Nam. Test nào chỉ nói về dữ liệu của Long Bình thì đặt phiên của điều phối viên Long Bình (`restoreSession`, không ghi nhật ký).
 */
const LONG_BINH_DISPATCHER = 'US-0001'

test('a new database starts with the Spec Truck 6m followed by seven Vietnamese trucks of Long Bình and two of Phương Nam, all valid vehicle configs', async () => {
  const vehicles = await createMockDb().listVehicles()
  expect(vehicles.map(({ id, name }) => [id, name])).toStrictEqual([
    ['VEHICLE-001', 'Truck 6m'],
    ['VEHICLE-002', 'Hyundai HD210 · 60C-446.32'],
    ['VEHICLE-003', 'Isuzu NQR 550 · 51C-284.19'],
    ['VEHICLE-004', 'Hino FC9J đông lạnh · 51C-190.07'],
    ['VEHICLE-005', 'Hino XZU720 · 51D-457.88'],
    ['VEHICLE-006', 'Thaco Ollin 720 · 61C-339.05'],
    ['VEHICLE-007', 'Isuzu FVR 900 · 51D-622.14'],
    ['VEHICLE-008', 'Hyundai Mighty EX8 · 50H-118.29'],
    ['VEHICLE-PN-01', 'Isuzu QKR 230 · 51C-907.41'],
    ['VEHICLE-PN-02', 'Hino XZU730 · 51D-318.62'],
  ])
  expect(vehicles[0]).toStrictEqual(SPEC_TRUCK_6M)
  for (const vehicle of vehicles) expect(vehicleConfigSchema.parse(vehicle)).toStrictEqual(vehicle)
})

test('every new database starts from the same seed, with the same ids and data, and keeps its own changes', async () => {
  const first = createMockDb()
  const second = createMockDb()
  expect(await first.listVehicles()).toStrictEqual(await second.listVehicles())
  expect(await first.listTrips()).toStrictEqual(await second.listTrips())
  await first.deleteVehicle('VEHICLE-008')
  expect((await second.listVehicles()).map(({ id }) => id)).toContain('VEHICLE-008')
})

test('the sample trip carries 132 valid package instances to four real stops on the Hyundai HD210', async () => {
  const db = createMockDb()
  expect((await db.listTrips())[0]?.id).toBe('TRIP-2026-0914')
  const trip = await db.getTrip('TRIP-2026-0914')
  expect(trip.vehicleId).toBe('VEHICLE-002')
  // the main trip of the anchor day: assigned to the demo driver, approved and waiting for the warehouse (D-44)
  expect([trip.scheduledDate, trip.driverId, trip.phase]).toStrictEqual(['2026-09-14', 'US-0004', 'planning'])
  expect(trip.inputVersion).toBe(1)
  expect(trip.stops.map(({ name, address }) => [name, address])).toStrictEqual([
    ['Công ty TNHH Thực phẩm Sài Gòn', '12 Nguyễn Văn Linh, Q.7, TP. Hồ Chí Minh'],
    ['Siêu thị Co.opmart Bình Dương', '30 Đại lộ Bình Dương, Thủ Dầu Một'],
    ['Kho Bách Hoá Xanh Dĩ An', '215 Quốc lộ 1K, P. Đông Hoà, Dĩ An'],
    ['Nhà thuốc Long Châu Biên Hoà', '58 Võ Thị Sáu, P. Quyết Thắng, Biên Hoà'],
  ])
  for (const pkg of trip.packages) expect(cargoPackageSchema.parse(pkg)).toStrictEqual(pkg)
  const { instances, issues } = expandPackages(trip.packages)
  expect(issues).toStrictEqual([])
  expect(instances).toHaveLength(132)
  expect(new Set(instances.map(({ deliveryStop }) => deliveryStop))).toStrictEqual(new Set([1, 2, 3, 4]))
  // 38 × 48 + 35 × 52 + 11 × 13.5 + 16 × 45 + 11 × 6.5 + 21 × 60 kg, within the 9,500 kg payload of the HD210
  expect(instances.reduce((sum, { weightKg }) => sum + weightKg, 0)).toBe(5844)
})

test('the sample trip is already optimized by the mock service and approved without edits, so warehouse and driver have data', async () => {
  const db = createMockDb()
  const trip = await db.getTrip('TRIP-2026-0914')
  const [optimized, approved, ...more] = await db.listRevisions(trip.id)
  const seededRequest = optimized?.request
  expect({
    more,
    optimized: optimized && { id: optimized.id, status: optimized.result.status, mock: optimized.result.isMockResult, stale: isStale(optimized, trip) },
    approved: approved && {
      id: approved.id,
      sourceRevisionId: approved.sourceRevisionId,
      approvedAt: approved.approvedAt,
      manuallyEdited: approved.manuallyEdited,
      ordersRecomputed: approved.ordersRecomputed,
      stale: isStale(approved, trip),
    },
    // the approval of an unedited mock result keeps every value: the mock already takes orders and warnings from the domain
    sameResult: approved?.result === undefined ? false : JSON.stringify(approved.result) === JSON.stringify(optimized?.result),
    request: seededRequest && { vehicle: seededRequest.vehicle.id, packages: seededRequest.packages === undefined ? 0 : seededRequest.packages.length },
    accountedFor: (optimized?.result.placements.length ?? 0) + (optimized?.result.unplacedPackages.length ?? 0),
  }).toStrictEqual({
    more: [],
    optimized: { id: 'REV-001', status: 'COMPLETED', mock: true, stale: false },
    approved: { id: 'REV-002', sourceRevisionId: 'REV-001', approvedAt: '2026-09-14T02:00:00.000Z', manuallyEdited: false, ordersRecomputed: true, stale: false },
    sameResult: true,
    request: { vehicle: 'VEHICLE-002', packages: trip.packages.length },
    accountedFor: 132,
  })
  expect(await createMockDb().listRevisions(trip.id)).toStrictEqual(await db.listRevisions(trip.id))
})

test('the seeded approved plan passes the approval check: no engine error and no must-load package left behind', async () => {
  const [, approved] = await createMockDb().listRevisions('TRIP-2026-0914')
  if (approved === undefined) throw new Error('the sample trip has no approved revision')
  const { request, result } = approved
  const { issues } = createConstraintEngine({ ...request, placements: result.placements }).evaluateAll()
  expect(approvalBlockers({ issues, packages: request.packages, unplacedPackages: result.unplacedPackages, stale: false })).toStrictEqual({
    canApprove: true,
    issues: [],
    stale: false,
  })
})

test('the seed of Long Bình spreads 15 trips over 30 days around the anchor day with every status (D-44, D-45)', async () => {
  const db = createMockDb({ today: '2026-09-19' })
  db.restoreSession(LONG_BINH_DISPATCHER)
  const trips = await db.listTrips()
  const statuses = await Promise.all(trips.map(async (trip) => tripStatus(trip, await db.listRevisions(trip.id))))
  const count = (status: string) => statuses.filter((item) => item === status).length
  expect(trips).toHaveLength(15)
  // FE-0-05: đã lập kế hoạch gồm chuyến chính (đã duyệt), TRIP-012 (chờ duyệt), TRIP-013 (lỗi thời); đang xếp hàng gồm TRIP-011, TRIP-010
  expect({
    DELIVERED: count('DELIVERED'), CANCELLED: count('CANCELLED'), IN_TRANSIT: count('IN_TRANSIT'),
    LOADING: count('LOADING'), PLANNED: count('PLANNED'), DRAFT: count('DRAFT'),
  }).toStrictEqual({ DELIVERED: 7, CANCELLED: 1, IN_TRANSIT: 1, LOADING: 2, PLANNED: 3, DRAFT: 1 })
  const dates = trips.map((trip) => trip.scheduledDate).toSorted()
  expect([dates[0], dates.at(-1)]).toStrictEqual(['2026-08-23', '2026-09-21'])
  // the main trip moves with the anchor day
  expect((await db.getTrip('TRIP-2026-0914')).scheduledDate).toBe('2026-09-19')
})

test('every seeded plan passes the constraint engine and places every package', async () => {
  const db = createMockDb()
  for (const trip of await db.listTrips()) {
    for (const { request, result } of await db.listRevisions(trip.id)) {
      const { issues } = createConstraintEngine({ ...request, placements: result.placements }).evaluateAll()
      expect(issues.filter((issue) => issue.severity === 'error'), trip.id).toStrictEqual([])
      expect(result.unplacedPackages, trip.id).toStrictEqual([])
    }
  }
})

test('Phương Nam has a small seed of its own, anchored to the same day, with ids the id generator does not count (FE-0-02)', async () => {
  const db = createMockDb({ today: '2026-09-19' })
  await db.authenticate('dieuphoi@phuongnam.vn', 'loadmaster')
  const trips = await db.listTrips()
  const revisions = await db.listRevisions('TRIP-PN-001')
  expect({
    vehicles: (await db.listVehicles()).map((vehicle) => vehicle.id),
    vehicleTypes: (await db.listVehicleTypeAssignments()),
    packageTypes: (await db.listPackageTypes()).map((type) => [type.id, type.name]),
    packages: (await db.listPackages()).map((pkg) => [pkg.id, pkg.status, pkg.orderId]),
    orders: (await db.listOrders()).map((order) => [order.id, order.status, order.packageIds.length]),
    trips: await Promise.all(trips.map(async (trip) => [trip.id, trip.scheduledDate, trip.driverId, tripStatus(trip, await db.listRevisions(trip.id))])),
    revisions: revisions.map((revision) => [revision.id, revision.approvedBy, revision.result.metrics.placedCount, revision.result.metrics.unplacedCount]),
    runs: (await db.listOptimizationRuns('TRIP-PN-001')).map((run) => [run.id, run.status, run.by]),
  }).toStrictEqual({
    vehicles: ['VEHICLE-PN-01', 'VEHICLE-PN-02'],
    vehicleTypes: [{ vehicleId: 'VEHICLE-PN-01', vehicleTypeId: 'VT-PN-01' }],
    packageTypes: [['PT-PN-01', 'Thùng linh kiện điện tử'], ['PT-PN-02', 'Kiện vải cuộn']],
    // 6 thùng linh kiện (4 thùng đầu thuộc đơn chờ gán) và 4 kiện vải cuộn, đều còn ở kho kiện (FE-3b-01)
    packages: [
      ['PK-PN-0001', 'IMPORTED', 'ORD-PN-001'], ['PK-PN-0002', 'IMPORTED', 'ORD-PN-001'], ['PK-PN-0003', 'IMPORTED', 'ORD-PN-001'],
      ['PK-PN-0004', 'IMPORTED', 'ORD-PN-001'], ['PK-PN-0005', 'IMPORTED', undefined], ['PK-PN-0006', 'IMPORTED', undefined],
      ['PK-PN-0007', 'IMPORTED', undefined], ['PK-PN-0008', 'IMPORTED', undefined], ['PK-PN-0009', 'IMPORTED', undefined],
      ['PK-PN-0010', 'IMPORTED', undefined],
    ],
    orders: [['ORD-PN-001', 'pending', 4]],
    // Chuyến hôm nay đã duyệt, gán tài xế taixe@phuongnam.vn; chuyến ngày mai còn nháp
    trips: [['TRIP-PN-001', '2026-09-19', 'US-PN-04', 'PLANNED'], ['TRIP-PN-002', '2026-09-20', null, 'DRAFT']],
    // 30 thùng linh kiện + 12 kiện vải cuộn xếp đủ; điều phối viên Phương Nam tối ưu rồi duyệt
    revisions: [['REV-PN-001', undefined, 42, 0], ['REV-PN-002', 'US-PN-03', 42, 0]],
    runs: [['RUN-PN-001', 'COMPLETED', 'US-PN-03']],
  })
  // Mã kế tiếp của kho không đổi vì mã `…-PN-…` không tính: các test và E2E vẫn ghi TRIP-015, VEHICLE-009, PT-009, VT-008, ORD-003
  const created = await db.createTrip({ name: 'Tuyến Quận 7', vehicleId: 'VEHICLE-PN-02', scheduledDate: '2026-09-20', packages: [], stops: [] })
  expect([created.id, (await db.createVehicleType({ name: 'Xe tải 1,9 tấn', cargoLengthCm: 360, cargoWidthCm: 170, cargoHeightCm: 170, payloadKg: 1900 })).id])
    .toStrictEqual(['TRIP-015', 'VT-008'])
})

test('every seeded plan of Long Bình was approved by its dispatcher: the approver on the revision and the actor in the audit log (FE-0-07)', async () => {
  const db = createMockDb()
  db.restoreSession(LONG_BINH_DISPATCHER)
  const revisions = (await Promise.all((await db.listTrips()).map((trip) => db.listRevisions(trip.id)))).flat()
  const approved = revisions.filter((revision) => revision.approvedAt !== undefined)
  // 27 seeded revisions: 14 optimizations (every trip but the draft TRIP-014) and 13 approvals (every optimized trip but TRIP-012)
  expect([revisions.length, approved.length]).toStrictEqual([27, 13])
  expect(new Set(approved.map((revision) => revision.approvedBy))).toStrictEqual(new Set(['US-0001']))
  const approvals = (await db.listEvents()).filter((event) => event.action === 'revision.approved')
  expect(approvals.map((event) => event.actorId)).toStrictEqual(approved.map(() => 'US-0001'))
})

test('seeded operations match their trips: warehouse progress, deliveries, issues and one vehicle in maintenance', async () => {
  const db = createMockDb()
  const trips = new Map((await db.listTrips()).map((trip) => [trip.id, trip]))
  expect(trips.get('TRIP-003')?.loading?.steps.filter((step) => step.outcome === 'missing')).toHaveLength(1)
  expect(trips.get('TRIP-005')?.delivery?.issues.map((issue) => issue.kind)).toStrictEqual(['damaged'])
  expect(trips.get('TRIP-007')?.delivery?.issues.map((issue) => issue.kind)).toStrictEqual(['refused'])
  expect(trips.get('TRIP-009')?.delivery?.stops.map((stop) => stop.completedAt !== undefined)).toStrictEqual([true, false, false])
  expect(trips.get('TRIP-011')?.loading?.steps).toHaveLength(110)
  expect(trips.get('TRIP-004')?.cancellation?.reason).not.toBe('')
  const states = await db.listVehicleStates()
  expect(states.filter((state) => state.status === 'maintenance').map((state) => state.vehicleId)).toStrictEqual(['VEHICLE-008'])
  expect(states.filter((state) => state.status === 'in_use').map((state) => [state.vehicleId, state.tripId])).toStrictEqual([
    ['VEHICLE-003', 'TRIP-010'],
    ['VEHICLE-006', 'TRIP-009'],
    ['VEHICLE-007', 'TRIP-011'],
  ])
})

test('twenty seeded users cover the eight roles; the history names only real users, newest first', async () => {
  const db = createMockDb()
  const users = await db.listUsers()
  // FE-0-06: tài khoản nhà sản xuất US-0013 và logistics US-0014 đã bỏ cùng hai vai trò đó; US-0015 ở lại nên mã kế tiếp vẫn là US-0016
  expect(users).toHaveLength(20)
  expect(users.map((user) => user.id).filter((id) => /^US-\d+$/.test(id)).toSorted().slice(-3)).toStrictEqual(['US-0011', 'US-0012', 'US-0015'])
  expect(new Set(users.map((user) => user.role))).toStrictEqual(new Set([
    'systemAdmin', 'systemManager', 'systemSupporter', 'companyAdmin', 'manager', 'dispatcher', 'warehouse', 'driver',
  ]))
  expect(users.filter((user) => user.status === 'suspended').map((user) => user.id)).toStrictEqual(['US-0008'])
  const events = await db.listEvents()
  const ids = new Set(users.map((user) => user.id))
  expect(events.length).toBeGreaterThan(100)
  expect(events.filter((event) => event.actorId !== null && !ids.has(event.actorId))).toStrictEqual([])
  expect(events.filter((event) => event.target.type === 'user' && !ids.has(event.target.id))).toStrictEqual([])
  expect(events.map((event) => event.at)).toStrictEqual(events.map((event) => event.at).toSorted().toReversed())
  // Mỗi công ty tự tạo kiện của mình: bảy đợt của Long Bình (sáu đợt thêm tay, một lần nhập file 16:20 hôm trước) do điều phối viên
  // Long Bình làm, hai đợt của Phương Nam do điều phối viên Phương Nam làm (07:25 ngày neo và hai ngày trước) — mới nhất trước
  expect(events.filter((event) => event.action === 'package.created' || event.action === 'package.importConfirmed').map((event) => [event.actorId, event.companyId])).toStrictEqual([
    ['US-0001', 'LOG-001'], ['US-PN-03', 'LOG-002'], ['US-0001', 'LOG-001'], ['US-0001', 'LOG-001'], ['US-0001', 'LOG-001'],
    ['US-0001', 'LOG-001'], ['US-PN-03', 'LOG-002'], ['US-0001', 'LOG-001'], ['US-0001', 'LOG-001'],
  ])
  // Sự kiện về một tài khoản mang công ty của tài khoản đó (FE-0-08), sự kiện khác mang công ty của người làm; việc của tài khoản nền
  // tảng trên chính tài khoản nền tảng không thuộc công ty nào
  const companyOf = new Map(users.map((user) => [user.id, user.companyId ?? null]))
  const expectedCompany = ({ target, actorId }: (typeof events)[number]) =>
    target.type === 'user' ? companyOf.get(target.id) : actorId === null ? null : companyOf.get(actorId)
  expect(events.filter((event) => event.companyId !== expectedCompany(event))).toStrictEqual([])
  // Bốn việc quản trị hệ thống làm trên tài khoản của Long Bình (tạo ba tài khoản, khoá một) là sự kiện của Long Bình
  expect(events.filter((event) => event.actorId === 'US-0005').map((event) => [event.action, event.target.id, event.companyId])).toStrictEqual([
    ['user.created', 'US-0012', 'LOG-001'], ['user.locked', 'US-0008', 'LOG-001'], ['user.created', 'US-0011', 'LOG-001'], ['user.created', 'US-0010', 'LOG-001'],
  ])
})

test('seeded history keeps the operation order: loading finishes before the delivery starts', async () => {
  const db = createMockDb({ today: '2026-09-19' })
  for (const trip of await db.listTrips()) {
    if (!trip.delivery) continue
    expect(trip.loading?.completedAt, trip.id).toBeDefined()
    expect((trip.loading?.completedAt ?? '') < trip.delivery.startedAt, trip.id).toBe(true)
    const completed = trip.delivery.stops.map((stop) => stop.completedAt).filter((at) => at !== undefined)
    expect(completed.every((at) => at > trip.delivery!.startedAt), trip.id).toBe(true)
  }
})

test('opened before the seeded day has played out, no seeded time lies in the future; order and run dates stay', async () => {
  const early = new Date('2026-09-19T00:30:00+07:00')
  const db = createMockDb({ today: '2026-09-19', now: () => early })
  const late = createMockDb({ today: '2026-09-19', now: () => new Date('2026-09-19T23:00:00+07:00') })
  const events = await db.listEvents()
  expect(events.every((event) => Date.parse(event.at) < early.getTime())).toBe(true)
  // same actions in the same order, all moved by one offset
  const lateEvents = await late.listEvents()
  expect(events.map((event) => [event.id, event.action])).toStrictEqual(lateEvents.map((event) => [event.id, event.action]))
  const offset = Date.parse(lateEvents[0]!.at) - Date.parse(events[0]!.at)
  expect(events.every((event, index) => Date.parse(lateEvents[index]!.at) - Date.parse(event.at) === offset)).toBe(true)
  expect((await db.getTrip('TRIP-2026-0914')).scheduledDate).toBe('2026-09-19')
  const [, approved] = await db.listRevisions('TRIP-2026-0914')
  expect(Date.parse(approved!.approvedAt!)).toBeLessThan(early.getTime())
})
