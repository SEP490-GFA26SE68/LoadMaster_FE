import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import { LandingPage } from './LandingPage'

/**
 * Khi nhóm `registration` nối backend, lối vào dễ thấy nhất của luồng dùng thử là nút chính của phần mở đầu: "Đăng ký trải nghiệm" là nút
 * chính duy nhất, "Nhận tư vấn" lùi thành nút kính. Người đã đăng nhập không cần đăng ký nên nút chính vẫn là "Nhận tư vấn".
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['registration']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'registration',
}))

/** Nút chính của V2.3 là nền gradient `--primary-fill-*`; chỉ một nút trên trang được mang nó. */
const isPrimary = (element: HTMLElement) => element.className.includes('from-primary-fill-from')

function renderLanding() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider source="mock">
          <MemoryRouter initialEntries={['/gioi-thieu']}>
            <LandingPage />
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => sessionStorage.clear())
afterEach(() => sessionStorage.clear())

test('a guest sees sign-up as the one primary action of the hero, with consulting beside it', () => {
  renderLanding()
  const hero = within(screen.getByRole('region', { name: 'Tận dụng thùng xe, dỡ đúng thứ tự, theo dõi tới điểm giao cuối.' }))

  const trial = hero.getByRole('link', { name: 'Đăng ký trải nghiệm' })
  expect(trial).toHaveAttribute('href', '/dang-ky-trai-nghiem')
  expect(isPrimary(trial)).toBe(true)
  const consult = hero.getByRole('link', { name: 'Nhận tư vấn' })
  expect(consult).toHaveAttribute('href', '/gioi-thieu#lien-he')
  expect(isPrimary(consult)).toBe(false)

  expect(screen.getAllByRole('link').filter(isPrimary)).toEqual([trial])
})

test('a signed-in user has nothing to sign up for: consulting stays the primary action', () => {
  signedInAs('dispatcher')
  renderLanding()
  const hero = within(screen.getByRole('region', { name: 'Tận dụng thùng xe, dỡ đúng thứ tự, theo dõi tới điểm giao cuối.' }))

  expect(hero.queryByRole('link', { name: /Đăng ký/ })).not.toBeInTheDocument()
  expect(isPrimary(hero.getByRole('link', { name: 'Nhận tư vấn' }))).toBe(true)
})
