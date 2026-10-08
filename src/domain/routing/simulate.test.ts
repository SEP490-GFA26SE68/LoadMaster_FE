import { describe, expect, test } from 'vitest'
import { liveEta, positionTimes, routeEta, SIMULATION_CONSTANTS, simulateVehicle, type GeoPoint, type SimulationInput } from '@/domain/routing'

/**
 * Số kỳ vọng tính tay, không dùng haversine của code đang test (AGENTS mục 9), R = 6.371 km, hệ số đường 1,3, 50 km/h:
 * - Kho → A đi dọc kinh tuyến 0,3°: cung = R × 0,3° × π/180 = 33,358478 km → 33,358478 × 1,3 ÷ 50 giờ = 3.122.354 ms (52 phút 2,354 giây).
 * - A → B đi dọc vĩ tuyến 10,3°, 0,2° kinh độ: định lý cos cầu cho 21,880605 km → 2.048.025 ms (34 phút 8,025 giây).
 * - Nửa chặng đầu (0,15°): 1.561.177 ms. Từ (10,3; 106,05) tới B: 1.536.018 ms.
 * Vị trí giữa chặng là nội suy tuyến tính của toạ độ (đường nối thẳng), làm tròn 6 chữ số lẻ.
 */
const DEPOT: GeoPoint = { lat: 10, lng: 106 }
const A: GeoPoint = { lat: 10.3, lng: 106 }
const B: GeoPoint = { lat: 10.3, lng: 106.2 }
const LEG_1 = 3_122_354
const LEG_2 = 2_048_025
const MINUTE = 60_000
const T0 = Date.parse('2026-09-14T01:00:00.000Z')
const at = (offsetMs: number) => new Date(T0 + offsetMs).toISOString()

const ROUTE: SimulationInput = {
  depot: DEPOT,
  departureTime: at(0),
  stops: [{ stopId: 'A', location: A }, { stopId: 'B', location: B }],
}

test('one position point every 30 simulated seconds', () => {
  expect(SIMULATION_CONSTANTS).toStrictEqual({ POSITION_INTERVAL_SECONDS: 30 })
  expect(positionTimes(at(0), at(95_000))).toStrictEqual([at(0), at(30_000), at(60_000), at(90_000)])
  // điểm thứ 3 trở đi, tới đúng mốc 2 phút
  expect(positionTimes(at(0), at(120_000), 3)).toStrictEqual([at(90_000), at(120_000)])
  expect(positionTimes(at(0), at(-1))).toStrictEqual([])
})

describe('a vehicle left to the schedule: straight legs at 50 km/h, 15 minutes at each stop', () => {
  test('leaves the depot at the departure time, heading for the first stop', () => {
    expect(simulateVehicle(ROUTE, at(0))).toStrictEqual({ lat: 10, lng: 106, speedKmh: 50, heading: 0, recordedAt: at(0), stopId: 'A', drivenMs: 0 })
  })

  test('before the departure time it stands at the depot', () => {
    expect(simulateVehicle(ROUTE, at(-5 * MINUTE))).toStrictEqual({ lat: 10, lng: 106, speedKmh: 0, heading: 0, recordedAt: at(-5 * MINUTE), stopId: 'A', drivenMs: 0 })
  })

  test('half the travel time of a leg is half the way', () => {
    expect(simulateVehicle(ROUTE, at(LEG_1 / 2))).toStrictEqual({ lat: 10.15, lng: 106, speedKmh: 50, heading: 0, recordedAt: at(LEG_1 / 2), stopId: 'A', drivenMs: LEG_1 / 2 })
    // 10 phút: 600.000 / 3.122.354 của 0,3° = 0,057649°
    expect(simulateVehicle(ROUTE, at(10 * MINUTE))).toMatchObject({ lat: 10.057649, lng: 106, speedKmh: 50 })
  })

  test('stands at the stop for 15 minutes from the moment it arrives', () => {
    const standing = { lat: 10.3, lng: 106, speedKmh: 0, heading: 0, stopId: 'A', arrivedAt: at(LEG_1), drivenMs: LEG_1 }
    expect(simulateVehicle(ROUTE, at(LEG_1))).toStrictEqual({ ...standing, recordedAt: at(LEG_1) })
    expect(simulateVehicle(ROUTE, at(LEG_1 + 15 * MINUTE - 1))).toStrictEqual({ ...standing, recordedAt: at(LEG_1 + 15 * MINUTE - 1) })
  })

  test('then drives the next leg, due east', () => {
    const leftA = LEG_1 + 15 * MINUTE
    expect(simulateVehicle(ROUTE, at(leftA))).toStrictEqual({ lat: 10.3, lng: 106, speedKmh: 50, heading: 90, recordedAt: at(leftA), stopId: 'B', drivenMs: 0 })
    expect(simulateVehicle(ROUTE, at(leftA + LEG_2 / 4))).toMatchObject({ lat: 10.3, lng: 106.05, speedKmh: 50, heading: 90, stopId: 'B' })
  })

  test('stays at the last stop of the route', () => {
    const arrived = LEG_1 + 15 * MINUTE + LEG_2
    const standing = { lat: 10.3, lng: 106.2, speedKmh: 0, heading: 90, stopId: 'B', arrivedAt: at(arrived), drivenMs: LEG_2 }
    expect(simulateVehicle(ROUTE, at(arrived))).toStrictEqual({ ...standing, recordedAt: at(arrived) })
    expect(simulateVehicle(ROUTE, at(arrived + 600 * MINUTE))).toStrictEqual({ ...standing, recordedAt: at(arrived + 600 * MINUTE) })
  })

  test('a route without stops keeps the vehicle at the depot', () => {
    expect(simulateVehicle({ ...ROUTE, stops: [] }, at(MINUTE))).toStrictEqual({ lat: 10, lng: 106, speedKmh: 0, heading: 0, recordedAt: at(MINUTE), stopId: null, drivenMs: 0 })
  })
})

describe('an incident stops the vehicle for exactly its delay', () => {
  const delayed: SimulationInput = { ...ROUTE, delays: [{ at: at(10 * MINUTE), minutes: 45 }] }

  test('the vehicle stands where it was for the whole delay, then goes on', () => {
    expect(simulateVehicle(delayed, at(10 * MINUTE))).toMatchObject({ lat: 10.057649, lng: 106, speedKmh: 0, stopId: 'A' })
    expect(simulateVehicle(delayed, at(30 * MINUTE))).toMatchObject({ lat: 10.057649, lng: 106, speedKmh: 0 })
    expect(simulateVehicle(delayed, at(55 * MINUTE))).toMatchObject({ lat: 10.057649, lng: 106, speedKmh: 50 })
    // nửa chặng tính theo thời gian chạy: muộn đúng 45 phút
    expect(simulateVehicle(delayed, at(LEG_1 / 2 + 45 * MINUTE))).toMatchObject({ lat: 10.15, lng: 106, speedKmh: 50 })
  })

  test('it arrives exactly 45 minutes later', () => {
    expect(simulateVehicle(delayed, at(LEG_1 + 45 * MINUTE - 1))).toMatchObject({ speedKmh: 50, stopId: 'A' })
    expect(simulateVehicle(delayed, at(LEG_1 + 45 * MINUTE))).toMatchObject({ lat: 10.3, lng: 106, speedKmh: 0, arrivedAt: at(LEG_1 + 45 * MINUTE) })
  })

  test('two incidents that overlap add up: each one costs its own minutes', () => {
    const twice: SimulationInput = { ...ROUTE, delays: [{ at: at(10 * MINUTE), minutes: 45 }, { at: at(20 * MINUTE), minutes: 10 }] }
    expect(simulateVehicle(twice, at(64 * MINUTE))).toMatchObject({ lat: 10.057649, speedKmh: 0 })
    expect(simulateVehicle(twice, at(LEG_1 + 55 * MINUTE))).toMatchObject({ lat: 10.3, speedKmh: 0, arrivedAt: at(LEG_1 + 55 * MINUTE) })
  })

  test('an incident while the vehicle stands at a stop makes it leave that much later', () => {
    const atStop: SimulationInput = { ...ROUTE, delays: [{ at: at(LEG_1 + 5 * MINUTE), minutes: 20 }] }
    expect(simulateVehicle(atStop, at(LEG_1 + 34 * MINUTE))).toMatchObject({ lat: 10.3, lng: 106, speedKmh: 0, stopId: 'A' })
    expect(simulateVehicle(atStop, at(LEG_1 + 35 * MINUTE))).toMatchObject({ lat: 10.3, lng: 106, speedKmh: 50, stopId: 'B' })
  })
})

describe('what the driver did overrides the schedule', () => {
  test('"arrived" puts the vehicle at the stop, even when the simulated vehicle was still on the road', () => {
    const arrived: SimulationInput = { ...ROUTE, stops: [{ stopId: 'A', location: A, arrivedAt: at(20 * MINUTE) }, { stopId: 'B', location: B }] }
    expect(simulateVehicle(arrived, at(20 * MINUTE - 1))).toMatchObject({ speedKmh: 50, stopId: 'A' })
    expect(simulateVehicle(arrived, at(20 * MINUTE))).toStrictEqual({ lat: 10.3, lng: 106, speedKmh: 0, heading: 0, recordedAt: at(20 * MINUTE), stopId: 'A', arrivedAt: at(20 * MINUTE), drivenMs: LEG_1 })
  })

  test('a late "arrived" does not move the vehicle back onto the road: it has been standing there, the arrival time is the driver\'s', () => {
    const late: SimulationInput = { ...ROUTE, stops: [{ stopId: 'A', location: A, arrivedAt: at(LEG_1 + 5 * MINUTE), completedAt: at(LEG_1 + 40 * MINUTE) }, { stopId: 'B', location: B }] }
    expect(simulateVehicle(late, at(LEG_1 + MINUTE))).toMatchObject({ lat: 10.3, speedKmh: 0, arrivedAt: at(LEG_1) })
    expect(simulateVehicle(late, at(LEG_1 + 6 * MINUTE))).toMatchObject({ lat: 10.3, speedKmh: 0, arrivedAt: at(LEG_1 + 5 * MINUTE) })
  })

  test('the vehicle leaves a stop when the driver completes it, not after 15 minutes', () => {
    const completed: SimulationInput = { ...ROUTE, stops: [{ stopId: 'A', location: A, completedAt: at(LEG_1 + 70 * MINUTE) }, { stopId: 'B', location: B }] }
    expect(simulateVehicle(completed, at(LEG_1 + 69 * MINUTE))).toMatchObject({ lat: 10.3, lng: 106, speedKmh: 0, stopId: 'A' })
    expect(simulateVehicle(completed, at(LEG_1 + 70 * MINUTE + LEG_2 / 2))).toMatchObject({ lat: 10.3, lng: 106.1, speedKmh: 50, stopId: 'B' })
  })

  test('a stop completed before the simulated vehicle got there: the vehicle is put at the stop and leaves at once', () => {
    const early: SimulationInput = { ...ROUTE, stops: [{ stopId: 'A', location: A, completedAt: at(30 * MINUTE) }, { stopId: 'B', location: B }] }
    expect(simulateVehicle(early, at(30 * MINUTE))).toMatchObject({ lat: 10.3, lng: 106, speedKmh: 50, heading: 90, stopId: 'B' })
  })

  test('after the last stop is completed the route is over', () => {
    const done: SimulationInput = { ...ROUTE, stops: [{ stopId: 'A', location: A, completedAt: at(60 * MINUTE) }] }
    expect(simulateVehicle(done, at(61 * MINUTE))).toStrictEqual({ lat: 10.3, lng: 106, speedKmh: 0, heading: 0, recordedAt: at(61 * MINUTE), stopId: null, drivenMs: LEG_1 })
  })
})

describe('live ETA from the vehicle position (D-76 from where the vehicle is)', () => {
  const stops = [
    { stopId: 'A', location: A, deadline: at(45 * MINUTE) },
    { stopId: 'B', location: B },
  ]

  test('travel from the position to the next stop, then 15 minutes and the next leg', () => {
    // từ (10,15; 106): 1.561.177 ms tới A; rồi 15 phút + 2.048.025 ms tới B
    expect(liveEta({ position: { lat: 10.15, lng: 106 }, at: at(0), stops })).toStrictEqual([
      { stopId: 'A', eta: at(1_561_177), deadlineStatus: 'AT_RISK' },
      { stopId: 'B', eta: at(1_561_177 + 15 * MINUTE + LEG_2) },
    ])
  })

  test('standing at the first stop: its ETA is the arrival, the next one counts 15 minutes from it', () => {
    expect(liveEta({ position: A, at: at(40 * MINUTE), stops: [{ ...stops[0]!, arrivedAt: at(35 * MINUTE) }, stops[1]!] })).toStrictEqual([
      { stopId: 'A', eta: at(35 * MINUTE), deadlineStatus: 'AT_RISK', arrived: true },
      { stopId: 'B', eta: at(50 * MINUTE + LEG_2) },
    ])
  })

  test('standing longer than 15 minutes: the next stop slips with the clock', () => {
    expect(liveEta({ position: A, at: at(80 * MINUTE), stops: [{ ...stops[0]!, arrivedAt: at(35 * MINUTE) }, stops[1]!] })[1]).toStrictEqual({ stopId: 'B', eta: at(80 * MINUTE + LEG_2) })
  })

  test('no stop left: nothing to estimate', () => {
    expect(liveEta({ position: A, at: at(0), stops: [] })).toStrictEqual([])
  })

  test('an incident of 45 minutes moves the ETA by exactly 45 minutes, not 90: the vehicle already stood still', () => {
    const delayed: SimulationInput = { ...ROUTE, delays: [{ at: at(10 * MINUTE), minutes: 45 }] }
    const etaAt = (input: SimulationInput, offsetMs: number) => {
      const { lat, lng, recordedAt } = simulateVehicle(input, at(offsetMs))
      return Date.parse(liveEta({ position: { lat, lng }, at: recordedAt, stops })[0]!.eta)
    }
    const before = etaAt(delayed, 10 * MINUTE)
    // giữa lúc đứng: trễ đúng bằng thời gian đã đứng; hết sự cố: trễ đúng 45 phút
    expect(etaAt(delayed, 30 * MINUTE) - before).toBe(20 * MINUTE)
    expect(etaAt(delayed, 55 * MINUTE) - before).toBe(45 * MINUTE)
    // chạy tiếp: ETA đứng yên (sai số làm tròn vị trí dưới một giây), không cộng thêm phút chậm lần nữa
    expect(Math.abs(etaAt(delayed, 80 * MINUTE) - before - 45 * MINUTE)).toBeLessThan(1000)
    expect(Math.abs(before - (T0 + LEG_1))).toBeLessThan(1000)
  })
})

describe('mandatory driver rest (FE-BL-04): planned ETA, live ETA and the simulated vehicle agree', () => {
  // Dọc xích đạo 2,5° = 277,987317 km → 26.019.613 ms (433,7 phút): lái 4 giờ, nghỉ 15 phút, lái nốt 11.619.613 ms
  const FAR: GeoPoint = { lat: 0, lng: 2.5 }
  const trip: SimulationInput = { depot: { lat: 0, lng: 0 }, departureTime: at(0), stops: [{ stopId: 'FAR', location: FAR }] }
  const TRAVEL = 26_019_613
  const FOUR_HOURS = 240 * MINUTE
  const planned = Date.parse(routeEta({ depot: trip.depot, departureTime: trip.departureTime, stops: [{ stopId: 'FAR', location: FAR }] }, ['FAR']).stops[0]!.eta)

  test('the planned ETA counts the rest; the vehicle arrives at that very moment, not earlier', () => {
    expect(planned).toBe(T0 + TRAVEL + 15 * MINUTE)
    expect(simulateVehicle(trip, at(planned - T0 - 1))).toMatchObject({ speedKmh: 50, stopId: 'FAR' })
    expect(simulateVehicle(trip, at(planned - T0))).toMatchObject({ speedKmh: 0, stopId: 'FAR', arrivedAt: at(planned - T0), drivenMs: TRAVEL - FOUR_HOURS })
  })

  test('the vehicle stands still for the whole rest, then goes on with the counter back at zero', () => {
    const resting = simulateVehicle(trip, at(FOUR_HOURS + 5 * MINUTE))
    // 4 giờ lái = 4 giờ / 433,66 phút của chặng, trên cung 2,5°
    expect(resting).toMatchObject({ lat: 0, speedKmh: 0, stopId: 'FAR', drivenMs: FOUR_HOURS, restEndsAt: at(FOUR_HOURS + 15 * MINUTE) })
    expect(resting.lng).toBeCloseTo((2.5 * FOUR_HOURS) / TRAVEL, 5)
    expect(simulateVehicle(trip, at(FOUR_HOURS + 15 * MINUTE))).toMatchObject({ speedKmh: 50, drivenMs: 0 })
  })

  test('the live ETA from the vehicle position, before and during the rest, is the planned ETA', () => {
    const eta = (offsetMs: number) => {
      const { lat, lng, recordedAt, drivenMs, restEndsAt } = simulateVehicle(trip, at(offsetMs))
      return Date.parse(liveEta({ position: { lat, lng }, at: recordedAt, drivenMs, ...(restEndsAt === undefined ? {} : { restEndsAt }), stops: [{ stopId: 'FAR', location: FAR }] })[0]!.eta)
    }
    // sai số làm tròn vị trí (6 chữ số lẻ) dưới một giây
    expect(Math.abs(eta(100 * MINUTE) - planned)).toBeLessThan(1000)
    expect(Math.abs(eta(FOUR_HOURS + 5 * MINUTE) - planned)).toBeLessThan(1000)
    expect(Math.abs(eta(FOUR_HOURS + 20 * MINUTE) - planned)).toBeLessThan(1000)
  })
})
