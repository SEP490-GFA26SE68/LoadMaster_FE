import { expect, test } from 'vitest'
import type { Trip, TripMonitoring } from '@/lib/mock-db'
import { stopListTimings } from './stop-timing'

/**
 * Giờ của từng điểm trong hai danh sách điểm của tài xế (`stopListTimings`): cùng luật với thẻ liên hệ (`stopTiming`). Chuyến viết tay,
 * giờ là chữ số viết sẵn — hàm chỉ chọn giờ nào nói ở điểm nào, không tính giờ.
 */

const D2 = '2026-09-16T02:00:00.000Z'
const D3 = '2026-09-16T02:30:00.000Z'

const STOPS: Trip['stops'] = [
  { id: 'STOP-01', name: 'Bách Hoá Xanh Thủ Đức', address: 'Thủ Đức' },
  { id: 'STOP-02', name: 'MM Mega Market An Phú', address: 'An Phú', deadline: D2 },
  { id: 'STOP-03', name: 'Circle K Phan Xích Long', address: 'Phú Nhuận', deadline: D3 },
]

const ROUTE: NonNullable<Trip['routePlan']> = {
  stops: [
    { stopId: 'STOP-01', eta: '2026-09-16T01:24:50.848Z' },
    { stopId: 'STOP-02', eta: '2026-09-16T01:48:28.525Z', deadlineStatus: 'OK' },
    { stopId: 'STOP-03', eta: '2026-09-16T02:13:54.549Z', deadlineStatus: 'AT_RISK' },
  ],
  missedStopIds: [], totalKm: 32.6, totalMinutes: 74, optimizedAt: '2026-09-15T09:00:00.000Z', optimizedBy: 'US-0001', isMockResult: true,
}

/** Đang giao: điểm 1 đã hoàn tất, tài xế bấm "Đã đến" điểm 2 lúc `arrivedAt`. */
function inTransit(arrivedAt: string): Pick<Trip, 'stops' | 'routePlan' | 'delivery'> {
  return {
    stops: STOPS,
    routePlan: ROUTE,
    delivery: {
      startedAt: '2026-09-16T01:00:00.000Z', startedBy: 'US-0004', issues: [],
      stops: [
        { number: 1, unloadedIds: ['PKG-001-01'], arrivedAt: '2026-09-16T01:25:00.000Z', completedAt: '2026-09-16T01:40:00.000Z' },
        { number: 2, unloadedIds: [], arrivedAt },
        { number: 3, unloadedIds: [] },
      ],
    },
  }
}

const VEHICLE = { lat: 10.8012, lng: 106.7412, speedKmh: 0, heading: 194, recordedAt: '2026-09-16T02:06:00.000Z' }

test('a trip waiting to depart: every stop expects the time of the route plan, a status only where the stop has a deadline, and one source', () => {
  const { byStop, sources } = stopListTimings({ stops: STOPS, routePlan: ROUTE }, undefined)
  expect([...byStop]).toStrictEqual([
    [1, { deadline: undefined, arrival: undefined, expected: { eta: '2026-09-16T01:24:50.848Z', source: 'PLAN', status: undefined } }],
    [2, { deadline: D2, arrival: undefined, expected: { eta: '2026-09-16T01:48:28.525Z', source: 'PLAN', status: 'OK' } }],
    [3, { deadline: D3, arrival: undefined, expected: { eta: '2026-09-16T02:13:54.549Z', source: 'PLAN', status: 'AT_RISK' } }],
  ])
  expect(sources).toStrictEqual(['PLAN'])
})

test('in transit: a completed stop has no time, the stop the driver reached has the actual time, later stops expect the time from the vehicle position', () => {
  const live: Pick<TripMonitoring, 'location' | 'stops'> = {
    location: { ...VEHICLE, source: 'SIMULATED' },
    stops: [
      { stopId: 'STOP-02', number: 2, eta: '2026-09-16T02:05:00.000Z', arrived: true, deadline: D2 },
      { stopId: 'STOP-03', number: 3, eta: '2026-09-16T02:40:00.000Z', deadlineStatus: 'MISSED', deadline: D3 },
    ],
  }
  // Tới điểm 2 lúc 02:05, hạn 02:00: đến trễ hạn
  const { byStop, sources } = stopListTimings(inTransit('2026-09-16T02:05:00.000Z'), live)
  expect([...byStop]).toStrictEqual([
    [2, { deadline: D2, arrival: { at: '2026-09-16T02:05:00.000Z', onTime: false }, expected: undefined }],
    [3, { deadline: D3, arrival: undefined, expected: { eta: '2026-09-16T02:40:00.000Z', source: 'SIMULATED', status: 'MISSED' } }],
  ])
  expect(sources).toStrictEqual(['SIMULATED'])
  // Tới đúng hạn vẫn là kịp hạn
  expect(stopListTimings(inTransit(D2), live).byStop.get(2)?.arrival).toStrictEqual({ at: D2, onTime: true })
})

test('in transit without a vehicle position the expected times stay those of the route plan', () => {
  const { byStop, sources } = stopListTimings(inTransit(D2), { location: null, stops: [] })
  expect(byStop.get(3)?.expected).toStrictEqual({ eta: '2026-09-16T02:13:54.549Z', source: 'PLAN', status: 'AT_RISK' })
  expect(sources).toStrictEqual(['PLAN'])
})

test('a stop the vehicle position does not cover keeps the plan, and the list names both sources in stop order', () => {
  const live: Pick<TripMonitoring, 'location' | 'stops'> = {
    location: { ...VEHICLE, source: 'GPS' },
    stops: [{ stopId: 'STOP-01', number: 1, eta: '2026-09-16T01:31:00.000Z' }],
  }
  const { byStop, sources } = stopListTimings({ stops: STOPS, routePlan: ROUTE }, live)
  expect([...byStop].map(([number, timing]) => [number, timing.expected?.source, timing.expected?.eta])).toStrictEqual([
    [1, 'GPS', '2026-09-16T01:31:00.000Z'],
    [2, 'PLAN', '2026-09-16T01:48:28.525Z'],
    [3, 'PLAN', '2026-09-16T02:13:54.549Z'],
  ])
  expect(sources).toStrictEqual(['GPS', 'PLAN'])
})

test('a trip whose route was never optimised has no time anywhere, not even for the stop the driver reached', () => {
  const { stops, delivery } = inTransit(D2)
  expect(stopListTimings({ stops, delivery }, undefined)).toStrictEqual({ byStop: new Map(), sources: [] })
})
