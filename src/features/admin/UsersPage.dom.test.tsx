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
 * Seam: kho dùng chung (20 người dùng seed) → `users-api.ts` → hook → màn (LM-092). Người xem là **quản trị hệ thống** demo Võ Minh
 * Khoa (US-0005): thấy mọi tài khoản của nền tảng và hai công ty (FE-0-08); phạm vi của quản trị công ty ở
 * `UsersPage.company.dom.test.tsx`. Các test trong file dùng chung kho nên mỗi test thao tác trên người dùng khác nhau.
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

/** Ô đầu của từng hàng dữ liệu: chữ viết tắt, tên, email. */
function firstCells() {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1).map((row) => row.querySelector('td')?.textContent)
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

test('danh sách từ kho: mọi tài khoản, sắp theo tên, lọc vai trò trên URL; cột Công ty nói công ty của từng người', async () => {
  renderUsers('/nguoi-dung?vai-tro=driver')
  await screen.findByRole('table', {}, SLOW)
  // Năm tài xế của seed (bốn của Long Bình, một của Phương Nam), theo thứ tự chữ cái tiếng Việt (ô đầu: chữ viết tắt, tên, email)
  expect(firstCells()).toStrictEqual([
    'HNĐặng Hoài Nam nam.dang@loadmaster.vn', 'VBNgô Văn Bảo bao.ngo@loadmaster.vn', 'QDPhạm Quốc Dũng taixe@loadmaster.vn',
    'VSThái Văn Sơn taixe@phuongnam.vn', 'VLTrương Văn Lộc loc.truong@loadmaster.vn',
  ])
  expect(screen.getByText('20 tài khoản · 8 vai trò · 2 công ty')).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Vai trò' })).toHaveTextContent('Tài xế')
  expect(within(screen.getByRole('table')).getAllByRole('columnheader').map((cell) => cell.textContent))
    .toStrictEqual(['Người dùng', 'Điện thoại', 'Vai trò', 'Công ty', 'Kho / chi nhánh', 'Hoạt động gần nhất', 'Trạng thái', 'Thao tác'])
  // Tên công ty về từ kho sau danh sách
  expect(await within(await rowOf('Thái Văn Sơn')).findByText('Công ty CP Giao nhận Phương Nam', {}, SLOW)).toBeInTheDocument()
  expect(within(await rowOf('Ngô Văn Bảo')).getByText('Công ty TNHH Vận tải Long Bình')).toBeInTheDocument()
})

test('lọc theo công ty trên URL và bằng ô chọn; "Nền tảng" là ba tài khoản không thuộc công ty nào', async () => {
  const user = userEvent.setup()
  renderUsers('/nguoi-dung?cong-ty=LOG-002')
  await screen.findByRole('table', {}, SLOW)
  expect(firstCells()).toStrictEqual([
    'MTChâu Minh Trí qtcongty@phuongnam.vn', 'ATKiều Anh Tuấn dieuphoi@phuongnam.vn', 'QVLâm Quốc Việt viet.lam@phuongnam.vn',
    'HNMạc Thị Hồng Nhung quanly@phuongnam.vn', 'VSThái Văn Sơn taixe@phuongnam.vn',
  ])
  const company = screen.getByRole('combobox', { name: 'Công ty' })
  await waitFor(() => expect(company).toHaveTextContent('Công ty CP Giao nhận Phương Nam'), SLOW)

  await user.click(company)
  expect((await screen.findAllByRole('option')).map((option) => option.textContent))
    .toStrictEqual(['Mọi công ty', 'Công ty TNHH Vận tải Long Bình', 'Công ty CP Giao nhận Phương Nam', 'Nền tảng'])
  await user.click(screen.getByRole('option', { name: 'Nền tảng' }))
  await waitFor(() => expect(firstCells()).toStrictEqual([
    'QHĐinh Quang Huy nentang@loadmaster.vn', 'NÁTạ Thị Ngọc Ánh hotro@loadmaster.vn', 'MKVõ Minh Khoa quantri@loadmaster.vn',
  ]))
  // Ô Công ty của tài khoản nền tảng nói rõ là tài khoản nền tảng, không để trống
  const cells = within(await rowOf('Đinh Quang Huy')).getAllByRole('cell').map((cell) => cell.textContent)
  expect(cells.slice(2, 5)).toStrictEqual(['Quản lý nền tảng', 'Nền tảng', 'Không thuộc kho nào'])
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

test('tài khoản đang đăng nhập: không khoá, không xoá được, lý do ngay trong menu', async () => {
  const user = userEvent.setup()
  renderUsers()
  const menu = await openMenu(user, 'Võ Minh Khoa')
  const lock = within(menu).getByRole('menuitem', { name: /^Khoá tài khoản/ })
  expect(lock).toHaveAttribute('aria-disabled', 'true')
  expect(lock).toHaveTextContent('Không áp dụng cho tài khoản bạn đang đăng nhập')
  expect(within(menu).getByRole('menuitem', { name: /^Xoá tài khoản/ })).toHaveAttribute('aria-disabled', 'true')
  expect(within(menu).getByRole('menuitem', { name: 'Sửa thông tin' })).not.toHaveAttribute('aria-disabled')
})

test('nhân sự công ty: sửa và xoá mờ kèm lý do; khoá rồi mở khoá thì quản trị hệ thống làm được', async () => {
  const user = userEvent.setup()
  renderUsers()
  const menu = await openMenu(user, 'Hoàng Đức Anh')
  for (const name of [/^Sửa thông tin/, /^Xoá tài khoản/]) {
    const item = within(menu).getByRole('menuitem', { name })
    expect(item).toHaveAttribute('aria-disabled', 'true')
    expect(item).toHaveTextContent('Nhân sự công ty do quản trị công ty đó quản lý')
  }
  expect(within(menu).getByRole('menuitem', { name: 'Đặt lại mật khẩu' })).not.toHaveAttribute('aria-disabled')

  await user.click(within(menu).getByRole('menuitem', { name: 'Khoá tài khoản' }))
  expect(await screen.findByText('Đã khoá tài khoản Hoàng Đức Anh', {}, SLOW)).toBeInTheDocument()
  await waitFor(async () => expect(within(await rowOf('Hoàng Đức Anh')).getByText('Đã khoá')).toBeInTheDocument(), SLOW)

  await user.click(within(await openMenu(user, 'Hoàng Đức Anh')).getByRole('menuitem', { name: 'Mở khoá tài khoản' }))
  await waitFor(async () => expect(within(await rowOf('Hoàng Đức Anh')).getByText('Đang hoạt động')).toBeInTheDocument(), SLOW)
})

test('quản trị công ty duy nhất của một công ty: không khoá được, lý do ngay trong menu', async () => {
  const user = userEvent.setup()
  renderUsers()
  // Long Bình chỉ có một quản trị công ty (Dương Thị Kim Oanh); quản trị công ty của Phương Nam không thay được
  const lock = within(await openMenu(user, 'Dương Thị Kim Oanh')).getByRole('menuitem', { name: /^Khoá tài khoản/ })
  expect(lock).toHaveAttribute('aria-disabled', 'true')
  expect(lock).toHaveTextContent('Công ty cần ít nhất một quản trị công ty đang hoạt động')
  await user.keyboard('{Escape}')
  // Nhân viên khác của công ty thì khoá được
  expect(within(await openMenu(user, 'Trần Thị Mai')).getByRole('menuitem', { name: 'Khoá tài khoản' })).not.toHaveAttribute('aria-disabled')
})

test('tạo tài khoản: chỉ vai trò nền tảng, không có ô kho; mật khẩu tạm hiện một lần và đăng nhập được bằng nó', async () => {
  const user = userEvent.setup()
  renderUsers()
  await screen.findByRole('table', {}, SLOW)
  await user.click(screen.getByRole('button', { name: 'Thêm người dùng' }))
  const form = await screen.findByRole('dialog', { name: 'Thêm người dùng' })
  expect(within(form).queryByLabelText(/^Kho . chi nhánh/)).toBeNull()
  await fill(user, within(form).getByLabelText(/^Họ và tên/), 'Vương Thị Bích Ngọc')
  await fill(user, within(form).getByLabelText(/^Số điện thoại/), '0926971238')
  await fill(user, within(form).getByLabelText(/^Email/), 'ngoc.vuong@loadmaster.vn')
  await user.click(within(form).getByRole('combobox', { name: 'Vai trò' }))
  expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toStrictEqual(['Quản trị hệ thống', 'Quản lý nền tảng', 'Hỗ trợ khách hàng'])
  await user.click(screen.getByRole('option', { name: 'Quản lý nền tảng' }))
  await user.click(within(form).getByRole('button', { name: 'Thêm người dùng' }))

  const result = await screen.findByRole('dialog', { name: 'Đã tạo tài khoản Vương Thị Bích Ngọc' }, SLOW)
  const password = within(result).getByLabelText('Mật khẩu tạm')
  expect(password).toHaveAttribute('readonly')
  const value = (password as HTMLInputElement).value
  expect(value).toMatch(/^[A-Za-z2-9]{10}$/)
  await user.click(within(result).getByRole('button', { name: 'Sao chép' }))
  expect(await navigator.clipboard.readText()).toBe(value)
  await user.click(within(result).getByRole('button', { name: 'Xong' }))

  const cells = within(await rowOf('Vương Thị Bích Ngọc')).getAllByRole('cell').map((cell) => cell.textContent)
  expect(cells.slice(1, 5)).toStrictEqual(['0926 971 238', 'Quản lý nền tảng', 'Nền tảng', 'Không thuộc kho nào'])
  // Đăng nhập được bằng mật khẩu tạm (kho giữ phiên; test sau dựng lại phiên quản trị): tài khoản nền tảng, không công ty, không kho
  const created = await getMockDb().authenticate('ngoc.vuong@loadmaster.vn', value)
  expect([created.role, 'companyId' in created, 'depot' in created]).toStrictEqual(['systemManager', false, false])
})

test('đặt lại mật khẩu cho nhân sự công ty: xác nhận rồi hiện mật khẩu tạm mới', async () => {
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

test('sửa tài khoản nền tảng: vai trò chỉ trong ba vai trò nền tảng; email trùng thì báo trong hộp thoại, dữ liệu đang nhập giữ nguyên', async () => {
  const user = userEvent.setup()
  renderUsers()
  await user.click(within(await openMenu(user, 'Tạ Thị Ngọc Ánh')).getByRole('menuitem', { name: 'Sửa thông tin' }))
  const form = await screen.findByRole('dialog', { name: 'Sửa người dùng' })
  expect(within(form).queryByLabelText(/^Kho . chi nhánh/)).toBeNull()
  const email = within(form).getByLabelText(/^Email/)
  await fill(user, email, 'kho@loadmaster.vn')
  await user.click(within(form).getByRole('button', { name: 'Lưu thay đổi' }))
  expect(await within(form).findByRole('alert', {}, SLOW)).toHaveTextContent('Email kho@loadmaster.vn đã có người dùng.')
  expect(email).toHaveValue('kho@loadmaster.vn')

  await fill(user, email, 'hotro@loadmaster.vn')
  await user.click(within(form).getByRole('combobox', { name: 'Vai trò' }))
  expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toStrictEqual(['Quản trị hệ thống', 'Quản lý nền tảng', 'Hỗ trợ khách hàng'])
  await user.click(screen.getByRole('option', { name: 'Quản trị hệ thống' }))
  await user.click(within(form).getByRole('button', { name: 'Lưu thay đổi' }))
  expect(await screen.findByText('Đã cập nhật Tạ Thị Ngọc Ánh', {}, SLOW)).toBeInTheDocument()
  await waitFor(async () => expect(within(await rowOf('Tạ Thị Ngọc Ánh')).getByText('Quản trị hệ thống')).toBeInTheDocument(), SLOW)
})

test('tab Ma trận quyền mở bảng chỉ đọc dựng từ ROLE_PERMISSIONS (chi tiết ở PermissionMatrix.dom.test)', async () => {
  const user = userEvent.setup()
  renderUsers()
  await user.click(screen.getByRole('tab', { name: 'Ma trận quyền' }))
  const matrix = await screen.findByRole('table')
  // Một dòng tiêu đề, 13 dòng khu vực, 33 quyền và một dòng tổng; cột đầu là tên quyền, tám cột còn lại là vai trò (FE-0-06)
  expect(within(matrix).getAllByRole('row')).toHaveLength(48)
  expect(within(matrix).getAllByRole('columnheader')).toHaveLength(9)
})
