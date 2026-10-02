import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { ComponentSheetPage } from './ComponentSheetPage'
import { StyleSheetPage } from './StyleSheetPage'

/**
 * Hai trang tài liệu V2.3 đọc kho thật (`@/lib/mock-db`, seed neo 14/09/2026) qua hook của chính các màn — không giả lập module nào.
 * Số kỳ vọng lấy từ nguồn độc lập với code: bản mẫu `design/v2.3/screens/web/ThanhPhan.jpg` in "7 / 12" chuyến hoàn thành, 15 chuyến,
 * 2 chuyến cần xử lý; tên chuyến đầu kho lấy từ `seed-trips.ts`.
 *
 * Hai trang nằm ngoài `RequireAuth` và test không đăng nhập: kho không có phiên thì không lọc theo công ty (FE-0-02), nên ngoài 15
 * chuyến của Long Bình như bản mẫu còn hai chuyến của Phương Nam (`seed-phuong-nam.ts`: TRIP-PN-001 chạy 14/09 đã duyệt, TRIP-PN-002
 * nháp chạy 15/09) — 17 chuyến, 4 chuyến đã lập kế hoạch, 13 chuyến trong kỳ 30 ngày.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-14T03:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

/** Kho có độ trễ giả mỗi lượt; chạy song song cả bộ thì chờ lâu hơn mức mặc định. */
const SLOW = { timeout: 8000 }

function renderPage(page: ReactNode, url: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={[url]}>{page}</MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

test('/kieu-dang: dải trời có đường dẫn và tiêu đề, thẻ dựng từ chip trạng thái thật và dữ liệu kho', async () => {
  renderPage(<StyleSheetPage />, '/kieu-dang')

  expect(screen.getByRole('heading', { level: 1, name: 'Cyan kính' })).toBeInTheDocument()
  const crumb = screen.getByRole('navigation', { name: 'Vị trí trang' })
  expect(within(crumb).getByText('/kieu-dang')).toHaveAttribute('aria-current', 'page')

  // Sáu trạng thái của backend (FE-0-05), đúng nhãn `StatusBadge`
  for (const label of ['Nháp', 'Đã lập kế hoạch', 'Đang xếp hàng', 'Đang vận chuyển', 'Đã giao', 'Đã huỷ']) {
    expect(screen.getByText(label)).toBeInTheDocument()
  }
  // Dòng phụ lấy từ chuyến thật của kho: TRIP-012 chờ duyệt, chuyến chính đã duyệt, TRIP-013 lỗi thời, TRIP-011 kho đang xếp
  // 110 / 280, TRIP-010 xếp xong
  expect(await screen.findByText('Đang xếp 110 / 280', {}, SLOW)).toBeInTheDocument()
  for (const line of ['Chờ duyệt', 'Đã duyệt', 'Lỗi thời — cần tối ưu lại', 'Xếp xong — chờ xuất phát']) {
    expect(screen.getByText(line)).toBeInTheDocument()
  }

  // Thang chữ dùng tên chuyến đầu kho và mã của nó
  expect(await screen.findByText('Tuyến Q.7 – Thủ Dầu Một – Dĩ An – Biên Hoà', {}, SLOW)).toBeInTheDocument()
  expect(screen.getByText(/^TRIP-2026-0914 · PKG-001-\d{2} · 60C-446\.32$/)).toBeInTheDocument()
})

test('/kieu-dang: tỷ lệ tương phản tính từ token lúc chạy — không đọc được token thì hiện "—", không có số ghi tay', () => {
  renderPage(<StyleSheetPage />, '/kieu-dang')

  // jsdom không nạp `src/index.css`: mọi token rỗng, nên không ô tỷ lệ nào có số
  const table = screen.getByRole('table')
  const rows = within(table).getAllByRole('row').slice(1)
  expect(rows).toHaveLength(13)
  for (const row of rows) {
    expect(within(row).getAllByRole('cell')[0]).toHaveTextContent(/^—( · —)*$/)
  }
})

test('/thanh-phan: bảng, tab và ô số liệu đếm chuyến thật của kho; kỳ báo cáo đổi luôn ô số liệu', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderPage(<ComponentSheetPage />, '/thanh-phan')

  expect(screen.getByRole('heading', { level: 1, name: 'Thành phần' })).toBeInTheDocument()

  // Bảng: 17 chuyến của kho (15 của Long Bình, 2 của Phương Nam) trên một trang 25 dòng
  expect(await screen.findByText('1–17 / 17', {}, SLOW)).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Bảng' })).getByText('TRIP-2026-0914 · 4 điểm giao')).toBeInTheDocument()

  // Tab trên dải trời: tab "Đã lập kế hoạch" có 4 chuyến (3 của Long Bình và TRIP-PN-001), số hổ phách đếm 2 chuyến chờ duyệt hoặc
  // lỗi thời — chuyến của Phương Nam đã duyệt nên không cần xử lý
  const groups = screen.getByRole('tablist', { name: 'Trạng thái chuyến' })
  expect(within(groups).getByRole('tab', { name: /^Tất cả\s*17$/ })).toHaveAttribute('aria-selected', 'true')
  expect(within(groups).getByRole('tab', { name: /^Đã lập kế hoạch\s*4\s*2 cần bạn xử lý$/ })).toBeInTheDocument()
  expect(within(groups).getByRole('tab', { name: /^Đã giao\s*7$/ })).toBeInTheDocument()

  // Ô số liệu kính: kỳ 30 ngày mặc định như Bảng điều khiển — 12 chuyến của Long Bình và TRIP-PN-001 chạy trong kỳ
  const completed = await screen.findByRole('group', { name: 'Chuyến hoàn thành' }, SLOW)
  expect(within(completed).getByText('7')).toBeInTheDocument()
  expect(within(completed).getByText('/ 13 chuyến')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '7 ngày' }))
  expect(screen.getByRole('button', { name: '7 ngày' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(screen.getByRole('group', { name: 'Chuyến hoàn thành' })).queryByText('/ 13 chuyến')).not.toBeInTheDocument()
})

test('/thanh-phan: điều khiển chọn bấm được, còn nút, hộp thoại, toast, menu chỉ là bản xem trước inert', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderPage(<ComponentSheetPage />, '/thanh-phan')

  const fragile = screen.getByRole('button', { name: 'Chỉ hàng dễ vỡ' })
  expect(fragile).toHaveAttribute('aria-pressed', 'true')
  await user.click(fragile)
  expect(fragile).toHaveAttribute('aria-pressed', 'false')
  // Không còn bộ lọc nào: "Xoá lọc" khoá lại
  expect(screen.getByRole('button', { name: 'Xoá lọc' })).toBeDisabled()

  for (const name of ['Nút', 'Toast', 'Hộp thoại', 'Menu thao tác']) {
    const preview = screen.getByRole('group', { name: `Bản xem trước: ${name}` })
    expect(preview.firstElementChild).toHaveAttribute('inert')
  }
})

test('/thanh-phan: bản đồ tuyến của chuyến mẫu — kho Long Bình rồi bốn điểm giao theo thứ tự mock tối ưu tuyến xếp', async () => {
  renderPage(<ComponentSheetPage />, '/thanh-phan')

  // jsdom không có WebGL: sơ đồ SVG, danh sách điểm cho trình đọc màn hình vẫn đủ
  const map = await screen.findByRole('region', { name: 'Bản đồ tuyến TRIP-2026-0914' }, SLOW)
  expect(map.querySelector('svg[data-route-sketch]')).toBeInTheDocument()
  // Láng giềng gần nhất từ kho (toạ độ gần đúng ở `route-map.mock.ts`), kiểm bằng máy theo định lý cos cầu: Biên Hoà 5,9 km →
  // Dĩ An 7,4 km → Thủ Dầu Một 15,0 km → Q.7 25,4 km; × 1,3 = 69,9 km; ÷ 50 km/h + 4 × 15 phút = 144 phút
  expect(within(map).getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual([
    'Kho xuất phát: Kho Long Bình',
    'Điểm 4: Nhà thuốc Long Châu Biên Hoà',
    'Điểm 3: Kho Bách Hoá Xanh Dĩ An',
    'Điểm 2: Siêu thị Co.opmart Bình Dương',
    'Điểm 1: Công ty TNHH Thực phẩm Sài Gòn',
  ])
  // số do mock tính nên đứng cạnh nhãn MOCK RESULT
  expect(screen.getByText('4 điểm giao · 69,9 km · 144 phút').parentElement).toHaveTextContent('MOCK RESULT')
})
