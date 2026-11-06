import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend } from '@/test/fake-backend'
import { clearPackageFlag, fetchPackage } from './packages-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['packages']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'packages',
}))

/** Cờ của kiện bản máy chủ: kiện kho bỏ khỏi chuyến mang cờ thiếu / hỏng; điều phối viên gỡ cờ bằng `DELETE /api/packages/{id}/flag`. */
const PACKAGE = {
  id: 5, orderId: null, packageTypeId: null, deliveryRequirementId: null, customerName: null, receivedPackageCount: null, expectedPackageCount: null,
  packageCode: 'LB-0005', trackingBarcode: null, qrToken: 'qr-5', actualLength: 60, actualWidth: 40, actualHeight: 30, actualWeightKg: 12.5,
  handlingClass: 'STANDARD', destination: '12 Lê Lợi, Quận 1', status: 'PENDING', flag: 'NOT_FOUND', isPinned: false, packageName: null, note: null,
  orientation: null, uprightOnly: null, fragilityLevel: null, stackable: null, maxTopLoadKg: null, maxLayers: null, minSupportRatio: null,
  priority: null, mustLoad: null, packingGroup: null,
}

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('kiện đọc kèm cờ của máy chủ; máy chủ cũ không trả cờ thì kiện không cờ', async () => {
  const { flag: _omitted, ...legacy } = PACKAGE
  stubBackend({
    'GET /api/packages/5': { body: envelope(PACKAGE) },
    'GET /api/packages/6': { body: envelope({ ...legacy, id: 6 }) },
  })
  expect((await fetchPackage('5')).flag).toBe('NOT_FOUND')
  expect((await fetchPackage('6')).flag).toBeNull()
})

test('gỡ cờ gọi DELETE …/flag và trả kiện không cờ', async () => {
  const { calls } = stubBackend({ 'DELETE /api/packages/5/flag': { body: envelope({ ...PACKAGE, flag: null }) } })
  const cleared = await clearPackageFlag('5')
  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(['DELETE /api/packages/5/flag'])
  expect(cleared.flag).toBeNull()
})
