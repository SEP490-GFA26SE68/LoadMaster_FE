import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { MonitoringPage } from './MonitoringPage'

/**
 * Màn Giám sát (FE-6-10 → FE-6-12) trên kho mock thật. Đồng hồ chỉ giả `Date`: 12:00 ngày neo 14/09/2026 và đứng yên. Chuyến seed
 * `TRIP-009` (Thaco Ollin 720 · 61C-339.05, tài xế Ngô Văn Bảo) rời kho 06:25:30, xong điểm 1 lúc 07:35, xe mô phỏng đứng ở điểm 2 từ
 * 07:39; điểm 3 cách đó 1.353.659 ms = 18,80 km đường (số đã kiểm ở `tracking.test.ts`): tới nơi 12:22. Đường tránh gần: × 1,15 =
 * 21,6 km · 26 phút, tới 12:25. Luật của kho kiểm ở `exceptions.test.ts`; yêu cầu giao và gia hạn đi cả luồng ở E2E.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-14T05:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

const SLOW = { timeout: 8000 }

function renderPage(role: Role, route = '/giam-sat') {
  signedInAs(role)
  const router = createMemoryRouter([{ path: '/giam-sat', element: <MonitoringPage /> }, { path: '/chuyen/:tripId', element: null }], { initialEntries: [route] })
  return render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <RouterProvider router={router} />
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
}

const panel = () => within(screen.getByRole('region', { name: 'Giám sát chuyến TRIP-009' }))
/** Sau một hộp thoại: phần còn lại của màn chỉ đọc được lại khi hộp đã đóng. */
const panelAfterDialog = async () => within(await screen.findByRole('region', { name: 'Giám sát chuyến TRIP-009' }, SLOW))

test('the dispatcher watches the trip in transit, reports an incident, takes another route and sends it to the manager, who finds it in the tab', async () => {
  const user = userEvent.setup()
  const dispatcher = renderPage('dispatcher')
  expect(await screen.findByRole('heading', { level: 1, name: 'Giám sát' })).toBeInTheDocument()
  expect(await screen.findByText('1 chuyến đang vận chuyển', undefined, SLOW)).toBeInTheDocument()
  // Điều phối viên không có tab "Sự cố cần xử lý"
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument()

  // Danh sách — cũng là bản thay thế bản đồ: xe, tài xế, điểm tiếp, giờ đến, mức hạn, nguồn vị trí
  const tripRow = () => within(screen.getByRole('list', { name: 'Chuyến đang vận chuyển' })).getByRole('listitem')
  await screen.findByRole('list', { name: 'Chuyến đang vận chuyển' }, SLOW)
  await within(tripRow()).findByText('Mô phỏng', undefined, SLOW)
  const row = tripRow()
  expect(row).toHaveTextContent('TRIP-009')
  expect(row).toHaveTextContent('Thaco Ollin 720 · 61C-339.05 · Tài xế Ngô Văn Bảo')
  expect(row).toHaveTextContent(/Đang ở điểm 2 · .+ · Đã đến 08:20/)
  expect(row).toHaveTextContent('Không có hạn')
  expect(row).not.toHaveTextContent('sự cố')

  // Bản đồ: xe kèm nhãn mã chuyến và nguồn vị trí; ba điểm giao của chuyến đang chọn
  const map = within(screen.getByRole('region', { name: 'Bản đồ các xe đang vận chuyển' }))
  expect(map.getByText('Vị trí xe: chuyến TRIP-009, Thaco Ollin 720 · 61C-339.05 (Mô phỏng)')).toBeInTheDocument()
  expect(map.getByText('TRIP-009 · Mô phỏng')).toBeInTheDocument()
  expect(map.getAllByRole('listitem').filter((item) => /^Điểm \d/.test(item.textContent ?? ''))).toHaveLength(3)
  expect(screen.getAllByText('MOCK RESULT').length).toBeGreaterThan(0)

  // Chi tiết: giờ đến từng điểm so hạn, lịch sử vị trí
  const etaRows = within(panel().getByRole('table', { name: 'Giờ đến từng điểm' })).getAllByRole('row').slice(1)
  expect(etaRows.map((item) => item.textContent)).toStrictEqual([
    expect.stringMatching(/Đã giao xong lúc 07:35Không có hạn$/),
    expect.stringMatching(/Đã đến lúc 08:20Không có hạn$/),
    expect.stringMatching(/12:22 14\/09Không có hạn$/),
  ])
  expect(await panel().findByText('670 điểm vị trí', undefined, SLOW)).toBeInTheDocument()
  expect(within(panel().getByRole('table', { name: 'Các điểm gần nhất, mới nhất trước.' })).getAllByRole('row')).toHaveLength(7)
  expect(panel().getByText('Chuyến chưa có sự cố nào.')).toBeInTheDocument()

  // Lọc "Có nguy cơ trễ": chuyến không có hạn nào nên không khớp
  await user.click(screen.getByRole('button', { name: 'Có nguy cơ trễ 0' }))
  expect(screen.getByText('Không có chuyến khớp bộ lọc.')).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Giám sát chuyến TRIP-009' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Bỏ lọc' }))

  // Báo sự cố: loại, mô tả, số phút dự kiến chậm
  await user.click(panel().getByRole('button', { name: 'Báo sự cố' }))
  const report = within(await screen.findByRole('dialog', { name: 'Báo sự cố chuyến TRIP-009' }))
  await user.click(report.getByRole('button', { name: 'Báo sự cố' }))
  expect(report.getByText('Chọn loại sự cố.')).toBeInTheDocument()
  expect(report.getByText('Nhập số phút nguyên từ 0 đến 480.')).toBeInTheDocument()
  await user.click(report.getByRole('radio', { name: 'Tắc đường' }))
  await user.type(report.getByRole('textbox', { name: 'Mô tả' }), 'Kẹt xe ở ngã tư Sở Sao')
  await user.type(report.getByRole('textbox', { name: 'Số phút dự kiến chậm' }), '20')
  await user.click(report.getByRole('button', { name: 'Báo sự cố' }))
  expect(await screen.findByText('Đã báo sự cố EXC-001', undefined, SLOW)).toBeInTheDocument()
  const incident = (await (await panelAfterDialog()).findByText('Kẹt xe ở ngã tư Sở Sao', undefined, SLOW)).closest('li')
  expect(incident).toHaveTextContent('EXC-001Tắc đườngChưa xử lý')
  expect(incident).toHaveTextContent('Báo lúc 12:00 14/09 bởi Nguyễn Thanh Tùng · Dự kiến chậm 20 phút · Xe đang tới điểm 2')
  // (danh sách đã dựng lại sau khi bỏ lọc: lấy lại dòng)
  await within(tripRow()).findByText('1 sự cố', undefined, SLOW)
  expect(screen.getByRole('button', { name: 'Có sự cố 1' })).toBeInTheDocument()

  // Tìm tuyến khác: ba lựa chọn mock tới điểm 3 (xe đang đứng ở điểm 2), thứ tự điểm không đổi
  await user.click(panel().getByRole('button', { name: 'Tìm tuyến khác' }))
  const reroute = within(await screen.findByRole('dialog', { name: 'Tìm tuyến khác cho chuyến TRIP-009' }))
  const options = await reroute.findAllByRole('radio', undefined, SLOW)
  expect(options.map((option) => option.closest('label')?.textContent)).toStrictEqual([
    'Đường tránh gần21,6 km · 26 phút · Đến điểm 3 lúc 12:25',
    'Đường vành đai24,4 km · 29 phút · Đến điểm 3 lúc 12:29',
    'Cao tốc28,2 km · 24 phút · Đến điểm 3 lúc 12:24',
  ])
  expect(reroute.getByText('MOCK RESULT')).toBeInTheDocument()
  expect(reroute.getByText(/^Thứ tự điểm giao không đổi\./)).toBeInTheDocument()
  expect(reroute.getByRole('button', { name: 'Chọn tuyến này' })).toBeDisabled()
  await user.click(options[0]!)
  await user.click(reroute.getByRole('button', { name: 'Chọn tuyến này' }))
  expect(await screen.findByText('Chuyến TRIP-009 đi Đường tránh gần', undefined, SLOW)).toBeInTheDocument()
  expect(await (await panelAfterDialog()).findByText('Tuyến đã chọn lúc 12:00: Đường tránh gần · 21,6 km · 26 phút tới điểm 3', undefined, SLOW)).toBeInTheDocument()

  // Không có tuyến khả thi — chuyển quản lý
  await user.click(panel().getByRole('button', { name: 'Không có tuyến khả thi — chuyển quản lý' }))
  expect(await panel().findByText('Chuyển quản lý lúc 12:00 14/09: không có tuyến khả thi', undefined, SLOW)).toBeInTheDocument()
  expect(incident).toHaveTextContent('Đã chuyển quản lý')
  expect(panel().queryByRole('button', { name: 'Không có tuyến khả thi — chuyển quản lý' })).not.toBeInTheDocument()
  expect(panel().getByRole('button', { name: 'Đã xử lý' })).toBeInTheDocument()
  dispatcher.unmount()

  // Quản lý công ty: chỉ xem ở tab chuyến, và có tab "Sự cố cần xử lý"
  renderPage('manager')
  const tabs = within(await screen.findByRole('tablist', { name: 'Phần của màn Giám sát' }, SLOW))
  await screen.findByRole('region', { name: 'Giám sát chuyến TRIP-009' }, SLOW)
  expect(panel().queryByRole('button', { name: 'Báo sự cố' })).not.toBeInTheDocument()
  expect(panel().queryByRole('button', { name: 'Đã xử lý' })).not.toBeInTheDocument()
  expect(await panel().findByText('Điều phối viên xử lý sự cố của chuyến; bạn chỉ xem.', undefined, SLOW)).toBeInTheDocument()
  // số trên tab: sự cố đã chuyển lên mà chưa nhập hạn mới
  const escalationTab = tabs.getByRole('tab', { name: /^Sự cố cần xử lý/ })
  await within(escalationTab).findByText('1', undefined, SLOW)
  await user.click(escalationTab)
  const escalated = within(within(await screen.findByRole('list', { name: 'Sự cố cần xử lý' }, SLOW)).getAllByRole('listitem')[0]!)
  expect(escalated.getByRole('heading', { name: 'Tắc đường' })).toBeInTheDocument()
  expect(escalated.getByRole('link', { name: 'Chuyến TRIP-009' })).toHaveAttribute('href', '/chuyen/TRIP-009')
  // chuyến không có điểm nào có hạn: dòng nói điểm xe đang đứng
  expect(escalated.getByText(/^Điểm 2 · /).closest('li')).toHaveTextContent(/Đã đến 08:20 14\/09Không có hạn$/)
  // Chuyến seed không chở yêu cầu giao nào: hộp nói rõ không có gì để gia hạn
  await user.click(escalated.getByRole('button', { name: 'Nhập hạn mới' }))
  const renegotiate = within(await screen.findByRole('dialog', { name: 'Liên hệ khách và nhập hạn mới' }))
  expect(await renegotiate.findByText('Chuyến này không có yêu cầu giao nào đang giao để gia hạn.', undefined, SLOW)).toBeInTheDocument()
  expect(renegotiate.queryByRole('button', { name: 'Lưu hạn mới' })).not.toBeInTheDocument()
}, 40_000)
