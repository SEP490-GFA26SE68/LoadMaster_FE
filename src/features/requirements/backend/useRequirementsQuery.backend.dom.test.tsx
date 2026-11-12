import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { stubBackend } from '@/test/fake-backend'
import { REQUIREMENTS_LIST_KEY, useRequirementsQuery } from './useRequirementsQuery'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

/**
 * Màn Yêu cầu giao, hộp đưa yêu cầu vào chuyến, form kiện và nhập file kiện cùng đọc danh sách yêu cầu giao của máy chủ qua một khoá
 * (`REQUIREMENTS_LIST_KEY`): mở cùng lúc chỉ đọc máy chủ một lần, và một lần ghi làm mới `['requirements']` là mọi nơi thấy bản mới.
 */
const REQUIREMENT = {
  id: 41, companyId: 1, customerId: null, customerName: null, destination: '12 Lê Lợi, Quận 1', destinationLat: null, destinationLng: null,
  deadline: '2026-11-08T17:00:00', priority: 'HIGH', status: 'PENDING', expectedPackageCount: 2, receivedPackageCount: 2, packageIds: [5, 6],
  note: null, tripId: null, tripCode: null, createdBy: null, createdAt: '2026-11-05T08:00:00',
}
const LIST = { success: true, data: [REQUIREMENT], page: 0, size: 100, totalElements: 1, totalPages: 1, last: true }

beforeEach(() => connectApiAuth(() => Promise.resolve('token-1')))
afterEach(() => vi.unstubAllGlobals())

test('hai nơi đọc danh sách yêu cầu giao dùng chung một bản cache dưới khoá requirements/list, làm mới requirements là đọc lại', async () => {
  const { calls } = stubBackend({ 'GET /api/delivery-requirements': { body: LIST } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>

  const { result } = renderHook(() => ({ page: useRequirementsQuery(), dialog: useRequirementsQuery({ enabled: true }) }), { wrapper })
  await waitFor(() => expect(result.current.page.isSuccess && result.current.dialog.isSuccess).toBe(true))

  expect(REQUIREMENTS_LIST_KEY).toEqual(['requirements', 'list'])
  expect(calls.filter((call) => call.path === '/api/delivery-requirements')).toHaveLength(1)
  expect(result.current.dialog.data).toBe(result.current.page.data)
  expect(client.getQueryData(REQUIREMENTS_LIST_KEY)).toBe(result.current.page.data)

  await client.invalidateQueries({ queryKey: ['requirements'] })
  expect(calls.filter((call) => call.path === '/api/delivery-requirements')).toHaveLength(2)
})

test('hộp thoại đóng (enabled false) không đọc máy chủ', async () => {
  const { calls } = stubBackend({ 'GET /api/delivery-requirements': { body: LIST } })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const { result } = renderHook(() => useRequirementsQuery({ enabled: false }), { wrapper })
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(result.current.fetchStatus).toBe('idle')
  expect(calls).toHaveLength(0)
})
