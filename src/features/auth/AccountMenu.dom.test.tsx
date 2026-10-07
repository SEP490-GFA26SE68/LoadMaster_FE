import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import { AccountMenu } from './AccountMenu'
import { AuthProvider } from './AuthProvider'

/** Nút tài khoản cỡ cảm ứng của màn kho và tài xế (LM-096). */

function Elsewhere() {
  return <output aria-label="route">{useLocation().pathname}</output>
}

function renderMenu() {
  render(
    <I18nProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={['/kho']}>
          <Routes>
            <Route path="/kho" element={<AccountMenu />} />
            <Route path="*" element={<Elsewhere />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </I18nProvider>,
  )
}

test('the 56px account button names the user and opens the profile from a touch-sized menu', async () => {
  const user = userEvent.setup()
  signedInAs('warehouse')
  renderMenu()
  const trigger = screen.getByRole('button', { name: 'Tài khoản Lê Văn Hải' })
  expect(trigger).toHaveClass('size-14')
  expect(trigger).toHaveTextContent('VH')

  await user.click(trigger)
  const menu = within(await screen.findByRole('menu'))
  expect(menu.getByText('kho@loadmaster.vn')).toBeInTheDocument()
  expect(menu.getByText('Nhân viên kho · Kho Long Bình')).toBeInTheDocument()
  expect(menu.getAllByRole('menuitem').map((item) => item.textContent)).toStrictEqual(['Hồ sơ cá nhân', 'Yêu cầu hỗ trợ', 'Đăng xuất'])
  const profile = menu.getByRole('menuitem', { name: 'Hồ sơ cá nhân' })
  expect(profile).toHaveAttribute('href', '/ho-so')
  expect(profile).toHaveClass('h-14', 'text-body-lg')

  await user.click(profile)
  expect(await screen.findByRole('status', { name: 'route' })).toHaveTextContent('/ho-so')
})

/** FE-0-03 (quyết định G13): kho là tuỳ chọn — người dùng nền tảng không có. */
test('an account without a depot shows the role alone, without a dangling separator', async () => {
  const user = userEvent.setup()
  signedInAs('systemAdmin')
  renderMenu()
  await user.click(screen.getByRole('button', { name: 'Tài khoản Võ Minh Khoa' }))
  const menu = await screen.findByRole('menu')
  expect(within(menu).getByText('Quản trị hệ thống')).toBeInTheDocument()
  expect(menu).not.toHaveTextContent('·')
})

test('signing out from the menu ends the session and opens the sign-in screen', async () => {
  const user = userEvent.setup()
  signedInAs('driver')
  renderMenu()
  await user.click(screen.getByRole('button', { name: 'Tài khoản Phạm Quốc Dũng' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Đăng xuất' }))
  expect(await screen.findByRole('status', { name: 'route' }, { timeout: 4000 })).toHaveTextContent('/dang-nhap')
  expect(getMockDb().sessionUser()).toBeNull()
})
