import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

/** Form tạo chuyến điền kho của công ty khi tải xong (D-76); kho chưa có phiên nên là công ty mặc định Long Bình. */
async function depotLoaded() {
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Tên kho' })).toHaveValue('Kho Long Bình'), SLOW)
}

test('creating a trip writes departure time, depot and driver to the repository — without stops — then opens its detail', async () => {
  const { user } = renderForm('/chuyen/moi')
  await depotLoaded()
  // Tạo chuyến không nhập điểm giao: điểm tự sinh khi đưa yêu cầu giao vào chuyến (FE-4b-04)
  expect(screen.queryByRole('textbox', { name: 'Tên điểm giao 1' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Thêm điểm giao' })).toBeNull()
  expect(screen.getByText('Thêm ở Chi tiết chuyến sau khi tạo: đưa yêu cầu giao vào chuyến thì điểm giao tự sinh.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Tạo chuyến' }))
  // Lỗi hiện dưới từng ô và cùng lúc trong thẻ kiểm tra bên phải
  expect(await screen.findByText('2 lỗi cần sửa trước khi lưu')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Tên chuyến' })).toHaveAccessibleDescription('Nhập tên chuyến')
  expect(screen.getAllByText('Chọn xe')).toHaveLength(2)

  const [vehicle] = await getMockDb().listVehicles()
  await user.type(screen.getByLabelText('Tên chuyến'), 'Tuyến Q.9 – Thủ Đức')
  fireEvent.change(screen.getByLabelText('Ngày chạy'), { target: { value: '2026-09-21' } })
  // Giờ xuất phát mặc định 08:00; kho xuất phát mặc định là kho của công ty, kèm toạ độ
  expect(screen.getByLabelText('Giờ xuất phát')).toHaveValue('08:00')
  fireEvent.change(screen.getByLabelText('Giờ xuất phát'), { target: { value: '06:30' } })
  const depot = within(screen.getByRole('group', { name: 'Toạ độ kho' }))
  expect([depot.getByRole('textbox', { name: 'Vĩ độ' }), depot.getByRole('textbox', { name: 'Kinh độ' })].map((input) => (input as HTMLInputElement).value)).toStrictEqual(['10.9294', '106.8747'])
  // Chỉ tài xế đang hoạt động; mặc định "Chưa gán"
  expect(screen.getByRole('combobox', { name: 'Tài xế' })).toHaveTextContent('Chưa gán')
  await choose(user, 'Tài xế', 'Phạm Quốc Dũng')
  await choose(user, 'Xe', vehicle!.name)
  await user.click(screen.getByRole('button', { name: 'Tạo chuyến' }))

  expect(await screen.findByText('Chi tiết chuyến', {}, SLOW)).toBeInTheDocument()
  const created = (await getMockDb().listTrips()).find((trip) => trip.name === 'Tuyến Q.9 – Thủ Đức')
  // 06:30 ngày 21/09 giờ Việt Nam
  expect(created).toMatchObject({
    vehicleId: vehicle!.id, packages: [], stops: [], scheduledDate: '2026-09-21', departureAt: '2026-09-20T23:30:00.000Z', driverId: 'US-0004', phase: 'planning',
    depot: { name: 'Kho Long Bình', address: '9 Đường 3A, KCN Biên Hoà 2, Biên Hoà, Đồng Nai', lat: 10.9294, lng: 106.8747 },
  })
})

test('the departure depot can be another place picked from the sample list; without coordinates the form does not save', async () => {
  const { user } = renderForm('/chuyen/moi')
  await depotLoaded()
  const depot = within(screen.getByRole('group', { name: 'Toạ độ kho' }))
  await user.click(depot.getByRole('button', { name: 'Bỏ toạ độ' }))
  await user.click(screen.getByRole('button', { name: 'Tạo chuyến' }))
  expect(await screen.findByText('3 lỗi cần sửa trước khi lưu')).toBeInTheDocument()
  expect(screen.getAllByText('Chọn toạ độ kho xuất phát')).toHaveLength(2)

  const name = screen.getByRole('textbox', { name: 'Tên kho' })
  await user.clear(name)
  await user.type(name, 'Bãi xe Sóng Thần')
  await user.clear(screen.getByRole('textbox', { name: 'Địa chỉ kho' }))
  await user.type(depot.getByRole('combobox', { name: 'Tìm địa danh' }), 'song than 1')
  await user.click(await depot.findByRole('option', { name: /KCN Sóng Thần 1/ }))
  // Ô địa chỉ đang trống nên được điền theo địa danh
  expect(screen.getByRole('textbox', { name: 'Địa chỉ kho' })).toHaveValue('KCN Sóng Thần 1, TP. Dĩ An, Bình Dương')
  expect(screen.queryByText('Chọn toạ độ kho xuất phát')).toBeNull()
  await user.type(screen.getByLabelText('Tên chuyến'), 'Tuyến từ Sóng Thần')
  await choose(user, 'Xe', 'Truck 6m')
  await user.click(screen.getByRole('button', { name: 'Tạo chuyến' }))
  expect(await screen.findByText('Chi tiết chuyến', {}, SLOW)).toBeInTheDocument()
  const created = (await getMockDb().listTrips()).find((trip) => trip.name === 'Tuyến từ Sóng Thần')
  expect(created?.depot).toStrictEqual({ name: 'Bãi xe Sóng Thần', address: 'KCN Sóng Thần 1, TP. Dĩ An, Bình Dương', lat: 10.893, lng: 106.75 })
})

test('a phone number with letters is rejected at its field of the edit form', async () => {
  const { user } = renderForm('/chuyen/TRIP-014/sua')
  const phone = await screen.findByLabelText('Số điện thoại điểm giao 1', {}, SLOW)
  await user.clear(phone)
  await user.type(phone, 'gọi sau')
  await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
  expect(await screen.findByText('1 lỗi cần sửa trước khi lưu')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Số điện thoại điểm giao 1' })).toHaveAccessibleDescription('Chỉ gồm chữ số, dấu cách và + - . ( )')
})

test('the check card reads the form live: empty required fields first, an error once a field is left, and a jump to that field', async () => {
  const { user } = renderForm('/chuyen/moi')
  const checks = within(await screen.findByRole('region', { name: 'Kiểm tra trước khi lưu' }))
  await depotLoaded()
  // Form mới mở: ô bắt buộc còn trống chưa tính là lỗi; điểm giao là việc sau khi lưu
  expect(checks.getByRole('status')).toHaveTextContent('Còn 2 ô bắt buộc chưa nhập')
  expect(checks.getByText('Sau khi lưu: đưa yêu cầu giao vào chuyến — điểm giao tự sinh')).toBeInTheDocument()
  expect(checks.getByText('Kho xuất phát có tên và toạ độ').closest('li')).toHaveTextContent('Kho Long Bình')

  const depotName = screen.getByRole('textbox', { name: 'Tên kho' })
  await user.clear(depotName)
  await user.tab()
  // Rời ô là thấy lỗi dưới ô và trong thẻ kiểm tra, chưa cần bấm lưu
  expect(depotName).toHaveAccessibleDescription('Nhập tên kho xuất phát')
  expect(checks.getByRole('status')).toHaveTextContent('1 lỗi cần sửa trước khi lưu')
  const depotRow = checks.getByText('Tên kho').closest('li') as HTMLElement
  expect(depotRow).toHaveTextContent('Nhập tên kho xuất phát')
  await user.click(within(depotRow).getByRole('button', { name: 'Tới ô cần sửa' }))
  expect(depotName).toHaveFocus()

  await user.type(depotName, 'Kho Long Bình')
  await user.type(screen.getByRole('textbox', { name: 'Tên chuyến' }), 'Tuyến Thủ Đức')
  await choose(user, 'Xe', 'Truck 6m')
  expect(checks.getByRole('status')).toHaveTextContent('Không có lỗi — có thể lưu.')
  expect(checks.getByText(/^Đã đặt tên · xuất phát 08:00 /)).toBeInTheDocument()
})

test('a vehicle under maintenance is listed with the reason but cannot be chosen (D-53)', async () => {
  const { user } = renderForm('/chuyen/moi')
  await user.click(await screen.findByRole('combobox', { name: 'Xe' }))
  const listbox = await screen.findByRole('listbox')
  expect(await within(listbox).findByRole('option', { name: 'Hyundai Mighty EX8 · 50H-118.29 · đang bảo dưỡng' }, SLOW)).toHaveAttribute('aria-disabled', 'true')
  expect(within(listbox).getByRole('option', { name: 'Truck 6m' })).not.toHaveAttribute('aria-disabled')
})

test('editing renames the trip, moves the departure time, edits a stop contact and keeps stop order and ids', async () => {
  const [trip] = await getMockDb().listTrips()
  const { user } = renderForm(`/chuyen/${trip!.id}/sua`)
  const name = await screen.findByLabelText('Tên chuyến', {}, SLOW)
  await user.clear(name)
  await user.type(name, 'Tuyến đã đổi tên')
  const contact = screen.getByLabelText('Người liên hệ điểm giao 2')
  await user.clear(contact)
  await user.type(contact, 'Anh Phúc (kho)')
  // Chuyến chính đi 13:30 ngày neo; kho xuất phát là kho của công ty
  expect(screen.getByLabelText('Giờ xuất phát')).toHaveValue('13:30')
  expect(screen.getByRole('textbox', { name: 'Tên kho' })).toHaveValue('Kho Long Bình')
  fireEvent.change(screen.getByLabelText('Giờ xuất phát'), { target: { value: '14:15' } })
  await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
  expect(await screen.findByText('Chi tiết chuyến', {}, SLOW)).toBeInTheDocument()
  const saved = await getMockDb().getTrip(trip!.id)
  expect(saved.name).toBe('Tuyến đã đổi tên')
  expect(saved.stops.map((stop) => stop.id)).toStrictEqual(trip!.stops.map((stop) => stop.id))
  expect(saved.stops[1]?.contactName).toBe('Anh Phúc (kho)')
  expect(saved.inputVersion).toBe(trip!.inputVersion)
  expect([saved.scheduledDate, saved.departureAt, saved.depot]).toStrictEqual([trip!.scheduledDate, `${trip!.scheduledDate}T07:15:00.000Z`, trip!.depot])
  // Điểm giao giữ nguyên các trường form không sửa (toạ độ của điểm 3 — Bách Hoá Xanh Dĩ An)
  expect(saved.stops.map(({ contactName: _contact, ...stop }) => stop)).toStrictEqual(trip!.stops.map(({ contactName: _contact, ...stop }) => stop))
})

test('while the warehouse loads, only name, departure and driver can change (D-45)', async () => {
  const before = await getMockDb().getTrip('TRIP-011')
  const { user } = renderForm('/chuyen/TRIP-011/sua')
  expect(await screen.findByText(/xe, kho xuất phát và điểm giao đã khoá/, {}, SLOW)).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Xe' })).toBeDisabled()
  expect(screen.getByRole('textbox', { name: 'Tên kho' })).toBeDisabled()
  expect(screen.queryByRole('combobox', { name: 'Tìm địa danh' })).toBeNull()
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
