import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { AuditLogPage } from './AuditLogPage'

/**
 * Nhật ký khi người dùng đã nối backend (`users`): backend chưa có nhật ký nên màn nói vậy, không đọc sự kiện của kho mẫu và không gọi
 * backend nào.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['users']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'users',
}))

const fetchCalls: string[] = []

beforeEach(() => {
  fetchCalls.length = 0
  vi.stubGlobal('fetch', (input: string) => {
    fetchCalls.push(input)
    return Promise.resolve(new Response('null', { status: 200 }))
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('says the server has no activity log yet instead of showing the sample events', () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/nhat-ky']}>
          <AuditLogPage />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
  expect(screen.getByRole('heading', { level: 1, name: 'Nhật ký hệ thống' })).toBeInTheDocument()
  expect(screen.getByText('Máy chủ chưa có nhật ký hoạt động')).toBeInTheDocument()
  expect(screen.getByText(/chưa ghi lại thao tác của người dùng/)).toBeInTheDocument()
  // Không bảng, không ô số liệu, không bộ lọc của bản kho mẫu
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  expect(fetchCalls).toStrictEqual([])
})
