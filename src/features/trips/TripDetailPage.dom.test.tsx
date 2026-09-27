import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { TripDetailPage } from './TripDetailPage'

const SLOW = { timeout: 4000 }

/** Seam: kho dùng chung → `trips-api.ts` → hook → màn Chi tiết chuyến, đăng nhập bằng tài khoản demo (không giả lập module nào). */
function renderDetail(tripId: string, role: Role = 'dispatcher') {
  signedInAs(role)
  const router = createMemoryRouter(
    [
      { path: '/chuyen/:tripId', element: <TripDetailPage /> },
      { path: '/chuyen/:tripId/sua', element: <p>Form sửa chuyến</p> },
      { path: '/chuyen/:tripId/toi-uu', element: <p>Thiết lập tối ưu</p> },
      { path: '/chuyen/:tripId/phuong-an', element: <p>Planner</p> },
    ],
    { initialEntries: [`/chuyen/${tripId}`] },
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={client}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
  return { user: userEvent.setup(), container: view.container }
}

/** Nút hoặc link mang nền primary của `Button` — mỗi màn đúng một (AGENTS mục 5). */
const primaryActions = (container: HTMLElement) => container.querySelectorAll('a.text-on-primary, button.text-on-primary')

test('a trip being loaded is locked: the banner says why, edit actions are gone, progress shows packages loaded so far', async () => {
  const { container } = renderDetail('TRIP-011')
  expect(await screen.findByText('Kho đang xếp hàng theo phương án đã duyệt nên xe, điểm giao và kiện đã khoá.', {}, SLOW)).toBeInTheDocument()
  // LM-104: chip vẫn Đã duyệt, tiến độ kho là dòng phụ cạnh chip
  expect(screen.getByText(/^Kho đang xếp \d+ \/ 280$/).previousElementSibling).toHaveTextContent('Đã duyệt')
  expect(screen.queryByRole('link', { name: 'Chạy tối ưu' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Thêm kiện' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Nhập từ file' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Đổi xe' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Kéo để đổi thứ tự/ })).not.toBeInTheDocument()
  // Hành động chính còn lại: mở phương án đã duyệt trong 3D
  expect(screen.getByRole('link', { name: 'Xem phương án 3D' })).toHaveAttribute('href', expect.stringContaining('/chuyen/TRIP-011/phuong-an?revision='))
  expect(primaryActions(container)).toHaveLength(1)

  // Banner: phần khung chuyến vẫn sửa được, dẫn tới form sửa
  expect(screen.getByText('Vẫn sửa được tên, ngày chạy và tài xế.', { exact: false })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Sửa thông tin chuyến' })).toHaveAttribute('href', '/chuyen/TRIP-011/sua')

  const plan = (await getMockDb().listRevisions('TRIP-011')).findLast((revision) => revision.approvedAt !== undefined)
  const progress = within(await screen.findByRole('list', { name: 'Tiến trình' }, SLOW))
  expect(progress.getByText(`Đã xếp 110 / ${plan!.result.placements.length} kiện`)).toBeInTheDocument()
  expect(progress.getByText('Xếp hàng')).toHaveTextContent('Xếp hàng, đang diễn ra')
  // Tài xế ở dòng dưới tên chuyến; cột phải có tài xế kèm số điện thoại
  expect(screen.getByText('Đặng Hoài Nam')).toBeInTheDocument()
  expect(screen.getByText('Đặng Hoài Nam · 0907 890 123')).toBeInTheDocument()
})

test('a stale trip says which approved plan is out of date and why — the package line changed, before → after — and links to setup', async () => {
  renderDetail('TRIP-013')
  const approved = (await getMockDb().listRevisions('TRIP-013')).findLast((revision) => revision.approvedAt !== undefined)
  const banner = (await screen.findByText(`Phương án ${approved!.id} đã lỗi thời: xe hoặc kiện đã đổi sau lần tối ưu.`, {}, SLOW)).closest('[role="status"]')!
  expect(banner).toHaveTextContent(/Nguyễn Thanh Tùng — PKG-001 Kiện nước giặt 4 can · Số lượng/)
  expect(within(banner as HTMLElement).getByText('từ 80 thành 86')).toBeInTheDocument()
  expect(within(banner as HTMLElement).getByRole('link', { name: 'Tới Thiết lập tối ưu' })).toHaveAttribute('href', '/chuyen/TRIP-013/toi-uu')
  // Tiến trình: mốc duyệt lỗi thời, kho chờ duyệt lại
  const progress = within(screen.getByRole('list', { name: 'Tiến trình' }))
  expect(progress.getByText('Duyệt phương án')).toHaveTextContent('Duyệt phương án, đã xong, phương án lỗi thời')
  expect(progress.getByText('Chờ duyệt lại')).toBeInTheDocument()
})

test('a trip with a plan offers both actions — "Xem phương án 3D" primary, "Chạy tối ưu" secondary; a draft only runs optimization', async () => {
  const { container } = renderDetail('TRIP-2026-0914')
  const openPlan = await screen.findByRole('link', { name: 'Xem phương án 3D' }, SLOW)
  const run = screen.getByRole('link', { name: 'Chạy tối ưu' })
  expect([...primaryActions(container)]).toStrictEqual([openPlan])
  expect(run).toHaveAttribute('href', '/chuyen/TRIP-2026-0914/toi-uu')
  expect(within(await screen.findByRole('list', { name: 'Tiến trình' }, SLOW)).getByText('Tiếp theo')).toBeInTheDocument()
})

test('a draft trip without packages cannot run yet and says why under the button', async () => {
  const created = await getMockDb().createTrip({ name: 'Tuyến thử chưa có kiện', vehicleId: 'VEHICLE-001', stops: [], packages: [], scheduledDate: '2026-09-30' })
  const { container } = renderDetail(created.id)
  const run = await screen.findByRole('button', { name: 'Chạy tối ưu' }, SLOW)
  expect(run).toBeDisabled()
  expect(run).toHaveAccessibleDescription('Chưa chạy được: chuyến chưa có kiện nào.')
  expect(screen.queryByRole('link', { name: 'Xem phương án 3D' })).not.toBeInTheDocument()
  expect(primaryActions(container)).toHaveLength(1)
})

test('cancelling a trip needs a reason, then shows "Đã huỷ" and writes the cancellation to the log', async () => {
  const { user } = renderDetail('TRIP-014')
  await user.click(await screen.findByRole('button', { name: 'Thao tác' }, SLOW))
  await user.click(await screen.findByRole('menuitem', { name: 'Huỷ chuyến' }))
  const dialog = await screen.findByRole('dialog', { name: 'Huỷ chuyến TRIP-014?' })
  await user.click(within(dialog).getByRole('button', { name: 'Huỷ chuyến' }))
  expect(await within(dialog).findByText('Nhập lý do huỷ chuyến')).toBeInTheDocument()
  expect((await getMockDb().getTrip('TRIP-014')).phase).toBe('planning')

  await user.type(within(dialog).getByLabelText('Lý do huỷ'), 'Khách hoãn đơn sang tuần sau')
  await user.click(within(dialog).getByRole('button', { name: 'Huỷ chuyến' }))
  // Banner nói lúc huỷ và lý do; tiến trình kết thúc ở mốc huỷ
  expect(await screen.findByText(/Lý do: Khách hoãn đơn sang tuần sau/, {}, SLOW)).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(within(screen.getByRole('list', { name: 'Tiến trình' })).getByText('Đã huỷ')).toHaveTextContent('Đã huỷ, đã xong')
  expect(screen.queryByRole('button', { name: 'Thao tác' })).not.toBeInTheDocument()

  const trip = await getMockDb().getTrip('TRIP-014')
  expect(trip).toMatchObject({ phase: 'cancelled', cancellation: { reason: 'Khách hoãn đơn sang tuần sau', by: 'US-0001' } })
  const [latest] = await getMockDb().listEvents({ targetId: 'TRIP-014' })
  expect(latest).toMatchObject({ action: 'trip.cancelled', actorId: 'US-0001', params: { reason: 'Khách hoãn đơn sang tuần sau' } })
})

test('a completed trip lists its delivery issues with kind, stop and note, and is read-only', async () => {
  renderDetail('TRIP-005')
  expect(await screen.findByText('1 sự cố giao hàng', {}, SLOW)).toBeInTheDocument()
  const issue = screen.getByText('Thùng móp góc do xóc đường, khách vẫn nhận').closest('li')!
  expect(issue).toHaveTextContent(/^Hàng hỏng·2Điểm 2/)
  expect(screen.getByText('Chuyến đã hoàn thành; màn này chỉ để xem.')).toBeInTheDocument()
  // Sơ đồ tuyến có số tổng hợp của chuyến đã giao xong
  const route = screen.getByRole('heading', { name: 'Sơ đồ tuyến' }).closest('summary')!
  expect(route).toHaveTextContent('Đã giao3 / 3 điểm')
  expect(route).toHaveTextContent('Sự cố1')
  // Menu thao tác chỉ còn mở báo cáo chuyến (LM-104): không sửa, không huỷ
  await userEvent.click(screen.getByRole('button', { name: 'Thao tác' }))
  expect((await screen.findAllByRole('menuitem')).map((item) => item.textContent)).toStrictEqual(['Báo cáo chuyến'])
  expect(screen.getByRole('menuitem', { name: 'Báo cáo chuyến' })).toHaveAttribute('href', '/chuyen/TRIP-005/bao-cao')
})

test('a package the warehouse reported missing is listed with its stop', async () => {
  renderDetail('TRIP-003')
  expect(await screen.findByText('1 kiện thiếu ở kho', {}, SLOW)).toBeInTheDocument()
  const trip = await getMockDb().getTrip('TRIP-003')
  const missing = trip.loading?.steps.find((step) => step.outcome === 'missing')
  expect(screen.getByText(missing!.packageInstanceId)).toBeInTheDocument()
  expect(await screen.findByText(/thiếu 1 kiện/)).toBeInTheDocument()
})

test('the manager reads a trip without the actions menu, with one primary action to view the plan', async () => {
  const { container } = renderDetail('TRIP-2026-0914', 'manager')
  expect(await screen.findByRole('heading', { name: 'Kiện hàng' }, SLOW)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Thao tác' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Chạy tối ưu' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Nhập từ file' })).not.toBeInTheDocument()
  expect(await screen.findByRole('link', { name: 'Xem phương án 3D' })).toBeInTheDocument()
  expect(primaryActions(container)).toHaveLength(1)
})

/** Mã kiện của các dòng bảng kiện đang hiện, theo thứ tự. */
function packageIds() {
  const table = within(screen.getByRole('region', { name: 'Kiện hàng' }))
  return table.getAllByRole('row').slice(1).map((row) => /PKG-\d{3}/.exec(row.textContent ?? '')?.[0])
}

test('the stop list filters the package table; the fragile chip and the search narrow it further (V2)', async () => {
  const { user } = renderDetail('TRIP-2026-0914')
  await screen.findByRole('row', { name: /PKG-006/ }, SLOW)
  expect(packageIds()).toHaveLength(6)

  // Seed chuyến chính: điểm 2 có PKG-002 và PKG-003
  const stop2 = screen.getByRole('button', { name: /^Lọc kiện theo điểm 2/ })
  await user.click(stop2)
  expect(stop2).toHaveAttribute('aria-pressed', 'true')
  expect(packageIds()).toStrictEqual(['PKG-002', 'PKG-003'])
  // Ô chọn điểm giao trên bảng đi cùng một bộ lọc
  expect(screen.getByRole('combobox', { name: 'Lọc theo điểm giao' })).toHaveValue('2')
  await user.click(stop2)
  expect(packageIds()).toHaveLength(6)

  // Dễ vỡ là mức Cao: PKG-003 thuỷ tinh và PKG-005 trứng
  await user.click(screen.getByRole('button', { name: 'Chỉ hàng dễ vỡ' }))
  expect(packageIds()).toStrictEqual(['PKG-003', 'PKG-005'])
  await user.type(screen.getByRole('searchbox', { name: 'Tìm mã hoặc tên kiện' }), 'trung ga')
  expect(packageIds()).toStrictEqual(['PKG-005'])
})

test('the right column warns about fragile cargo; selecting a package shows its preview, and a read-only viewer gets no form', async () => {
  const { user } = renderDetail('TRIP-2026-0914', 'manager')
  expect(await screen.findByText('22 kiện dễ vỡ', {}, SLOW)).toBeInTheDocument()

  await user.click(screen.getByRole('row', { name: /PKG-003/ }))
  const panel = within(screen.getByRole('complementary', { name: 'Kiện PKG-003' }))
  expect(panel.getByRole('img', { name: /Hình kiện 40 × 30 × 25 cm/ })).toBeInTheDocument()
  // 11 kiện × 13,5 kg
  expect(panel.getByText('148,5 kg')).toBeInTheDocument()
  expect(panel.getByText('Mức dễ vỡ: Cao')).toBeInTheDocument()
  // Quản lý chỉ xem: có phần xem kiện, không có form sửa
  expect(panel.queryByRole('textbox', { name: 'Tên kiện' })).not.toBeInTheDocument()
})
