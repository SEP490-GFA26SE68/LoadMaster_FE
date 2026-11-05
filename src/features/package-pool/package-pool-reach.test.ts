import { expect, test, vi } from 'vitest'
import { can } from '@/features/auth/permissions'
import { packagePoolReachable } from './usePackagePoolQuery'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['packages']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'packages',
}))

// Ma trận quyền của nhánh nhóm: `packages.manage` (quản lý kho kiện) là của nhân viên kho
test('kho kiện nối backend: chỉ người quản lý kho kiện đọc được, người khác không có nút tra cứu hay in lại nhãn', () => {
  expect(packagePoolReachable((permission) => can('warehouse', permission))).toBe(true)
  expect(packagePoolReachable((permission) => can('dispatcher', permission))).toBe(false)
  expect(packagePoolReachable((permission) => can('companyManager', permission))).toBe(false)
})
