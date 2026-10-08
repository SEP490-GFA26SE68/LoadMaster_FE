import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { FleetPage } from './FleetPage'
import { VehicleDetailPage } from './VehicleDetailPage'

/**
 * Ca nghiệm thu của LM-040 / LM-041, chạy qua kho mock thật (không giả lập kho):
 * cửa rộng hơn lòng thùng, vật cản vượt ra ngoài thùng, và lưu xe mới rồi thấy nó trong danh sách.
 * LM-089: bật/tắt bảo dưỡng, xe đang chạy chuyến chỉ đọc, quản lý chỉ xem trạng thái.
 */

const SLOW = { timeout: 5000 }

function renderAt(path: string, role: Role = 'dispatcher') {
  const router = createMemoryRouter(
    [
      { path: '/doi-xe', element: <FleetPage /> },
      { path: '/doi-xe/moi', element: <VehicleDetailPage /> },
      { path: '/doi-xe/:vehicleId', element: <VehicleDetailPage /> },
    ],
    { initialEntries: [path] },
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  signedInAs(role)
  render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
  return userEvent.setup()
}

/** Ô số: xoá giá trị cũ rồi gõ giá trị mới. */
async function retype(user: ReturnType<typeof userEvent.setup>, field: HTMLElement, value: string) {
  await user.clear(field)
  await user.type(field, value)
}

test('a door wider than the cargo space fails on the door field with the Spec sentence', async () => {
  const user = renderAt('/doi-xe/VEHICLE-001')

  // Truck 6m của Spec mục 12: lòng thùng rộng 240 cm, cửa 220 cm
  const doorWidth = await screen.findByLabelText(/^Chiều rộng cửa/, {}, SLOW)
  await retype(user, doorWidth, '250')
  await user.click(screen.getByRole('button', { name: 'Lưu' }))

  const sentence = 'Chiều rộng cửa 250 cm không được lớn hơn chiều rộng lòng thùng 240 cm.'
  expect(await screen.findAllByText(sentence)).not.toHaveLength(0)
  expect(doorWidth).toHaveAttribute('aria-invalid', 'true')
})

test('an obstacle sticking out of the cargo space fails on its own row', async () => {
  const user = renderAt('/doi-xe/VEHICLE-001')

  // Hốc bánh xe OBS-001 dài 120 cm đặt ở x = 0; thùng dài 600 cm
  const length = await screen.findByLabelText('Dài OBS-001', {}, SLOW)
  await retype(user, length, '700')
  await user.click(screen.getByRole('button', { name: 'Lưu' }))

  const rowErrors = await screen.findByRole('list', { name: 'Lỗi theo dòng vật cản' }, SLOW)
  expect(within(rowErrors).getByText('Vật cản OBS-001 vượt chiều dài thùng 100 cm.')).toBeInTheDocument()
  // Lỗi thuộc cả dòng, không thuộc riêng ô chiều dài
  expect(length).not.toHaveAttribute('aria-invalid')
})

test('a saved new vehicle shows up in the fleet list without reloading the page', async () => {
  const user = renderAt('/doi-xe/moi')
  const name = 'Hino FC9J đông lạnh · 51C-190.08'

  await user.type(screen.getByLabelText(/^Tên xe/), name)
  await user.click(screen.getByRole('button', { name: 'Lưu' }))

  expect(await screen.findByRole('heading', { name: 'Đội xe' }, SLOW)).toBeInTheDocument()
  expect(await screen.findByRole('link', { name }, SLOW)).toBeInTheDocument()
})

test('a dispatcher puts an available vehicle into maintenance with a required note, then ends it', async () => {
  const user = renderAt('/doi-xe/VEHICLE-004')
  const heading = await screen.findByRole('heading', { level: 1, name: 'Hino FC9J đông lạnh · 51C-190.07' }, SLOW)
  const header = heading.closest('header')!
  expect(within(header).getByText('Sẵn sàng')).toBeInTheDocument()

  await user.click(within(header).getByRole('button', { name: 'Đưa vào bảo dưỡng' }))
  const dialog = await screen.findByRole('dialog', { name: 'Đưa xe Hino FC9J đông lạnh · 51C-190.07 vào bảo dưỡng?' })
  await user.click(within(dialog).getByRole('button', { name: 'Đưa vào bảo dưỡng' }))
  expect(await within(dialog).findByText('Ghi lý do bảo dưỡng.')).toBeInTheDocument()

  await user.type(within(dialog).getByLabelText('Ghi chú bảo dưỡng'), 'Kiểm tra dàn lạnh')
  await user.click(within(dialog).getByRole('button', { name: 'Đưa vào bảo dưỡng' }))
  expect(await within(header).findByText('Bảo dưỡng', {}, SLOW)).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).toBeNull()
  const banner = screen.getByRole('status')
  expect(banner).toHaveTextContent(/^Xe đang bảo dưỡng từ \d{2}:\d{2} \d{2}\/\d{2}\/\d{4}: chưa gán được cho chuyến nào\./)
  expect(banner).toHaveTextContent('Ghi chú: Kiểm tra dàn lạnh')
  // Submit của hộp thoại không lan tới form xe: vẫn ở trang cấu hình, không lưu và rời trang
  expect(screen.getByRole('heading', { level: 1, name: 'Hino FC9J đông lạnh · 51C-190.07' })).toBeInTheDocument()

  await user.click(within(header).getByRole('button', { name: 'Kết thúc bảo dưỡng' }))
  expect(await within(header).findByText('Sẵn sàng', {}, SLOW)).toBeInTheDocument()
  expect(screen.queryByRole('status')).toBeNull()
  expect(within(header).getByRole('button', { name: 'Đưa vào bảo dưỡng' })).toBeInTheDocument()
})

test('a vehicle running a trip opens read-only and says which trip locks it', async () => {
  renderAt('/doi-xe/VEHICLE-007')
  const banner = await screen.findByRole('status', {}, SLOW)
  expect(banner).toHaveTextContent('Xe đang chạy chuyến TRIP-011: cấu hình bị khoá tới khi chuyến kết thúc')
  expect(within(banner).getByRole('link', { name: 'Xem chuyến TRIP-011' })).toHaveAttribute('href', '/chuyen/TRIP-011')
  expect(screen.getByText('Đang phục vụ chuyến')).toBeInTheDocument()
  expect(screen.getByLabelText(/^Chiều rộng cửa/)).toBeDisabled()
  for (const name of ['Lưu', 'Xoá xe', 'Đưa vào bảo dưỡng', 'Kết thúc bảo dưỡng']) {
    expect(screen.queryByRole('button', { name })).toBeNull()
  }
})

test('the manager reads the maintenance note but has no maintenance action', async () => {
  renderAt('/doi-xe/VEHICLE-008', 'manager')
  const banner = await screen.findByRole('status', {}, SLOW)
  expect(banner).toHaveTextContent('Ghi chú: Thay má phanh và bảo dưỡng định kỳ 20.000 km')
  expect(screen.getByText('Bảo dưỡng')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Kết thúc bảo dưỡng' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Lưu' })).toBeNull()
})
