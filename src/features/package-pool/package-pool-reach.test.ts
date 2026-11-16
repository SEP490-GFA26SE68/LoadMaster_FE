import { expect, test, vi } from 'vitest'
import { can } from '@/features/auth/permissions'
import { packagePoolReachable } from './usePackagePoolQuery'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['packages']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'packages',
}))

// Máy chủ cho nhân viên kho, điều phối viên, quản lý công ty đọc kiện — đúng ba vai trò có `packages.view`
test('kho kiện nối backend: ba vai trò có packages.view đọc được, vai trò khác thì không', () => {
  expect(packagePoolReachable((permission) => can('warehouse', permission))).toBe(true)
  expect(packagePoolReachable((permission) => can('dispatcher', permission))).toBe(true)
  expect(packagePoolReachable((permission) => can('companyManager', permission))).toBe(true)
  expect(packagePoolReachable((permission) => can('driver', permission))).toBe(false)
  expect(packagePoolReachable((permission) => can('companyAdmin', permission))).toBe(false)
})
