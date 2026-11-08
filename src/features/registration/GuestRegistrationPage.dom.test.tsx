import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { GuestRegistrationPage } from './GuestRegistrationPage'
import * as api from './api/registration-api'

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/dang-ky']}>
            <GuestRegistrationPage />
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

test('renders step 1 with companyCode and validates all required fields', async () => {
  renderPage()

  expect(screen.getByRole('heading', { level: 1, name: /Đăng Ký Tài Khoản Doanh Nghiệp/i })).toBeInTheDocument()

  const user = userEvent.setup()
  const submitBtn = screen.getByRole('button', { name: /Tiếp tục xác thực OTP/i })

  // Click submit without filling fields
  await user.click(submitBtn)
  expect(screen.getByText('Vui lòng nhập tên công ty')).toBeInTheDocument()
  expect(screen.getByText('Vui lòng nhập mã định danh công ty')).toBeInTheDocument()
  expect(screen.getByText('Vui lòng nhập mã số thuế')).toBeInTheDocument()
  expect(screen.getByText('Vui lòng nhập họ và tên người đại diện')).toBeInTheDocument()
  expect(screen.getByText('Vui lòng nhập email nhận tài khoản')).toBeInTheDocument()
})

test('submitting valid step 1 form passes companyCode to initRegistration', async () => {
  const initSpy = vi.spyOn(api, 'initRegistration').mockResolvedValue({
    token: 'test-paid-token-456',
    status: 'PENDING_OTP',
    companyName: 'Toàn Cầu Logistics',
    taxCode: '0109998888',
    fullName: 'Trần Văn Minh',
    email: 'admin@toancau.vn',
    maskedEmail: 'ad***@toancau.vn',
  })

  renderPage()
  const user = userEvent.setup()

  await user.type(screen.getByPlaceholderText('Công ty Cổ phần Vận tải & Tiếp vận Toàn Cầu'), 'Toàn Cầu Logistics')
  await user.type(screen.getByPlaceholderText('VD: TOANCAU_LOG'), 'toancau_log')
  await user.type(screen.getByPlaceholderText('0101234567'), '0109998888')
  await user.type(screen.getByPlaceholderText('Trần Văn Minh'), 'Trần Văn Minh')
  await user.type(screen.getByPlaceholderText('admin@toancau.vn'), 'admin@toancau.vn')

  await user.click(screen.getByRole('button', { name: /Tiếp tục xác thực OTP/i }))

  expect(initSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      companyName: 'Toàn Cầu Logistics',
      companyCode: 'TOANCAU_LOG',
      taxCode: '0109998888',
      fullName: 'Trần Văn Minh',
      email: 'admin@toancau.vn',
    }),
  )
})
