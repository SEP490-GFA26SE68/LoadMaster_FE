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
 * "Cần xử lý 2"; tên chuyến đầu kho lấy từ `seed-trips.ts`.
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

  // Mười trạng thái vòng đời của chuyến, đúng nhãn `StatusBadge`
  for (const label of ['Nháp', 'Đang tối ưu', 'Đã tối ưu', 'Cần xem lại', 'Đã duyệt', 'Đang xếp hàng', 'Đã xếp xong', 'Đang giao', 'Hoàn thành', 'Đã huỷ']) {
    expect(screen.getByText(label)).toBeInTheDocument()
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

  // Bảng: 15 chuyến của kho trên một trang 25 dòng
  expect(await screen.findByText('1–15 / 15', {}, SLOW)).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Bảng' })).getByText('TRIP-2026-0914 · 4 điểm giao')).toBeInTheDocument()

  // Tab trên dải trời: "Cần xử lý" đếm chuyến chờ duyệt hoặc cần xem lại
  const groups = screen.getByRole('tablist', { name: 'Nhóm chuyến' })
  expect(within(groups).getByRole('tab', { name: /^Tất cả\s*15$/ })).toHaveAttribute('aria-selected', 'true')
  expect(within(groups).getByRole('tab', { name: /^Cần xử lý\s*2$/ })).toBeInTheDocument()

  // Ô số liệu kính: kỳ 30 ngày mặc định như Bảng điều khiển
  const completed = await screen.findByRole('group', { name: 'Chuyến hoàn thành' }, SLOW)
  expect(within(completed).getByText('7')).toBeInTheDocument()
  expect(within(completed).getByText('/ 12 chuyến')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '7 ngày' }))
  expect(screen.getByRole('button', { name: '7 ngày' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(screen.getByRole('group', { name: 'Chuyến hoàn thành' })).queryByText('/ 12 chuyến')).not.toBeInTheDocument()
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
