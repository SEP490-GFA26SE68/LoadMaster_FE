import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { getMockDb } from '@/lib/mock-db'
import { envelope, stubBackend } from '@/test/fake-backend'
import { fetchTripFormOptions } from './trips-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips', 'companies']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips' || feature === 'companies',
}))

vi.mock('@/features/auth/auth-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth/auth-api')>()),
  getCachedCurrentUser: () => ({ id: '77', fullName: 'Lê Điều Phối', email: 'dp@phuongnam.vn', phone: '', role: 'dispatcher', status: 'active', companyId: '12', lastActiveAt: null }),
}))

/**
 * Form chuyến của máy chủ: công ty là của người đăng nhập bằng máy chủ, kho xuất phát mặc định đọc ở `GET /api/company-warehouses` —
 * không đọc công ty hay kho của kho mẫu (trước đây luôn là "Kho Long Bình").
 */
const emptyPage = { success: true, data: [], page: 0, size: 100, totalElements: 0, totalPages: 1, last: true }

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('kho xuất phát là kho mặc định của công ty trên máy chủ, tài xế mang công ty của người đăng nhập', async () => {
  const listCompanies = vi.spyOn(getMockDb(), 'listCompanies')
  const { calls } = stubBackend({
    'GET /api/vehicles': { body: emptyPage },
    'GET /api/vehicle-types': { body: emptyPage },
    'GET /api/trips/driver-options': { body: envelope([{ id: 9, fullName: 'Trần Văn Hùng' }]) },
    'GET /api/company-warehouses': {
      body: envelope([
        { id: 3, companyId: 12, warehouseName: 'Kho phụ', address: 'Q.9', latitude: 10.8, longitude: 106.8, isDefault: false, isActive: true },
        { id: 4, companyId: 12, warehouseName: 'Kho Phú Thuận', address: '102 Nguyễn Văn Quỳ', latitude: 10.73, longitude: 106.73, isDefault: true, isActive: true },
      ]),
    },
  })
  const options = await fetchTripFormOptions()
  expect(options.depot).toEqual({ name: 'Kho Phú Thuận', address: '102 Nguyễn Văn Quỳ', lat: 10.73, lng: 106.73 })
  expect(options.drivers).toEqual([expect.objectContaining({ id: '9', fullName: 'Trần Văn Hùng', companyId: '12' })])
  expect(calls.find((call) => call.path === '/api/company-warehouses')?.query).toEqual({ activeOnly: 'true' })
  expect(listCompanies).not.toHaveBeenCalled()
})

test('công ty chưa có kho mặc định có toạ độ: form không điền sẵn kho; lỗi của danh mục kho để lộ ra', async () => {
  stubBackend({
    'GET /api/vehicles': { body: emptyPage },
    'GET /api/vehicle-types': { body: emptyPage },
    'GET /api/trips/driver-options': { body: envelope([]) },
    'GET /api/company-warehouses': { body: envelope([{ id: 4, companyId: 12, warehouseName: 'Kho', address: '', latitude: null, longitude: null, isDefault: true, isActive: true }]) },
  })
  await expect(fetchTripFormOptions()).resolves.toMatchObject({ depot: null })

  stubBackend({
    'GET /api/vehicles': { body: emptyPage },
    'GET /api/vehicle-types': { body: emptyPage },
    'GET /api/trips/driver-options': { body: envelope([]) },
    'GET /api/company-warehouses': { status: 500, body: { success: false, message: 'boom' } },
  })
  await expect(fetchTripFormOptions()).rejects.toMatchObject({ status: 500 })
})
