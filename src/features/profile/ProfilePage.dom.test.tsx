import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Toaster } from 'sonner'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb, SEED_PASSWORD } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { ProfilePage } from './ProfilePage'

/** Hồ sơ cá nhân (LM-096) qua kho dùng chung: mỗi bài một vai trò để các lần ghi không dính nhau. Kho có độ trễ giả 300 ms. */
const SLOW = { timeout: 4000 }

function renderProfile(role: Role) {
  const user = signedInAs(role)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/ho-so']}>
            <ProfilePage />
          </MemoryRouter>
          <Toaster />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
  return user
}

function storedSession() {
  return JSON.parse(sessionStorage.getItem('loadmaster.phien') ?? 'null') as { fullName: string; phone: string } | null
}

test('name and phone are editable, email, role and depot read only; saving updates the store and the signed-in user', async () => {
  const user = userEvent.setup()
  renderProfile('dispatcher')
  expect(screen.getByRole('heading', { level: 1, name: 'Hồ sơ cá nhân' })).toBeInTheDocument()
  const details = within(screen.getByRole('region', { name: 'Thông tin cá nhân' }))
  expect(details.getByLabelText('Họ và tên')).toHaveValue('Nguyễn Thanh Tùng')
  expect(details.getByLabelText('Số điện thoại')).toHaveValue('0901 234 567')
  expect(details.queryByRole('textbox', { name: 'Email' })).not.toBeInTheDocument()

  // Cột nhận diện: tên, vai trò, rồi email và kho chỉ đọc. Email chỉ có một chỗ trên màn (V2 lặp lại — ở đây không).
  const identity = within(screen.getByRole('complementary', { name: 'Tài khoản' }))
  expect(identity.getByRole('heading', { level: 2, name: 'Nguyễn Thanh Tùng' })).toBeInTheDocument()
  expect(identity.getByText('Điều phối viên')).toBeInTheDocument()
  const readOnly = identity.getByText('dieuphoi@loadmaster.vn').closest('dl') as HTMLElement
  expect([...readOnly.querySelectorAll('dt, dd')].map((cell) => cell.textContent)).toStrictEqual(['Email', 'dieuphoi@loadmaster.vn', 'Kho trực thuộc', 'Kho Long Bình'])
  expect(screen.getAllByText('dieuphoi@loadmaster.vn')).toHaveLength(1)

  const save = details.getByRole('button', { name: 'Lưu thay đổi' })
  expect(save).toBeDisabled()
  await user.clear(details.getByLabelText('Họ và tên'))
  await user.type(details.getByLabelText('Họ và tên'), 'Nguyễn Thanh Tùng Anh')
  await user.clear(details.getByLabelText('Số điện thoại'))
  await user.type(details.getByLabelText('Số điện thoại'), '0987654321')
  await user.click(save)

  expect(await screen.findByText('Đã lưu hồ sơ', {}, SLOW)).toBeInTheDocument()
  expect(details.getByLabelText('Số điện thoại')).toHaveValue('0987 654 321')
  expect(save).toBeDisabled()
  expect(getMockDb().sessionUser()).toMatchObject({ fullName: 'Nguyễn Thanh Tùng Anh', phone: '0987 654 321' })
  // Phiên của tab đọc lại từ kho: tên trên nav rail và ở cột nhận diện đổi theo
  expect(storedSession()).toMatchObject({ fullName: 'Nguyễn Thanh Tùng Anh', phone: '0987 654 321' })
  expect(identity.getByRole('heading', { level: 2, name: 'Nguyễn Thanh Tùng Anh' })).toBeInTheDocument()
})

/** FE-0-03: hồ sơ là màn chính tạm của quản lý nền tảng và hỗ trợ khách hàng; người dùng nền tảng không thuộc kho nào. */
test('a platform account has no depot: the identity column shows the role and the email only', () => {
  renderProfile('systemManager')
  const identity = within(screen.getByRole('complementary', { name: 'Tài khoản' }))
  expect(identity.getByRole('heading', { level: 2, name: 'Đinh Quang Huy' })).toBeInTheDocument()
  expect(identity.getByText('Quản lý nền tảng')).toBeInTheDocument()
  const readOnly = identity.getByText('nentang@loadmaster.vn').closest('dl') as HTMLElement
  expect([...readOnly.querySelectorAll('dt, dd')].map((cell) => cell.textContent)).toStrictEqual(['Email', 'nentang@loadmaster.vn'])
})

test('an empty name and a malformed phone are reported at their fields and nothing is saved', async () => {
  const user = userEvent.setup()
  renderProfile('warehouse')
  const details = within(screen.getByRole('region', { name: 'Thông tin cá nhân' }))
  await user.clear(details.getByLabelText('Họ và tên'))
  await user.clear(details.getByLabelText('Số điện thoại'))
  await user.type(details.getByLabelText('Số điện thoại'), '12345')
  await user.click(details.getByRole('button', { name: 'Lưu thay đổi' }))

  expect(await details.findByText('Nhập họ tên')).toBeInTheDocument()
  expect(details.getByLabelText('Họ và tên')).toHaveAttribute('aria-invalid', 'true')
  expect(details.getByLabelText('Số điện thoại')).toHaveAccessibleDescription('Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0')
  expect(getMockDb().sessionUser()?.fullName).toBe('Lê Văn Hải')
})

test('password change: wrong current password at its field, short and mismatched new passwords, then success clears the form', async () => {
  const user = userEvent.setup()
  const account = renderProfile('manager')
  const password = within(screen.getByRole('region', { name: 'Đổi mật khẩu' }))
  const current = password.getByLabelText('Mật khẩu hiện tại')
  const next = password.getByLabelText('Mật khẩu mới')
  const confirm = password.getByLabelText('Nhập lại mật khẩu mới')
  const submit = password.getByRole('button', { name: 'Đổi mật khẩu' })
  expect(next).toHaveAccessibleDescription('Ít nhất 8 ký tự')

  await user.type(current, 'sai-mat-khau')
  await user.type(next, 'ngan')
  await user.type(confirm, 'ngan')
  await user.click(submit)
  expect(await password.findByText('Mật khẩu mới cần ít nhất 8 ký tự')).toBeInTheDocument()

  await user.clear(next)
  await user.type(next, 'kho-long-binh-2026')
  await user.clear(confirm)
  await user.type(confirm, 'kho-long-binh-2027')
  await user.click(submit)
  expect(await password.findByText('Mật khẩu nhập lại không khớp')).toBeInTheDocument()

  await user.clear(confirm)
  await user.type(confirm, 'kho-long-binh-2026')
  await user.click(submit)
  // Kho từ chối mật khẩu hiện tại: lỗi tại đúng ô, con trỏ quay về ô đó
  await waitFor(() => expect(current).toHaveAccessibleDescription('Mật khẩu hiện tại không đúng'), SLOW)
  expect(current).toHaveAttribute('aria-invalid', 'true')
  expect(current).toHaveFocus()

  await user.clear(current)
  await user.type(current, SEED_PASSWORD)
  await user.click(submit)
  expect(await screen.findByText('Đã đổi mật khẩu', {}, SLOW)).toBeInTheDocument()
  expect([current, next, confirm].map((input) => (input as HTMLInputElement).value)).toStrictEqual(['', '', ''])

  await expect(getMockDb().authenticate(account.email, SEED_PASSWORD)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
  await expect(getMockDb().authenticate(account.email, 'kho-long-binh-2026')).resolves.toMatchObject({ id: account.id })
}, 15_000)
