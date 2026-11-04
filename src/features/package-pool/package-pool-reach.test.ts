import { expect, test, vi } from 'vitest'
import { can } from '@/features/auth/permissions'
import { packagePoolReachable } from './usePackagePoolQuery'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['packages']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'packages',
}))

test('kho kiện nối backend: chỉ điều phối viên đọc được, nhân viên kho không có nút tra cứu hay in lại nhãn', () => {
  expect(packagePoolReachable((permission) => can('dispatcher', permission))).toBe(true)
  expect(packagePoolReachable((permission) => can('warehouse', permission))).toBe(false)
  expect(packagePoolReachable((permission) => can('manager', permission))).toBe(false)
})
