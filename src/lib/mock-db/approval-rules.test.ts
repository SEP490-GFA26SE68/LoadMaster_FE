import { expect, test } from 'vitest'
import type { PlacementPatch } from '@/domain/constraints'
import { SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import type { OptimizationRequest } from '@/domain/models'
import { createMockDb } from '@/lib/mock-db'
import { runMockOptimization } from '@/services/optimization'
import { optimizedTwoCartonTrip, twoCartonRequest, twoCartonResult, twoCartonTrip } from '@/test/mock-db-samples'

/**
 * Luật duyệt ở kho (FE-5b-08, D-80): kho tự kiểm lại lý do chặn — giao diện bị bỏ qua thì Duyệt vẫn bị từ chối — và đòi xác nhận
 * (`force`) khi tuyến có điểm trễ hạn dự kiến. Lỗi thời và kết quả chưa xong: `approve.test.ts`.
 */

const NOW = new Date('2026-09-14T03:00:00.000Z')

test('a plan that leaves a must-load package behind cannot be approved, with or without force, and nothing is added', async () => {
  const db = createMockDb()
  // Carton A is mustLoad; PKG-002-01 did not fit
  const { trip, revision } = await optimizedTwoCartonTrip(db, {
    ...twoCartonResult(),
    placements: twoCartonResult().placements.slice(0, 1),
    unplacedPackages: [{ packageInstanceId: 'PKG-002-01', reasonCode: 'NO_SPACE', message: 'NO_SPACE' }],
  })
  const blocked = { code: 'APPROVAL_BLOCKED', params: { revisionId: revision.id, count: 1, codes: ['MUST_LOAD_UNPLACED'] } }
  await expect(db.approveRevision(revision.id, [])).rejects.toMatchObject(blocked)
  await expect(db.approveRevision(revision.id, [], { force: true })).rejects.toMatchObject(blocked)
  expect(await db.listRevisions(trip.id)).toStrictEqual([revision])
})

test('a draft that puts one package inside another cannot be approved; the same plan without the draft can', async () => {
  const db = createMockDb()
  const { trip, revision } = await optimizedTwoCartonTrip(db)
  // PKG-001-01 sits at x 120–240; PKG-002-01 dragged from x 240 to x 180 overlaps it by 60 cm — the engine reports the pair once
  const intoNeighbour: PlacementPatch = { packageInstanceId: 'PKG-002-01', xCm: 180, yCm: 0, zCm: 0, orientation: 'LWH' }
  await expect(db.approveRevision(revision.id, [intoNeighbour])).rejects.toMatchObject({
    code: 'APPROVAL_BLOCKED',
    params: { revisionId: revision.id, count: 1, codes: ['OVERLAP'] },
  })
  expect(await db.listRevisions(trip.id)).toStrictEqual([revision])
  expect((await db.approveRevision(revision.id, [])).approvedAt).toBeDefined()
})

test('a plan that overloads an axle group cannot be approved (D-78)', async () => {
  const db = createMockDb()
  const trip = await db.createTrip(twoCartonTrip())
  // 60 kg of cargo centred at x 240, axles at x −120 and x 420: 60 × 360 / 540 = 40 kg on the rear, 20 kg on the front.
  // The front axle already carries 1,800 kg empty and may carry 1,810 kg: 1,820 kg is 10 kg over.
  const request: OptimizationRequest = {
    ...twoCartonRequest(),
    vehicle: {
      ...SPEC_TRUCK_6M,
      axles: [
        { id: 'AXLE-1', name: 'Trục trước', positionXCm: -120, emptyLoadKg: 1800, maxLoadKg: 1810 },
        { id: 'AXLE-2', name: 'Trục sau', positionXCm: 420, emptyLoadKg: 1200, maxLoadKg: 4000 },
      ],
    },
  }
  const revision = await db.addRevision({ tripId: trip.id, request, result: twoCartonResult() })
  await expect(db.approveRevision(revision.id, [])).rejects.toMatchObject({
    code: 'APPROVAL_BLOCKED',
    params: { revisionId: revision.id, count: 1, codes: ['AXLE_OVERLOAD'] },
  })
  expect(await db.listRevisions(trip.id)).toStrictEqual([revision])
})

/**
 * Chuyến một điểm giao từ yêu cầu `REQ-006` (10 thùng mì tới Bách Hoá Xanh Dĩ An), xuất phát 08:00 ngày 16/09 từ Kho Long Bình, đã
 * tối ưu tuyến; `deadlineOf` đặt hạn của yêu cầu theo giờ đến dự kiến của điểm. Revision là kết quả mock trên đúng xe và kiện của chuyến.
 */
async function plannedTrip(deadlineOf: (eta: string) => string) {
  const db = createMockDb({ now: () => NOW })
  db.restoreSession('US-0001')
  const created = await db.createTrip({ name: 'Tuyến Dĩ An', vehicleId: 'VEHICLE-005', scheduledDate: '2026-09-16', packages: [], stops: [] })
  await db.assignDeliveryRequirement('REQ-006', created.id)
  const routed = await db.optimizeTripRoute(created.id)
  await db.updateDeliveryRequirement('REQ-006', { deadline: deadlineOf(routed.routePlan!.stops[0]!.eta) })
  const trip = await db.getTrip(created.id)
  const request: OptimizationRequest = {
    vehicle: await db.getVehicle(trip.vehicleId),
    packages: trip.packages,
    settings: { method: 'MOCK', timeLimitSeconds: 30, randomSeed: 20_260_916, enforceLifo: true, prioritizeLowCenterOfGravity: false },
  }
  const revision = await db.addRevision({ tripId: trip.id, request, result: runMockOptimization(request, { clock: () => 0 }) })
  return { db, trip, revision }
}

test('a trip with a stop arriving after its deadline is approved only when the approver confirms (force); the event records the late stop', async () => {
  // Xe rời kho 08:00 (01:00 UTC); hạn 08:01 sớm hơn mọi giờ đến
  const { db, trip, revision } = await plannedTrip(() => '2026-09-16T08:01:00+07:00')
  expect([trip.routePlan?.stops.map((stop) => stop.deadlineStatus), trip.routePlan?.missedStopIds]).toStrictEqual([['MISSED'], ['STOP-01']])
  await expect(db.approveRevision(revision.id, [])).rejects.toMatchObject({
    code: 'LATE_STOPS_UNCONFIRMED',
    params: { tripId: trip.id, stopIds: ['STOP-01'], stopNumbers: [1] },
  })
  await expect(db.approveRevision(revision.id, [], { force: false })).rejects.toMatchObject({ code: 'LATE_STOPS_UNCONFIRMED' })
  expect(await db.listRevisions(trip.id)).toStrictEqual([revision])

  const approved = await db.approveRevision(revision.id, [], { force: true })
  expect([approved.approvedAt, approved.approvedBy, approved.sourceRevisionId]).toStrictEqual(['2026-09-14T03:00:00.000Z', 'US-0001', revision.id])
  const [event] = await db.listEvents({ targetId: trip.id })
  expect([event?.action, event?.params]).toStrictEqual([
    'revision.approved',
    { revisionId: approved.id, sourceRevisionId: revision.id, edits: 0, lateStops: 1 },
  ])
})

test('a stop close to its deadline does not ask for a confirmation, and force on a trip without late stops records nothing extra', async () => {
  // Hạn sau giờ đến 10 phút: trong ngưỡng 30 phút của "sát hạn"
  const { db, trip, revision } = await plannedTrip((eta) => new Date(Date.parse(eta) + 10 * 60_000).toISOString())
  expect([trip.routePlan?.stops.map((stop) => stop.deadlineStatus), trip.routePlan?.missedStopIds]).toStrictEqual([['AT_RISK'], []])
  const approved = await db.approveRevision(revision.id, [])
  const forced = await db.approveRevision(revision.id, [], { force: true })
  const events = await db.listEvents({ targetId: trip.id })
  expect(events.slice(0, 2).map((event) => event.params)).toStrictEqual([
    { revisionId: forced.id, sourceRevisionId: revision.id, edits: 0 },
    { revisionId: approved.id, sourceRevisionId: revision.id, edits: 0 },
  ])
})

test('the seeded plans awaiting approval pass the rules of the store as they are', async () => {
  const db = createMockDb({ now: () => NOW })
  // REV-001: bản nguồn của chuyến chính; REV-025: chuyến TRIP-012 đã tối ưu, chưa duyệt
  expect((await db.approveRevision('REV-001', [])).sourceRevisionId).toBe('REV-001')
  expect((await db.approveRevision('REV-025', [])).sourceRevisionId).toBe('REV-025')
})
