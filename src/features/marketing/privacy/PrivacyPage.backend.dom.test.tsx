import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { TRIAL_AGREEMENT_HOURS, TRIAL_PURGE_DAYS } from '../legal/legal-facts'
import { PrivacyPage } from './PrivacyPage'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['contacts']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'contacts',
}))

/** Liên hệ của khách đi tới máy chủ: trang nói đúng các vai trò máy chủ cho đọc (cả quản lý nền tảng) và việc trả lời qua Brevo. */
function renderPrivacy() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider source="mock">
          <MemoryRouter initialEntries={['/chinh-sach-bao-mat']}>
            <PrivacyPage />
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => sessionStorage.clear())
afterEach(() => sessionStorage.clear())

test('with contacts on the server the policy names the three roles the server lets read them, and says replies go out through Brevo', () => {
  renderPrivacy()
  const contact = screen.getByRole('region', { name: 'Form liên hệ' })
  expect(contact).toHaveTextContent(
    'Chỉ Hỗ trợ khách hàng, Quản lý nền tảng và Quản trị hệ thống của đội LoadMaster đọc và xử lý yêu cầu liên hệ.',
  )
  expect(contact).toHaveTextContent('Yêu cầu được gửi tới máy chủ của LoadMaster.')
  expect(contact).toHaveTextContent(/máy chủ gửi email tới địa chỉ bạn nhập qua Brevo/)
  expect(contact).not.toHaveTextContent(/Bản demo này chưa nối máy chủ/)
})

test('signed in through the server, the policy names Keycloak and the trial deadlines, read from the shared constants', () => {
  renderPrivacy()
  const account = screen.getByRole('region', { name: 'Tài khoản và đăng nhập' })
  expect(account).toHaveTextContent('ứng dụng gửi chúng thẳng tới Keycloak')
  // Thoả thuận dịch vụ thử nghiệm chỉ có khi nhóm `billing` nối máy chủ — ở đây chưa
  expect(account).not.toHaveTextContent('ký thoả thuận')
  const retention = screen.getByRole('region', { name: 'Thời gian lưu' })
  expect(retention).toHaveTextContent(
    `Tài khoản dùng thử chưa ký thoả thuận dịch vụ trong ${TRIAL_AGREEMENT_HOURS} giờ thì bị khoá, và bị xoá hẳn ${TRIAL_PURGE_DAYS} ngày sau khi hết hạn dùng thử.`,
  )
  expect(retention).toHaveTextContent('LoadMaster chưa ấn định thời hạn lưu')
})
