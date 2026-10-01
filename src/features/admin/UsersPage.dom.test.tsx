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
 * Seam: kho dùng chung (20 người dùng seed) → `users-api.ts` → hook → màn (LM-092). Người xem là quản trị hệ thống demo Võ Minh Khoa
 * (US-0005). Các test trong file dùng chung kho nên mỗi test thao tác trên người dùng khác nhau.
 */
const SLOW = { timeout: 5000 }

function renderUsers(url = '/nguoi-dung') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  signedInAs('systemAdmin')
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

/** Hàng của người dùng theo tên (ô đầu gồm tên và email). */
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

test('danh sách từ kho: sắp theo tên, tìm, lọc vai trò và trạng thái trên URL', async () => {
  renderUsers('/nguoi-dung?vai-tro=driver')
  await screen.findByRole('table', {}, SLOW)
  // Năm tài xế của seed (bốn của Long Bình, một của Phương Nam), theo thứ tự chữ cái tiếng Việt (ô đầu: chữ viết tắt, tên, email)
  const names = within(screen.getByRole('table')).getAllByRole('row').slice(1).map((row) => row.querySelector('td')?.textContent)
  expect(names).toStrictEqual([
    'HNĐặng Hoài Nam nam.dang@loadmaster.vn', 'VBNgô Văn Bảo bao.ngo@loadmaster.vn', 'QDPhạm Quốc Dũng taixe@loadmaster.vn',
    'VSThái Văn Sơn taixe@phuongnam.vn', 'VLTrương Văn Lộc loc.truong@loadmaster.vn',
  ])
  expect(screen.getByText('20 tài khoản')).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Vai trò' })).toHaveTextContent('Tài xế')
})

test('tìm theo số điện thoại không dấu cách và lọc tài khoản đã khoá', async () => {
  const user = userEvent.setup()
  renderUsers('/nguoi-dung?trang-thai=suspended')
  expect(within(await rowOf('Bùi Thị Lan')).getByText('Đã khoá')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Xoá lọc' }))
  await user.type(screen.getByRole('searchbox', { name: 'Tìm theo tên, email, số điện thoại, mã' }), '0905678901')
  await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2))
  // Quản trị hệ thống là tài khoản nền tảng: cột kho nói rõ là không thuộc kho nào (FE-0-03)
  expect(within(await rowOf('Võ Minh Khoa')).getByText('Không thuộc kho nào')).toBeInTheDocument()
})

/** Ô số liệu theo nhãn (vỏ `role="group"`), để không bắt nhầm số hay chữ trùng trong bảng. */
function tile(label: string) {
  return within(screen.getByRole('group', { name: label }))
}

test('ô số liệu đếm trên cả danh sách, không theo ô tìm; ô tổng chỉ hiển thị', async () => {
  // Seed: 20 tài khoản, chỉ Bùi Thị Lan đã khoá. Ô tìm đang lọc còn một dòng, ô số liệu không đổi.
  renderUsers('/nguoi-dung?q=khoa')
  await rowOf('Võ Minh Khoa')
  expect(tile('Tổng tài khoản').getByText('20')).toBeInTheDocument()
  expect(tile('Tổng tài khoản').getByText('Mọi vai trò, kể cả tài khoản đã khoá')).toBeInTheDocument()
  expect(tile('Đang hoạt động').getByText('19')).toBeInTheDocument()
  expect(tile('Đã khoá').getByText('1')).toBeInTheDocument()
  expect(tile('Tổng tài khoản').queryByRole('button')).toBeNull()
})

test('ô trạng thái lọc danh sách cùng bộ lọc với ô chọn; bấm lại ô đang lọc thì bỏ lọc', async () => {
  const user = userEvent.setup()
  renderUsers()
  await rowOf('Võ Minh Khoa')
  const suspended = tile('Đã khoá').getByRole('button')
  expect(suspended).toHaveAttribute('aria-pressed', 'false')

  await user.click(suspended)
  await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2))
  expect(await rowOf('Bùi Thị Lan')).toBeInTheDocument()
  expect(suspended).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('combobox', { name: 'Trạng thái' })).toHaveTextContent('Đã khoá')

  // Chuyển thẳng sang ô khác bằng bàn phím
  tile('Đang hoạt động').getByRole('button').focus()
  await user.keyboard('{Enter}')
  // 19 tài khoản đang hoạt động và dòng tiêu đề
  await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(20))
  expect(suspended).toHaveAttribute('aria-pressed', 'false')

  await user.click(tile('Đang hoạt động').getByRole('button'))
  await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(21))
  expect(screen.getByRole('combobox', { name: 'Trạng thái' })).toHaveTextContent('Mọi trạng thái')
})

test('tạo tài khoản: hộp thoại hiện mật khẩu tạm một lần, sao chép được, và đăng nhập được bằng nó', async () => {
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
  await user.click(await screen.findByRole('option', { name: 'Tài xế' }))
  await user.click(within(form).getByRole('button', { name: 'Thêm người dùng' }))

  const result = await screen.findByRole('dialog', { name: 'Đã tạo tài khoản Mai Văn Phúc' }, SLOW)
  const password = within(result).getByLabelText('Mật khẩu tạm')
  expect(password).toHaveAttribute('readonly')
  const value = (password as HTMLInputElement).value
  expect(value).toMatch(/^[A-Za-z2-9]{10}$/)
  await user.click(within(result).getByRole('button', { name: 'Sao chép' }))
  expect(await navigator.clipboard.readText()).toBe(value)
  await user.click(within(result).getByRole('button', { name: 'Xong' }))

  expect(within(await rowOf('Mai Văn Phúc')).getByText('0915 111 222')).toBeInTheDocument()
  // Đăng nhập được bằng mật khẩu tạm (kho giữ phiên; test sau dựng lại phiên quản trị)
  await expect(getMockDb().authenticate('phuc.mai@loadmaster.vn', value)).resolves.toMatchObject({ role: 'driver' })
})

test('tài khoản đang đăng nhập: không khoá, không xoá được, lý do ngay trong menu', async () => {
  const user = userEvent.setup()
  renderUsers()
  const menu = await openMenu(user, 'Võ Minh Khoa')
  const lock = within(menu).getByRole('menuitem', { name: /^Khoá tài khoản/ })
  expect(lock).toHaveAttribute('aria-disabled', 'true')
  expect(lock).toHaveTextContent('Không áp dụng cho tài khoản bạn đang đăng nhập')
  expect(within(menu).getByRole('menuitem', { name: /^Xoá tài khoản/ })).toHaveAttribute('aria-disabled', 'true')
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

test('đặt lại mật khẩu: xác nhận rồi hiện mật khẩu tạm mới', async () => {
  const user = userEvent.setup()
  renderUsers()
  await user.click(within(await openMenu(user, 'Đỗ Thị Hạnh')).getByRole('menuitem', { name: 'Đặt lại mật khẩu' }))
  const confirm = await screen.findByRole('dialog', { name: 'Đặt lại mật khẩu cho Đỗ Thị Hạnh?' })
  await user.click(within(confirm).getByRole('button', { name: 'Đặt lại mật khẩu' }))
  // Đang đặt lại (kho trễ 300 ms): Esc không đóng được hộp thoại, kẻo mật khẩu tạm bật ra sau khi người dùng tưởng đã huỷ
  await user.keyboard('{Escape}')
  expect(screen.getByRole('dialog', { name: 'Đặt lại mật khẩu cho Đỗ Thị Hạnh?' })).toBeInTheDocument()
  const result = await screen.findByRole('dialog', { name: 'Đã đặt lại mật khẩu cho Đỗ Thị Hạnh' }, SLOW)
  const value = (within(result).getByLabelText('Mật khẩu tạm') as HTMLInputElement).value
  await expect(getMockDb().authenticate('hanh.do@loadmaster.vn', 'loadmaster')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
  await expect(getMockDb().authenticate('hanh.do@loadmaster.vn', value)).resolves.toMatchObject({ id: 'US-0011' })
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

test('tab Ma trận quyền mở bảng chỉ đọc dựng từ ROLE_PERMISSIONS (chi tiết ở PermissionMatrix.dom.test)', async () => {
  const user = userEvent.setup()
  renderUsers()
  await user.click(screen.getByRole('tab', { name: 'Ma trận quyền' }))
  const matrix = await screen.findByRole('table')
  // Một dòng tiêu đề và 38 quyền; cột đầu là tên quyền, mười cột còn lại là vai trò
  expect(within(matrix).getAllByRole('row')).toHaveLength(39)
  expect(within(matrix).getAllByRole('columnheader')).toHaveLength(11)
})
