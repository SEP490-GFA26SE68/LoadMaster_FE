import { expect, test, vi } from 'vitest'
import type { TripException, TripLiveStop, TripMonitoring } from '@/lib/mock-db'
import type { MonitoringBoard, MonitoringTrip } from './monitoring-api'
import { monitoringEvents, publish, publishFleet, subscribe } from './monitoring-events'
import { escalationRows, matchesFilter, selectedTripId, tripSummary, worstDeadline } from './monitoring-view'

const trip = (tripId: string, stops: string[]): MonitoringTrip => ({
  tripId, name: `Tuyến ${tripId}`, vehicleName: 'Thaco Ollin 720 · 61C-339.05', driverName: 'Ngô Văn Bảo',
  depot: { name: 'Kho Long Bình', lat: 10.9294, lng: 106.8747 },
  stops: stops.map((name, index) => ({ id: `STOP-0${index + 1}`, number: index + 1, name })),
})
const stop = (number: number, extra: Partial<TripLiveStop> = {}): TripLiveStop => ({ stopId: `STOP-0${number}`, number, eta: `2026-09-14T0${number}:00:00.000Z`, ...extra })
const exception = (id: string, status: TripException['status'], reportedAt: string): TripException => ({
  id, tripId: 'TRIP-A', type: 'TRAFFIC', description: 'Kẹt xe ở ngã tư Vũng Tàu', delayMinutes: 20, status, reportedAt, reportedBy: 'US-0001',
})
const live = (tripId: string, stops: TripLiveStop[], exceptions: TripException[] = []): TripMonitoring => ({
  tripId, location: null, stops, alerts: [], exceptions, refreshMs: 30_000, isMockResult: true,
})

const A = trip('TRIP-A', ['Co.opmart Bình Dương', 'Nhà sách Phương Nam', 'Bếp ăn Sóng Thần'])
const B = trip('TRIP-B', ['Kho Bách Hoá Xanh Dĩ An'])

test('the worst deadline level of the open stops; stops without a deadline do not count', () => {
  expect(worstDeadline([])).toBeNull()
  expect(worstDeadline([stop(1), stop(2)])).toBeNull()
  expect(worstDeadline([stop(1, { deadlineStatus: 'OK' }), stop(2)])).toBe('OK')
  expect(worstDeadline([stop(1, { deadlineStatus: 'MISSED' }), stop(2, { deadlineStatus: 'AT_RISK' }), stop(3, { deadlineStatus: 'OK' })])).toBe('MISSED')
  expect(worstDeadline([stop(1, { deadlineStatus: 'OK' }), stop(2, { deadlineStatus: 'AT_RISK' })])).toBe('AT_RISK')
})

test('a row summarises the next stop, the worst level and the incidents still to handle', () => {
  expect(tripSummary(A, undefined)).toStrictEqual({ next: null, worst: null, activeExceptions: 0, lateRisk: false })
  const summary = tripSummary(A, live('TRIP-A', [stop(2, { arrived: true }), stop(3, { deadline: '2026-09-14T03:10:00.000Z', deadlineStatus: 'AT_RISK' })], [
    exception('EXC-001', 'RESOLVED', '2026-09-14T01:00:00.000Z'), exception('EXC-002', 'OPEN', '2026-09-14T01:30:00.000Z'), exception('EXC-003', 'ESCALATED', '2026-09-14T01:40:00.000Z'),
  ]))
  expect(summary).toStrictEqual({
    next: { stopId: 'STOP-02', number: 2, eta: '2026-09-14T02:00:00.000Z', arrived: true, name: 'Nhà sách Phương Nam' },
    worst: 'AT_RISK', activeExceptions: 2, lateRisk: true,
  })
  expect(tripSummary(B, live('TRIP-B', [stop(1, { deadlineStatus: 'OK' })])).lateRisk).toBe(false)
})

test('the two filters narrow together, and the selected trip falls back to the first visible one', () => {
  const late = { next: null, worst: 'MISSED' as const, activeExceptions: 0, lateRisk: true }
  const incident = { next: null, worst: null, activeExceptions: 1, lateRisk: false }
  expect([late, incident].map((summary) => matchesFilter(summary, { late: false, incidents: false }))).toStrictEqual([true, true])
  expect([late, incident].map((summary) => matchesFilter(summary, { late: true, incidents: false }))).toStrictEqual([true, false])
  expect([late, incident].map((summary) => matchesFilter(summary, { late: false, incidents: true }))).toStrictEqual([false, true])
  expect([late, incident].map((summary) => matchesFilter(summary, { late: true, incidents: true }))).toStrictEqual([false, false])

  expect(selectedTripId([A, B], 'TRIP-B')).toBe('TRIP-B')
  expect(selectedTripId([A, B], 'TRIP-Z')).toBe('TRIP-A')
  expect(selectedTripId([A, B], null)).toBe('TRIP-A')
  expect(selectedTripId([], 'TRIP-A')).toBeNull()
})

test('the manager tab lists escalated incidents oldest first, with the stops that have a deadline — or the next stop when none has', () => {
  const board: MonitoringBoard = { trips: [A, B], userNames: {} }
  const fleet = [
    live('TRIP-A', [stop(2), stop(3)], [exception('EXC-002', 'ESCALATED', '2026-09-14T01:30:00.000Z'), exception('EXC-004', 'OPEN', '2026-09-14T01:50:00.000Z')]),
    live('TRIP-B', [stop(1, { deadline: '2026-09-14T03:10:00.000Z', deadlineStatus: 'MISSED' })], [{ ...exception('EXC-001', 'ESCALATED', '2026-09-14T01:10:00.000Z'), tripId: 'TRIP-B' }]),
    live('TRIP-GONE', [], [exception('EXC-009', 'ESCALATED', '2026-09-14T00:10:00.000Z')]),
  ]
  const rows = escalationRows(board, fleet)
  expect(rows.map((row) => [row.exception.id, row.trip.tripId, row.stops.map((item) => `${item.number}:${item.name}`)])).toStrictEqual([
    ['EXC-001', 'TRIP-B', ['1:Kho Bách Hoá Xanh Dĩ An']],
    ['EXC-002', 'TRIP-A', ['2:Nhà sách Phương Nam']],
  ])
})

test('events between two reads: position, ETA, new alerts, changed incidents and the end of the trip', () => {
  const point = (recordedAt: string) => ({ lat: 10.9, lng: 106.8, speedKmh: 50, heading: 90, recordedAt, source: 'SIMULATED' as const })
  const alert = { eventId: 'EV-000900', at: '2026-09-14T01:00:30.000Z', tripId: 'TRIP-A', stopId: 'STOP-03', stopNumber: 3, status: 'AT_RISK' as const, eta: '2026-09-14T03:00:00.000Z', deadline: '2026-09-14T03:10:00.000Z' }
  const first = { ...live('TRIP-A', [stop(3)], [exception('EXC-001', 'OPEN', '2026-09-14T00:50:00.000Z')]), location: point('2026-09-14T01:00:00.000Z'), alerts: [alert] }
  // lần đọc đầu: vị trí và ETA hiện có, không phát lại cảnh báo và sự cố đã có
  expect(monitoringEvents(undefined, first).map((event) => event.type)).toStrictEqual(['LocationUpdate', 'EtaUpdate'])
  expect(monitoringEvents(first, first)).toStrictEqual([])

  const second = {
    ...first,
    location: point('2026-09-14T01:00:30.000Z'),
    alerts: [alert, { ...alert, eventId: 'EV-000901', status: 'MISSED' as const }],
    exceptions: [exception('EXC-001', 'ESCALATED', '2026-09-14T00:50:00.000Z'), exception('EXC-002', 'OPEN', '2026-09-14T01:00:10.000Z')],
  }
  expect(monitoringEvents(first, second).map((event) => [event.type, 'alert' in event ? event.alert.eventId : 'exception' in event ? event.exception.id : ''])).toStrictEqual([
    ['LocationUpdate', ''], ['EtaRiskAlert', 'EV-000901'], ['ExceptionUpdate', 'EXC-001'], ['ExceptionUpdate', 'EXC-002'],
  ])
  expect(monitoringEvents(second, { ...second, stops: [], refreshMs: null }).map((event) => event.type)).toStrictEqual(['EtaUpdate', 'TripCompleted'])
})

test('subscribeTrip delivers the events of its trip only, until unsubscribed; a trip that leaves the fleet is completed', () => {
  const listener = vi.fn()
  const unsubscribe = subscribe('TRIP-A', listener)
  publish(live('TRIP-B', [stop(1)]))
  expect(listener).not.toHaveBeenCalled()
  publishFleet([live('TRIP-A', [stop(3)]), live('TRIP-B', [stop(1)])])
  expect(listener.mock.calls.map(([event]) => event.type)).toStrictEqual(['EtaUpdate'])
  publishFleet([live('TRIP-B', [stop(1)])])
  expect(listener.mock.calls.map(([event]) => event.type)).toStrictEqual(['EtaUpdate', 'EtaUpdate', 'TripCompleted'])
  // đã kết thúc: không phát lần nữa
  publishFleet([live('TRIP-B', [stop(1)])])
  expect(listener).toHaveBeenCalledTimes(3)
  unsubscribe()
  publish(live('TRIP-A', [stop(2), stop(3)]))
  expect(listener).toHaveBeenCalledTimes(3)
})
