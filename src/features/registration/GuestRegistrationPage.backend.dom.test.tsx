import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { GuestRegistrationPage } from './GuestRegistrationPage'
import { RegistrationSuccessPage } from './RegistrationSuccessPage'
import * as api from './registration-api'

/** Trang chỉ chạy khi nhóm `registration` nối backend; đăng nhập vẫn là kho mẫu. */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['registration']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'registration',
}))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider source="mock">
          <MemoryRouter initialEntries={['/dang-ky']}>
            <Routes>
              <Route path="/dang-ky" element={<GuestRegistrationPage />} />
              <Route path="/dang-ky-thanh-cong" element={<RegistrationSuccessPage />} />
            </Routes>
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
    status: 'PENDING_EMAIL_VERIFY',
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
  await user.type(screen.getByLabelText(/Số điện thoại liên hệ/i), '0988776655')

  await user.click(screen.getByRole('button', { name: /Tiếp tục xác thực OTP/i }))

  expect(initSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      companyName: 'Toàn Cầu Logistics',
      companyCode: 'TOANCAU_LOG',
      taxCode: '0109998888',
      fullName: 'Trần Văn Minh',
      email: 'admin@toancau.vn',
      phoneCountry: 'VN',
      phoneNumber: '0988776655',
    }),
  )
})

test('renders the phone input with its country code and rejects VN phone with 8 identical trailing digits', async () => {
  renderPage()
  const user = userEvent.setup()

  // Nút mã vùng hiện mã nước và mã vùng của Việt Nam
  expect(screen.getByRole('button', { name: 'Mã vùng' })).toHaveTextContent('VN+84')

  // Rejects 0911111111 (8 identical trailing digits)
  await user.type(screen.getByLabelText(/Số điện thoại liên hệ/i), '0911111111')
  await user.click(screen.getByRole('button', { name: /Tiếp tục xác thực OTP/i }))
  expect(screen.getByText(/8 số cuối không được trùng nhau/i)).toBeInTheDocument()

  // Nút mã vùng mở danh sách năm nước, tên nước theo ngôn ngữ đang chọn
  await user.click(screen.getByRole('button', { name: 'Mã vùng' }))
  expect(screen.getAllByRole('option')).toHaveLength(5)
  expect(screen.getByRole('option', { name: /Nhật Bản/ })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: /Hàn Quốc/ })).toBeInTheDocument()
  await user.click(screen.getByRole('option', { name: /Singapore/i }))
  expect(screen.getByRole('button', { name: 'Mã vùng' })).toHaveTextContent('SG+65')
})

test('completes full 4-step registration and executes payment with BE BillingCycle enum without discount', async () => {
  vi.spyOn(api, 'initRegistration').mockResolvedValue({
    token: 'session-token-789',
    status: 'PENDING_EMAIL_VERIFY',
    companyName: 'Toàn Cầu Logistics',
    taxCode: '0109998888',
    fullName: 'Trần Văn Minh',
    email: 'admin@toancau.vn',
    maskedEmail: 'ad***@toancau.vn',
  })
  vi.spyOn(api, 'verifyRegistrationOtp').mockResolvedValue({
    token: 'session-token-789',
    status: 'EMAIL_VERIFIED',
    companyName: 'Toàn Cầu Logistics',
    taxCode: '0109998888',
    fullName: 'Trần Văn Minh',
    email: 'admin@toancau.vn',
  })
  vi.spyOn(api, 'acceptRegistrationPolicy').mockResolvedValue({
    token: 'session-token-789',
    status: 'POLICY_ACCEPTED',
    companyName: 'Toàn Cầu Logistics',
    taxCode: '0109998888',
    fullName: 'Trần Văn Minh',
    email: 'admin@toancau.vn',
  })
  const initPaymentSpy = vi.spyOn(api, 'initRegistrationPayment').mockResolvedValue({
    paymentUrl: '/api/payment/mock-checkout?txnRef=REG_ABC12345',
    paymentRef: 'REG_ABC12345',
    amountVnd: 24_000_000,
  })
  const mockCheckoutSpy = vi.spyOn(api, 'executeMockRegistrationCheckout').mockResolvedValue({
    success: true,
    txnRef: 'REG_ABC12345',
    callbackResult: {
      RspCode: '00',
      Message: 'Confirm Success',
    },
  })

  renderPage()
  const user = userEvent.setup()

  // Step 1
  await user.type(screen.getByPlaceholderText('Công ty Cổ phần Vận tải & Tiếp vận Toàn Cầu'), 'Toàn Cầu Logistics')
  await user.type(screen.getByPlaceholderText('VD: TOANCAU_LOG'), 'toancau_log')
  await user.type(screen.getByPlaceholderText('0101234567'), '0109998888')
  await user.type(screen.getByPlaceholderText('Trần Văn Minh'), 'Trần Văn Minh')
  await user.type(screen.getByPlaceholderText('admin@toancau.vn'), 'admin@toancau.vn')
  await user.type(screen.getByLabelText(/Số điện thoại liên hệ/i), '0988776655')
  await user.click(screen.getByRole('button', { name: /Tiếp tục xác thực OTP/i }))

  // Step 2
  const otpInput = await screen.findByPlaceholderText('Nhập 6 số OTP')
  await user.type(otpInput, '123456')
  await user.click(screen.getByRole('button', { name: /Xác nhận OTP/i }))

  // Step 3
  const policyCheckbox = await screen.findByRole('checkbox')
  await user.click(policyCheckbox)
  await user.click(screen.getByRole('button', { name: /Đồng ý & Tiếp tục/i }))

  // Step 4: Choose 1 year cycle and submit payment
  const oneYearBtn = await screen.findByRole('button', { name: /Thanh toán 1 năm/i })
  await user.click(oneYearBtn)
  await user.click(screen.getByRole('button', { name: /Thanh toán qua VNPay/i }))

  expect(initPaymentSpy).toHaveBeenCalledWith({
    token: 'session-token-789',
    planId: 1,
    billingCycle: 'YEARLY',
  })
  expect(mockCheckoutSpy).toHaveBeenCalledWith('REG_ABC12345')

  expect(await screen.findByRole('heading', { name: /Kích Hoạt Tài Khoản Thành Công/i })).toBeInTheDocument()
  expect(screen.getByText(/REG_ABC12345/i)).toBeInTheDocument()
})
