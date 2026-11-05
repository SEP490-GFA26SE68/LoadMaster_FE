import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { TrialRequestsPage } from './TrialRequestsPage'

/** Kho mẫu không có yêu cầu dùng thử: màn nói vậy và không gọi mạng. */
afterEach(() => vi.unstubAllGlobals())

test('sample data: the screen says trial requests need the server and never calls the network', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/nen-tang/yeu-cau-dung-thu']}>
          <TrialRequestsPage />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
  expect(await screen.findByText('Yêu cầu dùng thử chỉ có khi nối máy chủ')).toBeInTheDocument()
  expect(screen.queryByRole('table')).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
})
