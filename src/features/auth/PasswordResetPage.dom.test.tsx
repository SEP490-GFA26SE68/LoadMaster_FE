import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { envelope, stubBackend, type FakeRoutes } from '@/test/fake-backend'
import { AuthProvider } from './AuthProvider'
import type { KeycloakSession } from './keycloak-session'
import { PasswordResetPage } from './PasswordResetPage'

/**
 * Đặt mật khẩu mới ngay trong app `/quen-mat-khau`: ba endpoint công khai của backend (`/api/auth/password-reset/*`). Máy chủ từ chối
 * bằng 400 kèm mã của lý do (`OTP_INCORRECT`…) — màn nói đúng lý do; máy chủ cũ trả 400 không mã — màn nói lý do theo bước.
 */

const guest = {
  start: vi.fn(() => Promise.resolve(false)),
  login: vi.fn(() => Promise.resolve()),
  logout: vi.fn(() => Promise.resolve()),
  token: vi.fn(() => Promise.resolve(null)),
  refreshToken: vi.fn(() => Promise.resolve(null)),
  reject: vi.fn(),
  onEnded: vi.fn(() => () => undefined),
} satisfies KeycloakSession

const refused = { status: 400, body: { success: false, message: 'Yêu cầu không hợp lệ' } }
const refusedWith = (code: string) => ({ status: 400, body: { success: false, code, message: 'Yêu cầu không hợp lệ' } })

const happyPath: FakeRoutes = {
  'POST /api/auth/password-reset/request': { body: envelope(null) },
  'POST /api/auth/password-reset/verify': { body: envelope({ resetToken: 've-dat-mat-khau' }) },
  'POST /api/auth/password-reset/reset': { body: envelope(null) },
}

function renderAt(entry: string, source: 'keycloak' | 'mock' = 'keycloak') {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <I18nProvider>
        <AuthProvider source={source} {...(source === 'keycloak' ? { keycloak: guest } : {})}>
          <MemoryRouter initialEntries={[entry]}>
            <Routes>
              <Route path="/quen-mat-khau" element={<PasswordResetPage />} />
              <Route path="/dang-nhap" element={<p>màn đăng nhập</p>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  sessionStorage.clear()
  getMockDb().restoreSession(null)
})
afterEach(() => vi.unstubAllGlobals())

test('email, code and new password set the password in three steps, all on the app screen', async () => {
  const user = userEvent.setup()
  const backend = stubBackend(happyPath)
  renderAt('/quen-mat-khau?email=an%40fastmove.vn')

  // Bước 1: email điền sẵn từ màn đăng nhập
  expect(await screen.findByRole('heading', { level: 1, name: 'Nhập email của bạn' })).toBeInTheDocument()
  expect(screen.getByLabelText('Email')).toHaveValue('an@fastmove.vn')
  await user.click(screen.getByRole('button', { name: 'Gửi mã' }))

  // Bước 2: mã 6 chữ số
  const codeHeading = await screen.findByRole('heading', { level: 1, name: 'Nhập mã xác nhận' })
  expect(codeHeading).toHaveFocus()
  expect(screen.getByText(/Nếu an@fastmove\.vn có trong hệ thống/)).toBeInTheDocument()
  await user.type(screen.getByLabelText('Mã xác nhận'), '12')
  await user.click(screen.getByRole('button', { name: 'Xác nhận mã' }))
  expect(await screen.findByText('Nhập đủ 6 chữ số của mã')).toBeInTheDocument()
  await user.clear(screen.getByLabelText('Mã xác nhận'))
  await user.type(screen.getByLabelText('Mã xác nhận'), '482913')
  await user.click(screen.getByRole('button', { name: 'Xác nhận mã' }))

  // Bước 3: mật khẩu mới, nhập lại phải khớp
  expect(await screen.findByRole('heading', { level: 1, name: 'Đặt mật khẩu mới' })).toBeInTheDocument()
  await user.type(screen.getByLabelText('Mật khẩu mới', { exact: true }), 'MatKhauMoi1')
  await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'MatKhauMoi2')
  await user.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }))
  expect(await screen.findByText('Hai mật khẩu chưa khớp')).toBeInTheDocument()
  await user.clear(screen.getByLabelText('Nhập lại mật khẩu mới'))
  await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'MatKhauMoi1')
  await user.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }))

  const done = await screen.findByRole('status')
  expect(done).toHaveTextContent('Đăng nhập bằng mật khẩu vừa đặt.')
  expect(within(done).getByRole('link', { name: 'Về đăng nhập' })).toHaveAttribute('href', '/dang-nhap')
  expect(backend.calls.map(({ method, path, body }) => ({ method, path, body }))).toStrictEqual([
    { method: 'POST', path: '/api/auth/password-reset/request', body: { email: 'an@fastmove.vn' } },
    { method: 'POST', path: '/api/auth/password-reset/verify', body: { email: 'an@fastmove.vn', otp: '482913' } },
    { method: 'POST', path: '/api/auth/password-reset/reset', body: { resetToken: 've-dat-mat-khau', newPassword: 'MatKhauMoi1' } },
  ])
})

test('asking for a code again too soon says to wait', async () => {
  const user = userEvent.setup()
  stubBackend({ ...happyPath, 'POST /api/auth/password-reset/request': refused })
  renderAt('/quen-mat-khau?email=an%40fastmove.vn')
  await user.click(await screen.findByRole('button', { name: 'Gửi mã' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Bạn vừa yêu cầu mã. Chờ một phút rồi thử lại')
  expect(screen.getByRole('heading', { level: 1, name: 'Nhập email của bạn' })).toBeInTheDocument()
})

test('a wrong code stays on the code step with the reason', async () => {
  const user = userEvent.setup()
  stubBackend({ ...happyPath, 'POST /api/auth/password-reset/verify': refused })
  renderAt('/quen-mat-khau?email=an%40fastmove.vn')
  await user.click(await screen.findByRole('button', { name: 'Gửi mã' }))
  await user.type(await screen.findByLabelText('Mã xác nhận'), '000000')
  await user.click(screen.getByRole('button', { name: 'Xác nhận mã' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Mã không đúng hoặc đã hết hạn.')
  expect(screen.getByRole('heading', { level: 1, name: 'Nhập mã xác nhận' })).toBeInTheDocument()
})

test('an expired reset ticket goes back to the email step and says why', async () => {
  const user = userEvent.setup()
  stubBackend({ ...happyPath, 'POST /api/auth/password-reset/reset': refused })
  renderAt('/quen-mat-khau?email=an%40fastmove.vn')
  await user.click(await screen.findByRole('button', { name: 'Gửi mã' }))
  await user.type(await screen.findByLabelText('Mã xác nhận'), '482913')
  await user.click(screen.getByRole('button', { name: 'Xác nhận mã' }))
  await user.type(await screen.findByLabelText('Mật khẩu mới', { exact: true }), 'MatKhauMoi1')
  await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'MatKhauMoi1')
  await user.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Nhập email của bạn' })).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('Phiên đặt mật khẩu đã hết hạn. Gửi mã mới để làm lại.')
})

test.each([
  ['OTP_RESEND_COOLDOWN', 'Mã vừa được gửi. Chờ một phút rồi gửi lại.'],
  ['OTP_REQUEST_LIMIT_EXCEEDED', 'Bạn đã yêu cầu mã 3 lần trong 15 phút. Thử lại sau.'],
])('a refused code request with %s says exactly why', async (code, sentence) => {
  const user = userEvent.setup()
  stubBackend({ ...happyPath, 'POST /api/auth/password-reset/request': refusedWith(code) })
  renderAt('/quen-mat-khau?email=an%40fastmove.vn')
  await user.click(await screen.findByRole('button', { name: 'Gửi mã' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(sentence)
  expect(screen.getByRole('heading', { level: 1, name: 'Nhập email của bạn' })).toBeInTheDocument()
})

test.each([
  ['OTP_INCORRECT', 'Mã không đúng. Kiểm tra lại email rồi nhập lại.'],
  ['OTP_EXPIRED', 'Mã đã hết hạn (mỗi mã dùng được 3 phút). Gửi mã mới.'],
  ['OTP_ATTEMPTS_EXCEEDED', 'Bạn đã nhập sai 5 lần nên mã bị huỷ. Gửi mã mới.'],
])('a refused code with %s stays on the code step and says exactly why', async (code, sentence) => {
  const user = userEvent.setup()
  stubBackend({ ...happyPath, 'POST /api/auth/password-reset/verify': refusedWith(code) })
  renderAt('/quen-mat-khau?email=an%40fastmove.vn')
  await user.click(await screen.findByRole('button', { name: 'Gửi mã' }))
  await user.type(await screen.findByLabelText('Mã xác nhận'), '000000')
  await user.click(screen.getByRole('button', { name: 'Xác nhận mã' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(sentence)
  expect(screen.getByRole('heading', { level: 1, name: 'Nhập mã xác nhận' })).toBeInTheDocument()
})

test('a reset ticket the server calls RESET_TOKEN_INVALID goes back to the email step', async () => {
  const user = userEvent.setup()
  stubBackend({ ...happyPath, 'POST /api/auth/password-reset/reset': refusedWith('RESET_TOKEN_INVALID') })
  renderAt('/quen-mat-khau?email=an%40fastmove.vn')
  await user.click(await screen.findByRole('button', { name: 'Gửi mã' }))
  await user.type(await screen.findByLabelText('Mã xác nhận'), '482913')
  await user.click(screen.getByRole('button', { name: 'Xác nhận mã' }))
  await user.type(await screen.findByLabelText('Mật khẩu mới', { exact: true }), 'MatKhauMoi1')
  await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'MatKhauMoi1')
  await user.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Nhập email của bạn' })).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('Phiên đặt mật khẩu đã hết hạn. Gửi mã mới để làm lại.')
})

test('the sample store cannot send a code, so the page goes to the login screen', async () => {
  stubBackend(happyPath)
  renderAt('/quen-mat-khau', 'mock')
  expect(await screen.findByText('màn đăng nhập')).toBeInTheDocument()
})
