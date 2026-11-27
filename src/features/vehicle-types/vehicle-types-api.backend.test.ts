import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getMockDb } from '@/lib/mock-db'
import { fetchVehicleBodyStyle } from './vehicle-types-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['fleet']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'fleet',
}))

/** Đội xe nối máy chủ: máy chủ chưa có trường kiểu thân xe, nên khung 3D luôn tự chọn dáng — không đọc kho mẫu, không gọi mạng. */

beforeEach(() => {
  vi.stubGlobal('fetch', () => {
    throw new Error('Máy chủ chưa có kiểu thân xe: không được gọi mạng')
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('with the fleet on the server there is never a body style, even if the mock store has one', async () => {
  const db = getMockDb()
  db.restoreSession('US-0001')
  const type = await db.getVehicleType('VT-001')
  await db.updateVehicleType('VT-001', { ...type, bodyStyle: 'VAN_LARGE' })
  expect(await fetchVehicleBodyStyle('VEHICLE-001')).toBeNull()
})
