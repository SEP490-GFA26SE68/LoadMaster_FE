import { expect, test } from 'vitest'
import { delaysAfterReroute, REROUTE_CONSTANTS, rerouteOptions, simulateVehicle, type GeoPoint, type SimulationInput } from '@/domain/routing'

/**
 * Số kỳ vọng tính tay như ở `simulate.test.ts` (R = 6.371 km, hệ số đường 1,3, 50 km/h):
 * - A → B dọc vĩ tuyến 10,3°, 0,2° kinh độ: 21,880605 km chim bay = 28,444787 km đường, chạy 2.048.025 ms.
 * - Kho → C dọc kinh tuyến 0,1°: 11,119493 km chim bay = 14,455340 km đường, chạy 1.040.785 ms.
 * - Kho → A (0,3°): 3.122.354 ms.
 */
const DEPOT: GeoPoint = { lat: 10, lng: 106 }
const A: GeoPoint = { lat: 10.3, lng: 106 }
const B: GeoPoint = { lat: 10.3, lng: 106.2 }
const C: GeoPoint = { lat: 10.1, lng: 106 }
const T0 = Date.parse('2026-09-14T01:00:00.000Z')
const MINUTE = 60_000
const at = (offsetMs: number) => new Date(T0 + offsetMs).toISOString()

test('the constants of the mock: a bypass 15 % longer, a ring road 30 % longer, an expressway 50 % longer at 70 km/h for legs from 15 km', () => {
  expect(REROUTE_CONSTANTS).toStrictEqual({
    BYPASS: { distancePercent: 115, speedKmh: 50 },
    RING_ROAD: { distancePercent: 130, speedKmh: 50 },
    HIGHWAY: { distancePercent: 150, speedKmh: 70 },
    HIGHWAY_MIN_KM: 15,
  })
})

test('a long leg gets three options, each with its distance, time, extra time over the straight line and arrival', () => {
  // 28,444787 × 1,15 = 32,71 km · 2.048.025 × 1,15 = 2.355.228,75 ms; × 1,3 = 36,98 km · 2.662.432,5 ms; × 1,5 = 42,67 km · × 15/14 = 2.194.312,5 ms
  expect(rerouteOptions(A, B, at(0))).toStrictEqual([
    { route: 'BYPASS', distanceKm: 32.7, durationMinutes: 39, extraMs: 307_204, eta: at(2_355_229) },
    { route: 'RING_ROAD', distanceKm: 37, durationMinutes: 44, extraMs: 614_408, eta: at(2_662_433) },
    { route: 'HIGHWAY', distanceKm: 42.7, durationMinutes: 37, extraMs: 146_288, eta: at(2_194_313) },
  ])
})

test('a leg shorter than 15 km has no expressway option', () => {
  // 14,455340 × 1,15 = 16,62 km · 1.040.785 × 1,15 = 1.196.902,75 ms; × 1,3 = 18,79 km · 1.353.020,5 ms
  expect(rerouteOptions(DEPOT, C, at(10 * MINUTE))).toStrictEqual([
    { route: 'BYPASS', distanceKm: 16.6, durationMinutes: 20, extraMs: 156_118, eta: at(10 * MINUTE + 1_196_903) },
    { route: 'RING_ROAD', distanceKm: 18.8, durationMinutes: 23, extraMs: 312_236, eta: at(10 * MINUTE + 1_353_021) },
  ])
})

test('taking another route cuts the hold at that moment and adds the extra time of the detour; holds not yet begun are dropped', () => {
  const delays = [{ at: at(5 * MINUTE), minutes: 40 }, { at: at(90 * MINUTE), minutes: 20 }]
  const after = delaysAfterReroute(delays, at(10 * MINUTE), 85_061)
  expect(after).toStrictEqual([{ at: at(5 * MINUTE), minutes: 5 }, { at: at(10 * MINUTE), minutes: 85_061 / 60_000 }])
  // một sự cố đã hết giữ xe thì giữ nguyên; đường vòng không chậm hơn thì không thêm khoảng nào
  expect(delaysAfterReroute([{ at: at(0), minutes: 3 }], at(10 * MINUTE), 0)).toStrictEqual([{ at: at(0), minutes: 3 }])

  // Kho → A mất 3.122.354 ms: đi 5 phút, đứng tới phút 10, đứng thêm 85.061 ms, chạy nốt 2.822.354 ms — tới nơi sau 3.507.415 ms
  const route: SimulationInput = { depot: DEPOT, departureTime: at(0), stops: [{ stopId: 'A', location: A }], delays: after }
  expect(simulateVehicle(route, at(8 * MINUTE))).toMatchObject({ speedKmh: 0, stopId: 'A' })
  expect(simulateVehicle(route, at(3_507_414))).toMatchObject({ speedKmh: 50, stopId: 'A' })
  expect(simulateVehicle(route, at(3_507_415))).toStrictEqual({ lat: 10.3, lng: 106, speedKmh: 0, heading: 0, recordedAt: at(3_507_415), stopId: 'A', arrivedAt: at(3_507_415), drivenMs: 3_122_354 })
  // không đổi tuyến thì xe đứng đủ 40 phút: tới nơi sau 3.122.354 + 2.400.000 ms
  const waiting = { ...route, delays: [{ at: at(5 * MINUTE), minutes: 40 }] }
  expect(simulateVehicle(waiting, at(5_522_353))).toMatchObject({ speedKmh: 50 })
  expect(simulateVehicle(waiting, at(5_522_354))).toMatchObject({ speedKmh: 0, arrivedAt: at(5_522_354) })
})
