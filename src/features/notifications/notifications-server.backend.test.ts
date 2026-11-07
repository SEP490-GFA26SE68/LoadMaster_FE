import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend } from '@/test/fake-backend'
import { ROLES } from '@/types/user'
import { fetchServerNotifications, markServerNotificationsRead, notificationsReachable } from './notifications-api'

/**
 * Nhóm `notifications` nối backend: chuông của mọi vai trò có loại thông báo đọc máy chủ, kể cả khi chuyến, kho đã nối backend (máy chủ
 * nói về chính dữ liệu đó); thông báo đổi mã số thành chuỗi, mốc giờ sang ISO, vai trò sang mã của app.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['notifications', 'trips', 'warehouse']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => ['notifications', 'trips', 'warehouse'].includes(feature),
}))

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const item = {
  id: 501, actionType: 'LOADING_COMPLETED', entityName: 'LoadingExecution', entityId: '3', tripId: 42, tripCode: 'TRIP-20261106-A1',
  actorId: 12, actorName: 'Lê Văn Kho', actorRole: 'WAREHOUSE_WORKER', oldValues: null,
  newValues: { loadedPackages: 18, driverId: 31, nested: { ignored: true } }, createdAt: '2026-11-06 09:15:00', read: false,
}

test('mọi vai trò có loại thông báo có chuông; quản lý nền tảng và hỗ trợ khách hàng không', () => {
  expect(ROLES.filter((role) => !notificationsReachable(role))).toStrictEqual(['systemManager', 'systemSupporter'])
})

test('đọc thông báo của máy chủ', async () => {
  stubBackend({ 'GET /api/notifications': { body: envelope({ items: [item], unreadCount: 1, windowDays: 7 }) } })
  const feed = await fetchServerNotifications()

  expect(feed.windowDays).toBe(7)
  expect(feed.items).toStrictEqual([{
    id: '501', at: '2026-11-06T02:15:00.000Z', actionType: 'LOADING_COMPLETED', entityName: 'LoadingExecution', entityId: '3',
    entityCode: 'TRIP-20261106-A1', tripId: '42', actorId: '12', actorName: 'Lê Văn Kho', actorRole: 'warehouse', companyName: null,
    before: {}, after: { loadedPackages: 18, driverId: 31 }, read: false,
  }])
})

test('đánh dấu đã đọc gửi mã số dòng nhật ký và dùng danh sách máy chủ trả lại', async () => {
  const backend = stubBackend({
    'POST /api/notifications/read': { body: envelope({ items: [{ ...item, read: true }], unreadCount: 0, windowDays: 7 }) },
  })
  const feed = await markServerNotificationsRead(['501', '502'])

  expect(backend.calls.map((call) => [call.method, call.path, call.body])).toStrictEqual([['POST', '/api/notifications/read', { ids: [501, 502] }]])
  expect(feed.items.map((entry) => entry.read)).toStrictEqual([true])
})
