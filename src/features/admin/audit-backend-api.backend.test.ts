import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { auditPage, serverAuditLog } from '@/test/audit-backend'
import { stubBackend } from '@/test/fake-backend'
import { fetchServerAuditLog } from './audit-backend-api'

/**
 * Nhật ký nối backend (`usesBackend('users')`): đọc đúng một trang của `GET /api/audit-logs` kèm bộ lọc, giữ tổng của máy chủ, đổi vai
 * trò backend sang vai trò của app và chỉ giữ giá trị đơn của trước / sau.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['users']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'users',
}))

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('đọc một trang theo bộ lọc, tổng là của máy chủ', async () => {
  const backend = stubBackend({
    'GET /api/audit-logs': { body: auditPage([serverAuditLog({ entityCode: 'TRIP-20261104-A1' }), serverAuditLog({ id: 502 })], { page: 2, totalElements: 137 }) },
  })
  const result = await fetchServerAuditLog({
    page: 2, size: 50, from: '2026-11-01', to: '2026-11-05', actionType: 'TRIP_CANCELLED', userId: '7', companyId: 'platform', q: 'huỷ',
  })

  expect(backend.calls.map((call) => [call.path, call.query])).toStrictEqual([['/api/audit-logs', {
    page: '2', size: '50', from: '2026-11-01', to: '2026-11-05', actionType: 'TRIP_CANCELLED', userId: '7', companyId: 'platform', q: 'huỷ',
  }]])
  expect(result.total).toBe(137)
  expect(result.entries[0]).toStrictEqual({
    id: '501', at: '2026-11-04T02:15:00.000Z', actionType: 'TRIP_STATUS_TRANSITION', entityName: 'Trip', entityId: '42',
    entityCode: 'TRIP-20261104-A1', actorId: '7', actorName: 'Phạm Minh Khôi', actorRole: 'dispatcher', companyName: 'Vận tải Long Bình',
    before: { status: 'PLANNED' }, after: { status: 'LOADING' },
  })
  // Máy chủ cũ không trả mã chuyến
  expect(result.entries[1]?.entityCode).toBeNull()
})

test('bản ghi của hệ thống; giá trị lồng nhau bị bỏ', async () => {
  stubBackend({
    'GET /api/audit-logs': { body: auditPage([serverAuditLog({
      actionType: 'ROUTE_OPTIMIZED', userId: null, userName: null, userRole: null, companyId: null, companyName: null,
      oldValues: null, newValues: { stops: [{ id: 1 }], totalKm: 42.5, plan: { legs: 3 } },
    })]) },
  })
  const { entries } = await fetchServerAuditLog({ page: 0, size: 50 })
  expect(entries[0]).toMatchObject({ actorId: null, actorName: null, actorRole: null, companyName: null, before: {}, after: { totalKm: 42.5 } })
})

test('vai trò quản trị công ty của backend (`ADMIN`) là quản trị công ty; vai trò lạ không có nhãn', async () => {
  stubBackend({
    'GET /api/audit-logs': { body: auditPage([serverAuditLog({ userRole: 'ADMIN' }), serverAuditLog({ id: 502, userRole: 'AUDITOR' })]) },
  })
  const { entries } = await fetchServerAuditLog({ page: 0, size: 50 })
  expect(entries.map((entry) => entry.actorRole)).toStrictEqual(['companyAdmin', null])
})
