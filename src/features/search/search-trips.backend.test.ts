import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { can as roleCan } from '@/features/auth/permissions'
import { connectApiAuth } from '@/lib/api-client'
import { getMockDb } from '@/lib/mock-db'
import { envelope, page, stubBackend } from '@/test/fake-backend'
import { searchSources } from './quick-search'
import { fetchSearchSources } from './search-api'
import { quickSearchGroups } from './search-groups'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

/**
 * Tìm nhanh khi nhóm `trips` nối backend: nhóm chuyến đọc `GET /api/trips` và mở Chi tiết chuyến theo mã chuyến của máy chủ; nhóm kiện
 * của chuyến bị bỏ vì máy chủ chưa trả kiện của chuyến; máy chủ từ chối (403) thì nhóm chuyến rỗng, không lỗi.
 */
const ROW = { id: 42, tripCode: 'TRIP-20261019-7F3A', tripName: 'Biên Hoà – Dĩ An', status: 'IN_TRANSIT' }

let status = 200

beforeEach(() => {
  status = 200
  connectApiAuth(() => Promise.resolve('token-1'))
  stubBackend({ 'GET /api/trips': () => (status === 200 ? { body: envelope(page([ROW])) } : { status, body: { success: false, message: 'Access Denied' } }) })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('nhóm chuyến là chuyến của máy chủ, không đọc kho mẫu; nhóm kiện của chuyến không còn', async () => {
  const listTrips = vi.spyOn(getMockDb(), 'listTrips')
  const groups = quickSearchGroups((permission) => roleCan('dispatcher', permission))
  expect(groups).toContain('trips')
  expect(groups).not.toContain('packages')
  const sources = await fetchSearchSources(groups)
  expect(sources.trips).toEqual([{ id: 'TRIP-20261019-7F3A', name: 'Biên Hoà – Dĩ An', stops: [], packageIds: [] }])
  expect(listTrips).not.toHaveBeenCalled()
  const [group] = searchSources(sources, 'bien hoa', ['trips'])
  expect(group?.results.map((result) => result.href)).toEqual(['/chuyen/TRIP-20261019-7F3A'])
})

test('máy chủ từ chối vai trò (403): nhóm chuyến rỗng, không lỗi', async () => {
  status = 403
  await expect(fetchSearchSources(['trips'])).resolves.toMatchObject({ trips: [] })
})
