import { expect, test } from 'vitest'
import type { Package, PackageType } from '@/lib/mock-db'
import {
  filterByTab, filterPackages, filtersFromUrl, isLinked, labelsPath, orderedSelection, PACKAGE_TABS, packageRows, searchPackages, slugFromTab, tabCounts,
  tabFromSlug,
} from './packages-list'

const TYPE: PackageType = {
  id: 'PT-003', companyId: 'LOG-001', name: 'Thùng dầu ăn 12 chai', lengthCm: 45, widthCm: 32, heightCm: 30, weightKg: 12, fragilityLevel: 'NONE',
  allowedOrientations: ['LWH', 'WLH'], keepUpright: true, stackable: true, maxStackCount: 4, maxTopLoadKg: 50, createdAt: '2026-08-05T02:00:00.000Z',
}

function pkg(id: string, status: Package['status'], extra: Partial<Package> = {}): Package {
  return {
    id, companyId: 'LOG-001', packageCode: id, qrToken: `LM-AAAA-BBBB-${id.slice(-4)}`, lengthCm: 45, widthCm: 32, heightCm: 30, weightKg: 12,
    handlingClass: 'STANDARD', destination: 'KCN Mỹ Xuân A, TX. Phú Mỹ, Bà Rịa – Vũng Tàu', packageTypeId: 'PT-003', status, flags: [], source: 'MANUAL',
    createdAt: '2026-09-14T01:20:00.000Z', createdBy: 'US-0001', history: [], ...extra,
  }
}

/** Kiện nhập file không gắn loại kiện, mang cờ. */
const { packageTypeId: _typed, ...UNTYPED } = pkg('PK-0005', 'IMPORTED', {
  packageCode: 'PB-HUE-2609-01', handlingClass: 'FRAGILE', destination: 'KCN Phú Bài, TX. Hương Thuỷ, Thừa Thiên Huế', source: 'IMPORT', flags: ['NOT_FOUND'],
})

const ROWS = packageRows([
  pkg('PK-0001', 'IMPORTED'),
  pkg('PK-0002', 'IMPORTED', { packageCode: 'HB-QD16-0912-01', requirementId: 'REQ-001' }),
  pkg('PK-0003', 'ASSIGNED', { packageCode: 'MP-DA12-0914-01', requirementId: 'REQ-002', tripId: 'TRIP-014', stopId: 'STOP-01' }),
  pkg('PK-0004', 'DELIVERED', { requirementId: 'REQ-001', tripId: 'TRIP-009', handlingClass: 'HAZARDOUS' }),
  UNTYPED,
], [TYPE])

const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id)

test('rows come newest first, and a package without a package type gets no type on its row', () => {
  expect(ids(ROWS)).toStrictEqual(['PK-0005', 'PK-0004', 'PK-0003', 'PK-0002', 'PK-0001'])
  expect(ROWS.map((row) => row.type?.id)).toStrictEqual([undefined, 'PT-003', 'PT-003', 'PT-003', 'PT-003'])
})

test('search ignores accents and looks at sender code, pool id, destination, QR code, type, requirement and trip', () => {
  expect(searchPackages(ROWS, 'dau an')).toHaveLength(4)
  expect(ids(searchPackages(ROWS, 'mp-da12'))).toStrictEqual(['PK-0003'])
  expect(searchPackages(ROWS, 'pt-003')).toHaveLength(4)
  expect(ids(searchPackages(ROWS, 'bbbb-0002'))).toStrictEqual(['PK-0002'])
  expect(ids(searchPackages(ROWS, 'phu bai'))).toStrictEqual(['PK-0005'])
  expect(ids(searchPackages(ROWS, 'huong thuy hue'))).toStrictEqual(['PK-0005'])
  expect(ids(searchPackages(ROWS, 'req-001'))).toStrictEqual(['PK-0004', 'PK-0002'])
  expect(ids(searchPackages(ROWS, 'trip-014'))).toStrictEqual(['PK-0003'])
  expect(searchPackages(ROWS, '  ')).toHaveLength(5)
})

test('filters by handling class, by flag (one flag, or no flag at all) and by being in a requirement or a trip', () => {
  expect(ids(filterPackages(ROWS, { handlingClass: 'FRAGILE' }))).toStrictEqual(['PK-0005'])
  expect(ids(filterPackages(ROWS, { flag: 'NOT_FOUND' }))).toStrictEqual(['PK-0005'])
  expect(filterPackages(ROWS, { flag: 'DAMAGED' })).toStrictEqual([])
  expect(ids(filterPackages(ROWS, { flag: 'none' }))).toStrictEqual(['PK-0004', 'PK-0003', 'PK-0002', 'PK-0001'])
  expect(ids(filterPackages(ROWS, { link: 'free' }))).toStrictEqual(['PK-0005', 'PK-0001'])
  expect(ids(filterPackages(ROWS, { link: 'linked' }))).toStrictEqual(['PK-0004', 'PK-0003', 'PK-0002'])
  expect(ids(filterPackages(ROWS, { link: 'linked', handlingClass: 'HAZARDOUS', flag: 'none' }))).toStrictEqual(['PK-0004'])
  expect(filterPackages(ROWS, {})).toHaveLength(5)
  // Kiện chỉ thuộc yêu cầu giao, chưa vào chuyến, cũng là "đã vào"
  expect(isLinked({ requirementId: 'REQ-001' })).toBe(true)
  expect(isLinked({})).toBe(false)
})

test('filter slugs on the URL are unaccented Vietnamese; an unknown slug filters nothing', () => {
  expect(filtersFromUrl({ 'loai-hang': 'hang-lanh', co: 'khong-co', gan: 'chua' })).toStrictEqual({ handlingClass: 'REFRIGERATED', flag: 'none', link: 'free' })
  expect(filtersFromUrl({ 'loai-hang': 'gia-tri-cao', co: 'hu-hong', gan: 'da-vao' })).toStrictEqual({ handlingClass: 'HIGH_VALUE', flag: 'DAMAGED', link: 'linked' })
  expect(filtersFromUrl({ 'loai-hang': '', co: 'la', gan: 'FRAGILE' })).toStrictEqual({ handlingClass: undefined, flag: undefined, link: undefined })
})

test('seven status tabs after "all", one per backend package status (FE-3b-01)', () => {
  expect(PACKAGE_TABS).toStrictEqual(['all', 'IMPORTED', 'ASSIGNED', 'STAGED', 'LOADED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED'])
  expect(PACKAGE_TABS.map(slugFromTab)).toStrictEqual(['', 'da-nhap', 'da-gan-chuyen', 'da-soan', 'da-xep', 'dang-van-chuyen', 'da-giao', 'hoan-tra'])
  // Slug của trạng thái Review 1 đã bỏ rơi về "tất cả", như mọi slug lạ
  expect(['da-dang-ky', 'da-nhan', 'da-len-ke-hoach', 'da-len-xe'].map(tabFromSlug)).toStrictEqual(['all', 'all', 'all', 'all'])
})

test('tabs count every status and filter by one; URL slugs round-trip and unknown slugs fall back to all', () => {
  expect(tabCounts(ROWS)).toStrictEqual({ all: 5, IMPORTED: 3, ASSIGNED: 1, STAGED: 0, LOADED: 0, IN_TRANSIT: 0, DELIVERED: 1, RETURNED: 0 })
  expect(ids(filterByTab(ROWS, 'IMPORTED'))).toStrictEqual(['PK-0005', 'PK-0002', 'PK-0001'])
  expect(filterByTab(ROWS, 'all')).toHaveLength(5)
  expect(tabFromSlug(slugFromTab('ASSIGNED'))).toBe('ASSIGNED')
  expect(slugFromTab('all')).toBe('')
  expect(tabFromSlug('khong-co')).toBe('all')
})

test('the selection is printed in creation order and drops ids no longer in the store', () => {
  const selected = orderedSelection(ROWS, new Set(['PK-0004', 'PK-0001', 'PK-9999']))
  expect(selected).toStrictEqual(['PK-0001', 'PK-0004'])
  expect(labelsPath(selected)).toBe('/kien-hang/nhan?kien=PK-0001,PK-0004')
})
