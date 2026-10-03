import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb, vnDate } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import { AuditLogPage } from './AuditLogPage'

/**
 * Seam: kho dùng chung (seed neo 14/09/2026) → `audit-api.ts` → hook → màn `/nhat-ky` (LM-091). Các test trong file dùng chung một
 * kho; sự kiện test ghi thêm luôn là mới nhất. Người xem là quản trị hệ thống demo (FE-0-01): đọc nhật ký, không xem được chuyến.
 */
const SLOW = { timeout: 5000 }

function SearchProbe() {
  return <p data-testid="search">{useLocation().search}</p>
}

function renderLog(url = '/nhat-ky') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  signedInAs('systemAdmin')
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[url]}>
            <AuditLogPage />
            <SearchProbe />
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

/**
 * Chữ của ô như trình đọc màn hình đọc: bỏ phần `aria-hidden` (ô chữ tắt, icon hành động), gộp khoảng trắng. Ô người làm đọc
 * "tên vai trò", ô đối tượng đọc "tên mã".
 */
function cellText(cell: HTMLElement) {
  const copy = cell.cloneNode(true) as HTMLElement
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove()
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** Hàng dữ liệu (bỏ hàng tiêu đề), mỗi hàng là chữ của từng ô. */
async function dataRows() {
  const table = await screen.findByRole('table', {}, SLOW)
  return within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map(cellText))
}

test('sự kiện vừa ghi đứng đầu: người làm, hành động, đối tượng, chi tiết đã dịch; chuyến không thành liên kết với người không xem được chuyến', async () => {
  const db = getMockDb()
  // Điều phối viên huỷ chuyến ngày mai (TRIP-012 đã tối ưu, chưa xếp); `renderLog` đặt lại phiên của quản trị hệ thống
  db.restoreSession('US-0001')
  await db.cancelTrip('TRIP-012', 'Khách đổi lịch nhận hàng')
  renderLog()

  const [first] = await dataRows()
  // Người làm kèm vai trò hiện tại; ô chữ tắt "TT" và icon hành động chỉ để nhìn
  expect(first?.slice(1)).toStrictEqual([
    'Nguyễn Thanh Tùng Điều phối viên', 'Huỷ chuyến', 'Tuyến Bình Chánh – Biên Hoà TRIP-012', 'Lý do: Khách đổi lịch nhận hàng',
  ])
  const firstRow = within(screen.getByRole('table')).getAllByRole('row')[1]
  expect(within(firstRow!).getAllByRole('cell')[1]).toHaveTextContent(/^TTNguyễn Thanh Tùng/)
  // Quản trị hệ thống không có `trips.view`: tên chuyến là chữ thường, không dẫn tới màn 403
  expect(within(firstRow!).queryByRole('link')).not.toBeInTheDocument()
  // Mặc định 50 dòng một trang, mới nhất trước
  expect(await dataRows()).toHaveLength(50)
  expect(screen.getByRole('columnheader', { name: 'Thời điểm' })).toHaveAttribute('aria-sort', 'descending')
})

test('lọc theo người làm: chỉ còn sự kiện của người đó, bộ lọc nằm trên URL', async () => {
  const user = userEvent.setup()
  renderLog()
  await dataRows()

  await user.click(screen.getByRole('combobox', { name: 'Người làm' }))
  await user.click(await screen.findByRole('option', { name: 'Lê Văn Hải' }))

  expect(await screen.findByTestId('search')).toHaveTextContent('?nguoi-lam=US-0003')
  // Bảng cũ còn hiện (mờ) trong lúc đọc lại: chờ tới khi mọi hàng là của người được chọn
  await waitFor(async () => {
    expect(new Set((await dataRows()).map((row) => row[1]))).toStrictEqual(new Set(['Lê Văn Hải Nhân viên kho']))
  }, SLOW)
  // Đối tượng là người dùng thì vẫn là liên kết: quản trị hệ thống mở được màn Người dùng (lần đăng nhập 04:40 của seed)
  const signedIn = within(screen.getByRole('table')).getAllByRole('row').find((row) => within(row).queryByText('Đăng nhập') !== null)
  expect(within(signedIn!).getByRole('link', { name: 'Lê Văn Hải' })).toHaveAttribute('href', '/nguoi-dung?q=US-0003')
})

test('tìm theo mã đối tượng và lọc nhóm hành động', async () => {
  renderLog('/nhat-ky?q=TRIP-004')
  // TRIP-004: tạo, tối ưu, duyệt, huỷ — mới nhất trước
  await screen.findByText('4 sự kiện', {}, SLOW)
  expect((await dataRows()).map((row) => row[2])).toStrictEqual(['Huỷ chuyến', 'Duyệt phương án', 'Lưu kết quả tối ưu', 'Tạo chuyến'])
  expect((await dataRows())[0]?.[4]).toBe('Lý do: Khách hoãn nhận hàng do kiểm kê kho cuối tháng')
})

test('nhóm hành động "Chuyến" kết hợp mã đối tượng', async () => {
  renderLog('/nhat-ky?q=TRIP-004&nhom=trip')
  await screen.findByText('2 sự kiện', {}, SLOW)
  expect((await dataRows()).map((row) => row[2])).toStrictEqual(['Huỷ chuyến', 'Tạo chuyến'])
  expect(screen.getByRole('combobox', { name: 'Nhóm hành động' })).toHaveTextContent('Chuyến')
})

test('khoảng ngày tính theo giờ Việt Nam: ngày chạy của TRIP-001 (18/08) có 10 sự kiện soạn, xếp và giao', async () => {
  renderLog('/nhat-ky?tu=2026-08-18&den=2026-08-18')
  // Seed: soạn 230 kiện (5 giây mỗi kiện) rồi xếp từ 05:30, 30 giây mỗi kiện → xếp xong 07:25:30; xuất phát 20 phút sau; điểm 1–3 xong
  // 08:55, 10:05, 11:15, tài xế bấm "Đã đến" 25 phút trước mỗi lần hoàn tất (FE-6-06)
  await screen.findByText('10 sự kiện', {}, SLOW)
  const rows = await dataRows()
  expect(rows.map((row) => row[2])).toStrictEqual([
    'Hoàn thành chuyến', 'Hoàn tất điểm giao', 'Tài xế đã đến điểm giao', 'Hoàn tất điểm giao', 'Tài xế đã đến điểm giao', 'Hoàn tất điểm giao',
    'Tài xế đã đến điểm giao', 'Xuất phát giao hàng', 'Xếp xong', 'Bắt đầu soạn hàng',
  ])
  expect(rows.every((row) => row[3]?.endsWith('TRIP-001'))).toBe(true)
})

test('ba ô tóm tắt đếm cả nhật ký dù đang lọc; ô ngày gần nhất lọc đúng ngày đó, bấm lại thì bỏ', async () => {
  const user = userEvent.setup()
  // Nhật ký dùng chung giữa các test (test trước ghi thêm sự kiện): đọc kho để biết cả nhật ký lúc này, mới nhất trước
  const all = await getMockDb().listEvents()
  const latest = vnDate(new Date(all[0]!.at))
  const [year, month, day] = latest.split('-')
  renderLog('/nhat-ky?nhom=trip')

  const total = await screen.findByRole('group', { name: 'Sự kiện trong nhật ký' }, SLOW)
  expect(total).toHaveTextContent(`${new Intl.NumberFormat('vi-VN').format(all.length)}Sự kiện trong nhật ký`)
  const dayTile = screen.getByRole('group', { name: `Sự kiện ngày ${day}/${month}/${year}` })
  expect(dayTile).toHaveTextContent(new RegExp(`^${all.filter((event) => vnDate(new Date(event.at)) === latest).length}Sự kiện ngày`))
  expect(screen.getByRole('group', { name: 'Ghi nhận gần nhất' })).toHaveTextContent(`Ngày ${day}/${month}/${year}`)

  const toggle = within(dayTile).getByRole('button')
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await user.click(toggle)
  expect(screen.getByTestId('search')).toHaveTextContent(`?nhom=trip&tu=${latest}&den=${latest}`)
  expect(toggle).toHaveAttribute('aria-pressed', 'true')
  // Ô tổng không đổi theo bộ lọc
  expect(total).toHaveTextContent(new Intl.NumberFormat('vi-VN').format(all.length))

  await user.click(toggle)
  expect(screen.getByTestId('search')).toHaveTextContent(/^\?nhom=trip$/)
})

/** FE-0-08: quản trị hệ thống đọc nhật ký toàn hệ thống và lọc theo công ty của sự kiện. */
test('lọc theo công ty: bảy sự kiện seed của Phương Nam; bộ lọc nằm trên URL và ô tóm tắt vẫn đếm cả nhật ký', async () => {
  const user = userEvent.setup()
  const all = await getMockDb().listEvents()
  renderLog()
  await dataRows()

  await user.click(screen.getByRole('combobox', { name: 'Công ty' }))
  expect((await screen.findAllByRole('option')).map((option) => option.textContent))
    .toStrictEqual(['Mọi công ty', 'Công ty TNHH Vận tải Long Bình', 'Công ty CP Giao nhận Phương Nam', 'Nền tảng'])
  await user.click(screen.getByRole('option', { name: 'Công ty CP Giao nhận Phương Nam' }))

  expect(await screen.findByTestId('search')).toHaveTextContent('?cong-ty=LOG-002')
  // Seed của Phương Nam: 2 đợt thêm kiện, 2 chuyến, 1 lần tối ưu, 1 lần duyệt do điều phối viên Kiều Anh Tuấn làm; 1 yêu cầu giao do
  // quản lý công ty Mạc Thị Hồng Nhung lập (FE-4b-01)
  await screen.findByText('7 sự kiện', {}, SLOW)
  const rows = await dataRows()
  expect(new Set(rows.map((row) => row[1]))).toStrictEqual(new Set(['Kiều Anh Tuấn Điều phối viên', 'Mạc Thị Hồng Nhung Quản lý công ty']))
  expect(rows.map((row) => row[2]).toSorted()).toStrictEqual([
    'Duyệt phương án', 'Lưu kết quả tối ưu', 'Tạo chuyến', 'Tạo chuyến', 'Tạo yêu cầu giao', 'Thêm kiện vào kho kiện', 'Thêm kiện vào kho kiện',
  ].toSorted())
  expect(screen.getByRole('group', { name: 'Sự kiện trong nhật ký' })).toHaveTextContent(new Intl.NumberFormat('vi-VN').format(all.length))
})

test('lọc "Nền tảng": chỉ sự kiện không thuộc công ty nào — việc trên tài khoản nền tảng', async () => {
  // Quản lý nền tảng đăng nhập ở máy khác: sự kiện về một tài khoản nền tảng; `renderLog` đặt lại phiên của quản trị hệ thống
  await getMockDb().authenticate('nentang@loadmaster.vn', 'loadmaster')
  renderLog('/nhat-ky?cong-ty=nen-tang')
  const rows = await dataRows()
  expect(rows[0]?.slice(1)).toStrictEqual(['Đinh Quang Huy Quản lý nền tảng', 'Đăng nhập', 'Đinh Quang Huy US-NT-01', ''])
  // Không sự kiện nào của nhân sự công ty: người làm chỉ có tài khoản nền tảng
  expect(rows.filter((row) => !/Quản trị hệ thống|Quản lý nền tảng|Hỗ trợ khách hàng/.test(row[1] ?? ''))).toStrictEqual([])
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Công ty' })).toHaveTextContent('Nền tảng'), SLOW)
})

test('không có sự kiện khớp: bảng nói rõ và có nút xoá lọc', async () => {
  const user = userEvent.setup()
  renderLog('/nhat-ky?q=KHONG-CO')
  expect(await screen.findByText('Không có sự kiện khớp bộ lọc.', {}, SLOW)).toBeInTheDocument()
  await user.click(within(screen.getByRole('status')).getByRole('button', { name: 'Xoá lọc' }))
  expect(await dataRows()).toHaveLength(50)
})
