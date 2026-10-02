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
 * Panel chi tiết người dùng (V2) qua màn Người dùng: kho dùng chung (20 người dùng seed) → hook → màn. Người xem là quản trị hệ thống
 * demo Võ Minh Khoa (US-0005): thấy mọi tài khoản, panel có thêm dòng Công ty (FE-0-08). Các test trong file dùng chung kho; ghi vào kho
 * chỉ ở kho của Đặng Hoài Nam và khoá/mở lại Ngô Văn Bảo — không test nào khác đọc hai chỗ đó.
 */
const SLOW = { timeout: 5000 }

function renderUsers() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  signedInAs('systemAdmin')
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/nguoi-dung']}>
            <UsersPage />
          </MemoryRouter>
          <Toaster />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
  return client
}

async function rowOf(name: string) {
  const table = await screen.findByRole('table', {}, SLOW)
  const row = within(table).getAllByRole('row').find((item) => item.textContent?.includes(name))
  if (!row) throw new Error(`Không có dòng của ${name}`)
  return row
}

async function openMenu(user: UserEvent, name: string) {
  await user.click(within(await rowOf(name)).getByRole('button', { name: `Thao tác cho ${name}` }))
  return screen.findByRole('menu')
}

test('danh sách về lại từ kho không gắn lại ô: menu thao tác đang mở giữ nguyên', async () => {
  // Hồi quy E2E "Khoá tài khoản" chập chờn: TanStack Table v9 dựng hàm `cell` như component, cột dựng lại theo dữ liệu là gỡ cả
  // menu đang mở khỏi DOM. Mở màn là đọc lại kho (staleTime 0) nên lần đọc lại rơi đúng lúc người dùng vừa mở menu.
  const user = userEvent.setup()
  const client = renderUsers()
  const menu = await openMenu(user, 'Ngô Văn Bảo')
  const lock = within(menu).getByRole('menuitem', { name: 'Khoá tài khoản' })

  // Quản trị công ty của Long Bình sửa một nhân viên ở máy khác (quản trị hệ thống không sửa nhân sự công ty), rồi trả phiên cho người xem
  const db = getMockDb()
  db.restoreSession('US-LB-01')
  await db.updateUser('US-0007', { depot: 'Kho Bình Dương' })
  db.restoreSession('US-0005')
  await client.invalidateQueries({ queryKey: ['users'] })
  // Menu Radix là modal: phần còn lại bị aria-hidden nên tìm theo chữ, không theo vai trò
  expect(await screen.findByText('Kho Bình Dương', {}, SLOW)).toBeInTheDocument()
  expect(lock.isConnected).toBe(true)
  expect(screen.getByRole('menuitem', { name: 'Khoá tài khoản' })).toBe(lock)
  await user.keyboard('{Escape}')
})

/** Tiêu đề cột của bảng tài khoản, để biết cột Điện thoại đang hiện hay ẩn. */
function columnHeaders() {
  return within(screen.getByRole('table')).getAllByRole('columnheader').map((cell) => cell.textContent)
}

test('panel chi tiết: bấm dòng mở đúng người, quyền của vai trò, cột Điện thoại ẩn; bấm dòng khác thì đổi; nút đóng trả cột', async () => {
  const user = userEvent.setup()
  renderUsers()
  await screen.findByRole('table', {}, SLOW)
  expect(columnHeaders()).toStrictEqual(expect.arrayContaining(['Điện thoại', 'Công ty']))
  expect(screen.queryByRole('complementary')).toBeNull()

  // Bấm vào ô kho của dòng (không phải nút tên) cũng mở panel
  await user.click(within(await rowOf('Nguyễn Thanh Tùng')).getByText('Kho Long Bình'))
  const panel = screen.getByRole('complementary', { name: 'Chi tiết tài khoản Nguyễn Thanh Tùng' })
  expect(within(panel).getByRole('heading', { level: 2, name: 'Nguyễn Thanh Tùng' })).toHaveFocus()
  expect(within(panel).getByText('dieuphoi@loadmaster.vn')).toBeInTheDocument()
  expect(within(panel).getByText('Điều phối viên')).toBeInTheDocument()
  expect(within(panel).getByText('Đang hoạt động')).toBeInTheDocument()
  const info = within(within(panel).getByRole('region', { name: 'Thông tin cá nhân' }))
  expect(info.getAllByRole('term').map((term) => term.textContent)).toStrictEqual(['Mã tài khoản', 'Điện thoại', 'Công ty', 'Kho / chi nhánh', 'Hoạt động gần nhất'])
  // Tên công ty về từ kho sau danh sách người dùng
  await waitFor(() => expect(info.getAllByRole('definition').map((value) => value.textContent)).toStrictEqual([
    'US-0001', '0901 234 567', 'Công ty TNHH Vận tải Long Bình', 'Kho Long Bình', expect.stringMatching(/^07:50 \d{2}\/\d{2}\/\d{4}$/),
  ]), SLOW)
  // 24 quyền của điều phối viên theo thứ tự dòng của ma trận (FE-0-01, FE-0-07): 22 quyền của PRD v2, gồm chỉnh sửa và duyệt phương
  // án, cộng hai quyền đơn hàng còn tạm
  const chips = within(within(panel).getByRole('region', { name: 'Công việc được phép' })).getAllByRole('listitem')
  expect(chips.map((chip) => chip.textContent)).toStrictEqual([
    'Gửi yêu cầu hỗ trợ', 'Xem bảng điều khiển', 'Xem yêu cầu giao', 'Xem kho kiện', 'Nhập file, thêm kiện, loại kiện, gỡ cờ kiện',
    'Tra cứu kiện bằng mã QR', 'In nhãn QR', 'Xem chuyến hàng', 'Tạo, sửa, huỷ chuyến', 'Tối ưu tuyến', 'Chạy tối ưu',
    'Chỉnh sửa và duyệt phương án', 'Duyệt kiện xác nhận tay', 'Xem phương án 3D và so sánh', 'Xem giám sát chuyến đang chạy', 'Xem đội xe',
    'Thêm, sửa, xoá xe và bảo dưỡng', 'Thêm, sửa, xoá loại xe', 'Báo sự cố chuyến', 'Xử lý sự cố chuyến',
    'Tạo yêu cầu nhận hàng dọc đường', 'Duyệt yêu cầu nhận hàng dọc đường',
    'Xem đơn hàng', 'Tạo, sửa đơn hàng và gán vào điểm giao',
  ])
  // Panel mở: cột Điện thoại và cột Công ty nhường chỗ — cả hai đã nằm trong panel
  expect(columnHeaders()).toStrictEqual(['Người dùng', 'Vai trò', 'Kho / chi nhánh', 'Hoạt động gần nhất', 'Trạng thái', 'Thao tác'])
  expect(within(await rowOf('Nguyễn Thanh Tùng')).getByRole('button', { name: 'Nguyễn Thanh Tùng' })).toHaveAttribute('aria-pressed', 'true')

  // Menu thao tác của dòng khác không đổi panel
  await openMenu(user, 'Ngô Văn Bảo')
  await user.keyboard('{Escape}')
  expect(screen.getByRole('complementary', { name: 'Chi tiết tài khoản Nguyễn Thanh Tùng' })).toBeInTheDocument()

  await user.click(within(await rowOf('Trần Thị Mai')).getByText('quanly@loadmaster.vn'))
  // Quản lý công ty: 11 quyền của PRD v2, cộng xem đơn hàng còn tạm (FE-0-01); không còn duyệt phương án (FE-0-07)
  const next = screen.getByRole('complementary', { name: 'Chi tiết tài khoản Trần Thị Mai' })
  expect(within(within(next).getByRole('region', { name: 'Công việc được phép' })).getAllByRole('listitem')).toHaveLength(12)
  expect(within(await rowOf('Nguyễn Thanh Tùng')).getByRole('button', { name: 'Nguyễn Thanh Tùng' })).toHaveAttribute('aria-pressed', 'false')

  await user.click(within(next).getByRole('button', { name: 'Đóng chi tiết tài khoản' }))
  expect(screen.queryByRole('complementary')).toBeNull()
  expect(columnHeaders()).toStrictEqual(expect.arrayContaining(['Điện thoại', 'Công ty']))
  expect(within(await rowOf('Trần Thị Mai')).getByRole('button', { name: 'Trần Thị Mai' })).toHaveFocus()
})

test('panel chi tiết bằng bàn phím: nút ở tên mở, Esc đóng và trả con trỏ; lọc mất dòng thì panel vẫn giữ', async () => {
  const user = userEvent.setup()
  renderUsers()
  within(await rowOf('Lê Văn Hải')).getByRole('button', { name: 'Lê Văn Hải' }).focus()
  await user.keyboard('{Enter}')
  const panel = screen.getByRole('complementary', { name: 'Chi tiết tài khoản Lê Văn Hải' })
  const name = within(await rowOf('Lê Văn Hải')).getByRole('button', { name: 'Lê Văn Hải' })
  expect(name).toHaveAttribute('aria-pressed', 'true')
  expect(name).toHaveAttribute('aria-controls', panel.id)
  expect(within(panel).getByRole('heading', { level: 2 })).toHaveFocus()

  // Panel bám theo mã: tìm người khác làm dòng biến mất, panel vẫn là Lê Văn Hải; Esc trong ô tìm không đóng panel
  const search = screen.getByRole('searchbox', { name: 'Tìm theo tên, email, số điện thoại, mã' })
  // "taixe" khớp tài xế demo của cả hai công ty; thêm tên miền để còn đúng một dòng
  await user.type(search, 'taixe@loadmaster')
  await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2))
  await user.keyboard('{Escape}')
  expect(screen.getByRole('complementary', { name: 'Chi tiết tài khoản Lê Văn Hải' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Xoá lọc' }))
  await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(21))

  // Esc ở chỗ khác thì đóng và con trỏ về nút tên
  within(screen.getByRole('complementary')).getByRole('heading', { level: 2 }).focus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('complementary')).toBeNull()
  expect(within(await rowOf('Lê Văn Hải')).getByRole('button', { name: 'Lê Văn Hải' })).toHaveFocus()
})

test('thao tác từ panel: cùng luật chặn với menu; nhân sự công ty chỉ khoá, mở khoá, đặt lại mật khẩu được', async () => {
  const user = userEvent.setup()
  renderUsers()
  // Chính mình: khoá và xoá bị chặn, lý do nằm ngay dưới nút
  await user.click(within(await rowOf('Võ Minh Khoa')).getByRole('button', { name: 'Võ Minh Khoa' }))
  const own = within(screen.getByRole('complementary', { name: 'Chi tiết tài khoản Võ Minh Khoa' }))
  expect(own.getByRole('button', { name: 'Khoá tài khoản' })).toBeDisabled()
  expect(own.getByRole('button', { name: 'Khoá tài khoản' })).toHaveAccessibleDescription('Không áp dụng cho tài khoản bạn đang đăng nhập')
  expect(own.getByRole('button', { name: 'Xoá tài khoản' })).toBeDisabled()
  expect(own.getByRole('button', { name: 'Sửa thông tin' })).toBeEnabled()
  expect(own.getAllByText('Không áp dụng cho tài khoản bạn đang đăng nhập')).toHaveLength(1)
  // Quản trị hệ thống là người của nền tảng (FE-0-01, FE-0-03): không thuộc công ty hay kho nào, ba quyền và không quyền vận hành nào
  expect(within(own.getByRole('region', { name: 'Thông tin cá nhân' })).getAllByRole('definition').slice(2, 4).map((value) => value.textContent))
    .toStrictEqual(['Nền tảng', 'Không thuộc kho nào'])
  expect(within(own.getByRole('region', { name: 'Công việc được phép' })).getAllByRole('listitem').map((chip) => chip.textContent))
    .toStrictEqual(['Tạo và quản lý công ty khách hàng', 'Quản lý người dùng', 'Xem nhật ký hệ thống'])

  await user.click(within(await rowOf('Ngô Văn Bảo')).getByRole('button', { name: 'Ngô Văn Bảo' }))
  const panel = within(screen.getByRole('complementary', { name: 'Chi tiết tài khoản Ngô Văn Bảo' }))
  await user.click(panel.getByRole('button', { name: 'Khoá tài khoản' }))
  expect(await screen.findByText('Đã khoá tài khoản Ngô Văn Bảo', {}, SLOW)).toBeInTheDocument()
  await waitFor(() => expect(panel.getByText('Đã khoá')).toBeInTheDocument(), SLOW)
  await user.click(panel.getByRole('button', { name: 'Mở khoá tài khoản' }))
  await waitFor(() => expect(panel.getByText('Đang hoạt động')).toBeInTheDocument(), SLOW)
  // Sửa và xoá nhân sự công ty là việc của quản trị công ty đó (FE-0-08): hai nút mờ, chung một dòng lý do
  for (const name of ['Sửa thông tin', 'Xoá tài khoản']) {
    expect(panel.getByRole('button', { name })).toBeDisabled()
    expect(panel.getByRole('button', { name })).toHaveAccessibleDescription('Nhân sự công ty do quản trị công ty đó quản lý')
  }
  expect(panel.getAllByText('Nhân sự công ty do quản trị công ty đó quản lý')).toHaveLength(1)
  expect(panel.getByRole('button', { name: 'Đặt lại mật khẩu' })).toBeEnabled()

  // Tài khoản nền tảng: Sửa mở đúng hộp thoại của menu
  await user.click(within(await rowOf('Đinh Quang Huy')).getByRole('button', { name: 'Đinh Quang Huy' }))
  const platform = within(screen.getByRole('complementary', { name: 'Chi tiết tài khoản Đinh Quang Huy' }))
  await user.click(platform.getByRole('button', { name: 'Sửa thông tin' }))
  const form = await screen.findByRole('dialog', { name: 'Sửa người dùng' })
  expect(within(form).getByLabelText('Email')).toHaveValue('nentang@loadmaster.vn')
  await user.click(within(form).getByRole('button', { name: 'Huỷ' }))
})

