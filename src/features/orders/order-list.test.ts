import { beforeAll, expect, test } from 'vitest'
import { getMockDb } from '@/lib/mock-db'
import { fetchAssignableTrips, fetchOrderablePackages, fetchOrders } from './orders-api'
import { filterOrderRows, groupByType, matchingStopId, selectedWeightKg } from './order-list'

/**
 * Màn Đơn hàng (LM-104) tính trên dữ liệu kho seed của Long Bình: ORD-001, ORD-002 chờ gán; 18 kiện đã ở kho, chưa vào đơn — sữa,
 * bánh quy, quạt (FE-0-06). Kho đọc dưới phiên của điều phối viên Long Bình như ở màn thật: đơn và kiện của Phương Nam không lọt vào
 * (FE-0-02).
 */
beforeAll(() => {
  getMockDb().restoreSession('US-0001')
})

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
  const ids = (group: (typeof groups)[number]) => group.items.map((item) => item.package.id)

  // Ba loại, mỗi loại 6 kiện; kỳ vọng chép từ seed: sữa RPK-0023…0028, bánh quy RPK-0029…0034, quạt RPK-0043…0048
  expect(packages).toHaveLength(18)
  expect(groups.map((group) => [group.name, group.items.length]).toSorted()).toStrictEqual([
    ['Kiện quạt điện', 6], ['Thùng bánh quy', 6], ['Thùng sữa hộp 48 hộp', 6],
  ])
  const milk = groups.find((group) => group.name === 'Thùng sữa hộp 48 hộp')!
  expect(ids(milk)).toStrictEqual(['RPK-0023', 'RPK-0024', 'RPK-0025', 'RPK-0026', 'RPK-0027', 'RPK-0028'])
  expect(groups.flatMap(ids).toSorted()).toStrictEqual(packages.map((item) => item.package.id).toSorted())
  // Thùng sữa 52 kg: ba thùng 156 kg, cả nhóm 312 kg; thêm một kiện quạt 9 kg
  expect(selectedWeightKg(packages, ids(milk).slice(0, 3))).toBe(156)
  expect(selectedWeightKg(packages, ids(milk))).toBe(312)
  expect(selectedWeightKg(packages, [...ids(milk), 'RPK-0043'])).toBe(321)
  expect(selectedWeightKg(packages, [])).toBe(0)
})

test('the stop named like the customer is suggested when assigning', async () => {
  const trips = await fetchAssignableTrips()
  const trip = trips.find((candidate) => candidate.id === 'TRIP-014')!

  expect(matchingStopId('KHO BACH HOA XANH DI AN', trip.stops)).toBe(trip.stops[1]!.id)
  expect(matchingStopId('Siêu thị Co.opmart Bình Dương', trip.stops)).toBeUndefined()
})
