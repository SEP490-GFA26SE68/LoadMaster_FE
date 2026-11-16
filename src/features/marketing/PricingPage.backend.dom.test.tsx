import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { PricingPage } from './PricingPage'

/**
 * Lối vào hai luồng đăng ký công khai khi nhóm `registration` nối backend (danh mục gói vẫn đọc kho mẫu): đầu trang có hai nút kính, thẻ
 * gói có "Đăng ký dùng ngay" (mọi gói) và "Đăng ký trải nghiệm" (chỉ gói Basic), tất cả là nút phụ — nút chính vẫn là "Nhận tư vấn".
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['registration']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'registration',
}))

const SLOW = { timeout: 5000 }

function renderPricing() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider source="mock">
          <MemoryRouter initialEntries={['/bang-gia']}>
            <PricingPage />
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => sessionStorage.clear())
afterEach(() => sessionStorage.clear())

test('guests see the sign-up entry points: header buttons and plan-card links, trial only on Basic', async () => {
  renderPricing()
  await screen.findByRole('heading', { level: 2, name: 'Pro' }, SLOW)

  const header = screen.getByRole('banner')
  expect(within(header).getByRole('link', { name: 'Đăng ký trải nghiệm' })).toHaveAttribute('href', '/dang-ky-trai-nghiem')
  expect(within(header).getByRole('link', { name: 'Đăng ký dùng ngay' })).toHaveAttribute('href', '/dang-ky')

  const basic = screen.getByRole('group', { name: 'Basic' })
  expect(within(basic).getByRole('link', { name: 'Đăng ký dùng ngay gói Basic' })).toHaveAttribute('href', '/dang-ky?planId=PLAN-001')
  expect(within(basic).getByRole('link', { name: 'Đăng ký trải nghiệm gói Basic' })).toHaveAttribute('href', '/dang-ky-trai-nghiem?planId=PLAN-001')
  expect(within(basic).getByRole('link', { name: 'Liên hệ tư vấn gói Basic' })).toBeInTheDocument()

  const pro = screen.getByRole('group', { name: 'Pro' })
  expect(within(pro).getByRole('link', { name: 'Đăng ký dùng ngay gói Pro' })).toHaveAttribute('href', '/dang-ky?planId=PLAN-002')
  expect(within(pro).queryByRole('link', { name: /Đăng ký trải nghiệm/ })).not.toBeInTheDocument()
  expect(within(pro).getByRole('link', { name: 'Liên hệ tư vấn gói Pro' })).toHaveAttribute('href', '/gioi-thieu?goi=PLAN-002&loai=bao-gia#lien-he')
})
