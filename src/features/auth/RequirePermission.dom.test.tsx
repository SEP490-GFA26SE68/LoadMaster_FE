import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { AuthProvider } from './AuthProvider'
import { RequirePermission } from './RequirePermission'

function renderUsersRoute(role: Role) {
  signedInAs(role)
  render(
    <I18nProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={['/nguoi-dung']}>
          <Routes>
            <Route element={<RequirePermission permission="users.manage" />}>
              <Route path="/nguoi-dung" element={<h1>Người dùng</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </I18nProvider>,
  )
}

/** D-41: thiếu quyền thì màn 403 có lối về màn chính của vai trò, không để người dùng kẹt. */
test('a driver opening the users screen gets 403 with a way back to the driver screen', () => {
  renderUsersRoute('driver')
  expect(screen.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeInTheDocument()
  expect(screen.getByText('403')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Về màn chính' })).toHaveAttribute('href', '/tai-xe')
  expect(screen.queryByRole('heading', { name: 'Người dùng' })).not.toBeInTheDocument()
})

test.each<Role>(['systemAdmin', 'companyAdmin'])('the %s opens the users screen', (role) => {
  renderUsersRoute(role)
  expect(screen.getByRole('heading', { name: 'Người dùng' })).toBeInTheDocument()
})

/** FE-0-03, FE-8-02: nút về màn chính của vai trò nền tảng dẫn tới màn vai trò đó mở được (danh mục gói), không tới 404. */
test('a platform manager opening the users screen gets 403 with a way back to the plan catalogue', () => {
  renderUsersRoute('systemManager')
  expect(screen.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Về màn chính' })).toHaveAttribute('href', '/nen-tang/goi')
})
