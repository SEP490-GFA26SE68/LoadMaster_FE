import { expect, test } from 'vitest'
import { deadlineStatus } from '@/domain/routing'
import { hoursMinutes, projectPoints, roleCargo, roleRoute, zonePlaceOf } from './roles-model'

test('the sample route is computed by the routing domain and always gives the same times', () => {
  const route = roleRoute()

  // Giờ đến của từng điểm: số đã chạy thử bằng máy trên tuyến mẫu (xuất phát 05:00 giờ Việt Nam).
  expect(route.stops.map((stop) => stop.eta.slice(0, 16))).toEqual([
    '2026-09-14T02:19',
    '2026-09-14T03:42',
    '2026-09-14T05:26',
    '2026-09-14T08:07',
  ])
  expect(route.totalKm).toBe(455.9)
  expect(route.totalMinutes).toBe(622)
})

test('the three deadline levels all appear, and each one is what the domain says for that stop', () => {
  const route = roleRoute()

  expect(route.stops.map((stop) => stop.status)).toEqual(['OK', 'AT_RISK', 'OK', 'MISSED'])
  for (const stop of route.stops) expect(stop.status).toBe(deadlineStatus(stop.eta, stop.deadline))
  expect(route.lateCount).toBe(1)
})

test('the first leg is longer than four hours of driving, so the route has one mandatory rest', () => {
  const route = roleRoute()

  expect(route.restCount).toBe(1)
  expect(route.restMinutes).toBe(15)
})

test('the simulated vehicle is on the first leg, between the depot and stop 1', () => {
  const route = roleRoute()

  const first = route.stops.at(0)?.at ?? { x: Number.NaN, y: Number.NaN }

  expect(route.headingTo).toBe(1)
  expect(route.vehicle.x).toBeGreaterThan(first.x)
  expect(route.vehicle.x).toBeLessThan(route.depot.x)
  expect(route.vehicle.y).toBeGreaterThan(route.depot.y)
  expect(route.vehicle.y).toBeLessThan(first.y)
})

test('points are projected into the unit box, north up and east to the right', () => {
  const [a, b, c] = projectPoints([
    { lat: 10, lng: 105 },
    { lat: 11, lng: 107 },
    { lat: 10.5, lng: 106 },
  ])

  expect(a).toEqual({ x: 0, y: 1 })
  expect(b).toEqual({ x: 1, y: 0 })
  expect(c).toEqual({ x: 0.5, y: 0.5 })
  expect(projectPoints([{ lat: 10, lng: 105 }])).toEqual([{ x: 0.5, y: 0.5 }])
})

test('the cargo numbers are counted from the sample trip', () => {
  const cargo = roleCargo()

  expect(cargo.packageCount).toBe(366)
  expect(cargo.stopCount).toBe(4)
  expect(cargo.totalKg).toBe(4164)
  expect(cargo.lines.map((line) => line.totalKg)).toEqual([1440, 960, 900, 864])
  expect(cargo.payloadRatio).toBeCloseTo(0.8328, 4)
})

test('the warehouse loads the last stops first: after two stops, 174 packages are on the truck and stop 2 is next', () => {
  const cargo = roleCargo()

  expect(cargo.loadedCount).toBe(174)
  expect(cargo.loadingLine.stop).toBe(2)
  expect(cargo.firstStopLine.stop).toBe(1)
})

test('the zones come from the domain: stop 1 at the door, the last stop at the front wall, in delivery order', () => {
  const { zones } = roleCargo()

  expect(zones.map((zone) => zone.stop)).toEqual([1, 2, 3, 4])
  expect(zones.at(0)?.end).toBe(1)
  expect(zones.at(-1)?.start).toBe(0)
  // Đi từ cửa vào trong: mỗi vùng nằm hẳn sau vùng trước nó, cách một khoảng đệm
  zones.slice(1).forEach((zone, index) => expect(zone.end).toBeLessThan(zones.at(index)?.start ?? Number.NaN))
})

test('package ids are the instance ids the app gives (expandPackages), not typed by hand', () => {
  const cargo = roleCargo()

  expect(cargo.loadingId).toBe('SKU-B-01')
  expect(cargo.firstStopIds).toEqual(['SKU-A-01', 'SKU-A-02', 'SKU-A-03'])
})

test('the zone place follows the warehouse card: first zone at the door, last at the front wall', () => {
  expect(zonePlaceOf(1, 4)).toBe('door')
  expect(zonePlaceOf(2, 4)).toBe('middle')
  expect(zonePlaceOf(4, 4)).toBe('front')
  expect(zonePlaceOf(1, 1)).toBe('whole')
})

test('minutes split into hours and minutes', () => {
  expect(hoursMinutes(622)).toEqual({ hours: 10, minutes: 22 })
  expect(hoursMinutes(45)).toEqual({ hours: 0, minutes: 45 })
})
