import { expect, test } from 'vitest'
import type { PackageType, RegisteredPackage } from '@/lib/mock-db'
import { filterByTab, isShippable, labelsPath, orderedSelection, packageRows, searchPackages, slugFromTab, tabCounts, tabFromSlug } from './packages-list'

const TYPE: PackageType = {
  id: 'PT-003', name: 'Thùng dầu ăn 12 chai', lengthCm: 45, widthCm: 32, heightCm: 30, weightKg: 12, fragilityLevel: 'NONE',
  allowedOrientations: ['LWH', 'WLH'], keepUpright: true, stackable: true, maxStackCount: 4, maxTopLoadKg: 50, createdAt: '2026-08-05T02:00:00.000Z',
}

function pkg(id: string, status: RegisteredPackage['status'], extra: Partial<RegisteredPackage> = {}): RegisteredPackage {
  return { id, packageTypeId: 'PT-003', ownerCompanyId: 'MFR-001', qrToken: `LM-AAAA-BBBB-${id.slice(-4)}`, status, registeredAt: '2026-09-14T01:20:00.000Z', registeredBy: 'US-0006', ...extra }
}

const ROWS = packageRows([
  pkg('RPK-0001', 'registered'),
  pkg('RPK-0002', 'registered', { shipmentId: 'SHP-004' }),
  pkg('RPK-0003', 'in_shipment', { shipmentId: 'SHP-002', reference: 'MP-DA12-0914' }),
  pkg('RPK-0004', 'delivered', { shipmentId: 'SHP-001' }),
], [TYPE])

test('search ignores accents and looks at code, type, batch reference and shipment', () => {
  expect(searchPackages(ROWS, 'dau an').map((row) => row.id)).toHaveLength(4)
  expect(searchPackages(ROWS, 'mp-da12').map((row) => row.id)).toStrictEqual(['RPK-0003'])
  expect(searchPackages(ROWS, 'SHP-00').map((row) => row.id)).toStrictEqual(['RPK-0002', 'RPK-0003', 'RPK-0004'])
})

test('tabs count every status and filter by one; URL slugs round-trip and unknown slugs fall back to all', () => {
  expect(tabCounts(ROWS)).toStrictEqual({ all: 4, registered: 2, in_shipment: 1, received: 0, planned: 0, loaded: 0, delivered: 1 })
  expect(filterByTab(ROWS, 'registered').map((row) => row.id)).toStrictEqual(['RPK-0001', 'RPK-0002'])
  expect(tabFromSlug(slugFromTab('in_shipment'))).toBe('in_shipment')
  expect(slugFromTab('all')).toBe('')
  expect(tabFromSlug('khong-co')).toBe('all')
})

test('only registered packages outside any shipment (even a draft) can go into a new shipment', () => {
  expect(ROWS.filter(isShippable).map((row) => row.id)).toStrictEqual(['RPK-0001'])
})

test('the selection keeps list order and drops ids no longer in the store', () => {
  const ids = orderedSelection(ROWS, new Set(['RPK-0004', 'RPK-0001', 'RPK-9999']))
  expect(ids).toStrictEqual(['RPK-0001', 'RPK-0004'])
  expect(labelsPath(ids)).toBe('/kien-hang/nhan?kien=RPK-0001,RPK-0004')
})
