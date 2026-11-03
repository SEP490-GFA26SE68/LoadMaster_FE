import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import { AuthProvider, useAuth } from './AuthProvider'
import type { KeycloakSession } from './keycloak-session'
import { RequireAuth } from './RequireAuth'

/**
 * Gốc `/` của khách và của người vừa đăng xuất: khách chưa đăng nhập mở `/` thì sang trang giới thiệu công khai (giữ query và neo), mở
 * trang khác thì về màn đăng nhập (trang đó được ghi nhớ); người đang đăng nhập bấm Đăng xuất thì về màn đăng nhập, không sang trang
 * giới thiệu và không ghi nhớ trang đang đứng — kể cả ở chế độ Keycloak, nơi phiên được mở lại sau khi layout đã mount.
 */
function Where() {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  return <p>{`Đang ở ${location.pathname}${location.search}${location.hash}${from === undefined ? '' : ` · nhớ ${from}`}`}</p>
}

/** Đăng xuất mà không tự điều hướng: chỉ `RequireAuth` quyết định trang kế tiếp. */
function SignOut() {
  const { signOut } = useAuth()
  return <button type="button" onClick={() => void signOut()}>Đăng xuất</button>
}

function renderAt(entry: string, keycloak?: KeycloakSession) {
  render(
    <I18nProvider>
      <AuthProvider {...(keycloak ? { source: 'keycloak' as const, keycloak } : {})}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/dang-nhap" element={<Where />} />
            <Route path="/gioi-thieu" element={<Where />} />
            <Route element={<RequireAuth />}>
              <Route path="*" element={<><SignOut /><Where /></>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </I18nProvider>,
  )
}

/** Phiên Keycloak giả (`signedIn`: trình duyệt còn phiên ở Keycloak) và backend trả hồ sơ một điều phối viên. */
function keycloakSession(signedIn: boolean): KeycloakSession {
  const profile = {
    id: 6, keycloakId: 'kc-6', username: 'an@fastmove.vn', email: 'an@fastmove.vn', fullName: 'Nguyễn Hoài An', phoneNumber: null,
    companyId: 2, status: 'ACTIVE', userRoleType: 'DISPATCHER',
  }
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ success: true, data: profile })) } as Response),
  ))
  return {
    start: vi.fn(() => Promise.resolve(signedIn)),
    login: vi.fn(() => Promise.resolve()),
    logout: vi.fn(() => Promise.resolve()),
    token: vi.fn(() => Promise.resolve(signedIn ? 'TOKEN' : null)),
  }
}

beforeEach(() => {
  sessionStorage.clear()
  getMockDb().restoreSession(null)
})
afterEach(() => vi.unstubAllGlobals())

test('a guest opening the root lands on the public landing page, query and hash kept', async () => {
  renderAt('/?lang=vi#lien-he')
  expect(await screen.findByText('Đang ở /gioi-thieu?lang=vi#lien-he')).toBeInTheDocument()
})

test('a guest opening any other page goes to the sign-in screen, which remembers that page', async () => {
  renderAt('/chuyen?trang=2')
  expect(await screen.findByText('Đang ở /dang-nhap · nhớ /chuyen?trang=2')).toBeInTheDocument()
})

test('signing out on the root goes to the sign-in screen, not to the landing page', async () => {
  const user = userEvent.setup()
  signedInAs('manager')
  renderAt('/')
  expect(await screen.findByText('Đang ở /')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Đăng xuất' }))
  expect(await screen.findByText('Đang ở /dang-nhap')).toBeInTheDocument()
})

test('Keycloak mode: without a session the root still opens the landing page once Keycloak has answered', async () => {
  renderAt('/?lang=en#bang-gia', keycloakSession(false))
  expect(await screen.findByText('Đang ở /gioi-thieu?lang=en#bang-gia')).toBeInTheDocument()
})

test.each(['/', '/chuyen'])('Keycloak mode: signing out of a restored session on %s goes to the sign-in screen and remembers nothing', async (path) => {
  const user = userEvent.setup()
  renderAt(path, keycloakSession(true))
  await user.click(await screen.findByRole('button', { name: 'Đăng xuất' }))
  expect(await screen.findByText('Đang ở /dang-nhap')).toBeInTheDocument()
})
