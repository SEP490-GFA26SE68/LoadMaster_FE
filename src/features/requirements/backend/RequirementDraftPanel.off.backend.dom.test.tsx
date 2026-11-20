import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { stubBackend } from '@/test/fake-backend'
import { RequirementFormDialog } from './RequirementFormDialog'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

/** Nhóm `assistant` tắt: form tạo yêu cầu giao không có ô dán tin nhắn — không nút nào gọi tới trợ lý không có. */
window.matchMedia ??= (query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})

beforeEach(() => connectApiAuth(() => Promise.resolve('token-1')))
afterEach(() => vi.unstubAllGlobals())

test('trợ lý AI chưa nối thì form tạo yêu cầu giao không có panel bản nháp', async () => {
  const { calls } = stubBackend({
    'GET /api/customers': { body: { success: true, data: [], page: 0, size: 100, totalElements: 0, totalPages: 1, last: true } },
    'GET /api/packages': { body: { success: true, data: [], last: true } },
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <RequirementFormDialog open onOpenChange={() => {}} />
      </I18nProvider>
    </QueryClientProvider>,
  )

  const dialog = within(await screen.findByRole('dialog'))
  expect(await dialog.findByRole('textbox', { name: 'Địa chỉ' })).toBeInTheDocument()
  expect(dialog.queryByRole('region', { name: 'Điền nhanh từ tin nhắn của khách' })).toBeNull()
  expect(dialog.queryByRole('button', { name: 'Đọc và điền form' })).toBeNull()
  expect(calls.some((call) => call.path.startsWith('/api/assistant'))).toBe(false)
})
