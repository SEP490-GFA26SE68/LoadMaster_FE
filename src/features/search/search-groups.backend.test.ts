import { expect, test, vi } from 'vitest'
import { can } from '@/features/auth/permissions'
import { quickSearchGroups } from './search-groups'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['packages']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'packages',
}))

test('kho kiện nối backend: quản lý công ty không có nhóm kho kiện (máy chủ trả 403), điều phối viên vẫn có', () => {
  expect(quickSearchGroups((permission) => can('manager', permission))).toStrictEqual(['trips', 'packages', 'requirements', 'vehicles'])
  expect(quickSearchGroups((permission) => can('dispatcher', permission))).toContain('pool')
})
