import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { can as roleCan } from '@/features/auth/permissions'
import { connectApiAuth } from '@/lib/api-client'
import { getMockDb } from '@/lib/mock-db'
import { envelope, page, stubBackend } from '@/test/fake-backend'
import { searchSources } from './quick-search'
import { fetchSearchSources } from './search-api'
import { quickSearchGroups } from './search-groups'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['fleet']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'fleet',
}))

/**
 * Tìm nhanh khi nhóm `fleet` nối backend: nhóm xe đọc `GET /api/vehicles` (kèm loại xe để ghép) và mở Chi tiết xe theo mã của máy chủ;
 * quản lý công ty cũng có nhóm xe vì máy chủ cho vai trò đó đọc đội xe (chỉ đọc); máy chủ từ chối (403) thì nhóm xe rỗng, không lỗi.
 */
const TYPE = {
  id: 7, name: 'Xe tải 5 tấn thùng kín', innerLength: 620, innerWidth: 235, innerHeight: 240, doorWidth: 230, doorHeight: 230,
  maxPayloadKg: 5000, frontAxleLimitKg: null, rearAxleLimitKg: null, maxCogOffsetRatio: 0.15, hazardousCapable: false, vehicleCount: 1, obstacles: [],
}
const HINO = { id: 11, name: 'Hino 500', licensePlate: '51C-123.45', vehicleTypeId: 7, vehicleTypeName: TYPE.name, companyId: 1, companyName: 'Long Bình', status: 'AVAILABLE' }

let status = 200

beforeEach(() => {
  status = 200
  connectApiAuth(() => Promise.resolve('token-1'))
  const denied = { status: 403, body: { success: false, message: 'Access Denied' } }
  stubBackend({
    'GET /api/vehicles': () => (status === 200 ? { body: envelope(page([HINO])) } : denied),
    'GET /api/vehicle-types': () => (status === 200 ? { body: envelope(page([TYPE])) } : denied),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('nhóm xe là xe của máy chủ, không đọc kho mẫu, mở Chi tiết xe theo mã của máy chủ', async () => {
  const listVehicles = vi.spyOn(getMockDb(), 'listVehicles')
  const groups = quickSearchGroups((permission) => roleCan('dispatcher', permission))
  expect(groups).toContain('vehicles')
  const sources = await fetchSearchSources(groups)
  expect(sources.vehicles).toEqual([{ id: '11', name: 'Hino 500 · 51C-123.45' }])
  expect(listVehicles).not.toHaveBeenCalled()
  const [group] = searchSources(sources, 'hino', ['vehicles'])
  expect(group?.results.map((result) => result.href)).toEqual(['/doi-xe/11'])
})

test('quản lý công ty có nhóm xe khi đội xe nối backend (máy chủ cho quản lý đọc xe)', () => {
  expect(quickSearchGroups((permission) => roleCan('companyManager', permission))).toContain('vehicles')
})

test('vai trò không có quyền xem đội xe không có nhóm xe', () => {
  expect(quickSearchGroups((permission) => roleCan('warehouse', permission))).not.toContain('vehicles')
})

test('máy chủ từ chối vai trò (403): nhóm xe rỗng, không lỗi', async () => {
  status = 403
  await expect(fetchSearchSources(['vehicles'])).resolves.toMatchObject({ vehicles: [] })
})
