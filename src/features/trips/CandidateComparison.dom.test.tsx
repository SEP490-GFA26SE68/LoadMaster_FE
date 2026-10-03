import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { PlanComparisonPage } from './PlanComparisonPage'

/**
 * Seam: kho dùng chung → `plan-compare-api.ts` → hook → màn So sánh phương án với `?lan-chay=` (FE-5b-06). Số trên thẻ là số của
 * `result.metrics` của từng revision seed (ngày neo 14/09/2026), chép từ `seed.test.ts`.
 */
const TRIP = 'TRIP-2026-0914'
const SLOW = { timeout: 8000 }

function renderRun(tripId: string, runId: string, role: Role = 'dispatcher') {
  signedInAs(role)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { container } = render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[`/chuyen/${tripId}/so-sanh?lan-chay=${runId}`]}>
            <Routes><Route path="/chuyen/:tripId/so-sanh" element={<PlanComparisonPage />} /></Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
  return container
}

const candidate = async (name: string) => within(await screen.findByRole('region', { name }, SLOW))
/** Chữ của ô giá trị một chỉ số trên thẻ, và chỉ số đó có mang dấu "tốt nhất" không. */
function metric(card: ReturnType<typeof within>, label: string) {
  const row = card.getByText(label, { selector: 'dt' }).parentElement as HTMLElement
  return { value: row.querySelector('dd')?.textContent, best: row.hasAttribute('data-best') }
}

test('the run of the seed trip: deadlines once on top, then cards A, B, C with the metrics of each plan and a neutral mark on the best value', async () => {
  const container = renderRun(TRIP, 'RUN-002')
  const a = await candidate('Phương án A — Tối đa thể tích')
  const b = await candidate('Phương án B — Cân bằng tải trục')
  const c = await candidate('Phương án C — Ít dỡ-xếp lại')

  // Dải trời: lần chạy và số phương án ứng viên
  const hero = screen.getByRole('heading', { level: 1, name: 'So sánh phương án' }).closest('header') as HTMLElement
  expect(await within(hero).findByText('Lần chạy RUN-002 · 3 phương án ứng viên', {}, SLOW)).toBeInTheDocument()

  // Thẻ đầu: lần chạy, người chạy, tên thuật toán đã chạy và thiết lập chung; rồi mức hạn các điểm — một lần cho cả ba phương án
  const run = within(screen.getByRole('region', { name: 'Lần chạy RUN-002' }))
  expect(run.getByText('08:30 14/09/2026 · Nguyễn Thanh Tùng')).toBeInTheDocument()
  expect(run.getByText('EP + DBLF (mock) · random seed 20260914 · LIFO bật · trọng tâm thấp tắt · giới hạn 30 giây')).toBeInTheDocument()
  const deadlines = within(run.getByRole('region', { name: 'Mức hạn các điểm giao' }))
  expect(deadlines.getByText('MOCK RESULT')).toBeInTheDocument()
  const stops = deadlines.getAllByRole('listitem')
  expect(stops).toHaveLength(4)
  expect(stops[0]).toHaveTextContent(/^1Điểm 1 · .+Dự kiến đến \d{2}:\d{2} 14\/09Không có hạn$/)
  expect(screen.getAllByRole('region', { name: 'Mức hạn các điểm giao' })).toHaveLength(1)

  // Mỗi thẻ: MOCK RESULT, mã revision, ảnh thu nhỏ SVG, các chỉ số
  for (const [card, id] of [[a, 'REV-001-A'], [b, 'REV-001-B'], [c, 'REV-001']] as const) {
    expect(card.getByText('MOCK RESULT')).toBeInTheDocument()
    expect(card.getByText(id)).toBeInTheDocument()
    expect(card.getByRole('img', { name: `Sơ đồ xếp hàng của ${id}: 132 / 132 kiện đã xếp` })).toBeInTheDocument()
    expect(metric(card, 'Thể tích')).toStrictEqual({ value: '40,8%', best: false })
    expect(metric(card, 'Tải trọng')).toStrictEqual({ value: '61,5%', best: false })
    expect(metric(card, 'Kiện chưa xếp')).toStrictEqual({ value: '0 kiện', best: false })
    expect(metric(card, 'Thời gian chạy').value).toBe('0 ms')
    expect(metric(card, 'Trọng tâm hàng').value).toMatch(/^[\d,]+ · [\d,]+ · [\d,]+ cmdọc · ngang · cao$/)
  }
  expect([metric(a, 'Tải trục trước').value, metric(a, 'Tải trục sau').value]).toStrictEqual(['5.326,12 kg / 6.500 kg81,9% giới hạn', '6.217,88 kg / 10.000 kg62,2% giới hạn'])
  expect([metric(b, 'Tải trục trước').value, metric(b, 'Tải trục sau').value]).toStrictEqual(['4.574,61 kg / 6.500 kg70,4% giới hạn', '6.969,39 kg / 10.000 kg69,7% giới hạn'])
  expect([metric(c, 'Tải trục trước').value, metric(c, 'Tải trục sau').value]).toStrictEqual(['4.663,27 kg / 6.500 kg71,7% giới hạn', '6.880,73 kg / 10.000 kg68,8% giới hạn'])

  // Tốt nhất: B cân tải trục nhất, C không kiện nào phải dỡ-xếp lại; dấu là nhãn xám, không tô xanh / đỏ
  expect([a, b, c].map((card) => metric(card, 'Chênh mức tải hai trục'))).toStrictEqual([
    { value: '19,8 điểm %', best: false }, { value: '0,7 điểm %Tốt nhất', best: true }, { value: '2,9 điểm %', best: false },
  ])
  expect([a, b, c].map((card) => metric(card, 'Dỡ-xếp lại'))).toStrictEqual([
    { value: '43 kiện', best: false }, { value: '18 kiện', best: false }, { value: '0 kiệnTốt nhất', best: true },
  ])
  const marks = screen.getAllByText('Tốt nhất')
  expect(marks).toHaveLength(2)
  expect(marks.every((mark) => !/green|red|success|danger/.test(mark.className))).toBe(true)

  // Mỗi thẻ một nút phụ mở đúng phương án đó; thẻ đã duyệt có nhãn và lối tới bản đã duyệt. Màn không có nút primary
  expect(a.getByRole('link', { name: 'Mở phương án A trong Planner' })).toHaveAttribute('href', `/chuyen/${TRIP}/phuong-an?revision=REV-001-A`)
  expect(b.getByRole('link', { name: 'Mở phương án B trong Planner' })).toHaveAttribute('href', `/chuyen/${TRIP}/phuong-an?revision=REV-001-B`)
  expect(c.getByRole('link', { name: 'Mở phương án C trong Planner' })).toHaveAttribute('href', `/chuyen/${TRIP}/phuong-an?revision=REV-001`)
  expect(c.getByText('Đã duyệt')).toBeInTheDocument()
  expect(c.getByRole('link', { name: 'Mở bản đã duyệt REV-002' })).toHaveAttribute('href', `/chuyen/${TRIP}/phuong-an?revision=REV-002`)
  expect([a.queryByText('Đã duyệt'), b.queryByText('Đã duyệt')]).toStrictEqual([null, null])
  expect(container.querySelectorAll('a.text-on-primary, button.text-on-primary')).toHaveLength(0)
  expect(screen.getByRole('link', { name: 'Mọi phương án đã lưu' })).toHaveAttribute('href', `/chuyen/${TRIP}/so-sanh`)
  expect(screen.getByRole('link', { name: 'Chạy tối ưu lại' })).toHaveAttribute('href', `/chuyen/${TRIP}/toi-uu`)
})

test('a truck without axles shows why the axle loads are not computed; stale plans are flagged; the manager gets no way to run again', async () => {
  // TRIP-013: "Truck 6m" của Spec không khai trục, và chuyến đã sửa kiện sau khi duyệt
  const [run] = await getMockDb().listOptimizationRuns('TRIP-013')
  renderRun('TRIP-013', run?.id ?? '', 'manager')
  const a = await candidate('Phương án A — Tối đa thể tích')
  expect(metric(a, 'Tải trục trước').value).toBe('Chưa tính đượcXe chưa khai báo trục')
  expect(a.queryByText('Chênh mức tải hai trục')).toBeNull()
  expect(a.getByText('Lỗi thời')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Kết quả đã lỗi thời: chuyến đã đổi xe, kiện hoặc thứ tự điểm giao sau lần chạy này.')
  expect(screen.queryByRole('link', { name: 'Chạy tối ưu lại' })).toBeNull()
})

test('an unknown run, or a run that produced no plan, says so and leads back to the saved plans', async () => {
  renderRun(TRIP, 'RUN-404')
  expect(await screen.findByText('Không tìm thấy lần chạy', {}, SLOW)).toBeInTheDocument()
  expect(screen.getByText('Chuyến này không có lần chạy RUN-404, hoặc lần chạy đó không ra phương án nào.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Mọi phương án đã lưu' })).toHaveAttribute('href', `/chuyen/${TRIP}/so-sanh`)
  expect(screen.queryByRole('region', { name: /^Phương án / })).toBeNull()
})
