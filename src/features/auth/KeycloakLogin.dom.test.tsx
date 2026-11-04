import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { AuthError, type AuthErrorCode } from './auth-api'
import { AuthProvider, useAuth } from './AuthProvider'
import type { KeycloakSession } from './keycloak-session'
import { LoginPage } from './LoginPage'
import { RequireAuth } from './RequireAuth'

/** Hình minh hoạ màn đăng nhập đọc `prefers-reduced-motion`; jsdom chưa có `matchMedia`. */
window.matchMedia ??= (query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})

/**
 * Phiên Keycloak giả: `restored` là tab có mở lại được phiên không; `refuse` là mã Keycloak trả khi đăng nhập bằng mật khẩu.
 * `end()` giả lập phiên hết giữa chừng (tab khác đăng xuất, Keycloak đóng phiên).
 */
function fakeSession({ restored = false, refuse }: { restored?: boolean; refuse?: AuthErrorCode } = {}) {
  let signedIn = restored
  const listeners = new Set<() => void>()
  const session = {
    start: vi.fn(() => Promise.resolve(restored)),
    login: vi.fn((_email: string, _password: string) => {
      if (refuse) return Promise.reject(new AuthError(refuse))
      signedIn = true
      return Promise.resolve()
    }),
    logout: vi.fn(() => {
      signedIn = false
      return Promise.resolve()
    }),
    token: vi.fn(() => Promise.resolve(signedIn ? 'TOKEN' : null)),
    onEnded: vi.fn((listener: () => void) => {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    }),
  } satisfies KeycloakSession
  return { session, end: () => listeners.forEach((listener) => listener()) }
}

/** Backend giả: chỉ có `GET /api/users/me`, trả đúng phong bì của backend. */
function backendReturns(status: number, profile?: { userRoleType: string; status?: string }, failure?: { code: string; message: string }) {
  const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => {
    const body =
      failure !== undefined
        ? { success: false, ...failure }
        : profile === undefined
          ? undefined
          : {
              success: true,
              data: { id: 6, keycloakId: 'kc-6', username: 'an@fastmove.vn', email: 'an@fastmove.vn', fullName: 'Nguyễn Hoài An', phoneNumber: null, companyId: 2, status: 'ACTIVE', ...profile },
            }
    return Promise.resolve({ ok: status === 200, status, text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)) } as Response)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function Where() {
  const location = useLocation()
  const { user } = useAuth()
  return <p>{`Đang ở ${location.pathname}${location.search} — ${user?.fullName ?? ''} (${user?.role ?? ''})`}</p>
}

function renderApp(session: KeycloakSession, path = '/dang-nhap') {
  render(
    <I18nProvider>
      <AuthProvider source="keycloak" keycloak={session}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/dang-nhap" element={<LoginPage />} />
            <Route path="/quen-mat-khau" element={<Where />} />
            <Route element={<RequireAuth />}>
              <Route path="*" element={<Where />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </I18nProvider>,
  )
}

async function signInWith(email: string, password: string) {
  const user = userEvent.setup()
  const button = await screen.findByRole('button', { name: 'Đăng nhập' })
  await waitFor(() => expect(button).toBeEnabled())
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Mật khẩu', { exact: true }), password)
  await user.click(button)
  return user
}

beforeEach(() => {
  sessionStorage.clear()
  getMockDb().restoreSession(null)
})
afterEach(() => vi.unstubAllGlobals())

test('the login screen signs in with the email and password form of the app, without demo accounts or a trip to another page', async () => {
  const { session } = fakeSession()
  const fetchMock = backendReturns(200, { userRoleType: 'DISPATCHER' })
  renderApp(session)

  await signInWith('an@fastmove.vn', 'dung-mat-khau')

  expect(await screen.findByText('Đang ở /chuyen — Nguyễn Hoài An (dispatcher)')).toBeInTheDocument()
  expect(session.login).toHaveBeenCalledWith('an@fastmove.vn', 'dung-mat-khau')
  const [url, init] = fetchMock.mock.calls[0] ?? []
  expect(String(url)).toBe('http://localhost:8080/api/users/me')
  expect(init?.headers).toMatchObject({ Authorization: 'Bearer TOKEN' })
  // Dữ liệu vận hành còn là kho mẫu: kho mang phiên của tài khoản mẫu cùng vai trò
  expect(getMockDb().sessionUser()?.role).toBe('dispatcher')
})

test('the keycloak login screen has a forgot-password link carrying the typed email, and no demo accounts', async () => {
  const user = userEvent.setup()
  backendReturns(200, { userRoleType: 'DISPATCHER' })
  renderApp(fakeSession().session)

  await screen.findByRole('button', { name: 'Đăng nhập' })
  expect(screen.queryByText('Tài khoản dùng thử')).not.toBeInTheDocument()
  expect(screen.getByText(/vẫn là dữ liệu mẫu/)).toBeInTheDocument()

  await user.type(screen.getByLabelText('Email'), 'an@fastmove.vn')
  await user.click(screen.getByRole('link', { name: 'Quên mật khẩu?' }))
  expect(await screen.findByText(/^Đang ở \/quen-mat-khau\?email=an%40fastmove\.vn —/)).toBeInTheDocument()
})

test('a tab that still has a session opens the home screen of the backend role without asking for the password', async () => {
  backendReturns(200, { userRoleType: 'ADMIN' })
  const { session } = fakeSession({ restored: true })
  renderApp(session)
  // ADMIN của backend là quản trị công ty
  expect(await screen.findByText('Đang ở /nguoi-dung — Nguyễn Hoài An (companyAdmin)')).toBeInTheDocument()
  expect(session.login).not.toHaveBeenCalled()
})

test('a protected page opened first is not bounced to the login screen while the session is being restored', async () => {
  backendReturns(200, { userRoleType: 'DRIVER' })
  renderApp(fakeSession({ restored: true }).session, '/tai-xe')
  expect(screen.queryByRole('button', { name: 'Đăng nhập' })).not.toBeInTheDocument()
  expect(await screen.findByText('Đang ở /tai-xe — Nguyễn Hoài An (driver)')).toBeInTheDocument()
})

test.each([
  ['a wrong password', 'invalid-credentials' as const, 'Email hoặc mật khẩu không đúng'],
  ['a disabled account', 'account-suspended' as const, 'Tài khoản đã bị khoá. Liên hệ quản trị viên của bạn để mở khoá.'],
  ['a client without in-app login', 'login-not-enabled' as const, 'Máy chủ chưa bật đăng nhập trong ứng dụng. Báo quản trị viên hệ thống.'],
])('%s refused by Keycloak stays on the login screen with the reason', async (_name, refuse, message) => {
  const fetchMock = backendReturns(200, { userRoleType: 'DISPATCHER' })
  renderApp(fakeSession({ refuse }).session)
  await signInWith('an@fastmove.vn', 'sai')
  expect(await screen.findByRole('alert')).toHaveTextContent(message)
  expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeEnabled()
  expect(fetchMock).not.toHaveBeenCalled()
})

test('a temporary password points to setting a new password in the app, with the email filled in', async () => {
  backendReturns(200, { userRoleType: 'DISPATCHER' })
  renderApp(fakeSession({ refuse: 'password-change-required' }).session)
  const user = await signInWith('an@fastmove.vn', 'mat-khau-tam')

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Tài khoản đang dùng mật khẩu tạm. Đặt mật khẩu mới trước khi đăng nhập.')
  await user.click(screen.getByRole('link', { name: 'Đặt mật khẩu mới' }))
  expect(await screen.findByText(/^Đang ở \/quen-mat-khau\?email=an%40fastmove\.vn —/)).toBeInTheDocument()
})

test.each([
  ['a locked account', 200, { userRoleType: 'DISPATCHER', status: 'LOCKED' }, undefined, 'Tài khoản đã bị khoá. Liên hệ quản trị viên của bạn để mở khoá.'],
  ['a role the app does not know', 200, { userRoleType: 'AUDITOR' }, undefined, 'Tài khoản mang vai trò mà ứng dụng chưa hỗ trợ. Liên hệ quản trị viên của bạn.'],
  [
    'a Keycloak account with no user on the server',
    404,
    undefined,
    { code: 'USER_PROFILE_NOT_FOUND', message: 'User profile not found' },
    'Tài khoản đăng nhập được nhưng chưa gắn với người dùng nào trên máy chủ. Liên hệ quản trị viên của bạn.',
  ],
  ['a server that refuses the token', 401, undefined, { code: 'UNAUTHORIZED', message: 'Unauthorized' }, 'Máy chủ không chấp nhận phiên đăng nhập này. Báo quản trị viên hệ thống.'],
  ['a backend that fails', 500, undefined, undefined, 'Không kết nối được máy chủ. Thử lại sau.'],
])('%s after Keycloak accepts the password closes the Keycloak session and shows the reason', async (_name, status, profile, failure, message) => {
  backendReturns(status, profile, failure)
  const { session } = fakeSession()
  renderApp(session)
  await signInWith('an@fastmove.vn', 'dung-mat-khau')
  expect(await screen.findByRole('alert')).toHaveTextContent(message)
  // Để lại phiên thì tab giữ một phiên không dùng được, lần mở trang sau lại vấp đúng lỗi đó
  expect(session.logout).toHaveBeenCalledTimes(1)
})

test('a session that ends mid-way (signed out in another tab) goes back to the login screen', async () => {
  backendReturns(200, { userRoleType: 'DISPATCHER' })
  const { session, end } = fakeSession({ restored: true })
  renderApp(session, '/chuyen')
  await screen.findByText('Đang ở /chuyen — Nguyễn Hoài An (dispatcher)')

  act(end)
  expect(await screen.findByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument()
})

test('signing out closes the sample-store session and the Keycloak session', async () => {
  const user = userEvent.setup()
  const { session } = fakeSession({ restored: true })
  backendReturns(200, { userRoleType: 'DISPATCHER' })
  function SignOut() {
    const { user: current, signOut } = useAuth()
    return current ? <button type="button" onClick={() => void signOut()}>thoát</button> : <p>đã thoát</p>
  }
  render(
    <AuthProvider source="keycloak" keycloak={session}>
      <SignOut />
    </AuthProvider>,
  )
  await user.click(await screen.findByRole('button', { name: 'thoát' }))
  expect(await screen.findByText('đã thoát')).toBeInTheDocument()
  expect(session.logout).toHaveBeenCalledTimes(1)
  expect(getMockDb().sessionUser()).toBeNull()
})
