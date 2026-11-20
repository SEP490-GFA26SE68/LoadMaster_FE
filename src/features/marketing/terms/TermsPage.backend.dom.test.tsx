import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { TRIAL_AGREEMENT_HOURS, TRIAL_PURGE_DAYS } from '../legal/legal-facts'
import { TermsPage } from './TermsPage'

const SERVER_GROUPS = vi.hoisted(() => new Set(['registration', 'billing', 'trips']))
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: SERVER_GROUPS, keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => SERVER_GROUPS.has(feature),
}))
vi.mock('@/features/registration/registration-capabilities', () => ({ REGISTRATION_CAPABILITIES: { publicSignUp: true } }))

/** Đăng nhập bằng máy chủ, khách tự đăng ký được: trang nói hạn ký thoả thuận, ngày xoá và khoá theo gói cước — đọc từ hằng chung. */
function renderTerms() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider source="mock">
          <MemoryRouter initialEntries={['/dieu-khoan-su-dung']}>
            <TermsPage />
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => sessionStorage.clear())
afterEach(() => sessionStorage.clear())

test('with public sign-up on the server, the trial section states the agreement deadline and the purge delay', () => {
  renderTerms()
  const trial = screen.getByRole('region', { name: 'Dùng thử' })
  expect(trial).toHaveTextContent(`trong ${TRIAL_AGREEMENT_HOURS} giờ kể từ khi tài khoản được cấp`)
  expect(trial).toHaveTextContent(`bị xoá hẳn ${TRIAL_PURGE_DAYS} ngày sau khi hết hạn dùng thử`)
  expect(trial).not.toHaveTextContent('chưa mở đăng ký dùng thử công khai')
  expect(screen.getByRole('region', { name: 'Tài khoản và vai trò' })).toHaveTextContent('khi đăng ký dùng thử được duyệt')
})

test('signed in through the server, an expired plan locks the company and payments are not described as simulated', () => {
  renderTerms()
  const billing = screen.getByRole('region', { name: 'Gói cước, credit, gia hạn và huỷ' })
  expect(billing).toHaveTextContent('nhân viên của công ty không dùng được ứng dụng')
  expect(billing).not.toHaveTextContent(/Ở bản demo này|thanh toán giả lập/)
  expect(screen.getByRole('region', { name: 'Tạm ngừng và chấm dứt' })).toHaveTextContent('Công ty hết gói đang hiệu lực')
  // Phương án của máy chủ không mang MOCK RESULT
  expect(screen.getByRole('region', { name: 'Kết quả tối ưu là ước lượng' })).not.toHaveTextContent('MOCK RESULT')
})
