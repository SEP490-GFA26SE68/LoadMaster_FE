import { expect, test } from 'vitest'
import { expandPackages } from '@/domain/cargo'
import { approvalBlockers, createConstraintEngine } from '@/domain/constraints'
import { SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import { cargoPackageSchema, vehicleConfigSchema } from '@/domain/models'
import { createMockDb, isStale, tripStatus } from '@/lib/mock-db'

test('a new database starts with the Spec Truck 6m followed by seven Vietnamese trucks, all valid vehicle configs', async () => {
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

test('the seed spreads 15 trips over 30 days around the anchor day with every status (D-44, D-45)', async () => {
  const db = createMockDb({ today: '2026-09-19' })
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

test('every seeded plan was approved by the dispatcher: the approver on the revision and the actor in the audit log (FE-0-07)', async () => {
  const db = createMockDb()
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

test('twenty-two seeded users cover the ten roles; the history names only real users, newest first', async () => {
  const db = createMockDb()
  const users = await db.listUsers()
  expect(users).toHaveLength(22)
  expect(new Set(users.map((user) => user.role))).toStrictEqual(new Set([
    'systemAdmin', 'systemManager', 'systemSupporter', 'companyAdmin', 'manager', 'dispatcher', 'warehouse', 'driver', 'manufacturer', 'logistics',
  ]))
  expect(users.filter((user) => user.status === 'suspended').map((user) => user.id)).toStrictEqual(['US-0008'])
  const events = await db.listEvents()
  const ids = new Set(users.map((user) => user.id))
  expect(events.length).toBeGreaterThan(100)
  expect(events.filter((event) => event.actorId !== null && !ids.has(event.actorId))).toStrictEqual([])
  expect(events.map((event) => event.at)).toStrictEqual(events.map((event) => event.at).toSorted().toReversed())
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
