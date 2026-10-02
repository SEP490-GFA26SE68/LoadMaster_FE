import { beforeAll, expect, test } from 'vitest'
import { getMockDb } from '@/lib/mock-db'
import { fetchAssignableTrips, fetchOrderablePackages, fetchOrders } from './orders-api'
import { filterOrderRows, groupByType, matchingStopId, selectedWeightKg } from './order-list'

/**
 * Màn Đơn hàng (LM-104) tính trên dữ liệu kho seed của Long Bình: ORD-001, ORD-002 chờ gán; 64 kiện kho kiện chọn được — 26 kiện gắn
 * loại kiện (sữa, bánh quy, dầu ăn, quạt) và 38 kiện nhập file không gắn loại, trừ hai kiện mang cờ (FE-3b-01). Kho đọc dưới phiên của điều phối viên Long Bình như ở màn thật: đơn và kiện của Phương Nam không lọt vào
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

test('orderable packages group by package type, untyped ones by handling class, and the chosen weight is the weight of each package', async () => {
  const packages = await fetchOrderablePackages()
  const groups = groupByType(packages, (handlingClass) => `Hàng ${handlingClass}`)
  const ids = (group: (typeof groups)[number]) => group.items.map((item) => item.package.id)

  // Kỳ vọng chép từ seed: sữa PK-0023…0028, bánh quy PK-0029…0034, dầu ăn PK-0035…0042, quạt PK-0043…0048; kiện nhập file PK-0049…0088
  // theo loại hàng, không tính hai kiện mang cờ (PK-0063 hàng thường, PK-0078 hàng nguy hiểm); cộng 170 kiện hàng thường của chuyến đã
  // huỷ TRIP-004 đã về kho kiện (FE-3b-07)
  expect(packages).toHaveLength(64 + 170)
  expect(groups.map((group) => [group.name, group.items.length])).toStrictEqual([
    // Nhóm theo thứ tự kho: kiện của chuyến seed đứng trước kiện có từ trước
    ['Hàng STANDARD', 170 + 19], ['Thùng sữa hộp 48 hộp', 6], ['Thùng bánh quy', 6], ['Thùng dầu ăn 12 chai', 8], ['Kiện quạt điện', 6],
    ['Hàng FRAGILE', 5], ['Hàng HIGH_VALUE', 5], ['Hàng REFRIGERATED', 5], ['Hàng HAZARDOUS', 4],
  ])
  expect(packages.filter((item) => item.package.flags.length > 0 || item.package.orderId !== undefined)).toStrictEqual([])
  const milk = groups.find((group) => group.name === 'Thùng sữa hộp 48 hộp')!
  expect(ids(milk)).toStrictEqual(['PK-0023', 'PK-0024', 'PK-0025', 'PK-0026', 'PK-0027', 'PK-0028'])
  expect(groups.flatMap(ids).toSorted()).toStrictEqual(packages.map((item) => item.package.id).toSorted())
  // Thùng sữa 52 kg: ba thùng 156 kg, cả nhóm 312 kg; thêm một kiện quạt 9 kg; kiện dễ vỡ đi Huế 9,5 kg không gắn loại kiện
  expect(selectedWeightKg(packages, ids(milk).slice(0, 3))).toBe(156)
  expect(selectedWeightKg(packages, ids(milk))).toBe(312)
  expect(selectedWeightKg(packages, [...ids(milk), 'PK-0043'])).toBe(321)
  expect(selectedWeightKg(packages, ['PK-0054', 'PK-0055'])).toBe(19)
  expect(selectedWeightKg(packages, [])).toBe(0)
})

test('the stop named like the customer is suggested when assigning', async () => {
  const trips = await fetchAssignableTrips()
  const trip = trips.find((candidate) => candidate.id === 'TRIP-014')!

  expect(matchingStopId('KHO BACH HOA XANH DI AN', trip.stops)).toBe(trip.stops[1]!.id)
  expect(matchingStopId('Siêu thị Co.opmart Bình Dương', trip.stops)).toBeUndefined()
})
