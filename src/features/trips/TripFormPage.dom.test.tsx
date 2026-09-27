import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { TripFormPage } from './TripFormPage'

const SLOW = { timeout: 3000 }

/** Seam: kho dùng chung → `trips-api.ts` → hook → form, không giả lập module nào (LM-053: không báo thành công giả). */
function renderForm(route: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/chuyen', element: <p>Danh sách chuyến</p> },
      { path: '/chuyen/moi', element: <TripFormPage /> },
      { path: '/chuyen/:tripId/sua', element: <TripFormPage /> },
      { path: '/chuyen/:tripId', element: <p>Chi tiết chuyến</p> },
    ],
    { initialEntries: [route] },
  )
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>,
  )
  return { user: userEvent.setup(), router }
}

async function choose(user: ReturnType<typeof userEvent.setup>, combobox: string, option: string) {
  await user.click(screen.getByRole('combobox', { name: combobox }))
  await user.click(await screen.findByRole('option', { name: option }))
}

test('creating a trip writes run date, driver and stop contacts to the repository, then opens its detail', async () => {
  const { user } = renderForm('/chuyen/moi')
  await user.click(screen.getByRole('button', { name: 'Tạo chuyến' }))
  // Lỗi hiện dưới từng ô và cùng lúc trong thẻ kiểm tra bên phải
  expect(await screen.findByText('3 lỗi cần sửa trước khi lưu')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Tên chuyến' })).toHaveAccessibleDescription('Nhập tên chuyến')
  expect(screen.getByRole('textbox', { name: 'Tên điểm giao 1' })).toHaveAccessibleDescription('Nhập tên điểm giao')
  expect(screen.getAllByText('Chọn xe')).toHaveLength(2)

  const [vehicle] = await getMockDb().listVehicles()
  await user.type(screen.getByLabelText('Tên chuyến'), 'Tuyến Q.9 – Thủ Đức')
  fireEvent.change(screen.getByLabelText('Ngày chạy'), { target: { value: '2026-09-21' } })
  // Chỉ tài xế đang hoạt động; mặc định "Chưa gán"
  expect(screen.getByRole('combobox', { name: 'Tài xế' })).toHaveTextContent('Chưa gán')
  await choose(user, 'Tài xế', 'Phạm Quốc Dũng')
  await choose(user, 'Xe', vehicle!.name)
  await user.type(screen.getByLabelText('Tên điểm giao 1'), 'Q.9')
  await user.type(screen.getByLabelText('Số điện thoại điểm giao 1'), '0901 234 567')
  await user.type(screen.getByLabelText('Người liên hệ điểm giao 1'), 'Anh Minh')
  await user.click(screen.getByRole('button', { name: 'Thêm điểm giao' }))
  await user.type(screen.getByLabelText('Tên điểm giao 2'), 'Thủ Đức')
  await user.type(screen.getByLabelText('Địa chỉ điểm giao 2'), 'Võ Văn Ngân')
  await user.click(screen.getByRole('button', { name: 'Tạo chuyến' }))

  expect(await screen.findByText('Chi tiết chuyến', {}, SLOW)).toBeInTheDocument()
  const created = (await getMockDb().listTrips()).find((trip) => trip.name === 'Tuyến Q.9 – Thủ Đức')
  expect(created).toMatchObject({
    vehicleId: vehicle!.id, packages: [], scheduledDate: '2026-09-21', driverId: 'US-0004', phase: 'planning',
    stops: [
      { id: 'STOP-01', name: 'Q.9', address: '', phone: '0901 234 567', contactName: 'Anh Minh' },
      { id: 'STOP-02', name: 'Thủ Đức', address: 'Võ Văn Ngân' },
    ],
  })
  // Liên hệ để trống không lưu thành chuỗi rỗng
  expect(created?.stops[1]).not.toHaveProperty('phone')
})

test('while creating, the up/down buttons reorder stops; the first cannot move up and the last cannot move down', async () => {
  const { user } = renderForm('/chuyen/moi')
  await user.type(await screen.findByLabelText('Tên điểm giao 1'), 'Q.9')
  await user.click(screen.getByRole('button', { name: 'Thêm điểm giao' }))
  await user.type(screen.getByLabelText('Tên điểm giao 2'), 'Thủ Đức')
  expect(screen.getByRole('button', { name: 'Đưa điểm giao 1 lên trước' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Đưa điểm giao 2 xuống sau' })).toBeDisabled()

  await user.click(screen.getByRole('button', { name: 'Đưa điểm giao 2 lên trước' }))
  expect(screen.getByLabelText('Tên điểm giao 1')).toHaveValue('Thủ Đức')
  expect(screen.getByLabelText('Tên điểm giao 2')).toHaveValue('Q.9')
  // Tóm tắt bên phải đếm điểm giao theo form đang nhập
  expect(within(screen.getByRole('region', { name: 'Tóm tắt chuyến' })).getByText('2')).toBeInTheDocument()
})

test('a phone number with letters is rejected at its field', async () => {
  const { user } = renderForm('/chuyen/moi')
  await user.type(await screen.findByLabelText('Số điện thoại điểm giao 1'), 'gọi sau')
  await user.click(screen.getByRole('button', { name: 'Tạo chuyến' }))
  expect(await screen.findByText('4 lỗi cần sửa trước khi lưu')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Số điện thoại điểm giao 1' })).toHaveAccessibleDescription('Chỉ gồm chữ số, dấu cách và + - . ( )')
})

test('the check card reads the form live: empty required fields first, an error once a field is left, and a jump to that field', async () => {
  const { user } = renderForm('/chuyen/moi')
  const checks = within(await screen.findByRole('region', { name: 'Kiểm tra trước khi lưu' }))
  // Form mới mở: ô bắt buộc còn trống chưa tính là lỗi
  expect(checks.getByRole('status')).toHaveTextContent('Còn 3 ô bắt buộc chưa nhập')

  const phone = screen.getByRole('textbox', { name: 'Số điện thoại điểm giao 1' })
  await user.type(phone, '0918 407 331/332')
  await user.tab()
  // Rời ô là thấy lỗi dưới ô và trong thẻ kiểm tra, chưa cần bấm lưu
  expect(phone).toHaveAccessibleDescription('Chỉ gồm chữ số, dấu cách và + - . ( )')
  expect(checks.getByRole('status')).toHaveTextContent('1 lỗi cần sửa trước khi lưu')
  const stopsRow = checks.getByText('Số điện thoại điểm giao 1').closest('li') as HTMLElement
  expect(stopsRow).toHaveTextContent('Chỉ gồm chữ số, dấu cách và + - . ( )')
  await user.click(within(stopsRow).getByRole('button', { name: 'Tới ô cần sửa' }))
  expect(phone).toHaveFocus()

  await user.clear(phone)
  await user.type(phone, '0918 407 331')
  await user.type(screen.getByRole('textbox', { name: 'Tên chuyến' }), 'Tuyến Thủ Đức')
  await user.type(screen.getByRole('textbox', { name: 'Tên điểm giao 1' }), 'Thủ Đức')
  await choose(user, 'Xe', 'Truck 6m')
  expect(checks.getByRole('status')).toHaveTextContent('Không có lỗi — có thể lưu.')
})

test('a vehicle under maintenance is listed with the reason but cannot be chosen (D-53)', async () => {
  const { user } = renderForm('/chuyen/moi')
  await user.click(await screen.findByRole('combobox', { name: 'Xe' }))
  const listbox = await screen.findByRole('listbox')
  expect(await within(listbox).findByRole('option', { name: 'Hyundai Mighty EX8 · 50H-118.29 · đang bảo dưỡng' }, SLOW)).toHaveAttribute('aria-disabled', 'true')
  expect(within(listbox).getByRole('option', { name: 'Truck 6m' })).not.toHaveAttribute('aria-disabled')
})

test('editing renames the trip, edits a stop contact and keeps stop order and ids', async () => {
  const [trip] = await getMockDb().listTrips()
  const { user } = renderForm(`/chuyen/${trip!.id}/sua`)
  const name = await screen.findByLabelText('Tên chuyến', {}, SLOW)
  await user.clear(name)
  await user.type(name, 'Tuyến đã đổi tên')
  const contact = screen.getByLabelText('Người liên hệ điểm giao 2')
  await user.clear(contact)
  await user.type(contact, 'Anh Phúc (kho)')
  await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
  expect(await screen.findByText('Chi tiết chuyến', {}, SLOW)).toBeInTheDocument()
  const saved = await getMockDb().getTrip(trip!.id)
  expect(saved.name).toBe('Tuyến đã đổi tên')
  expect(saved.stops.map((stop) => stop.id)).toStrictEqual(trip!.stops.map((stop) => stop.id))
  expect(saved.stops[1]?.contactName).toBe('Anh Phúc (kho)')
  expect(saved.inputVersion).toBe(trip!.inputVersion)
})

test('while the warehouse loads, only name, run date and driver can change (D-45)', async () => {
  const before = await getMockDb().getTrip('TRIP-011')
  const { user } = renderForm('/chuyen/TRIP-011/sua')
  expect(await screen.findByText(/xe và điểm giao đã khoá/, {}, SLOW)).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Xe' })).toBeDisabled()
  expect(screen.getByLabelText('Tên điểm giao 1')).toBeDisabled()
  await choose(user, 'Tài xế', 'Ngô Văn Bảo')
  await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
  expect(await screen.findByText('Chi tiết chuyến', {}, SLOW)).toBeInTheDocument()
  const saved = await getMockDb().getTrip('TRIP-011')
  expect(saved).toMatchObject({ driverId: 'US-0006', vehicleId: before.vehicleId, phase: 'loading' })
})

test('leaving with unsaved changes asks first; staying keeps the input, confirming leaves (LM-100)', async () => {
  const { user, router } = renderForm('/chuyen/moi')
  await user.type(await screen.findByLabelText('Tên chuyến'), 'Tuyến chưa lưu')
  await user.click(screen.getByRole('link', { name: 'Huỷ' }))

  const dialog = await screen.findByRole('dialog', { name: 'Rời trang khi chưa lưu?' })
  await user.click(within(dialog).getByRole('button', { name: 'Ở lại' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/chuyen/moi')
  expect(screen.getByLabelText('Tên chuyến')).toHaveValue('Tuyến chưa lưu')

  // V2.3: đầu màn không còn nút quay lại; đường dẫn "Chuyến hàng / Tạo chuyến mới" dẫn về danh sách
  await user.click(screen.getByRole('link', { name: 'Chuyến hàng' }))
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Rời trang' }))
  expect(await screen.findByText('Danh sách chuyến')).toBeInTheDocument()
})

test('an untouched form leaves without asking', async () => {
  const { user } = renderForm('/chuyen/moi')
  await user.click(await screen.findByRole('link', { name: 'Huỷ' }))
  expect(await screen.findByText('Danh sách chuyến')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('a trip that has left the warehouse opens no form', async () => {
  renderForm('/chuyen/TRIP-009/sua')
  expect(await screen.findByRole('alert', {}, SLOW)).toHaveTextContent('Chuyến TRIP-009 đã rời kho hoặc đã kết thúc nên không sửa được nữa.')
  expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).not.toBeInTheDocument()
})
