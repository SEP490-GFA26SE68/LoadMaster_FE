import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { TRIAL_AGREEMENT_HOURS, TRIAL_PURGE_DAYS } from '../legal/legal-facts'
import { PrivacyPage } from './PrivacyPage'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['contacts', 'assistant']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'contacts' || feature === 'assistant',
}))

/**
 * Liên hệ của khách và trợ lý AI đi tới máy chủ: trang nói đúng các vai trò máy chủ cho đọc (cả quản lý nền tảng), việc trả lời qua Brevo và
 * việc câu hỏi cho trợ lý đi tới Anthropic.
 */
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

test('with the AI assistant on the server, the policy says questions go through the server to Anthropic and lists Anthropic as a recipient', () => {
  renderPrivacy()
  const assistant = screen.getByRole('region', { name: 'Bản thử trên trang giới thiệu và trợ lý' })
  expect(assistant).toHaveTextContent('máy chủ lưu cuộc trò chuyện và gửi câu đó, cùng các lượt trước của cuộc trò chuyện, tới Anthropic')
  expect(assistant).not.toHaveTextContent('câu bạn gõ không được gửi đi')
  // Ô "Mô tả hàng bằng lời" của bản thử cũng gửi mô tả qua máy chủ tới Anthropic
  expect(assistant).toHaveTextContent('mô tả bạn gõ đi tới máy chủ của LoadMaster, và máy chủ gửi nó tới Anthropic để đọc ra số điền vào form')
  const recipients = screen.getByRole('region', { name: 'Bên thứ ba nhận dữ liệu' })
  expect(recipients).toHaveTextContent('Anthropic — mô hình AI soạn câu trả lời của trợ lý Lumo và đọc mô tả hàng của bản thử')
})
