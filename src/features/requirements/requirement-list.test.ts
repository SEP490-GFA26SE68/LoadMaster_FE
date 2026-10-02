import { beforeAll, expect, test } from 'vitest'
import { getMockDb } from '@/lib/mock-db'
import { fetchAssignableTrips, fetchSelectablePackages, listDeliveryRequirements } from './requirements-api'
import {
  filterPickerPackages, filterRequirementRows, groupByType, matchingStopId, packageWarnings, sameDestination, selectedWeightKg,
} from './requirement-list'

/**
 * Màn Yêu cầu giao (FE-4b-02) tính trên dữ liệu kho seed của Long Bình (neo 14/09/2026): sáu yêu cầu chờ xếp chuyến REQ-001…006; 56
 * kiện kho kiện chọn được — 26 kiện gắn loại kiện (sữa, bánh quy, dầu ăn, quạt) và 30 kiện nhập file không gắn loại (40 kiện trừ 8
 * kiện của REQ-001…004 và hai kiện mang cờ) — cùng 170 kiện của chuyến đã huỷ TRIP-004. Kho đọc dưới phiên của quản lý công ty Long
 * Bình như ở màn thật: yêu cầu và kiện của Phương Nam không lọt vào (FE-0-02).
 */
beforeAll(() => {
  getMockDb().restoreSession('US-0002')
})

const NO_FILTER = { 'trang-thai': '', 'uu-tien': '', 'han-tu': '', 'han-den': '' }
const idsOf = (rows: Awaited<ReturnType<typeof listDeliveryRequirements>>) => rows.map((row) => row.requirement.id).toSorted()

test('rows carry the shown status, the packages, their weight and who made the requirement', async () => {
  const rows = await listDeliveryRequirements()
  expect(rows.map((row) => row.requirement.id)).toStrictEqual(['REQ-006', 'REQ-005', 'REQ-004', 'REQ-003', 'REQ-002', 'REQ-001'])
  // REQ-005: 12 thùng nước suối 13 kg; REQ-002: hai kiện dễ vỡ 9,5 kg
  expect(rows.map((row) => [row.requirement.id, row.status, row.closed, row.packages.length, row.totalKg, row.trip, row.createdByName]).slice(1, 5)).toStrictEqual([
    ['REQ-005', 'PENDING', false, 12, 156, undefined, 'Trần Thị Mai'],
    ['REQ-004', 'PENDING', false, 2, 44, undefined, 'Trần Thị Mai'],
    ['REQ-003', 'PENDING', false, 2, 14.4, undefined, 'Trần Thị Mai'],
    ['REQ-002', 'PENDING', false, 2, 19, undefined, 'Trần Thị Mai'],
  ])
  expect(rows[1]?.packages[0]?.type?.name).toBe('Thùng nước suối 24 chai')
})

test('requirements filter by status, priority, a deadline range in Vietnam time and an accent-free search', async () => {
  const rows = await listDeliveryRequirements()
  const filter = (query: string, filters: Partial<typeof NO_FILTER>) => idsOf(filterRequirementRows(rows, query, { ...NO_FILTER, ...filters }))

  expect(filter('', { 'trang-thai': 'cho-xep-chuyen' })).toStrictEqual(['REQ-001', 'REQ-002', 'REQ-003', 'REQ-004', 'REQ-005', 'REQ-006'])
  expect(filter('', { 'trang-thai': 'da-vao-chuyen' })).toStrictEqual([])
  expect(filter('', { 'uu-tien': 'khan' })).toStrictEqual(['REQ-003'])
  expect(filter('', { 'uu-tien': 'cao' })).toStrictEqual(['REQ-002', 'REQ-006'])
  // Hạn 17/09: REQ-002 (17:00) và REQ-004 (10:00); cả hai đầu của khoảng đều tính
  expect(filter('', { 'han-tu': '2026-09-17', 'han-den': '2026-09-17' })).toStrictEqual(['REQ-002', 'REQ-004'])
  expect(filter('', { 'han-den': '2026-09-16' })).toStrictEqual(['REQ-005', 'REQ-006'])
  expect(filter('', { 'han-tu': '2026-09-18' })).toStrictEqual(['REQ-001', 'REQ-003'])
  expect(filter('bach hoa xanh di an', {})).toStrictEqual(['REQ-006'])
  expect(filter('ha noi', {})).toStrictEqual(['REQ-003'])
  expect(filter('hang gom', {})).toStrictEqual(['REQ-002'])
  // Slug lạ là không lọc
  expect(filter('req-001', { 'trang-thai': 'khong-co', 'uu-tien': 'gap' })).toStrictEqual(['REQ-001'])
})

test('selectable packages group by package type, untyped ones by handling class, newest first, and filter by the destination in the file', async () => {
  const packages = await fetchSelectablePackages()
  const groups = groupByType(packages, (handlingClass) => `Hàng ${handlingClass}`)
  const ids = (group: (typeof groups)[number]) => group.items.map((item) => item.package.id)

  // Kỳ vọng chép từ seed: kiện nhập file PK-0049…0088 theo loại hàng, không tính 8 kiện của REQ-001…004 và hai kiện mang cờ (PK-0063
  // hàng thường, PK-0078 hàng nguy hiểm); quạt PK-0043…0048, dầu ăn PK-0035…0042, bánh quy PK-0029…0034, sữa PK-0023…0028; cộng 170
  // kiện hàng thường của chuyến đã huỷ TRIP-004 đã về kho kiện (FE-3b-07)
  expect(packages).toHaveLength(56 + 170)
  expect(packages[0]?.package.id).toBe('PK-0088')
  expect(groups.map((group) => [group.name, group.items.length])).toStrictEqual([
    ['Hàng STANDARD', 17 + 170], ['Hàng HAZARDOUS', 4], ['Hàng REFRIGERATED', 3], ['Hàng HIGH_VALUE', 3], ['Hàng FRAGILE', 3],
    ['Kiện quạt điện', 6], ['Thùng dầu ăn 12 chai', 8], ['Thùng bánh quy', 6], ['Thùng sữa hộp 48 hộp', 6],
  ])
  expect(packages.filter((item) => item.package.flags.length > 0 || item.package.requirementId !== undefined)).toStrictEqual([])
  const milk = groups.find((group) => group.name === 'Thùng sữa hộp 48 hộp')!
  expect(ids(milk)).toStrictEqual(['PK-0023', 'PK-0024', 'PK-0025', 'PK-0026', 'PK-0027', 'PK-0028'])
  // Thùng sữa 52 kg: ba thùng 156 kg, cả nhóm 312 kg; thêm một kiện quạt 9 kg; kiện dễ vỡ đi Huế 9,5 kg không gắn loại kiện
  expect(selectedWeightKg(packages, ids(milk).slice(0, 3))).toBe(156)
  expect(selectedWeightKg(packages, [...ids(milk), 'PK-0043'])).toBe(321)
  expect(selectedWeightKg(packages, ['PK-0054', 'PK-0055'])).toBe(19)
  expect(selectedWeightKg(packages, [])).toBe(0)

  // Lọc nhanh theo điểm đến ghi trong file (bỏ dấu) hoặc mã kiện; kiện đã chọn luôn ở lại
  const picked = (query: string, selected: string[] = []) => filterPickerPackages(packages, query, selected).map((item) => item.package.id)
  expect(picked('phu bai')).toStrictEqual(['PK-0056', 'PK-0055', 'PK-0054'])
  expect(picked('PB-HUE-2609-02')).toStrictEqual(['PK-0055'])
  expect(picked('can tho', ['PK-0023'])).toStrictEqual(['PK-0071', 'PK-0070', 'PK-0069', 'PK-0023'])
  expect(picked('  ')).toHaveLength(226)
})

test('the form warns about mixed handling classes and about packages whose file destination differs from the requirement', async () => {
  const packages = await fetchSelectablePackages()
  const phuBai = { destinationName: 'KCN Phú Bài', address: 'KCN Phú Bài, TX. Hương Thuỷ, Thừa Thiên Huế' }
  // PK-0054, PK-0055: hàng dễ vỡ đi Phú Bài; PK-0064: hàng giá trị cao đi KCN Thăng Long
  expect(packageWarnings(packages, ['PK-0054', 'PK-0055'], phuBai)).toStrictEqual({ mixedClasses: [], otherDestination: [] })
  expect(packageWarnings(packages, ['PK-0054', 'PK-0064'], phuBai)).toStrictEqual({ mixedClasses: ['HIGH_VALUE', 'FRAGILE'], otherDestination: ['PK-0064'] })
  // Chưa nhập điểm đến thì chưa so điểm đến; không chọn kiện nào thì không cảnh báo gì
  expect(packageWarnings(packages, ['PK-0054', 'PK-0064'], { destinationName: ' ', address: '' }).otherDestination).toStrictEqual([])
  expect(packageWarnings(packages, [], phuBai)).toStrictEqual({ mixedClasses: [], otherDestination: [] })

  expect(sameDestination('kcn phu bai, tx. huong thuy, thua thien hue', phuBai)).toBe(true)
  expect(sameDestination('KCN Phú Bài', phuBai)).toBe(true)
  expect(sameDestination('KCN Phú Bài, KCN Phú Bài, TX. Hương Thuỷ, Thừa Thiên Huế', phuBai)).toBe(true)
  expect(sameDestination('KCN Phú Bài, Huế', phuBai)).toBe(false)
})

test('the stop named like the destination is suggested when putting a requirement on a trip', async () => {
  const trips = await fetchAssignableTrips()
  const trip = trips.find((candidate) => candidate.id === 'TRIP-014')!

  expect(matchingStopId('KHO BACH HOA XANH DI AN', trip.stops)).toBe(trip.stops[1]!.id)
  expect(matchingStopId('Siêu thị Co.opmart Bình Dương', trip.stops)).toBeUndefined()
})
