import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { LoginSignUp } from './LoginSignUp'

/** Khi nhóm `registration` nối backend, màn đăng nhập có lối vào hai luồng đăng ký ngay dưới form; cả hai là nút phụ. */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['registration']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'registration',
}))

test('someone without an account finds both sign-up flows right under the sign-in form', () => {
  render(
    <I18nProvider>
      <MemoryRouter>
        <LoginSignUp />
      </MemoryRouter>
    </I18nProvider>,
  )

  expect(screen.getByText('Công ty bạn chưa có tài khoản LoadMaster?')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Đăng ký trải nghiệm' })).toHaveAttribute('href', '/dang-ky-trai-nghiem')
  expect(screen.getByRole('link', { name: 'Đăng ký dùng ngay' })).toHaveAttribute('href', '/dang-ky')
})
