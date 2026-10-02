import { expect, test } from 'vitest'
import type { Package, PackageType } from '@/lib/mock-db'
import { filterByTab, labelsPath, orderedSelection, PACKAGE_TABS, packageRows, searchPackages, slugFromTab, tabCounts, tabFromSlug } from './packages-list'

const TYPE: PackageType = {
  id: 'PT-003', companyId: 'LOG-001', name: 'Thùng dầu ăn 12 chai', lengthCm: 45, widthCm: 32, heightCm: 30, weightKg: 12, fragilityLevel: 'NONE',
  allowedOrientations: ['LWH', 'WLH'], keepUpright: true, stackable: true, maxStackCount: 4, maxTopLoadKg: 50, createdAt: '2026-08-05T02:00:00.000Z',
}

function pkg(id: string, status: Package['status'], extra: Partial<Package> = {}): Package {
  return {
    id, companyId: 'LOG-001', packageCode: id, qrToken: `LM-AAAA-BBBB-${id.slice(-4)}`, lengthCm: 45, widthCm: 32, heightCm: 30, weightKg: 12,
    handlingClass: 'STANDARD', destination: 'KCN Mỹ Xuân A, TX. Phú Mỹ, Bà Rịa – Vũng Tàu', packageTypeId: 'PT-003', status, flags: [], source: 'MANUAL',
    createdAt: '2026-09-14T01:20:00.000Z', createdBy: 'US-0001', ...extra,
  }
}

/** Kiện nhập file không gắn loại kiện. */
const { packageTypeId: _typed, ...UNTYPED } = pkg('PK-0005', 'IMPORTED', { packageCode: 'PB-HUE-2609-01', handlingClass: 'FRAGILE', destination: 'KCN Phú Bài, TX. Hương Thuỷ, Thừa Thiên Huế', source: 'IMPORT' })

const ROWS = packageRows([
  pkg('PK-0001', 'IMPORTED'),
  pkg('PK-0002', 'IMPORTED', { packageCode: 'HB-QD16-0912-01' }),
  pkg('PK-0003', 'ASSIGNED', { packageCode: 'MP-DA12-0914-01' }),
  pkg('PK-0004', 'DELIVERED', { orderId: 'ORD-001' }),
  UNTYPED,
], [TYPE])

test('search ignores accents and looks at code, sender code, type, destination and QR code', () => {
  expect(searchPackages(ROWS, 'dau an').map((row) => row.id)).toHaveLength(4)
  expect(searchPackages(ROWS, 'mp-da12').map((row) => row.id)).toStrictEqual(['PK-0003'])
  expect(searchPackages(ROWS, 'pt-003').map((row) => row.id)).toHaveLength(4)
  expect(searchPackages(ROWS, 'bbbb-0002').map((row) => row.id)).toStrictEqual(['PK-0002'])
  expect(searchPackages(ROWS, 'phu bai').map((row) => row.id)).toStrictEqual(['PK-0005'])
  expect(searchPackages(ROWS, '  ').map((row) => row.id)).toHaveLength(5)
})

test('a package without a package type gets no type on its row', () => {
  expect(ROWS.map((row) => row.type?.id)).toStrictEqual(['PT-003', 'PT-003', 'PT-003', 'PT-003', undefined])
})

test('seven status tabs after "all", one per backend package status (FE-3b-01)', () => {
  expect(PACKAGE_TABS).toStrictEqual(['all', 'IMPORTED', 'ASSIGNED', 'STAGED', 'LOADED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED'])
  expect(PACKAGE_TABS.map(slugFromTab)).toStrictEqual(['', 'da-nhap', 'da-gan-chuyen', 'da-soan', 'da-xep', 'dang-van-chuyen', 'da-giao', 'hoan-tra'])
  // Slug của trạng thái Review 1 đã bỏ rơi về "tất cả", như mọi slug lạ
  expect(['da-dang-ky', 'da-nhan', 'da-len-ke-hoach', 'da-len-xe'].map(tabFromSlug)).toStrictEqual(['all', 'all', 'all', 'all'])
})

test('tabs count every status and filter by one; URL slugs round-trip and unknown slugs fall back to all', () => {
  expect(tabCounts(ROWS)).toStrictEqual({ all: 5, IMPORTED: 3, ASSIGNED: 1, STAGED: 0, LOADED: 0, IN_TRANSIT: 0, DELIVERED: 1, RETURNED: 0 })
  expect(filterByTab(ROWS, 'IMPORTED').map((row) => row.id)).toStrictEqual(['PK-0001', 'PK-0002', 'PK-0005'])
  expect(filterByTab(ROWS, 'all')).toHaveLength(5)
  expect(tabFromSlug(slugFromTab('ASSIGNED'))).toBe('ASSIGNED')
  expect(slugFromTab('all')).toBe('')
  expect(tabFromSlug('khong-co')).toBe('all')
})

test('the selection keeps list order and drops ids no longer in the store', () => {
  const ids = orderedSelection(ROWS, new Set(['PK-0004', 'PK-0001', 'PK-9999']))
  expect(ids).toStrictEqual(['PK-0001', 'PK-0004'])
  expect(labelsPath(ids)).toBe('/kien-hang/nhan?kien=PK-0001,PK-0004')
})
