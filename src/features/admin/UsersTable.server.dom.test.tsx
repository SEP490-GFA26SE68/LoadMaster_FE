import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import type { User } from '@/types/user'
import type { UserFormValues } from './user-form.schema'
import { UserFormDialog } from './UserFormDialog'
import { UsersTable } from './UsersTable'

/**
 * Màn Người dùng khi người dùng đã nối backend (`users`): tài khoản của máy chủ không có kho / chi nhánh và lần hoạt động gần nhất, nên
 * bảng, panel và form bỏ chúng — không ghi "Chưa đăng nhập" cho mọi người, không đòi nhập kho mà máy chủ không lưu.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['users']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'users',
}))

/** Tài khoản như `users-api.ts` dựng từ máy chủ: không kho, không lần hoạt động. */
const ADMIN: User = {
  id: '7', fullName: 'Lý Thanh Tâm', email: 'qtcongty@loadmaster.vn', phone: '0909 111 222', role: 'companyAdmin', status: 'active',
  lastActiveAt: null, companyId: '1',
}
const DISPATCHER: User = {
  id: '9', fullName: 'Trần Minh Khoa', email: 'dieuphoi@loadmaster.vn', phone: '0909 333 444', role: 'dispatcher', status: 'active',
  lastActiveAt: null, companyId: '1',
}

test('the table and the detail panel leave out the depot and the last activity the server does not keep', async () => {
  const user = userEvent.setup()
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/nguoi-dung']}>
        <UsersTable users={[ADMIN, DISPATCHER]} viewer={ADMIN} onAction={() => {}} />
      </MemoryRouter>
    </I18nProvider>,
  )
  const headers = within(screen.getByRole('table')).getAllByRole('columnheader').map((cell) => cell.textContent)
  expect(headers).toStrictEqual(expect.arrayContaining(['Người dùng', 'Điện thoại', 'Vai trò', 'Trạng thái']))
  expect(headers).not.toContain('Kho / chi nhánh')
  expect(headers).not.toContain('Hoạt động gần nhất')
  expect(screen.queryByText('Chưa đăng nhập')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Trần Minh Khoa' }))
  const panel = screen.getByRole('complementary', { name: 'Chi tiết tài khoản Trần Minh Khoa' })
  const info = within(within(panel).getByRole('region', { name: 'Thông tin cá nhân' }))
  expect(info.getAllByRole('term').map((term) => term.textContent)).toStrictEqual(['Mã tài khoản', 'Điện thoại'])
  expect(info.getAllByRole('definition').map((value) => value.textContent)).toStrictEqual(['9', '0909 333 444'])
})

test('editing a company account has no depot field and saves without a depot', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn<(values: UserFormValues) => Promise<void>>().mockResolvedValue(undefined)
  render(<I18nProvider><UserFormDialog scope="company" user={DISPATCHER} onClose={() => {}} onSubmit={onSubmit} /></I18nProvider>)
  const form = within(screen.getByRole('dialog', { name: 'Sửa người dùng' }))
  expect(form.getByText('Sửa thông tin liên hệ và vai trò của tài khoản.')).toBeInTheDocument()
  expect(form.queryByLabelText(/^Kho . chi nhánh/)).toBeNull()

  await user.click(form.getByRole('button', { name: 'Lưu thay đổi' }))
  expect(onSubmit).toHaveBeenCalledTimes(1)
  expect(onSubmit.mock.calls[0]?.[0]).toStrictEqual({
    fullName: 'Trần Minh Khoa', email: 'dieuphoi@loadmaster.vn', phone: '0909 333 444', role: 'dispatcher', depot: '',
  })
})
