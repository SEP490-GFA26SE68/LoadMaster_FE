import { expect, test, vi } from 'vitest'
import { can } from '@/features/auth/permissions'
import { quickSearchGroups } from './search-groups'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['packages']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'packages',
}))

test('kho kiện nối backend: ba vai trò đọc được kho kiện đều có nhóm kho kiện', () => {
  expect(quickSearchGroups((permission) => can('companyManager', permission))).toContain('pool')
  expect(quickSearchGroups((permission) => can('dispatcher', permission))).toContain('pool')
  expect(quickSearchGroups((permission) => can('warehouse', permission))).toContain('pool')
})

test('kho kiện nối backend: nhân viên kho vẫn có nhóm loại kiện (đọc GET /api/package-types)', () => {
  expect(quickSearchGroups((permission) => can('warehouse', permission))).toContain('packageTypes')
})
