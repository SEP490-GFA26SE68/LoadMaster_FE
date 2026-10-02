import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { stopColor } from '@/lib/stops'
import { signedInAs } from '@/test/signed-in'
import { TripDetailPage } from './TripDetailPage'

/**
 * Điểm giao của chuyến ở Chi tiết chuyến (FE-4b-04, D-73) trên kho mock thật: điểm tự sinh khi đưa yêu cầu giao vào chuyến, gộp theo
 * địa chỉ và toạ độ, hạn sớm nhất và ưu tiên cao nhất; điểm tay cho kiện lẻ. Mỗi test tạo chuyến riêng; yêu cầu REQ-001 (KCN Hoà Khánh,
 * Thấp, hạn 17:00 18/09/2026), REQ-003 (KCN Thăng Long, Khẩn, hạn 12:00 19/09/2026) chép từ `seed-sourcing.ts`. Đồng hồ của kho là giờ
 * thật nên yêu cầu tạo trong test dùng hạn năm 2099.
 */
const SLOW = { timeout: 8000 }

async function renderTrip(name: string) {
  signedInAs('dispatcher')
  const db = getMockDb()
  db.restoreSession('US-0001')
  const trip = await db.createTrip({ name, vehicleId: 'VEHICLE-001', stops: [], packages: [], scheduledDate: '2026-09-30', departureAt: '2026-09-30T06:30:00+07:00' })
  const router = createMemoryRouter(
    [{ path: '/chuyen/:tripId', element: <TripDetailPage /> }, { path: '*', element: <p>Màn khác</p> }],
    { initialEntries: [`/chuyen/${trip.id}`] },
  )
  render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <RouterProvider router={router} />
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
  return { user: userEvent.setup(), trip, db }
}

const route = () => screen.getByRole('region', { name: 'Sơ đồ tuyến' })
/** Tên các điểm giao trên sơ đồ tuyến, theo thứ tự — bỏ mục kho xuất phát đầu danh sách. */
const stopNames = () => within(within(route()).getByRole('list')).getAllByRole('listitem').slice(1).map((item) => item.querySelector('.line-clamp-2')?.textContent)

async function assign(user: ReturnType<typeof userEvent.setup>, tripName: string, option: RegExp) {
  await user.click(within(screen.getByRole('region', { name: 'Yêu cầu giao của chuyến' })).getByRole('button', { name: 'Đưa yêu cầu vào chuyến' }))
  const dialog = within(await screen.findByRole('dialog', { name: `Đưa yêu cầu giao vào ${tripName}` }, SLOW))
  await user.click(await dialog.findByRole('combobox', { name: 'Yêu cầu giao' }, SLOW))
  await user.click(await screen.findByRole('option', { name: option }))
  return dialog
}

test('a new trip has no stops: the route card says where stops come from, packages wait for a stop, and a stop is added by hand', async () => {
  const { user, trip, db } = await renderTrip('Tuyến thử điểm tay')
  const card = within(await screen.findByRole('region', { name: 'Sơ đồ tuyến' }, SLOW))
  // Kho xuất phát của chuyến và giờ xuất phát dự kiến (giờ Việt Nam)
  expect(card.getByText('Kho Long Bình')).toBeInTheDocument()
  expect(card.getByText('Dự kiến xuất phát 06:30')).toBeInTheDocument()
  expect(screen.getByText('Ngày chạy', { exact: false })).toHaveTextContent('Ngày chạy 30/09/2026, xuất phát 06:30')
  expect(card.getByText('Chuyến chưa có điểm giao. Đưa yêu cầu giao vào chuyến để điểm giao tự sinh, hoặc thêm điểm giao tay cho kiện lẻ.')).toBeInTheDocument()
  expect(stopNames()).toStrictEqual([])
  // Kiện phải thuộc một điểm giao
  expect(screen.getByText('Chuyến chưa có điểm giao. Đưa yêu cầu giao vào chuyến, hoặc thêm điểm giao rồi thêm kiện.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Thêm kiện' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Nhập từ file' })).toBeNull()

  await user.click(card.getByRole('button', { name: 'Thêm điểm giao' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Thêm điểm giao' }))
  await user.click(dialog.getByRole('button', { name: 'Thêm điểm giao' }))
  expect(await dialog.findByText('Nhập tên điểm giao')).toBeInTheDocument()
  await user.type(dialog.getByRole('textbox', { name: 'Tên điểm giao' }), 'Xưởng may Sóng Thần')
  // Toạ độ qua ô chọn toạ độ dùng chung; ô địa chỉ trống nên được điền theo địa danh
  await user.type(dialog.getByRole('combobox', { name: 'Tìm địa danh' }), 'song than 2')
  await user.click(await dialog.findByRole('option', { name: /KCN Sóng Thần 2/ }))
  expect(dialog.getByRole('textbox', { name: 'Địa chỉ' })).toHaveValue('KCN Sóng Thần 2, TP. Dĩ An, Bình Dương')
  await user.type(dialog.getByRole('textbox', { name: 'Số điện thoại' }), '0918 407 331')
  await user.click(dialog.getByRole('button', { name: 'Thêm điểm giao' }))

  expect(await screen.findByText('Đã thêm điểm 1: Xưởng may Sóng Thần.', {}, SLOW)).toBeInTheDocument()
  await waitFor(() => expect(stopNames()).toStrictEqual(['Xưởng may Sóng Thần']), SLOW)
  // Điểm tay: không hạn, không ưu tiên; có toạ độ và liên hệ
  expect((await db.getTrip(trip.id)).stops).toStrictEqual([
    { id: 'STOP-01', name: 'Xưởng may Sóng Thần', address: 'KCN Sóng Thần 2, TP. Dĩ An, Bình Dương', phone: '0918 407 331', lat: 10.9, lng: 106.743 },
  ])
  expect(await screen.findByRole('button', { name: 'Thêm kiện' }, SLOW)).toBeInTheDocument()
  expect(within(route()).getByText('Điểm giao tự sinh khi đưa yêu cầu giao vào chuyến; điểm tự sinh hết kiện thì tự mất. Kiện lẻ cần một điểm giao thêm tay.')).toBeInTheDocument()
})

test('requirements put on the trip generate its stops; the same place shares one stop with the earliest deadline and the highest priority', async () => {
  const { user, trip, db } = await renderTrip('Tuyến thử điểm tự sinh')
  // Yêu cầu thứ hai tới KCN Hoà Khánh: cùng địa chỉ (viết khác kiểu) và toạ độ với REQ-001, ưu tiên Cao, hạn muộn hơn
  db.restoreSession('US-0002')
  const extra = await db.createDeliveryRequirement({
    destinationName: 'Xưởng Hoà Khánh', address: 'kcn hoà khánh - q. liên chiểu, đà nẵng', lat: 16.0747, lng: 108.1506, deadline: '2099-12-31T17:00:00+07:00', priority: 'HIGH',
    packageIds: ['PK-0029'],
  })
  db.restoreSession('US-0001')
  await screen.findByRole('region', { name: 'Sơ đồ tuyến' }, SLOW)
  const stopItems = () => within(within(route()).getByRole('list')).getAllByRole('listitem').slice(1)

  const first = await assign(user, trip.name, /^REQ-001 · KCN Hoà Khánh/)
  expect(first.getByRole('status')).toHaveTextContent('Điểm giao: chuyến có thêm điểm 1 · KCN Hoà Khánh ở cuối tuyến.')
  await user.click(first.getByRole('button', { name: 'Đưa vào chuyến' }))
  expect(await screen.findByText(`Đã đưa yêu cầu REQ-001 vào ${trip.name}, điểm 1.`, {}, SLOW)).toBeInTheDocument()
  await waitFor(() => expect(stopNames()).toStrictEqual(['KCN Hoà Khánh']), SLOW)
  expect(stopItems()[0]).toHaveTextContent('Hạn 17:00 18/09')
  expect(within(stopItems()[0]!).getByText('Thấp')).toBeInTheDocument()

  // Cùng địa chỉ và toạ độ: gộp vào điểm 1 — hạn vẫn là hạn sớm nhất (của REQ-001), ưu tiên lên Cao
  const merged = await assign(user, trip.name, new RegExp(`^${extra.id} · Xưởng Hoà Khánh`))
  expect(merged.getByRole('status')).toHaveTextContent('Điểm giao: gộp vào điểm 1 · KCN Hoà Khánh — cùng địa chỉ và toạ độ.')
  await user.click(merged.getByRole('button', { name: 'Đưa vào chuyến' }))
  await waitFor(() => expect(within(stopItems()[0]!).getByText('Cao')).toBeInTheDocument(), SLOW)
  expect(stopNames()).toStrictEqual(['KCN Hoà Khánh'])
  expect(stopItems()[0]).toHaveTextContent('Hạn 17:00 18/09')

  const third = await assign(user, trip.name, /^REQ-003 · KCN Thăng Long/)
  expect(third.getByRole('status')).toHaveTextContent('Điểm giao: chuyến có thêm điểm 2 · KCN Thăng Long ở cuối tuyến.')
  await user.click(third.getByRole('button', { name: 'Đưa vào chuyến' }))
  await waitFor(() => expect(stopNames()).toStrictEqual(['KCN Hoà Khánh', 'KCN Thăng Long']), SLOW)
  expect(stopItems()[1]).toHaveTextContent('Hạn 12:00 19/09')
  expect(within(stopItems()[1]!).getByText('Khẩn')).toBeInTheDocument()
  // Mốc màu định danh của điểm giao luôn kèm số
  expect(stopItems()[1]!.querySelector('[data-stop-marker="2"]')).toHaveStyle({ background: stopColor(2) })

  // Thẻ yêu cầu: theo thứ tự điểm giao rồi hạn
  const card = within(screen.getByRole('region', { name: 'Yêu cầu giao của chuyến' }))
  const listed = () => card.getAllByRole('listitem').map((item) => /REQ-\d{3}/.exec(item.textContent ?? '')?.[0])
  await waitFor(() => expect(listed()).toStrictEqual(['REQ-001', extra.id, 'REQ-003']), SLOW)
  expect(card.getByText(/^Điểm 2 · KCN Thăng Long/)).toHaveTextContent('Điểm 2 · KCN Thăng Long · Hạn 12:00 19/09/2026 · 2 kiện')

  // Gỡ REQ-001: điểm 1 còn yêu cầu kia nên ở lại, hạn về hạn của yêu cầu đó
  await user.click(card.getByRole('button', { name: 'Gỡ yêu cầu REQ-001' }))
  expect(await screen.findByText('Đã gỡ yêu cầu REQ-001 khỏi chuyến.', {}, SLOW)).toBeInTheDocument()
  await waitFor(() => expect(stopItems()[0]).toHaveTextContent('Hạn 17:00 31/12'), SLOW)
  expect(stopNames()).toStrictEqual(['KCN Hoà Khánh', 'KCN Thăng Long'])
  // Gỡ yêu cầu cuối cùng của điểm 1: điểm tự sinh hết kiện nên tự mất, KCN Thăng Long thành điểm 1
  await waitFor(() => expect(card.getByRole('button', { name: `Gỡ yêu cầu ${extra.id}` })).toBeEnabled(), SLOW)
  await user.click(card.getByRole('button', { name: `Gỡ yêu cầu ${extra.id}` }))
  await waitFor(() => expect(stopNames()).toStrictEqual(['KCN Thăng Long']), SLOW)
  expect((await db.getTrip(trip.id)).stops.map((stop) => [stop.id, stop.generated, stop.priority])).toStrictEqual([['STOP-02', true, 'URGENT']])
  expect(await card.findByText(/^Điểm 1 · KCN Thăng Long/, {}, SLOW)).toBeInTheDocument()
})
