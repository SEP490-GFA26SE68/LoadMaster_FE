import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { AuthProvider, useAuth } from './AuthProvider'
import type { KeycloakSession } from './keycloak-session'
import { LoginPage } from './LoginPage'
import { RequireAuth } from './RequireAuth'

/** Hình minh hoạ màn đăng nhập đọc `prefers-reduced-motion`; jsdom chưa có `matchMedia`. */
window.matchMedia ??= (query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})

/** Phiên Keycloak giả: `signedIn` là trình duyệt có còn phiên ở Keycloak hay không. */
function fakeSession(signedIn: boolean) {
  const session = {
    start: vi.fn(() => Promise.resolve(signedIn)),
    login: vi.fn((_returnTo: string) => Promise.resolve()),
    logout: vi.fn((_returnTo: string) => Promise.resolve()),
    token: vi.fn(() => Promise.resolve(signedIn ? 'TOKEN' : null)),
  } satisfies KeycloakSession
  return session
}

/** Backend giả: chỉ có `GET /api/users/me`, trả đúng phong bì của backend. */
function backendReturns(status: number, profile?: { userRoleType: string; status?: string; fullName?: string; email?: string }) {
  const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
    Promise.resolve({
      ok: status === 200,
      status,
      text: () =>
        Promise.resolve(
          profile === undefined
            ? ''
            : JSON.stringify({
                success: true,
                data: { id: 6, keycloakId: 'kc-6', username: 'an@fastmove.vn', email: 'an@fastmove.vn', fullName: 'Nguyễn Hoài An', phoneNumber: null, companyId: 2, status: 'ACTIVE', ...profile },
              }),
        ),
    } as Response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function Where() {
  const location = useLocation()
  const { user } = useAuth()
  return <p>{`Đang ở ${location.pathname} — ${user?.fullName ?? ''} (${user?.role ?? ''})`}</p>
}

function renderApp(session: KeycloakSession, path = '/dang-nhap') {
  render(
    <I18nProvider>
      <AuthProvider source="keycloak" keycloak={session}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/dang-nhap" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route path="*" element={<Where />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </I18nProvider>,
  )
}

beforeEach(() => {
  sessionStorage.clear()
  getMockDb().restoreSession(null)
})
afterEach(() => vi.unstubAllGlobals())

test('without a Keycloak session the login screen offers one button and no password form or demo accounts', async () => {
  const user = userEvent.setup()
  const session = fakeSession(false)
  backendReturns(200, { userRoleType: 'DISPATCHER' })
  renderApp(session)

  // Trong lúc hỏi Keycloak nút mang vòng quay; hỏi xong nút bấm được và tên trở lại đúng chữ
  const button = await screen.findByRole('button', { name: 'Đăng nhập' })
  await waitFor(() => expect(button).toBeEnabled())
  expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  expect(screen.queryByText('Tài khoản dùng thử')).not.toBeInTheDocument()
  expect(screen.getByText(/vẫn là dữ liệu mẫu/)).toBeInTheDocument()

  await user.click(button)
  expect(session.login).toHaveBeenCalledWith(`${window.location.origin}/dang-nhap`)
})

test('coming back from Keycloak reads the profile with the session token and opens the home screen of the backend role', async () => {
  const session = fakeSession(true)
  const fetchMock = backendReturns(200, { userRoleType: 'DISPATCHER' })
  renderApp(session)

  expect(await screen.findByText('Đang ở /chuyen — Nguyễn Hoài An (dispatcher)')).toBeInTheDocument()
  const [url, init] = fetchMock.mock.calls[0] ?? []
  expect(String(url)).toBe('http://localhost:8080/api/users/me')
  expect(init?.headers).toMatchObject({ Authorization: 'Bearer TOKEN' })
  // Dữ liệu vận hành còn là kho mẫu: kho mang phiên của tài khoản mẫu cùng vai trò
  expect(getMockDb().sessionUser()?.role).toBe('dispatcher')
})

test("the backend's ADMIN is the company administrator and lands on the users screen", async () => {
  backendReturns(200, { userRoleType: 'ADMIN' })
  renderApp(fakeSession(true))
  expect(await screen.findByText('Đang ở /nguoi-dung — Nguyễn Hoài An (companyAdmin)')).toBeInTheDocument()
})

test('a protected page opened first is not bounced to the login screen while Keycloak is still answering', async () => {
  backendReturns(200, { userRoleType: 'DRIVER' })
  renderApp(fakeSession(true), '/tai-xe')
  expect(screen.queryByRole('button', { name: 'Đăng nhập' })).not.toBeInTheDocument()
  expect(await screen.findByText('Đang ở /tai-xe — Nguyễn Hoài An (driver)')).toBeInTheDocument()
})

test.each([
  ['a locked account', { userRoleType: 'DISPATCHER', status: 'LOCKED' }, 200, 'Tài khoản đã bị khoá. Liên hệ quản trị viên của bạn để mở khoá.'],
  ['a role the app does not know', { userRoleType: 'AUDITOR' }, 200, 'Tài khoản mang vai trò mà ứng dụng chưa hỗ trợ. Liên hệ quản trị viên của bạn.'],
  ['a backend that fails', undefined, 500, 'Không kết nối được máy chủ. Thử lại sau.'],
])('%s stays on the login screen with the reason', async (_name, profile, status, message) => {
  backendReturns(status, profile)
  renderApp(fakeSession(true))
  expect(await screen.findByRole('alert')).toHaveTextContent(message)
  expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeEnabled()
})

test('signing out closes the sample-store session and the Keycloak session', async () => {
  const user = userEvent.setup()
  const session = fakeSession(true)
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
  expect(session.logout).toHaveBeenCalledWith(`${window.location.origin}/dang-nhap`)
  expect(getMockDb().sessionUser()).toBeNull()
})
