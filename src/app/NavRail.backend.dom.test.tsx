import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { assistantSession } from '@/features/marketing/assistant/assistant-session'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import { NavRail } from './NavRail'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['assistant']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'assistant',
}))

/**
 * Trợ lý AI nối máy chủ: nút "Trợ lý AI" nằm trên thanh điều hướng, ngay sau Tìm nhanh — không nổi đè lên bảng của màn. Khung chat là của
 * bề mặt ứng dụng (neo góc trên phải, `data-surface="app"`); mở thì focus vào ô gõ, đóng thì focus về nút trên thanh.
 */
window.matchMedia ??= (query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})

afterEach(() => {
  cleanup()
  assistantSession.reset()
})

test('the AI assistant button sits on the nav bar right after quick search and opens the app panel under it', async () => {
  signedInAs('dispatcher')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <TooltipProvider>
            <MemoryRouter initialEntries={['/chuyen']}>
              <NavRail />
            </MemoryRouter>
          </TooltipProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
  const banner = within(screen.getByRole('banner'))
  const assistant = banner.getByRole('button', { name: 'Trợ lý AI' })
  const search = banner.getByRole('button', { name: 'Tìm nhanh' })
  expect(search.compareDocumentPosition(assistant) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(assistant).toHaveAttribute('aria-expanded', 'false')

  const user = userEvent.setup()
  await user.click(assistant)
  const panel = await screen.findByRole('dialog', { name: 'Lumo' }, { timeout: 4000 })
  expect(panel).toHaveAttribute('data-surface', 'app')
  expect(assistant).toHaveAttribute('aria-expanded', 'true')
  expect(within(panel).getByRole('textbox', { name: 'Câu hỏi của bạn' })).toHaveFocus()

  await user.click(within(panel).getByRole('button', { name: 'Đóng trợ lý' }))
  expect(assistant).toHaveAttribute('aria-expanded', 'false')
  expect(assistant).toHaveFocus()
})
