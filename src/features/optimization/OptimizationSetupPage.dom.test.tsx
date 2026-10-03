import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, test } from 'vitest'
import type { CargoPackage } from '@/domain/models'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { OptimizationSetupPage } from './OptimizationSetupPage'

const TRIP_ID = 'TRIP-2026-0914'

/** Seam: kho dùng chung → `optimization-api.ts` → hook → màn hình, không giả lập module nào. */
function renderSetup(client = new QueryClient({ defaultOptions: { queries: { retry: false } } }), tripId = TRIP_ID) {
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={[`/chuyen/${tripId}/toi-uu`]}>
          <Routes><Route path="/chuyen/:tripId/toi-uu" element={<OptimizationSetupPage />} /></Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

test('the seed trip is ready to optimize, and the screen never says "AI"', async () => {
  renderSetup()
  expect(await screen.findByText('Không có lỗi — có thể tối ưu.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tối ưu' })).toBeEnabled()
  expect(document.body.textContent ?? '').not.toMatch(/\bAI\b/)
})

test('the run history lists every run newest first, the failed one with its reason (LM-104)', async () => {
  renderSetup()
  const history = within(await screen.findByRole('region', { name: 'Lần chạy tối ưu' }))
  const rows = await history.findAllByRole('row')
  expect(rows).toHaveLength(3)
  expect(rows[1]).toHaveTextContent('RUN-002')
  expect(rows[1]).toHaveTextContent('EP + DBLF (mock)')
  // Lần chạy ra ba phương án ứng viên (FE-5b-05): mỗi phương án một liên kết mở Planner, kèm tỷ lệ thể tích; bản được duyệt là C
  const run = within(rows[1] as HTMLElement)
  expect(run.getAllByRole('link', { name: /^Mở phương án / }).map((link) => [link.textContent, link.getAttribute('href')])).toStrictEqual([
    ['A · REV-001-A', `/chuyen/${TRIP_ID}/phuong-an?revision=REV-001-A`],
    ['B · REV-001-B', `/chuyen/${TRIP_ID}/phuong-an?revision=REV-001-B`],
    ['C · REV-001', `/chuyen/${TRIP_ID}/phuong-an?revision=REV-001`],
  ])
  expect(rows[1]).toHaveTextContent('30 s · seed 20260914')
  expect(rows[1]).toHaveTextContent('xếp đủ')
  expect(rows[1]).toHaveTextContent('Đã duyệt')
  expect(rows[1]).toHaveTextContent('Phương án C')
  expect(run.getByRole('link', { name: 'So sánh các phương án của lần chạy RUN-002' })).toHaveAttribute('href', `/chuyen/${TRIP_ID}/so-sanh?lan-chay=RUN-002`)
  expect(rows[2]).toHaveTextContent('EP + DBLF (mock)')
  expect(rows[2]).toHaveTextContent('Dịch vụ tối ưu không phản hồi')
  expect(within(rows[2] as HTMLElement).queryByRole('link')).toBeNull()
})

test('the setup no longer asks for an objective or an algorithm: it lists the three plans of a run and names the method that runs (FE-5b-05)', async () => {
  renderSetup()
  const plans = within(await screen.findByRole('list', { name: 'Ba phương án mỗi lần chạy' }))
  expect(plans.getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual([
    'APhương án A: Tối đa thể tíchDồn hàng sát vách trong, dùng ít chiều dài thùng nhất.',
    'BPhương án B: Cân bằng tải trụcĐặt khối hàng sao cho hai nhóm trục cùng mức tải.',
    'CPhương án C: Ít dỡ-xếp lạiXếp theo vùng của từng điểm giao, ít phải dỡ ra xếp lại nhất.',
  ])
  expect(screen.queryByRole('radio')).toBeNull()
  expect(document.querySelector('[data-run-algorithm]')).toHaveTextContent('EP + DBLF (mock)')
})

test('a draft trip cannot be optimized: the route check fails, links back to the trip, and the reason sits on the button (FE-5b-05)', async () => {
  renderSetup(undefined, 'TRIP-014')
  const summary = within(await screen.findByRole('region', { name: 'Kiểm tra trước khi tối ưu' }))
  expect(await summary.findByText('Chuyến còn Nháp. Tối ưu tuyến ở Chi tiết chuyến để chốt thứ tự điểm giao trước khi xếp hàng.')).toBeInTheDocument()
  expect(summary.getByRole('link', { name: 'Tới Chi tiết chuyến' })).toHaveAttribute('href', '/chuyen/TRIP-014')
  expect(summary.getByRole('alert')).toHaveTextContent('Còn lỗi: sửa các mục đánh dấu đỏ để tối ưu.')
  expect(screen.getByRole('button', { name: 'Tối ưu' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Tối ưu' })).toHaveAccessibleDescription('Chưa chạy được: 1 lỗi cần sửa ở Tuyến.')
})

test('a package with no usable orientation disables Optimize and the summary links to exactly that package', async () => {
  const db = getMockDb()
  const trip = await db.getTrip(TRIP_ID)
  const source = trip.packages[0] as CargoPackage
  const broken: CargoPackage = { ...source, id: 'PKG-900', allowedOrientations: ['HWL'], keepUpright: true }
  await db.updateTrip(TRIP_ID, { packages: [...trip.packages, broken] })

  renderSetup()
  const summary = within(await screen.findByRole('region', { name: 'Kiểm tra trước khi tối ưu' }))
  const link = await summary.findByRole('link', { name: /PKG-900/ })
  expect(link).toHaveAttribute('href', `/chuyen/${TRIP_ID}?kien=PKG-900`)
  // Liên kết còn lại của thẻ là "Xem kiện" của mục thông tin kiện không bắt buộc (V2.3), không phải một issue
  expect(summary.getAllByRole('link').filter((item) => item.getAttribute('href')?.includes('PKG-900'))).toHaveLength(1)
  expect(summary.getByRole('alert')).toHaveTextContent('Còn lỗi: sửa các mục đánh dấu đỏ để tối ưu.')
  expect(screen.getByRole('button', { name: 'Tối ưu' })).toBeDisabled()
  // Lý do tắt nằm ngay trên nút (LM-106): một lỗi, ở nhóm Kiện
  expect(screen.getByRole('button', { name: 'Tối ưu' })).toHaveAccessibleDescription('Chưa chạy được: 1 lỗi cần sửa ở Kiện.')

  await db.updateTrip(TRIP_ID, { packages: trip.packages })
})

test('fixing the cargo and coming back enables Optimize without touching the settings (LM-054)', async () => {
  const db = getMockDb()
  const trip = await db.getTrip(TRIP_ID)
  const source = trip.packages[0] as CargoPackage
  const broken: CargoPackage = { ...source, id: 'PKG-901', allowedOrientations: ['HWL'], keepUpright: true }
  await db.updateTrip(TRIP_ID, { packages: [...trip.packages, broken] })

  // Cùng QueryClient như app: lần mở lại đọc bản cache còn lỗi trước, rồi mới nhận dữ liệu đã sửa
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const first = renderSetup(client)
  expect(await screen.findByRole('link', { name: /PKG-901/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tối ưu' })).toBeDisabled()
  first.unmount()

  await db.updateTrip(TRIP_ID, { packages: trip.packages })
  void client.invalidateQueries({ queryKey: ['trips', TRIP_ID] })
  renderSetup(client)
  expect(await screen.findByText('Không có lỗi — có thể tối ưu.')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Tối ưu' })).toBeEnabled())
})

test('a trip the warehouse is loading cannot be optimized again: the banner says why and nothing can be changed (D-45)', async () => {
  renderSetup(undefined, 'TRIP-011')
  expect(await screen.findByText('Kho đang xếp hàng theo phương án đã duyệt nên xe, điểm giao và kiện đã khoá.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tối ưu' })).toBeDisabled()
  expect(screen.getByRole('combobox', { name: 'Xe chở chuyến này' })).toBeDisabled()
})

test('a vehicle under maintenance is listed with the reason but cannot be chosen (D-53)', async () => {
  renderSetup()
  const select = await screen.findByRole('combobox', { name: 'Xe chở chuyến này' })
  expect(within(select).getByRole('option', { name: 'Hyundai Mighty EX8 · 50H-118.29 · đang bảo dưỡng' })).toBeDisabled()
  expect(within(select).getByRole('option', { name: 'Truck 6m' })).toBeEnabled()
})

test('the sky header reads like the trip: breadcrumb, status chip and the trip data line (V2.3, LM-106)', async () => {
  renderSetup(undefined, 'TRIP-014')
  const header = (await screen.findByRole('heading', { name: 'Thiết lập tối ưu' })).closest('header') as HTMLElement
  const crumbs = within(header).getByRole('navigation')
  expect(within(crumbs).getByRole('link', { name: 'TRIP-014' })).toHaveAttribute('href', '/chuyen/TRIP-014')
  expect(await within(header).findByText('Nháp')).toBeInTheDocument()
  expect(header).toHaveTextContent('Tuyến Tân An – Dĩ An')
  expect(header).toHaveTextContent('Chưa gán tài xế')
  // Danh sách kiểm tra: mục đạt nói số của chuyến, không chỉ "đạt"
  const summary = within(screen.getByRole('region', { name: 'Kiểm tra trước khi tối ưu' }))
  expect(summary.getByText('3 dòng kiện · 140 kiện, không trùng mã')).toBeInTheDocument()
  expect(summary.getByText('40 kiện không bắt buộc xếp')).toBeInTheDocument()
})
