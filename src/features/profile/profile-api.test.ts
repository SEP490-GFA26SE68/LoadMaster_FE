import { expect, test, vi } from 'vitest'
import { accountConsoleUrl } from './profile-api'

/** Keycloak của môi trường đang chạy: địa chỉ đã bỏ dấu `/` cuối (`backend-config.ts`), tên realm có thể chứa ký tự cần mã hoá. */
vi.mock('@/lib/backend-config', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/backend-config')>()
  return {
    ...original,
    backendConfig: { ...original.backendConfig, keycloak: { url: 'https://sso.vantai.vn/auth', realm: 'load master', clientId: 'loadmaster-web' } },
  }
})

test('the account page link points at the Keycloak account console of the configured realm', () => {
  expect(accountConsoleUrl()).toBe('https://sso.vantai.vn/auth/realms/load%20master/account')
})
