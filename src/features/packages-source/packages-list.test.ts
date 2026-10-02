import { expect, test } from 'vitest'
import type { PackageType, RegisteredPackage } from '@/lib/mock-db'
import { filterByTab, labelsPath, orderedSelection, PACKAGE_TABS, packageRows, searchPackages, slugFromTab, tabCounts, tabFromSlug } from './packages-list'

const TYPE: PackageType = {
  id: 'PT-003', companyId: 'LOG-001', name: 'Thùng dầu ăn 12 chai', lengthCm: 45, widthCm: 32, heightCm: 30, weightKg: 12, fragilityLevel: 'NONE',
  allowedOrientations: ['LWH', 'WLH'], keepUpright: true, stackable: true, maxStackCount: 4, maxTopLoadKg: 50, createdAt: '2026-08-05T02:00:00.000Z',
}

function pkg(id: string, status: RegisteredPackage['status'], extra: Partial<RegisteredPackage> = {}): RegisteredPackage {
  return { id, packageTypeId: 'PT-003', ownerCompanyId: 'LOG-001', qrToken: `LM-AAAA-BBBB-${id.slice(-4)}`, status, registeredAt: '2026-09-14T01:20:00.000Z', registeredBy: 'US-0001', ...extra }
}

const ROWS = packageRows([
  pkg('RPK-0001', 'registered'),
  pkg('RPK-0002', 'registered', { reference: 'HB-QD16-0912' }),
  pkg('RPK-0003', 'received', { reference: 'MP-DA12-0914' }),
  pkg('RPK-0004', 'delivered', { orderId: 'ORD-001' }),
], [TYPE])

test('search ignores accents and looks at code, type, batch reference and QR code', () => {
  expect(searchPackages(ROWS, 'dau an').map((row) => row.id)).toHaveLength(4)
  expect(searchPackages(ROWS, 'mp-da12').map((row) => row.id)).toStrictEqual(['RPK-0003'])
  expect(searchPackages(ROWS, 'pt-003').map((row) => row.id)).toHaveLength(4)
  expect(searchPackages(ROWS, 'bbbb-0002').map((row) => row.id)).toStrictEqual(['RPK-0002'])
  expect(searchPackages(ROWS, '  ').map((row) => row.id)).toHaveLength(4)
})

test('five status tabs after "all" — no tab for packages on their way to a logistics company any more (FE-0-06)', () => {
  expect(PACKAGE_TABS).toStrictEqual(['all', 'registered', 'received', 'planned', 'loaded', 'delivered'])
  expect(PACKAGE_TABS.map(slugFromTab)).toStrictEqual(['', 'da-dang-ky', 'da-nhan', 'da-len-ke-hoach', 'da-len-xe', 'da-giao'])
  // Slug của tab đã bỏ rơi về "tất cả", như mọi slug lạ
  expect(tabFromSlug('dang-giao-logistics')).toBe('all')
})

test('tabs count every status and filter by one; URL slugs round-trip and unknown slugs fall back to all', () => {
  expect(tabCounts(ROWS)).toStrictEqual({ all: 4, registered: 2, received: 1, planned: 0, loaded: 0, delivered: 1 })
  expect(filterByTab(ROWS, 'registered').map((row) => row.id)).toStrictEqual(['RPK-0001', 'RPK-0002'])
  expect(filterByTab(ROWS, 'all')).toHaveLength(4)
  expect(tabFromSlug(slugFromTab('received'))).toBe('received')
  expect(slugFromTab('all')).toBe('')
  expect(tabFromSlug('khong-co')).toBe('all')
})

test('the selection keeps list order and drops ids no longer in the store', () => {
  const ids = orderedSelection(ROWS, new Set(['RPK-0004', 'RPK-0001', 'RPK-9999']))
  expect(ids).toStrictEqual(['RPK-0001', 'RPK-0004'])
  expect(labelsPath(ids)).toBe('/kien-hang/nhan?kien=RPK-0001,RPK-0004')
})
