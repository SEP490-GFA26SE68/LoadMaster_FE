import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import { PublicFooter } from '../PublicFooter'

/**
 * Khi nhóm `registration` nối backend, khách chưa đăng nhập tự đăng ký được: cột Tài khoản của chân trang có thêm hai lối đăng ký, cùng
 * chữ và cùng đích với đầu trang. Người đã đăng nhập không thấy lối nào. Kho mẫu: `PublicFooter.dom.test.tsx`.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['registration']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'registration',
}))

function renderFooter() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider source="mock">
          <MemoryRouter initialEntries={['/gioi-thieu']}>
            <PublicFooter />
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

function linksOf(region: HTMLElement) {
  return within(region).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])
}

beforeEach(() => sessionStorage.clear())
afterEach(() => sessionStorage.clear())

test('a guest finds both sign-up routes in the account column, after the sign-in link', () => {
  renderFooter()
  expect(linksOf(screen.getByRole('navigation', { name: 'Tài khoản' }))).toStrictEqual([
    ['Đăng nhập', '/dang-nhap'],
    ['Đăng ký trải nghiệm', '/dang-ky-trai-nghiem'],
    ['Đăng ký dùng ngay', '/dang-ky'],
  ])
})

test('a signed-in user sees no sign-up route, only the way into the app', async () => {
  signedInAs('dispatcher')
  renderFooter()
  const account = screen.getByRole('navigation', { name: 'Tài khoản' })
  expect(await within(account).findByRole('link', { name: 'Vào ứng dụng' })).toHaveAttribute('href', '/chuyen')
  expect(linksOf(account)).toStrictEqual([['Vào ứng dụng', '/chuyen']])
})

test('the sign-up links read in English', () => {
  sessionStorage.setItem('loadmaster.ngon-ngu', 'en')
  renderFooter()
  expect(linksOf(screen.getByRole('navigation', { name: 'Account' }))).toStrictEqual([
    ['Sign in', '/dang-nhap'],
    ['Try for free', '/dang-ky-trai-nghiem'],
    ['Get started', '/dang-ky'],
  ])
})
