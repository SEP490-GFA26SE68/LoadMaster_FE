import { expect, test, vi } from 'vitest'
import { can } from '@/features/auth/permissions'
import { quickSearchGroups } from './search-groups'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['packages']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'packages',
}))

test('kho kiện nối backend: chỉ nhân viên kho (giữ packages.manage) có nhóm kho kiện', () => {
  expect(quickSearchGroups((permission) => can('companyManager', permission))).toStrictEqual(['trips', 'packages', 'requirements', 'vehicles'])
  expect(quickSearchGroups((permission) => can('dispatcher', permission))).not.toContain('pool')
  expect(quickSearchGroups((permission) => can('warehouse', permission))).toContain('pool')
})

test('kho kiện nối backend: không còn nhóm loại kiện (chỉ có ở kho mẫu)', () => {
  expect(quickSearchGroups((permission) => can('warehouse', permission))).not.toContain('packageTypes')
})
