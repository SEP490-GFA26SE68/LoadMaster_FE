import { expect, test, vi } from 'vitest'
import { getMockDb } from '@/lib/mock-db'
import { fetchNotifications } from './notifications-api'

/**
 * Chuông khi người dùng nối backend (`users`): sự kiện tài khoản của kho mẫu nói về tài khoản mẫu, không phải tài khoản thật trên màn
 * Người dùng — chuông bỏ chúng, như Nhật ký nói backend chưa có nhật ký.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['users']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'users',
}))

const isAccountEvent = (action: string) => action.startsWith('user.') || action.startsWith('auth.')

test('with users on the backend the bell of the company administrator drops the account events of the mock store', async () => {
  const db = getMockDb()
  // Quản trị hệ thống khoá một tài xế của Long Bình: sự kiện thuộc Long Bình, quản trị công ty đọc được ở nhật ký của kho
  db.restoreSession('US-0005')
  const driver = (await db.listUsers()).find((user) => user.companyId === 'LOG-001' && user.role === 'driver' && user.status === 'active')
  expect(driver).toBeDefined()
  await db.setUserStatus(driver!.id, 'suspended')

  db.restoreSession('US-LB-01')
  expect((await db.listEvents()).some((event) => event.action === 'user.locked' && event.target.id === driver!.id)).toBe(true)
  const feed = await fetchNotifications({ id: 'US-LB-01', role: 'companyAdmin' })
  expect(feed.events.filter((event) => isAccountEvent(event.action))).toStrictEqual([])
})
