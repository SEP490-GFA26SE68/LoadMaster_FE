import { expect, test, vi } from 'vitest'
import { ROLES } from '@/types/user'
import { notificationsReachable } from './notifications-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips', 'warehouse']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips' || feature === 'warehouse',
}))

/** Chuông đọc nhật ký của kho mẫu: vai trò mà dữ liệu chính đã nối backend thì không có chuông, vai trò khác giữ nguyên. */
test('chuyến và kho nối backend: điều phối viên, quản lý công ty, nhân viên kho không có chuông; quản trị, tài xế vẫn có', () => {
  expect(ROLES.filter((role) => !notificationsReachable(role))).toStrictEqual(['companyManager', 'dispatcher', 'warehouse'])
})
