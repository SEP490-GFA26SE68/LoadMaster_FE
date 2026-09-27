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
 * Panel chi tiết người dùng (V2) qua màn Người dùng: kho dùng chung (12 người dùng seed) → hook → màn. Người xem là quản trị viên demo
 * Võ Minh Khoa (US-0005). Các test trong file dùng chung kho; ghi vào kho chỉ ở kho của Đặng Hoài Nam và khoá/mở lại Ngô Văn Bảo —
 * không test nào khác đọc hai chỗ đó.
 */
const SLOW = { timeout: 5000 }

function renderUsers() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  signedInAs('admin')
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

  await getMockDb().updateUser('US-0007', { depot: 'Kho Bình Dương' })
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
  expect(columnHeaders()).toContain('Điện thoại')
  expect(screen.queryByRole('complementary')).toBeNull()

  // Bấm vào ô kho của dòng (không phải nút tên) cũng mở panel
  await user.click(within(await rowOf('Nguyễn Thanh Tùng')).getByText('Kho Long Bình'))
  const panel = screen.getByRole('complementary', { name: 'Chi tiết tài khoản Nguyễn Thanh Tùng' })
  expect(within(panel).getByRole('heading', { level: 2, name: 'Nguyễn Thanh Tùng' })).toHaveFocus()
  expect(within(panel).getByText('dieuphoi@loadmaster.vn')).toBeInTheDocument()
  expect(within(panel).getByText('Điều phối viên')).toBeInTheDocument()
  expect(within(panel).getByText('Đang hoạt động')).toBeInTheDocument()
  const info = within(within(panel).getByRole('region', { name: 'Thông tin cá nhân' }))
  expect(info.getAllByRole('term').map((term) => term.textContent)).toStrictEqual(['Mã tài khoản', 'Điện thoại', 'Kho / chi nhánh', 'Hoạt động gần nhất'])
  expect(info.getAllByRole('definition').map((value) => value.textContent)).toStrictEqual([
    'US-0001', '0901 234 567', 'Kho Long Bình', expect.stringMatching(/^07:50 \d{2}\/\d{2}\/\d{4}$/),
  ])
  // Quyền của điều phối viên (tám quyền gốc + đơn hàng và loại xe của Review 1, LM-104), nhãn lấy từ ma trận quyền
  const chips = within(within(panel).getByRole('region', { name: 'Công việc được phép' })).getAllByRole('listitem')
  expect(chips.map((chip) => chip.textContent)).toStrictEqual([
    'Xem bảng điều khiển', 'Xem chuyến hàng', 'Tạo, sửa, huỷ chuyến', 'Chạy tối ưu', 'Xem phương án 3D và so sánh',
    'Chỉnh sửa và duyệt phương án', 'Xem đội xe', 'Thêm, sửa, xoá xe và bảo dưỡng',
    'Xem đơn hàng', 'Tạo, sửa đơn hàng và gán vào điểm giao', 'Thêm, sửa, xoá loại xe',
  ])
  expect(columnHeaders()).not.toContain('Điện thoại')
  expect(within(await rowOf('Nguyễn Thanh Tùng')).getByRole('button', { name: 'Nguyễn Thanh Tùng' })).toHaveAttribute('aria-pressed', 'true')

  // Menu thao tác của dòng khác không đổi panel
  await openMenu(user, 'Ngô Văn Bảo')
  await user.keyboard('{Escape}')
  expect(screen.getByRole('complementary', { name: 'Chi tiết tài khoản Nguyễn Thanh Tùng' })).toBeInTheDocument()

  await user.click(within(await rowOf('Trần Thị Mai')).getByText('quanly@loadmaster.vn'))
  const next = screen.getByRole('complementary', { name: 'Chi tiết tài khoản Trần Thị Mai' })
  expect(within(within(next).getByRole('region', { name: 'Công việc được phép' })).getAllByRole('listitem')).toHaveLength(7)
  expect(within(await rowOf('Nguyễn Thanh Tùng')).getByRole('button', { name: 'Nguyễn Thanh Tùng' })).toHaveAttribute('aria-pressed', 'false')

  await user.click(within(next).getByRole('button', { name: 'Đóng chi tiết tài khoản' }))
  expect(screen.queryByRole('complementary')).toBeNull()
  expect(columnHeaders()).toContain('Điện thoại')
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
  await user.type(search, 'taixe')
  await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2))
  await user.keyboard('{Escape}')
  expect(screen.getByRole('complementary', { name: 'Chi tiết tài khoản Lê Văn Hải' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Xoá lọc' }))
  await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(16))

  // Esc ở chỗ khác thì đóng và con trỏ về nút tên
  within(screen.getByRole('complementary')).getByRole('heading', { level: 2 }).focus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('complementary')).toBeNull()
  expect(within(await rowOf('Lê Văn Hải')).getByRole('button', { name: 'Lê Văn Hải' })).toHaveFocus()
})

test('thao tác từ panel: cùng luật chặn với menu, khoá rồi mở khoá cập nhật ngay trong panel', async () => {
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

  await user.click(within(await rowOf('Ngô Văn Bảo')).getByRole('button', { name: 'Ngô Văn Bảo' }))
  const panel = within(screen.getByRole('complementary', { name: 'Chi tiết tài khoản Ngô Văn Bảo' }))
  await user.click(panel.getByRole('button', { name: 'Khoá tài khoản' }))
  expect(await screen.findByText('Đã khoá tài khoản Ngô Văn Bảo', {}, SLOW)).toBeInTheDocument()
  await waitFor(() => expect(panel.getByText('Đã khoá')).toBeInTheDocument(), SLOW)
  await user.click(panel.getByRole('button', { name: 'Mở khoá tài khoản' }))
  await waitFor(() => expect(panel.getByText('Đang hoạt động')).toBeInTheDocument(), SLOW)

  // Sửa mở đúng hộp thoại của menu
  await user.click(panel.getByRole('button', { name: 'Sửa thông tin' }))
  const form = await screen.findByRole('dialog', { name: 'Sửa người dùng' })
  expect(within(form).getByLabelText('Email')).toHaveValue('bao.ngo@loadmaster.vn')
  await user.click(within(form).getByRole('button', { name: 'Huỷ' }))
})

