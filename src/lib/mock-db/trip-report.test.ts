import { expect, test } from 'vitest'
import { tripReport, type PackageVerification, type Trip, type TripException, type TripReroute } from '@/lib/mock-db'
import { tripRecord, twoCartonRequest, twoCartonResult } from '@/test/mock-db-samples'

/**
 * Báo cáo chuyến theo luồng mới (FE-6-14) — hàm thuần trên một chuyến dựng tay: hai thùng Carton A 30 kg, `PKG-002-01` giao điểm 1,
 * `PKG-001-01` giao điểm 3, điểm 2 không có kiện. Mọi giờ là ngày 15/09/2026 (UTC).
 */
const at = (time: string) => `2026-09-15T${time}:00.000Z`
const PLAN = { request: twoCartonRequest(), result: twoCartonResult() }

const verification = (id: string, context: PackageVerification['context'], packageInstanceId: string, method: PackageVerification['method'], time: string): PackageVerification =>
  ({ id, context, packageInstanceId, method, at: at(time), by: 'US-0003' })

const MANUAL: PackageVerification = {
  ...verification('VF-005', 'UNLOADING', 'PKG-002-01', 'MANUAL', '02:10'), stopNumber: 1, by: 'US-0004',
  manual: { status: 'MANUAL_APPROVED', reason: 'LABEL_DAMAGED', note: 'Nhãn rách khi dỡ', decidedAt: at('02:15'), decidedBy: 'US-0001' },
}

/** Xe rời kho 01:00; điểm 1 hạn 02:00, đến 02:05 (trễ), dỡ một kiện bằng xác nhận tay, hoàn tất 02:20; điểm 2 đến 02:40; điểm 3 hạn 04:00. */
function inTransit(): Trip {
  const record = tripRecord('TRIP-900')
  const [first, second, third] = record.stops
  return {
    ...record,
    phase: 'delivering',
    stops: [{ ...first!, deadline: at('02:00') }, second!, { ...third!, deadline: at('04:00') }],
    routePlan: {
      stops: [
        { stopId: 'STOP-01', eta: at('01:30'), deadlineStatus: 'OK' }, { stopId: 'STOP-02', eta: at('02:10') }, { stopId: 'STOP-03', eta: at('03:50'), deadlineStatus: 'AT_RISK' },
      ],
      missedStopIds: [], totalKm: 62.4, totalMinutes: 215, optimizedAt: '2026-09-14T09:00:00.000Z', optimizedBy: 'US-0001', isMockResult: true,
    },
    overrideReason: 'Khách đồng ý chở chung hàng dễ vỡ với hàng thường',
    loading: {
      revisionId: 'REV-900', startedAt: at('00:00'), startedBy: 'US-0003', completedAt: at('00:40'),
      stagedIds: ['PKG-001-01', 'PKG-002-01'],
      steps: [
        { packageInstanceId: 'PKG-001-01', outcome: 'loaded', at: at('00:20'), via: 'qr' },
        { packageInstanceId: 'PKG-002-01', outcome: 'loaded', at: at('00:30'), via: 'qr' },
      ],
    },
    verifications: [
      verification('VF-001', 'STAGING', 'PKG-001-01', 'QR', '00:05'), verification('VF-002', 'STAGING', 'PKG-002-01', 'QR', '00:06'),
      verification('VF-003', 'LOADING', 'PKG-001-01', 'CODE', '00:20'), verification('VF-004', 'LOADING', 'PKG-002-01', 'QR', '00:30'),
      MANUAL,
    ],
    delivery: {
      startedAt: at('01:00'), startedBy: 'US-0004', issues: [],
      stops: [
        { number: 1, unloadedIds: ['PKG-002-01'], arrivedAt: at('02:05'), completedAt: at('02:20') },
        { number: 2, unloadedIds: [], arrivedAt: at('02:40') },
        { number: 3, unloadedIds: [] },
      ],
    },
  }
}

const EXCEPTION: TripException = {
  id: 'EXC-001', tripId: 'TRIP-900', type: 'VEHICLE_BREAKDOWN', description: 'Xe hỏng hộp số ở Dĩ An', delayMinutes: 120, status: 'ESCALATED', stopNumber: 3,
  reportedAt: at('02:45'), reportedBy: 'US-0004',
  escalation: { reason: 'NO_ROUTE', at: at('02:50'), by: 'US-0001' },
  renegotiation: { requirementId: 'REQ-006', previousDeadline: at('04:00'), deadline: at('06:00'), contactNote: 'Đã gọi chị Hoa', at: at('02:55'), by: 'US-0002' },
}
const REROUTE: TripReroute = { index: 1, route: 'BYPASS', distanceKm: 21.5, durationMinutes: 34, extraMs: 300_000, eta: at('03:20'), stopNumber: 3, confirmedAt: at('02:48'), confirmedBy: 'US-0001' }

test('arrival against the planned time and the deadline, verification methods, manual confirmations, incidents and the override reason', () => {
  const report = tripReport(inTransit(), PLAN, { exceptions: [EXCEPTION], reroutes: [REROUTE] })
  expect(report.stops.map(({ number, planned, unloaded, returned, plannedEta, arrivedAt, deadline, plannedStatus, arrivedOnTime }) =>
    ({ number, planned, unloaded, returned, plannedEta, arrivedAt, deadline, plannedStatus, arrivedOnTime }))).toStrictEqual([
    { number: 1, planned: 1, unloaded: 1, returned: 0, plannedEta: at('01:30'), arrivedAt: at('02:05'), deadline: at('02:00'), plannedStatus: 'OK', arrivedOnTime: false },
    { number: 2, planned: 0, unloaded: 0, returned: 0, plannedEta: at('02:10'), arrivedAt: at('02:40'), deadline: null, plannedStatus: null, arrivedOnTime: null },
    { number: 3, planned: 1, unloaded: 0, returned: 0, plannedEta: at('03:50'), arrivedAt: null, deadline: at('04:00'), plannedStatus: 'AT_RISK', arrivedOnTime: null },
  ])
  expect(report.packages).toStrictEqual({ planned: 2, staged: 2, loaded: 2, damaged: 0, loadedByQr: 2, delivered: 1, returned: 0, withIssue: 0 })
  expect(report.verifications).toStrictEqual({
    STAGING: { QR: 2, CODE: 0, MANUAL: 0 }, LOADING: { QR: 1, CODE: 1, MANUAL: 0 }, UNLOADING: { QR: 0, CODE: 0, MANUAL: 1 }, PICKUP: { QR: 0, CODE: 0, MANUAL: 0 },
  })
  expect(report.manualConfirms).toStrictEqual([MANUAL])
  expect([report.exceptions, report.reroutes]).toStrictEqual([[EXCEPTION], [REROUTE]])
  expect([report.overrideReason, report.cancellation, report.weight]).toStrictEqual([
    'Khách đồng ý chở chung hàng dễ vỡ với hàng thường', null, { plannedKg: 60, deliveredKg: 30 },
  ])
})

test('a package left on the truck when its stop is completed is returned; an arrival before the deadline is on time', () => {
  const trip = inTransit()
  trip.delivery!.stops[2] = { number: 3, unloadedIds: [], arrivedAt: at('03:40'), completedAt: at('03:55') }
  const report = tripReport(trip, PLAN)
  expect(report.stops.map((stop) => [stop.returned, stop.arrivedOnTime])).toStrictEqual([[0, false], [0, null], [1, true]])
  expect([report.packages.delivered, report.packages.returned, report.exceptions, report.reroutes, report.overrideReason]).toStrictEqual([
    1, 1, [], [], 'Khách đồng ý chở chung hàng dễ vỡ với hàng thường',
  ])
})

test('cancelled in transit: packages of stops not completed are returned — even one already unloaded there — and only completed stops count as delivered', () => {
  const trip = inTransit()
  trip.delivery!.stops[2] = { number: 3, unloadedIds: ['PKG-001-01'], arrivedAt: at('03:40') }
  expect(tripReport(trip, PLAN).packages).toMatchObject({ delivered: 2, returned: 0 })
  const cancellation = { at: at('03:45'), by: 'US-0001', reason: 'Xe hỏng, chờ cứu hộ', fromPhase: 'delivering' as const }
  const report = tripReport({ ...trip, phase: 'cancelled', cancellation }, PLAN)
  expect(report.stops.map((stop) => [stop.unloaded, stop.returned])).toStrictEqual([[1, 0], [0, 0], [1, 1]])
  expect([report.completed, report.cancellation, report.packages.delivered, report.packages.returned, report.weight.deliveredKg]).toStrictEqual([false, cancellation, 1, 1, 30])
  // huỷ trước khi xe chạy: không có kiện hoàn trả
  expect(tripReport({ ...trip, delivery: undefined, phase: 'cancelled', cancellation: { ...cancellation, fromPhase: 'loaded' } }, PLAN).packages.returned).toBe(0)
})

test('a trip with no plan, no route and no override: every new figure is empty, none is guessed', () => {
  const report = tripReport(tripRecord('TRIP-901'), undefined)
  expect(report.stops.map(({ plannedEta, arrivedAt, deadline, plannedStatus, arrivedOnTime, returned }) => [plannedEta, arrivedAt, deadline, plannedStatus, arrivedOnTime, returned]))
    .toStrictEqual([[null, null, null, null, null, 0], [null, null, null, null, null, 0], [null, null, null, null, null, 0]])
  expect([report.packages.staged, report.manualConfirms, report.overrideReason, report.cancellation]).toStrictEqual([0, [], null, null])
  expect(report.verifications.UNLOADING).toStrictEqual({ QR: 0, CODE: 0, MANUAL: 0 })
})
