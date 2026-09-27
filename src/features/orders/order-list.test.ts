import { expect, test } from 'vitest'
import { fetchAssignableTrips, fetchOrderablePackages, fetchOrders } from './orders-api'
import { filterOrderRows, groupByType, matchingStopId, selectedWeightKg } from './order-list'

/** Màn Đơn hàng (LM-104) tính trên dữ liệu kho seed: ORD-001, ORD-002 chờ gán; 4 hộp sữa của SHP-002 đã nhận, chưa vào đơn. */

test('orders filter by status slug and by an accent-free search over customer, address and code', async () => {
  const rows = await fetchOrders()

  expect(filterOrderRows(rows, '', 'cho-gan').map((row) => row.order.id).toSorted()).toStrictEqual(['ORD-001', 'ORD-002'])
  expect(filterOrderRows(rows, '', 'da-gan')).toStrictEqual([])
  expect(filterOrderRows(rows, 'bach hoa xanh di an', '').map((row) => row.order.id)).toStrictEqual(['ORD-002'])
  expect(filterOrderRows(rows, 'ord-001', 'khong-co').map((row) => row.order.id)).toStrictEqual(['ORD-001'])
})

test('orderable packages group by package type and the chosen weight follows the package type', async () => {
  const packages = await fetchOrderablePackages()
  const groups = groupByType(packages, '?')

  expect(groups).toHaveLength(1)
  expect(groups[0]!.items.map((item) => item.package.id)).toStrictEqual(packages.map((item) => item.package.id).toSorted())
  const weight = groups[0]!.items[0]!.type!.weightKg
  expect(selectedWeightKg(packages, groups[0]!.items.slice(0, 3).map((item) => item.package.id))).toBeCloseTo(weight * 3, 6)
  expect(selectedWeightKg(packages, [])).toBe(0)
})

test('the stop named like the customer is suggested when assigning', async () => {
  const trips = await fetchAssignableTrips()
  const trip = trips.find((candidate) => candidate.id === 'TRIP-014')!

  expect(matchingStopId('KHO BACH HOA XANH DI AN', trip.stops)).toBe(trip.stops[1]!.id)
  expect(matchingStopId('Siêu thị Co.opmart Bình Dương', trip.stops)).toBeUndefined()
})
