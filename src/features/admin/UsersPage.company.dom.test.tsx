import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Toaster } from 'sonner'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import { UsersPage } from './UsersPage'

/**
 * Màn Người dùng trong phạm vi **công ty** (FE-0-08): người xem là quản trị công ty demo của Long Bình, Dương Thị Kim Oanh (US-LB-01).
 * Kho chỉ trả 12 người của Long Bình (11 đang hoạt động, Bùi Thị Lan đã khoá); không có tài khoản nền tảng hay người của Phương Nam.
 * Phạm vi của quản trị hệ thống ở `UsersPage.dom.test.tsx`. Các test trong file dùng chung kho nên mỗi test thao tác trên người khác nhau.
 */
const SLOW = { timeout: 5000 }

function renderUsers(url = '/nguoi-dung') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  signedInAs('companyAdmin')
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[url]}>
            <UsersPage />
          </MemoryRouter>
          <Toaster />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

async function rowOf(name: string) {
  const table = await screen.findByRole('table', {}, SLOW)
  const row = within(table).getAllByRole('row').find((item) => item.textContent?.includes(name))
  if (!row) throw new Error(`Không có dòng của ${name}`)
  return row
}

/** Thay chữ trong ô bằng một lần dán: nhanh hơn gõ từng phím khi cả bộ chạy song song. */
async function fill(user: UserEvent, field: HTMLElement, text: string) {
  await user.clear(field)
  await user.click(field)
  await user.paste(text)
}

async function openMenu(user: UserEvent, name: string) {
  await user.click(within(await rowOf(name)).getByRole('button', { name: `Thao tác cho ${name}` }))
  return screen.findByRole('menu')
}

function tile(label: string) {
  return within(screen.getByRole('group', { name: label }))
}

test('chỉ người của công ty mình: không tài khoản nền tảng, không người của công ty khác, không cột hay bộ lọc công ty', async () => {
  const user = userEvent.setup()
  renderUsers()
  await screen.findByRole('table', {}, SLOW)
  // 12 người của Long Bình theo thứ tự chữ cái tiếng Việt
  expect(within(screen.getByRole('table')).getAllByRole('row').slice(1).map((row) => row.querySelector('td button')?.textContent)).toStrictEqual([
    'Bùi Thị Lan', 'Dương Thị Kim Oanh', 'Đặng Hoài Nam', 'Đỗ Thị Hạnh', 'Hoàng Đức Anh', 'Lê Văn Hải', 'Lý Minh Châu', 'Ngô Văn Bảo',
    'Nguyễn Thanh Tùng', 'Phạm Quốc Dũng', 'Trần Thị Mai', 'Trương Văn Lộc',
  ])
  expect(screen.getByText('12 tài khoản')).toBeInTheDocument()
  expect(tile('Tổng tài khoản').getByText('12')).toBeInTheDocument()
  expect(tile('Đang hoạt động').getByText('11')).toBeInTheDocument()
  expect(tile('Đã khoá').getByText('1')).toBeInTheDocument()

  expect(within(screen.getByRole('table')).getAllByRole('columnheader').map((cell) => cell.textContent))
    .toStrictEqual(['Người dùng', 'Điện thoại', 'Vai trò', 'Kho / chi nhánh', 'Hoạt động gần nhất', 'Trạng thái', 'Thao tác'])
  expect(screen.queryByRole('combobox', { name: 'Công ty' })).toBeNull()
  // Ô lọc vai trò chỉ mời năm vai trò công ty
  await user.click(screen.getByRole('combobox', { name: 'Vai trò' }))
  expect((await screen.findAllByRole('option')).map((option) => option.textContent))
    .toStrictEqual(['Mọi vai trò', 'Quản trị công ty', 'Quản lý công ty', 'Điều phối viên', 'Nhân viên kho', 'Tài xế'])
})

test('tham số công ty trên URL không mở được người của công ty khác', async () => {
  renderUsers('/nguoi-dung?cong-ty=LOG-002')
  await screen.findByRole('table', {}, SLOW)
  expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(13)
  expect(screen.queryByText('Thái Văn Sơn')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Xoá lọc' })).toBeNull()
})

test('tài khoản đang đăng nhập — cũng là quản trị công ty duy nhất: không khoá, không xoá được, lý do ngay trong menu', async () => {
  const user = userEvent.setup()
  renderUsers()
  const menu = await openMenu(user, 'Dương Thị Kim Oanh')
  const lock = within(menu).getByRole('menuitem', { name: /^Khoá tài khoản/ })
  expect(lock).toHaveAttribute('aria-disabled', 'true')
  expect(lock).toHaveTextContent('Không áp dụng cho tài khoản bạn đang đăng nhập')
  expect(within(menu).getByRole('menuitem', { name: /^Xoá tài khoản/ })).toHaveAttribute('aria-disabled', 'true')
  await user.keyboard('{Escape}')

  // Sửa chính mình: vai trò chỉ xem kèm lý do, không phải ô chọn
  await user.click(within(await openMenu(user, 'Dương Thị Kim Oanh')).getByRole('menuitem', { name: 'Sửa thông tin' }))
  const form = await screen.findByRole('dialog', { name: 'Sửa người dùng' })
  expect(within(form).queryByRole('combobox', { name: 'Vai trò' })).toBeNull()
  expect(within(form).getByText('Quản trị công ty')).toBeInTheDocument()
  expect(within(form).getByText('Không áp dụng cho tài khoản bạn đang đăng nhập')).toBeInTheDocument()
  await user.click(within(form).getByRole('button', { name: 'Huỷ' }))
})

test('tạo tài khoản: chỉ năm vai trò công ty; người mới thuộc công ty của quản trị và đăng nhập được bằng mật khẩu tạm', async () => {
  const user = userEvent.setup()
  renderUsers()
  await screen.findByRole('table', {}, SLOW)
  await user.click(screen.getByRole('button', { name: 'Thêm người dùng' }))
  const form = await screen.findByRole('dialog', { name: 'Thêm người dùng' })
  await fill(user, within(form).getByLabelText('Họ và tên'), 'Mai Văn Phúc')
  await fill(user, within(form).getByLabelText('Số điện thoại'), '0915111222')
  await fill(user, within(form).getByLabelText('Email'), 'phuc.mai@loadmaster.vn')
  await fill(user, within(form).getByLabelText('Kho / chi nhánh'), 'Kho Long Bình')
  await user.click(within(form).getByRole('combobox', { name: 'Vai trò' }))
  expect((await screen.findAllByRole('option')).map((option) => option.textContent))
    .toStrictEqual(['Quản trị công ty', 'Quản lý công ty', 'Điều phối viên', 'Nhân viên kho', 'Tài xế'])
  await user.click(screen.getByRole('option', { name: 'Tài xế' }))
  await user.click(within(form).getByRole('button', { name: 'Thêm người dùng' }))

  const result = await screen.findByRole('dialog', { name: 'Đã tạo tài khoản Mai Văn Phúc' }, SLOW)
  const value = (within(result).getByLabelText('Mật khẩu tạm') as HTMLInputElement).value
  expect(value).toMatch(/^[A-Za-z2-9]{10}$/)
  await user.click(within(result).getByRole('button', { name: 'Xong' }))

  expect(within(await rowOf('Mai Văn Phúc')).getByText('0915 111 222')).toBeInTheDocument()
  expect(screen.getByText('13 tài khoản')).toBeInTheDocument()
  // Đăng nhập được bằng mật khẩu tạm (kho giữ phiên; test sau dựng lại phiên quản trị): tài xế của Long Bình
  await expect(getMockDb().authenticate('phuc.mai@loadmaster.vn', value)).resolves.toMatchObject({ role: 'driver', companyId: 'LOG-001', depot: 'Kho Long Bình' })
})

test('khoá rồi mở khoá tài khoản', async () => {
  const user = userEvent.setup()
  renderUsers()
  await user.click(within(await openMenu(user, 'Hoàng Đức Anh')).getByRole('menuitem', { name: 'Khoá tài khoản' }))
  expect(await screen.findByText('Đã khoá tài khoản Hoàng Đức Anh', {}, SLOW)).toBeInTheDocument()
  await waitFor(async () => expect(within(await rowOf('Hoàng Đức Anh')).getByText('Đã khoá')).toBeInTheDocument(), SLOW)

  await user.click(within(await openMenu(user, 'Hoàng Đức Anh')).getByRole('menuitem', { name: 'Mở khoá tài khoản' }))
  await waitFor(async () => expect(within(await rowOf('Hoàng Đức Anh')).getByText('Đang hoạt động')).toBeInTheDocument(), SLOW)
})

test('xoá: có xác nhận; tài xế còn chuyến thì kho từ chối và báo lý do', async () => {
  const user = userEvent.setup()
  renderUsers()
  await user.click(within(await openMenu(user, 'Lý Minh Châu')).getByRole('menuitem', { name: 'Xoá tài khoản' }))
  const confirm = await screen.findByRole('dialog', { name: 'Xoá tài khoản Lý Minh Châu?' })
  await user.click(within(confirm).getByRole('button', { name: 'Xoá tài khoản' }))
  expect(await screen.findByText('Đã xoá tài khoản Lý Minh Châu', {}, SLOW)).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByText('Lý Minh Châu')).not.toBeInTheDocument(), SLOW)

  // Phạm Quốc Dũng lái chuyến chính (chưa kết thúc)
  await user.click(within(await openMenu(user, 'Phạm Quốc Dũng')).getByRole('menuitem', { name: 'Xoá tài khoản' }))
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Xoá tài khoản' }))
  expect(await screen.findByText(/^Tài xế này đang được gán cho chuyến .*TRIP-2026-0914/, {}, SLOW)).toBeInTheDocument()
  expect(await rowOf('Phạm Quốc Dũng')).toBeInTheDocument()
})

test('sửa: lưu thay đổi; email trùng thì báo trong hộp thoại, dữ liệu đang nhập giữ nguyên', async () => {
  const user = userEvent.setup()
  renderUsers()
  await user.click(within(await openMenu(user, 'Trương Văn Lộc')).getByRole('menuitem', { name: 'Sửa thông tin' }))
  const form = await screen.findByRole('dialog', { name: 'Sửa người dùng' })
  const email = within(form).getByLabelText('Email')
  await fill(user, email, 'kho@loadmaster.vn')
  await user.click(within(form).getByRole('button', { name: 'Lưu thay đổi' }))
  expect(await within(form).findByRole('alert', {}, SLOW)).toHaveTextContent('Email kho@loadmaster.vn đã có người dùng.')
  expect(email).toHaveValue('kho@loadmaster.vn')

  await fill(user, email, 'loc.truong@loadmaster.vn')
  await fill(user, within(form).getByLabelText('Kho / chi nhánh'), 'Kho Sóng Thần')
  await user.click(within(form).getByRole('button', { name: 'Lưu thay đổi' }))
  expect(await screen.findByText('Đã cập nhật Trương Văn Lộc', {}, SLOW)).toBeInTheDocument()
  await waitFor(async () => expect(within(await rowOf('Trương Văn Lộc')).getByText('Kho Sóng Thần')).toBeInTheDocument(), SLOW)
})
