import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb, type DeliveryStop } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { TripDetailPage } from './TripDetailPage'

/**
 * Tối ưu tuyến và phân nhóm hàng ở Chi tiết chuyến (FE-4b-09, FE-4b-06) trên kho mock thật. Chuyến thử đi từ Kho Long Bình tới ba
 * điểm cùng vĩ độ, cách kho 0,3° · 0,1° · 0,2° kinh độ: thứ tự gần nhất trước là B → C → A, mỗi chặng 17 phút, mỗi điểm dừng 15 phút
 * (số đã kiểm ở `trip-route.test.ts`). Đồng hồ của kho là giờ thật nên chuyến và yêu cầu tạo trong test dùng năm 2099.
 */
const SLOW = { timeout: 8000 }
const LAT = 10.9294
const STOPS: DeliveryStop[] = [
  { id: 'STOP-01', name: 'Điểm A', address: 'Đường A', lat: LAT, lng: 106.5747 },
  { id: 'STOP-02', name: 'Điểm B', address: 'Đường B', lat: LAT, lng: 106.7747 },
  { id: 'STOP-03', name: 'Điểm C', address: 'Đường C', lat: LAT, lng: 106.6747 },
]

function renderTrip(tripId: string, role: Role = 'dispatcher') {
  signedInAs(role)
  const router = createMemoryRouter([{ path: '/chuyen/:tripId', element: <TripDetailPage /> }, { path: '*', element: <p>Màn khác</p> }], { initialEntries: [`/chuyen/${tripId}`] })
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
  return userEvent.setup()
}

async function newTrip(name: string, stops: DeliveryStop[]) {
  const db = getMockDb()
  db.restoreSession('US-0001')
  return db.createTrip({ name, vehicleId: 'VEHICLE-001', stops, packages: [], scheduledDate: '2099-12-31', departureAt: '2099-12-31T08:00:00+07:00' })
}

const route = () => within(screen.getByRole('region', { name: 'Sơ đồ tuyến' }))
const stopItems = () => within(route().getByRole('list', { name: /^Kho xuất phát rồi/ })).getAllByRole('listitem').slice(1)
const stopNames = () => stopItems().map((item) => item.querySelector('.line-clamp-2')?.textContent)

test('the dispatcher optimizes the route: stops in visiting order with arrival times, a MOCK RESULT badge, the map, and the trip becomes planned', async () => {
  const trip = await newTrip('Tuyến thử tối ưu tuyến', STOPS)
  const user = renderTrip(trip.id)
  const button = await screen.findByRole('button', { name: 'Tối ưu tuyến' }, SLOW)
  expect(route().getByText('Chưa tối ưu tuyến. Tối ưu để có thứ tự điểm giao, giờ đến dự kiến và mức hạn của từng điểm.')).toBeInTheDocument()
  expect(screen.getByRole('banner')).toHaveTextContent('Nháp')
  expect(stopNames()).toStrictEqual(['Điểm A', 'Điểm B', 'Điểm C'])

  await user.click(button)
  expect(await screen.findByText('Đã tối ưu tuyến 3 điểm giao.', {}, SLOW)).toBeInTheDocument()
  await waitFor(() => expect(stopNames()).toStrictEqual(['Điểm B', 'Điểm C', 'Điểm A']), SLOW)
  await waitFor(() => expect(stopItems()[0]).toHaveTextContent('Dự kiến đến 08:17 31/12'), SLOW)
  expect(stopItems()[1]).toHaveTextContent('Dự kiến đến 08:49 31/12')
  expect(stopItems()[2]).toHaveTextContent('Dự kiến đến 09:21 31/12')
  // Kết quả của mock: nhãn MOCK RESULT, quãng đường và thời gian ước lượng; không điểm nào có hạn nên không có mức hạn
  expect(route().getByText('Tuyến đã tối ưu')).toBeInTheDocument()
  expect(route().getByText('MOCK RESULT')).toBeInTheDocument()
  expect(route().getByText('42,6 km · 1 giờ 36 phút')).toBeInTheDocument()
  expect(route().queryByText(/^(Kịp hạn|Sát hạn|Trễ hạn dự kiến)$/)).toBeNull()
  expect(route().getByRole('button', { name: 'Tối ưu lại tuyến' })).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('banner')).toHaveTextContent('Đã lập kế hoạch'), SLOW)
  // Bản đồ tuyến: kho rồi các điểm theo thứ tự đi, số của điểm đi kèm tên
  const map = within(route().getByRole('region', { name: `Bản đồ tuyến ${trip.id}` }))
  expect(within(map.getByRole('list')).getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual([
    'Kho xuất phát: Kho Long Bình', 'Điểm 1: Điểm B', 'Điểm 2: Điểm C', 'Điểm 3: Điểm A',
  ])
})

test('a stop without coordinates is tagged, and optimizing names exactly that stop', async () => {
  const trip = await newTrip('Tuyến thử thiếu toạ độ', [STOPS[0]!, { id: 'STOP-02', name: 'Điểm chưa có toạ độ', address: 'Đường B' }])
  const user = renderTrip(trip.id)
  await user.click(await screen.findByRole('button', { name: 'Tối ưu tuyến' }, SLOW))
  expect(await route().findByRole('alert')).toHaveTextContent('Điểm giao số 2 chưa có toạ độ nên chưa tối ưu tuyến được.')
  expect(within(stopItems()[1]!).getByText('Chưa có toạ độ')).toBeInTheDocument()
  expect(within(stopItems()[0]!).queryByText('Chưa có toạ độ')).toBeNull()
  expect(screen.getByRole('banner')).toHaveTextContent('Nháp')
})

test('a stop reached after its deadline is marked late on the stop, on the route bar and next to the trip status', async () => {
  const db = getMockDb()
  db.restoreSession('US-0002')
  // KCN Hoà Khánh cách Kho Long Bình hơn 600 km: hạn 10 phút sau giờ xuất phát thì chắc chắn trễ
  const requirement = await db.createDeliveryRequirement({
    destinationName: 'Xưởng Hoà Khánh', address: 'Lô 5, KCN Hoà Khánh, Đà Nẵng', lat: 16.0747, lng: 108.1506, deadline: '2099-12-31T08:10:00+07:00', priority: 'HIGH',
    packageIds: ['PK-0031'],
  })
  const trip = await newTrip('Tuyến thử trễ hạn', [STOPS[1]!])
  await db.assignDeliveryRequirement(requirement.id, trip.id)
  const user = renderTrip(trip.id)
  await user.click(await screen.findByRole('button', { name: 'Tối ưu tuyến' }, SLOW))
  expect(await route().findByText('1 điểm trễ hạn dự kiến', {}, SLOW)).toBeInTheDocument()
  // Điểm có hạn gấp đi trước; mức hạn nằm ngay trên điểm
  await waitFor(() => expect(stopNames()).toStrictEqual(['Xưởng Hoà Khánh', 'Điểm B']), SLOW)
  expect(within(stopItems()[0]!).getByText('Trễ hạn dự kiến')).toBeInTheDocument()
  expect(stopItems()[0]!.querySelector('.sr-only')).toHaveTextContent(/hạn giao 08:10 31\/12\/2099.*dự kiến đến .*, Trễ hạn dự kiến/)
  await waitFor(() => expect(within(screen.getByRole('banner')).getByText('Có điểm trễ hạn dự kiến')).toBeInTheDocument(), SLOW)
})

test('the manager reads the optimized route of the seed trip and its cargo groups, without a way to optimize', async () => {
  renderTrip('TRIP-2026-0914', 'companyManager')
  await screen.findByRole('region', { name: 'Sơ đồ tuyến' }, SLOW)
  expect(await route().findByText('Tuyến đã tối ưu', {}, SLOW)).toBeInTheDocument()
  expect(route().getByText('MOCK RESULT')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Tối ưu.*tuyến/ })).toBeNull()
  expect(stopItems()).toHaveLength(4)
  // seed: 132 kiện gõ tay, không ghi loại hàng → hàng thường khoá chuyến, không có kiện khác loại
  const groups = within(await screen.findByRole('region', { name: 'Phân nhóm hàng' }))
  expect(await groups.findByRole('list', { name: 'Số kiện theo loại hàng' }, SLOW)).toHaveTextContent('Thường132 kiện')
  expect(groups.queryByText('Dòng kiện khác loại hàng của chuyến')).toBeNull()
})

test('the cargo group card shows the locked class, the lines of another class and the reason, which the dispatcher can rewrite', async () => {
  const trip = await newTrip('Tuyến thử phân nhóm hàng', [])
  const db = getMockDb()
  // PK-0065 (giá trị cao) vào trước nên khoá chuyến; hai thùng bánh quy PK-0032, PK-0033 là hàng thường
  await db.addTripPackages(trip.id, ['PK-0065', 'PK-0032', 'PK-0033'], { newStop: { name: 'Xưởng Tân Bình', address: 'KCN Tân Bình' } }, { overrideReason: 'Khách gom chung một xe' })
  const user = renderTrip(trip.id)
  const card = within(await screen.findByRole('region', { name: 'Phân nhóm hàng' }, SLOW))
  expect(await card.findByText('2 kiện khác loại', {}, SLOW)).toBeInTheDocument()
  expect(card.getByRole('list', { name: 'Số kiện theo loại hàng' })).toHaveTextContent('Giá trị cao1 kiệnThường2 kiện')
  expect(card.getByText('PKG-002')).toBeInTheDocument()
  expect(card.getByText('Thường · 2 kiện')).toBeInTheDocument()
  expect(card.getByText('Khách gom chung một xe')).toBeInTheDocument()
  // Kiểm tra trước khi tối ưu: đã ghi lý do thì chỉ cảnh báo
  const readiness = within(screen.getByRole('region', { name: 'Kiểm tra trước khi tối ưu' }))
  expect(await readiness.findByText('2 kiện khác loại hàng, đã ghi lý do chở chung', {}, SLOW)).toBeInTheDocument()

  await user.click(card.getByRole('button', { name: 'Sửa lý do' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Chở chung kiện khác loại hàng' }))
  const reason = dialog.getByRole('textbox', { name: 'Lý do chở chung' })
  expect(reason).toHaveValue('Khách gom chung một xe')
  await user.clear(reason)
  await user.type(reason, 'Đã chèn lót riêng')
  await user.click(dialog.getByRole('button', { name: 'Lưu lý do' }))
  expect(await screen.findByText('Đã ghi lý do chở chung.', {}, SLOW)).toBeInTheDocument()
  expect((await db.getTrip(trip.id)).overrideReason).toBe('Đã chèn lót riêng')
  expect(await card.findByText('Đã chèn lót riêng', {}, SLOW)).toBeInTheDocument()
})
