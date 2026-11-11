import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend } from '@/test/fake-backend'
import type { Role, User } from '@/types/user'
import { addressSearchAvailable, resolveAddress, searchAddress } from './places-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: () => false,
}))

const session = vi.hoisted(() => ({ user: null as User | null }))
vi.mock('@/features/auth/auth-api', () => ({
  isAuthenticated: () => session.user !== null,
  getCachedCurrentUser: () => session.user,
}))

/**
 * Tìm địa chỉ khi đăng nhập bằng máy chủ: gợi ý `GET /api/places/autocomplete`, toạ độ `GET /api/places/detail` (máy chủ gọi Goong).
 * Máy chủ chỉ cho điều phối viên và quản lý công ty tìm — vai trò khác không có ô tìm, nên không gọi máy chủ nào.
 */
function signIn(role: Role) {
  session.user = { id: '7', fullName: 'Lê Thị Điều Phối', email: 'dieuphoi@longbinh.vn', phone: '', role, status: 'active', lastActiveAt: null }
}

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
  session.user = null
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('ô tìm theo vai trò máy chủ cho tìm; chưa đăng nhập bằng máy chủ thì luôn có (địa danh mẫu)', () => {
  expect(addressSearchAvailable()).toBe(true)
  signIn('dispatcher')
  expect(addressSearchAvailable()).toBe(true)
  signIn('companyManager')
  expect(addressSearchAvailable()).toBe(true)
  for (const role of ['driver', 'warehouse', 'companyAdmin', 'systemAdmin'] as const) {
    signIn(role)
    expect(addressSearchAvailable()).toBe(false)
  }
})

test('gợi ý: tên chính, địa chỉ đầy đủ và khu vực của Goong; từ khoá dưới hai ký tự không gọi', async () => {
  signIn('dispatcher')
  const { calls } = stubBackend({
    'GET /api/places/autocomplete': {
      body: envelope({
        status: 'OK',
        predictions: [
          { place_id: 'g-1', description: '12 Cộng Hoà, Tân Bình, Hồ Chí Minh', structured_formatting: { main_text: '12 Cộng Hoà', secondary_text: 'Tân Bình, Hồ Chí Minh' } },
          { place_id: '', description: 'bỏ qua' },
        ],
      }),
    },
  })
  expect(await searchAddress('C')).toEqual([])
  expect(await searchAddress(' cộng hoà ')).toEqual([
    { placeId: 'g-1', name: '12 Cộng Hoà', address: '12 Cộng Hoà, Tân Bình, Hồ Chí Minh', region: 'Tân Bình, Hồ Chí Minh' },
  ])
  expect(calls.map((call) => [call.path, call.query])).toEqual([['/api/places/autocomplete', { input: 'cộng hoà' }]])
})

test('không có kết quả là danh sách rỗng; trạng thái lạ là lỗi', async () => {
  signIn('companyManager')
  stubBackend({ 'GET /api/places/autocomplete': ({ query }) => ({ body: envelope({ status: query.input === 'zzz' ? 'ZERO_RESULTS' : 'REQUEST_DENIED', predictions: [] }) }) })
  expect(await searchAddress('zzz')).toEqual([])
  await expect(searchAddress('kho')).rejects.toThrow()
})

test('chọn gợi ý: toạ độ và địa chỉ đầy đủ của máy chủ; thiếu toạ độ là lỗi', async () => {
  signIn('dispatcher')
  const suggestion = { placeId: 'g-1', name: '12 Cộng Hoà', address: '12 Cộng Hoà', region: '' }
  const { calls } = stubBackend({
    'GET /api/places/detail': ({ query }) => ({
      body: envelope(query.placeId === 'g-1'
        ? { status: 'OK', result: { place_id: 'g-1', formatted_address: '12 Cộng Hoà, Phường 4, Tân Bình', geometry: { location: { lat: 10.8012, lng: 106.6521 } } } }
        : { status: 'OK', result: null }),
    }),
  })
  expect(await resolveAddress(suggestion)).toEqual({ placeId: 'g-1', name: '12 Cộng Hoà', address: '12 Cộng Hoà, Phường 4, Tân Bình', lat: 10.8012, lng: 106.6521 })
  expect(calls[0]?.query).toEqual({ placeId: 'g-1' })
  await expect(resolveAddress({ ...suggestion, placeId: 'g-2' })).rejects.toThrow()
})
