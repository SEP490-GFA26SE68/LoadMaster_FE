import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { TripDetailPage } from './TripDetailPage'

/**
 * Điều phối viên đưa kiện Đã nhập thẳng vào chuyến ở Chi tiết chuyến (FE-4b-05, D-68 đường 2) trên kho mock thật. Kiện của seed:
 * PK-0064 `TL-HNI-2609-01` (giá trị cao, 45 × 35 × 30 cm, 7,2 kg), PK-0029 / PK-0030 thùng bánh quy (loại kiện PT-005, 60 × 40 × 35 cm,
 * 6 kg); PK-0013 thuộc REQ-006 và PK-0063 mang cờ nên không nằm trong ô chọn.
 */
const SLOW = { timeout: 8000 }

async function renderTrip(name: string, { role = 'dispatcher', poolPackages = [] }: { role?: Role; poolPackages?: string[] } = {}) {
  const db = getMockDb()
  db.restoreSession('US-0001')
  const trip = await db.createTrip({ name, vehicleId: 'VEHICLE-001', stops: [], packages: [], scheduledDate: '2026-09-30' })
  if (poolPackages.length > 0) await db.addTripPackages(trip.id, poolPackages, { newStop: TAN_BINH })
  signedInAs(role)
  const router = createMemoryRouter([{ path: '/chuyen/:tripId', element: <TripDetailPage /> }, { path: '*', element: <p>Màn khác</p> }], { initialEntries: [`/chuyen/${trip.id}`] })
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

const TAN_BINH = { name: 'Xưởng bánh kẹo Tân Bình', address: 'KCN Tân Bình, Q. Tân Phú, TP. Hồ Chí Minh', lat: 10.817, lng: 106.62 }
const poolCard = () => within(screen.getByRole('region', { name: 'Kiện đưa thẳng từ kho kiện' }))
const listed = () => poolCard().getAllByRole('listitem').map((item) => /PK-\d{4}/.exec(item.textContent ?? '')?.[0])

async function openPicker(user: ReturnType<typeof userEvent.setup>) {
  await user.click(poolCard().getByRole('button', { name: 'Thêm kiện từ kho kiện' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Thêm kiện từ kho kiện' }))
  const filter = await dialog.findByRole('searchbox', { name: 'Lọc theo điểm đến ghi trong file, mã kiện' }, SLOW)
  return { dialog, filter }
}

test('the picker offers only IMPORTED packages without a flag and outside every requirement; errors sit at the fields', async () => {
  const { user } = await renderTrip('Tuyến thử ô chọn kiện')
  expect(await screen.findByText('Chưa có kiện nào đưa thẳng từ kho kiện vào chuyến này.', {}, SLOW)).toBeInTheDocument()
  const { dialog, filter } = await openPicker(user)
  // Chuyến chưa có điểm tay nào: mặc định tạo điểm giao mới
  expect(dialog.getByRole('combobox', { name: 'Điểm giao' })).toHaveTextContent('Tạo điểm giao mới')
  // PK-0013 thuộc REQ-006, PK-0063 mang cờ: không có trong ô chọn
  await user.type(filter, 'PK-0013')
  expect(await dialog.findByText('Không kiện nào khớp ô lọc.')).toBeInTheDocument()
  await user.clear(filter)
  await user.type(filter, 'PK-0063')
  expect(dialog.getByText('Không kiện nào khớp ô lọc.')).toBeInTheDocument()
  // Gửi khi chưa chọn kiện và chưa đặt tên điểm: lỗi tại ô
  await user.click(dialog.getByRole('button', { name: 'Đưa vào chuyến' }))
  expect(await dialog.findByText('Chọn ít nhất một kiện.')).toBeInTheDocument()
  expect(dialog.getByRole('textbox', { name: 'Tên điểm giao' })).toHaveAccessibleDescription('Nhập tên điểm giao')
})

test('the dispatcher adds IMPORTED packages to a new hand-added stop and sees them on the trip', async () => {
  const { user, trip, db } = await renderTrip('Tuyến thử kiện kho kiện')
  await screen.findByText('Chưa có kiện nào đưa thẳng từ kho kiện vào chuyến này.', {}, SLOW)
  const { dialog, filter } = await openPicker(user)
  await user.type(filter, 'PK-0064')
  await user.click(await dialog.findByRole('checkbox', { name: /^PK-0064/ }))
  await user.clear(filter)
  await user.type(filter, 'MP-BQ')
  await user.click(await dialog.findByRole('checkbox', { name: /^PK-0029/ }))
  await user.click(dialog.getByRole('checkbox', { name: /^PK-0030/ }))
  expect(dialog.getByText('Đã chọn 3 kiện · 19,2 kg')).toBeInTheDocument()
  await user.type(dialog.getByRole('textbox', { name: 'Tên điểm giao' }), 'Xưởng Tân Bình')
  await user.type(dialog.getByRole('combobox', { name: 'Tìm địa danh' }), 'kcn tan b')
  await user.click(await dialog.findByRole('option', { name: /KCN Tân Bình/ }))
  await user.click(dialog.getByRole('button', { name: 'Đưa vào chuyến' }))

  // PK-0064 (giá trị cao) là kiện đầu tiên nên khoá chuyến; hai thùng bánh quy là hàng thường → hộp vượt luật hỏi lý do (FE-4b-06)
  const override = within(await screen.findByRole('dialog', { name: 'Chở chung kiện khác loại hàng' }, SLOW))
  expect(override.getByText('Giá trị cao')).toBeInTheDocument()
  expect(override.getByText('MP-BQ-0913-02 và MP-BQ-0913-01')).toBeInTheDocument()
  await user.click(override.getByRole('button', { name: 'Lưu lý do' }))
  expect(await override.findByText('Cần ghi lý do.')).toBeInTheDocument()
  expect((await db.getTrip(trip.id)).packages).toStrictEqual([])
  await user.type(override.getByRole('textbox', { name: 'Lý do chở chung' }), 'Khách gom chung một xe')
  await user.click(override.getByRole('button', { name: 'Lưu lý do' }))

  expect(await screen.findByText('Đã đưa 3 kiện vào chuyến, điểm 1.', {}, SLOW)).toBeInTheDocument()
  expect((await db.getTrip(trip.id)).overrideReason).toBe('Khách gom chung một xe')
  // Thẻ liệt kê từng kiện theo dòng kiện của chuyến (ô chọn xếp kiện mới nhất trước), kèm điểm giao
  await waitFor(() => expect(listed()).toStrictEqual(['PK-0064', 'PK-0030', 'PK-0029']), SLOW)
  const first = poolCard().getAllByRole('listitem')[0]!
  expect(first).toHaveTextContent('TL-HNI-2609-01')
  expect(first).toHaveTextContent('45 × 35 × 30 cm · 7,2 kg')
  expect(first).toHaveTextContent('Điểm 1 · Xưởng Tân Bình')
  expect(within(first).getByText('Giá trị cao')).toBeInTheDocument()
  const saved = await db.getTrip(trip.id)
  // Điểm tay: toạ độ của địa danh đã chọn, địa chỉ điền theo địa danh; không hạn
  expect(saved.stops).toStrictEqual([{ id: 'STOP-01', name: 'Xưởng Tân Bình', address: 'KCN Tân Bình, Q. Tân Phú, TP. Hồ Chí Minh', lat: 10.817, lng: 106.62 }])
  // Hai thùng bánh quy cùng loại kiện gộp một dòng
  expect(saved.packages.map((line) => [line.id, line.name, line.quantity, line.deliveryStop])).toStrictEqual([['PKG-001', 'TL-HNI-2609-01', 1, 1], ['PKG-002', 'Thùng bánh quy', 2, 1]])
  expect(await db.getPackage('PK-0064')).toMatchObject({ status: 'ASSIGNED', tripId: trip.id, stopId: 'STOP-01' })
})

test('a package taken off the trip goes back to the pool; the next time the hand-added stop is preselected', async () => {
  const { user, trip, db } = await renderTrip('Tuyến thử bỏ kiện', { poolPackages: ['PK-0031', 'PK-0032'] })
  await waitFor(() => expect(listed()).toStrictEqual(['PK-0031', 'PK-0032']), SLOW)
  await user.click(poolCard().getByRole('button', { name: 'Bỏ kiện PK-0031 khỏi chuyến' }))
  expect(await screen.findByText('Đã bỏ kiện PK-0031 khỏi chuyến; kiện về kho kiện.', {}, SLOW)).toBeInTheDocument()
  await waitFor(() => expect(listed()).toStrictEqual(['PK-0032']), SLOW)
  expect((await db.getPackage('PK-0031')).status).toBe('IMPORTED')
  expect((await db.getTrip(trip.id)).packages.map((line) => [line.id, line.quantity])).toStrictEqual([['PKG-001', 1]])

  const { dialog } = await openPicker(user)
  expect(dialog.getByRole('combobox', { name: 'Điểm giao' })).toHaveTextContent('Điểm 1 · Xưởng bánh kẹo Tân Bình')
  expect(dialog.queryByRole('textbox', { name: 'Tên điểm giao' })).toBeNull()
})

test('the manager only reads: no way to add or remove; the card hides when the trip has no pool package', async () => {
  const { trip, db } = await renderTrip('Tuyến thử chỉ xem', { role: 'manager' })
  await screen.findByRole('region', { name: 'Sơ đồ tuyến' }, SLOW)
  expect(screen.queryByRole('region', { name: 'Kiện đưa thẳng từ kho kiện' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Thêm kiện từ kho kiện' })).toBeNull()
  expect((await db.getTrip(trip.id)).packages).toStrictEqual([])
})
