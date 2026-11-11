import { expect, test } from 'vitest'
import { createFormatter } from '@/lib/format'
import { createTranslator } from '@/lib/i18n'
import type { Role } from '@/types/user'
import { serverBellRows, type ServerNotification } from './server-notifications'

/**
 * Chuông bản máy chủ cho việc của kho: báo thiếu lúc soạn, quyết định của điều phối viên với kiện thiếu, kiện hỏng lúc xếp, kho tìm thấy
 * lại kiện. Máy chủ đã chọn người nhận; đây chỉ dịch câu và chi tiết — tài xế đọc câu "chuyến tạm dừng" của mình.
 */
const t = createTranslator('vi')
const format = createFormatter('vi-VN')
const LINKS = { trips: true, warehouse: true, driver: true, billing: false }

function item(id: string, actionType: string, entityName: string, after: ServerNotification['after']): ServerNotification {
  return {
    id, at: '2026-11-12T02:00:00.000Z', actionType, entityName, entityId: '9', entityCode: actionType === 'PACKAGE_FOUND' ? null : 'TRIP-20261112-A1',
    actorId: '7', actorName: 'Lê Văn Kho', actorRole: 'warehouse', companyName: 'Long Bình', before: {}, after,
    tripId: actionType === 'PACKAGE_FOUND' ? null : '42', read: false,
  }
}

const FEED = [
  item('4', 'PACKAGE_FOUND', 'CargoPackage', { packageId: 5, packageCode: 'LB-0005', flag: 'NOT_FOUND' }),
  item('3', 'LOADING_DAMAGE_REPORTED', 'LoadingDamage', { packageId: 5, placementId: 8, tripId: 42, outcome: 'REPLANNED', restingCount: 2, driverId: 31 }),
  item('2', 'STAGING_SHORTAGE_RESOLVED', 'StagingShortage', { packageId: 6, tripId: 42, decision: 'DROP', reportedBy: 7, driverId: 31 }),
  item('1', 'STAGING_SHORTAGE_REPORTED', 'StagingShortage', { packageId: 6, tripId: 42 }),
]

const rows = (role: Role, items = FEED) => serverBellRows({ items, windowDays: 7, viewerId: '31' }, role, LINKS, t, format)

test('the dispatcher reads the warehouse events with their outcome; a found package names its code and links nowhere', () => {
  expect(rows('dispatcher').map((row) => [row.action, row.details, row.target.href])).toEqual([
    ['Kho tìm thấy lại kiện', 'Kiện LB-0005', null],
    ['Kho báo kiện hỏng khi xếp', 'Chuyến quay về lập kế hoạch', '/chuyen/TRIP-20261112-A1'],
    ['Điều phối quyết định kiện kho báo thiếu', 'Bỏ kiện khỏi chuyến — chuyến chờ lập lại phương án', '/chuyen/TRIP-20261112-A1'],
    ['Kho báo thiếu kiện khi soạn hàng', '', '/chuyen/TRIP-20261112-A1'],
  ])
})

test('the driver reads a paused trip in their own words, with no warehouse detail; the warehouse opens its loading session', () => {
  const driver = rows('driver', FEED.slice(1, 3))
  expect(driver.map((row) => [row.action, row.details, row.target.href])).toEqual([
    ['Chuyến tạm dừng: kho báo kiện hỏng, chờ điều phối lập lại phương án', '', '/tai-xe/diem-giao?chuyen=42'],
    ['Chuyến tạm dừng: thiếu kiện, chờ điều phối lập lại phương án', '', '/tai-xe/diem-giao?chuyen=42'],
  ])
  const kept = rows('driver', [item('5', 'STAGING_SHORTAGE_RESOLVED', 'StagingShortage', { packageId: 6, tripId: 42, decision: 'KEEP_SEARCHING' })])
  expect(kept[0]?.action).toBe('Điều phối quyết định kiện kho báo thiếu')
  expect(rows('warehouse', FEED.slice(1, 2))[0]?.target.href).toBe('/kho?chuyen=42')
})

test('English labels exist for the four warehouse events', () => {
  const english = serverBellRows({ items: FEED, windowDays: 7, viewerId: null }, 'companyManager', LINKS, createTranslator('en'), createFormatter('en-US'))
  expect(english.map((row) => row.action)).toEqual([
    'Warehouse found the package again', 'Warehouse reported a damaged package while loading', 'Dispatcher decided on a package reported missing',
    'Warehouse reported a package missing while staging',
  ])
  expect(english[1]?.details).toBe('Trip went back to planning')
})
