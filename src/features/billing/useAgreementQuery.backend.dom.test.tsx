import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend } from '@/test/fake-backend'
import { useMyAgreementQuery } from './useAgreementQuery'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['billing']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'billing',
}))
const viewer = vi.hoisted(() => ({ role: 'companyAdmin' }))
vi.mock('@/features/auth/AuthProvider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth/AuthProvider')>()),
  useAuthSafe: () => ({ user: { role: viewer.role } }),
}))

/** Thoả thuận dịch vụ của công ty chỉ quản trị công ty đọc (máy chủ chỉ cho vai trò đó): vai trò khác không gọi máy chủ. */
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
}

beforeEach(() => connectApiAuth(() => Promise.resolve('token-1')))
afterEach(() => vi.unstubAllGlobals())

test.each(['dispatcher', 'warehouse', 'driver', 'companyManager', 'systemAdmin'])('%s does not read the agreement of the company', async (role) => {
  viewer.role = role
  const { calls } = stubBackend({ 'GET /api/agreements/my-agreement': { body: envelope(null) } })
  const { result } = renderHook(() => useMyAgreementQuery(), { wrapper })
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(result.current.fetchStatus).toBe('idle')
  expect(calls).toStrictEqual([])
})

test('the company admin reads it', async () => {
  viewer.role = 'companyAdmin'
  const { calls } = stubBackend({ 'GET /api/agreements/my-agreement': { body: envelope(null) } })
  const { result } = renderHook(() => useMyAgreementQuery(), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(calls.map((call) => call.path)).toStrictEqual(['/api/agreements/my-agreement'])
})
