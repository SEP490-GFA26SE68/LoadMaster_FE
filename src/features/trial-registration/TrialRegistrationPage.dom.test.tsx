import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { TrialRegistrationPage } from './TrialRegistrationPage'
import * as api from './trial-registration-api'

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/dang-ky-trai-nghiem']}>
            <TrialRegistrationPage />
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

test('renders step 1 with all required fields and validates tax code format', async () => {
  renderPage()

  expect(screen.getByRole('heading', { level: 1, name: /Đăng Ký Trải Nghiệm Giải Pháp/i })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: /1\. Thông tin Doanh nghiệp/i })).toBeInTheDocument()

  const user = userEvent.setup()
  const submitBtn = screen.getByRole('button', { name: /Tiếp tục xác thực OTP/i })

  // Click submit with empty fields -> shows errors
  await user.click(submitBtn)
  expect(screen.getByText('Vui lòng nhập tên doanh nghiệp')).toBeInTheDocument()
  expect(screen.getByText('Vui lòng nhập mã số thuế')).toBeInTheDocument()

  // Type invalid tax code
  const taxInput = screen.getByPlaceholderText('0101234567')
  await user.type(taxInput, '123')
  await user.click(submitBtn)
  expect(screen.getByText(/Mã số thuế phải có 10 hoặc 13 chữ số/i)).toBeInTheDocument()
})

test('filling valid info calls init API and moves to step 2 OTP', async () => {
  vi.spyOn(api, 'initGuestTrial').mockResolvedValue({
    token: 'test-token-123',
    email: 'test@company.com',
    maskedEmail: 'te***@company.com',
    otpExpiresAt: '2026-11-08T12:00:00Z',
    otpResendAllowedAt: '2026-11-08T11:01:00Z',
    message: 'Mã xác thực OTP đã được gửi.',
  })

  renderPage()
  const user = userEvent.setup()

  await user.type(screen.getByPlaceholderText('Công ty TNHH Vận tải & Logistics ABC'), 'Công ty ABC')
  await user.type(screen.getByPlaceholderText('0101234567'), '0101234567')
  await user.type(screen.getByPlaceholderText('Nguyễn Văn A'), 'Nguyễn Văn B')
  await user.type(screen.getByPlaceholderText('admin@doanhnghiep.vn'), 'test@company.com')

  await user.click(screen.getByRole('button', { name: /Tiếp tục xác thực OTP/i }))

  expect(await screen.findByRole('heading', { level: 2, name: /2\. Xác thực Email/i })).toBeInTheDocument()
  expect(screen.getByPlaceholderText('Nhập 6 số OTP')).toBeInTheDocument()
})

