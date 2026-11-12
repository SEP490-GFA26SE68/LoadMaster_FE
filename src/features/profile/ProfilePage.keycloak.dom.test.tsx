import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import type { KeycloakSession } from '@/features/auth/keycloak-session'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { ProfilePage } from './ProfilePage'

const toastError = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn(), warning: vi.fn(), info: vi.fn() } }))

/** Hồ sơ khi đăng nhập bằng Keycloak: danh tính là của tài khoản trên máy chủ (`GET /api/users/me`), mật khẩu đổi bằng mã gửi qua email. */
const session = {
  start: vi.fn(() => Promise.resolve(true)),
  login: vi.fn((_email: string, _password: string) => Promise.resolve()),
  logout: vi.fn(() => Promise.resolve()),
  token: vi.fn(() => Promise.resolve('TOKEN')),
  refreshToken: vi.fn(() => Promise.resolve('TOKEN')),
  reject: vi.fn(),
  onEnded: vi.fn(() => () => undefined),
} satisfies KeycloakSession

/** Backend giả chỉ có `GET /api/users/me`; mỗi lần đọc lấy họ tên kế tiếp trong `names` — như khi quản trị viên vừa sửa trên máy chủ. */
function backendWith(names: readonly string[], phoneNumber: string | null) {
  let reads = 0
  const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => {
    const fullName = names[Math.min(reads, names.length - 1)]
    reads += 1
    const data = { id: 9, keycloakId: 'kc-9', username: 'kho@loadmaster.vn', email: 'kho@loadmaster.vn', fullName, phoneNumber, companyId: 1, status: 'ACTIVE', userRoleType: 'WAREHOUSE_WORKER' }
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ success: true, data })) } as Response)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderProfile() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <AuthProvider source="keycloak" keycloak={session}>
          <MemoryRouter initialEntries={['/ho-so']}>
            <Routes>
              <Route element={<RequireAuth />}>
                <Route path="/ho-so" element={<ProfilePage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

const factsOf = (identity: HTMLElement) => [...identity.querySelectorAll('dt, dd')].map((cell) => cell.textContent)

beforeEach(() => {
  sessionStorage.clear()
  getMockDb().restoreSession(null)
})
afterEach(() => vi.unstubAllGlobals())

test('the profile shows the server account, read again on opening, and links to setting a new password in the app instead of the two forms', async () => {
  const fetchMock = backendWith(['Trần Văn Kho', 'Trần Văn Khoa'], '0912345678')
  renderProfile()

  // Lần đọc thứ nhất là lúc mở lại phiên; mở màn thì đọc lại nên tên là tên mới nhất trên máy chủ
  const identity = await screen.findByRole('complementary', { name: 'Tài khoản' })
  expect(await within(identity).findByRole('heading', { level: 2, name: 'Trần Văn Khoa' })).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(fetchMock.mock.calls.every(([url]) => String(url).endsWith('/api/users/me'))).toBe(true)
  expect(within(identity).getByText('Nhân viên kho')).toBeInTheDocument()
  // Số điện thoại của máy chủ thay cho kho trực thuộc — kho đang có là của tài khoản mẫu đứng thay, backend chưa có kho
  expect(factsOf(identity)).toStrictEqual(['Email', 'kho@loadmaster.vn', 'Số điện thoại', '0912 345 678'])
  expect(within(identity).getByText(/Quản trị viên sửa họ tên và số điện thoại ở màn Người dùng/)).toBeInTheDocument()

  // Backend chưa có lối tự sửa hồ sơ hay đổi mật khẩu bằng mật khẩu cũ: không có hai form; đổi mật khẩu bằng mã gửi qua email, ngay trong app
  expect(screen.queryByRole('region', { name: 'Thông tin cá nhân' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Mật khẩu hiện tại')).not.toBeInTheDocument()
  const link = within(screen.getByRole('region', { name: 'Mật khẩu' })).getByRole('link', { name: 'Đổi mật khẩu' })
  expect(link).toHaveAttribute('href', '/quen-mat-khau?email=kho%40loadmaster.vn')
  expect(link).not.toHaveAttribute('target')
})

test('reading the account again fails on the server: the account on screen stays and the error is said, not a sign-out', async () => {
  const fetchMock = backendWith(['Trần Văn Kho'], null)
  const first = fetchMock.getMockImplementation()
  fetchMock.mockImplementationOnce((input, init) => first!(input, init))
  fetchMock.mockImplementation(() => Promise.resolve({ ok: false, status: 503, text: () => Promise.resolve('') } as Response))
  renderProfile()
  const identity = await screen.findByRole('complementary', { name: 'Tài khoản' })
  await vi.waitFor(() => expect(toastError).toHaveBeenCalledWith('Máy chủ gặp lỗi. Thử lại sau.'))
  expect(within(identity).getByRole('heading', { level: 2, name: 'Trần Văn Kho' })).toBeInTheDocument()
  expect(session.logout).not.toHaveBeenCalled()
})

test('an account without a phone number on the server shows only the email', async () => {
  backendWith(['Trần Văn Kho'], null)
  renderProfile()
  const identity = await screen.findByRole('complementary', { name: 'Tài khoản' })
  expect(factsOf(identity)).toStrictEqual(['Email', 'kho@loadmaster.vn'])
})
