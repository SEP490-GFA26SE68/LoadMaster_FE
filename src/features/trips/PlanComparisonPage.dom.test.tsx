import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, test } from 'vitest'
import { createFormatter } from '@/lib/format'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { twoCartonRequest, twoCartonResult, twoCartonTrip } from '@/test/mock-db-samples'
import { PlanComparisonPage } from './PlanComparisonPage'

/**
 * Seam kiểm thử là kho dùng chung (`@/lib/mock-db`) → `trips-api.ts` → hook → màn hình, không giả lập module nào:
 * số trong ma trận phải truy về `result.metrics` của revision (tiêu chí nghiệm thu LM-051).
 */
const SEED_TRIP = 'TRIP-2026-0914'
const vi = createFormatter('vi-VN')

function renderComparison(tripId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { container } = render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={[`/chuyen/${tripId}/so-sanh`]}>
          <Routes>
            <Route path="/chuyen/:tripId/so-sanh" element={<PlanComparisonPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
  return container
}

/**
 * Phần tử sâu nhất có đúng chữ `text` (hoặc bắt đầu bằng nó): câu có mã bản bọc trong span mono (V2.3) nên chữ bị chia qua nhiều
 * nút, matcher mặc định của Testing Library không đọc được.
 */
function byFullText(text: string, { prefix = false } = {}) {
  const matches = (element: Element | null) => {
    const content = element?.textContent ?? ''
    return prefix ? content.startsWith(text) : content === text
  }
  return (_: string, element: Element | null) => matches(element) && !Array.from(element?.children ?? []).some(matches)
}

/** Nút hoặc link mang lớp nền primary của `Button` — màn chỉ được có đúng một (AGENTS.md mục 5). */
function primaryActions(container: HTMLElement) {
  return container.querySelectorAll('a.text-on-primary, button.text-on-primary')
}

/** Chữ của mọi ô trong cột một bản lưu — cột xác định bằng radio mang mã bản ở đầu cột (ma trận V2). */
function columnTexts(revisionId: string): string[] {
  const table = screen.getByRole('table')
  const index = within(table).getAllByRole('columnheader').findIndex((header) => within(header).queryByRole('radio', { name: revisionId }))
  if (index < 0) throw new Error(`Không có cột ${revisionId}`)
  return within(table).getAllByRole('row').map((row) => row.children[index]?.textContent ?? '')
}

test('ma trận revision của chuyến seed: số khớp result.metrics, bản duyệt và bản nguồn tách bạch, một nút primary', async () => {
  const [source, approved] = await getMockDb().listRevisions(SEED_TRIP)
  if (!source || !approved) throw new Error('Seed phải có revision nguồn và revision đã duyệt')
  const container = renderComparison(SEED_TRIP)

  await screen.findByRole('radio', { name: approved.id })
  // Dải trời V2.3: đường dẫn về chuyến, chip trạng thái chuyến và dòng tuyến · số bản · xe đọc từ kho
  const trip = await getMockDb().getTrip(SEED_TRIP)
  const crumbs = screen.getByRole('navigation', { name: 'Vị trí trang' })
  expect(within(crumbs).getByRole('link', { name: SEED_TRIP })).toHaveAttribute('href', `/chuyen/${SEED_TRIP}`)
  const hero = screen.getByRole('heading', { level: 1, name: 'So sánh phương án' }).closest('header')
  if (!hero) throw new Error('Tiêu đề phải nằm trong header')
  expect(await within(hero).findByText('Đã duyệt')).toBeInTheDocument()
  expect(within(hero).getByText(trip.name)).toBeInTheDocument()
  expect(within(hero).getByText('2 phương án đã lưu')).toBeInTheDocument()
  const sourceColumn = columnTexts(source.id)
  const approvedColumn = columnTexts(approved.id)

  for (const [column, revision] of [[sourceColumn, source], [approvedColumn, approved]] as const) {
    const { metrics } = revision.result
    expect(column[0]).toContain('MOCK RESULT')
    expect(column).toContain(vi.percent(metrics.volumeUtilizationPercent))
    expect(column).toContain(vi.percent(metrics.payloadUtilizationPercent))
    expect(column).toContain(`${vi.integer(metrics.placedCount)} kiện`)
    expect(column).toContain(`${vi.integer(metrics.unplacedCount)} kiện`)
    expect(column).toContain(`${vi.integer(metrics.runtimeMs)} ms`)
    expect(column).toContain(String(revision.request.settings.randomSeed))
    expect(column).toContain('Mock (xếp kệ tất định)')
    expect(column).toContain(revision.jobId)
  }
  // Số seed kiểm bằng máy: 16.552.000 / 40.608.000 cm³ = 40,76%; 5.844 / 9.500 kg = 61,52%; 132 kiện, seed 20260914, LIFO bật.
  expect(approvedColumn).toEqual(expect.arrayContaining(['40,8%', '61,5%', '132 kiện', '20260914', '30 giây', 'Bật']))

  expect(approvedColumn[0]).toContain('Đã duyệt')
  expect(approvedColumn[0]).toContain('Mới nhất')
  expect(approvedColumn[0]).toContain(`Duyệt từ ${source.id}`)
  const sourceHeader = within(screen.getByRole('columnheader', { name: new RegExp(`^${source.id}`) }))
  expect(sourceHeader.queryByText('Đã duyệt', { exact: true })).not.toBeInTheDocument()
  expect(sourceHeader.queryByText('Mới nhất')).not.toBeInTheDocument()
  expect(sourceColumn[0]).toContain(`Đã duyệt thành ${approved.id}`)
  expect(screen.queryByText('Lỗi thời')).not.toBeInTheDocument()
  expect(screen.getByText(byFullText(`${approved.id} được duyệt từ ${source.id}. Hai bản có cùng chỉ số chất xếp`, { prefix: true }))).toBeInTheDocument()

  // Mặc định chọn bản đã duyệt; chọn bản nguồn thì hành động chính đổi theo, vẫn chỉ một nút primary.
  expect(screen.getByRole('radio', { name: approved.id })).toBeChecked()
  const plannerHref = `/chuyen/${SEED_TRIP}/phuong-an?revision=${encodeURIComponent(approved.id)}`
  expect(screen.getByRole('link', { name: `Mở ${approved.id} trong 3D` })).toHaveAttribute('href', plannerHref)
  expect(primaryActions(container)).toHaveLength(1)
  expect(screen.getByRole('link', { name: 'Chạy thêm phương án' })).toHaveAttribute('href', `/chuyen/${SEED_TRIP}/toi-uu`)

  await userEvent.setup().click(screen.getByRole('radio', { name: source.id }))
  expect(screen.getByRole('radio', { name: source.id })).toBeChecked()
  expect(screen.getByRole('radio', { name: approved.id })).not.toBeChecked()
  expect(screen.getByText(byFullText(`Đang chọn: ${source.id}`))).toBeInTheDocument()
  expect(screen.getByRole('link', { name: `Mở ${source.id} trong 3D` })).toHaveAttribute(
    'href',
    `/chuyen/${SEED_TRIP}/phuong-an?revision=${encodeURIComponent(source.id)}`,
  )
  expect(primaryActions(container)).toHaveLength(1)
})

test('"Chỉ hiện khác biệt" ẩn dòng mà mọi bản cùng giá trị', async () => {
  const [source, approved] = await getMockDb().listRevisions(SEED_TRIP)
  if (!source || !approved) throw new Error('Seed phải có revision nguồn và revision đã duyệt')
  renderComparison(SEED_TRIP)
  await screen.findByRole('radio', { name: approved.id })
  const table = screen.getByRole('table')
  expect(within(table).getByRole('rowheader', { name: 'Tỷ lệ thể tích' })).toBeInTheDocument()
  expect(within(table).getByRole('rowheader', { name: 'Hình phương án' })).toBeInTheDocument()

  await userEvent.setup().click(screen.getByRole('checkbox', { name: 'Chỉ hiện khác biệt' }))
  // Bản duyệt chép nguyên kết quả chạy: tỷ lệ thể tích như nhau nên dòng này ẩn; hình phương án cũng ẩn
  expect(source.result.metrics.volumeUtilizationPercent).toBe(approved.result.metrics.volumeUtilizationPercent)
  expect(within(table).queryByRole('rowheader', { name: 'Tỷ lệ thể tích' })).not.toBeInTheDocument()
  expect(within(table).queryByRole('rowheader', { name: 'Hình phương án' })).not.toBeInTheDocument()
  // Cột bản lưu và nút chọn vẫn còn
  expect(screen.getByRole('radio', { name: source.id })).toBeInTheDocument()
})

test('chuyến chưa có revision: trạng thái rỗng dẫn tới Thiết lập tối ưu', async () => {
  const trip = await getMockDb().createTrip(twoCartonTrip())
  const container = renderComparison(trip.id)

  expect(await screen.findByText('Chưa đủ phương án để so sánh')).toBeInTheDocument()
  expect(screen.getByText(/mới có 0 phương án đã lưu/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Thiết lập tối ưu' })).toHaveAttribute('href', `/chuyen/${trip.id}/toi-uu`)
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(primaryActions(container)).toHaveLength(1)
})

test('chuyến có đúng một revision: trạng thái rỗng, kèm lối mở revision đó', async () => {
  const db = getMockDb()
  const trip = await db.createTrip(twoCartonTrip())
  const only = await db.addRevision({ tripId: trip.id, request: twoCartonRequest(), result: twoCartonResult() })
  renderComparison(trip.id)

  expect(await screen.findByText('Chưa đủ phương án để so sánh')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Mở phương án đã có' })).toHaveAttribute(
    'href',
    `/chuyen/${trip.id}/phuong-an?revision=${only.id}`,
  )
  expect(screen.getByRole('link', { name: 'Thiết lập tối ưu' })).toHaveAttribute('href', `/chuyen/${trip.id}/toi-uu`)
  // Mục "Phương án đã lưu" (V2.3) liệt kê bản duy nhất với số thật của revision
  const saved = screen.getByRole('article', { name: only.id })
  expect(within(saved).getByText('MOCK RESULT')).toBeInTheDocument()
  expect(within(saved).getByText(vi.percent(only.result.metrics.volumeUtilizationPercent))).toBeInTheDocument()
  expect(within(saved).getByText(only.jobId)).toBeInTheDocument()
})
