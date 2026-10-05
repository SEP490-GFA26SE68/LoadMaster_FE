import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { Toaster } from 'sonner'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { RequirementsPage } from './RequirementsPage'

/**
 * Yêu cầu giao `/yeu-cau-giao` (FE-4b-02) trên kho mock thật, seed neo 14/09/2026: Long Bình có sáu yêu cầu chờ xếp chuyến
 * REQ-001…006 (`seed-sourcing.ts`). Các test dùng chung kho và chạy theo thứ tự — test tạo, sửa, xoá, đưa vào chuyến ghi vào kho; số
 * đếm ghi ngay ở từng test. Đồng hồ của kho là giờ thật nên hạn nhập ở form dùng một ngày xa (31/12/2099).
 */
const SLOW = { timeout: 8000 }

function UrlProbe() {
  const location = useLocation()
  return <output data-testid="url">{location.pathname + location.search}</output>
}

function renderPage(role: Role, path = '/yeu-cau-giao') {
  const router = createMemoryRouter(
    [
      { path: '/yeu-cau-giao', element: <><RequirementsPage /><UrlProbe /></> },
      { path: '*', element: <UrlProbe /> },
    ],
    { initialEntries: [path] },
  )
  signedInAs(role)
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

const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]!).getAllByRole('row')
const rowIds = () => bodyRows().map((row) => /REQ-\d{3}/.exec(row.textContent ?? '')?.[0])
const rowOf = (id: string) => screen.getByRole('row', { name: new RegExp(id) })

async function openMenu(user: UserEvent, id: string) {
  await user.click(within(rowOf(id)).getByRole('button', { name: `Thao tác với yêu cầu ${id}` }))
  return within(await screen.findByRole('menu'))
}

test('the manager sees the requirements by nearest deadline, with filters on the URL and the create button', async () => {
  const user = renderPage('companyManager')
  expect(await screen.findByText('6 yêu cầu chờ xếp chuyến', {}, SLOW)).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Yêu cầu giao' })).toBeInTheDocument()
  expect(within(screen.getByRole('table')).getAllByRole('columnheader').map((cell) => cell.textContent)).toStrictEqual([
    'Yêu cầu', 'Điểm đến', 'Hạn giao', 'Ưu tiên', 'Kiện', 'Trạng thái', 'Chuyến', 'Thao tác',
  ])
  // Hạn gần nhất trước: 11:00 và 16:00 ngày 16/09, 10:00 và 17:00 ngày 17/09, 18/09, 19/09
  expect(rowIds()).toStrictEqual(['REQ-006', 'REQ-005', 'REQ-004', 'REQ-002', 'REQ-001', 'REQ-003'])
  const first = within(rowOf('REQ-006'))
  for (const text of ['Kho Bách Hoá Xanh Dĩ An', '215 Quốc lộ 1K, P. Đông Hoà, Dĩ An', '16/09/2026', '11:00', 'Cao', '10 kiện', '35 kg', 'Chờ xếp chuyến', 'Chưa vào chuyến']) {
    expect(first.getByText(text)).toBeInTheDocument()
  }
  expect(screen.getByRole('button', { name: 'Tạo yêu cầu giao' })).toBeInTheDocument()

  // Tìm bỏ dấu; lọc ưu tiên nằm trên URL
  await user.type(screen.getByRole('searchbox', { name: 'Tìm theo mã, điểm đến, địa chỉ, chuyến' }), 'ha noi')
  await waitFor(() => expect(rowIds()).toStrictEqual(['REQ-003']), SLOW)
  await user.click(screen.getByRole('button', { name: 'Xoá lọc' }))
  await user.click(screen.getByRole('combobox', { name: 'Ưu tiên' }))
  await user.click(await screen.findByRole('option', { name: 'Cao' }))
  await waitFor(() => expect(rowIds()).toStrictEqual(['REQ-006', 'REQ-002']), SLOW)
  expect(screen.getByTestId('url')).toHaveTextContent('/yeu-cau-giao?uu-tien=cao')

  // Menu của quản lý công ty: xem, sửa, xoá — không có việc của điều phối viên
  const menu = await openMenu(user, 'REQ-002')
  expect(menu.getAllByRole('menuitem').map((item) => item.textContent)).toStrictEqual(['Xem chi tiết', 'Sửa yêu cầu', 'Xoá yêu cầu'])
})

test('the deadline range and the status filter read from the URL', async () => {
  renderPage('manager', '/yeu-cau-giao?han-tu=2026-09-17&han-den=2026-09-17&trang-thai=cho-xep-chuyen')
  await waitFor(() => expect(rowIds()).toStrictEqual(['REQ-004', 'REQ-002']), SLOW)
  expect(screen.getByRole('combobox', { name: 'Trạng thái' })).toHaveTextContent('Chờ xếp chuyến')
})

test('the detail shows the destination, coordinates, deadline, who made it and every package', async () => {
  const user = renderPage('dispatcher')
  await user.click(await screen.findByRole('button', { name: 'Xem chi tiết yêu cầu REQ-002' }, SLOW))
  const dialog = within(await screen.findByRole('dialog', { name: 'Yêu cầu REQ-002' }, SLOW))
  // Địa chỉ của yêu cầu, và điểm đến ghi trong file của hai kiện
  expect(await dialog.findAllByText('KCN Phú Bài, TX. Hương Thuỷ, Thừa Thiên Huế', {}, SLOW)).toHaveLength(3)
  for (const text of ['16.4022, 107.6960', '17:00 17/09/2026', 'Hàng gốm, giao trong giờ hành chính', 'Trần Thị Mai', 'Chưa vào chuyến', '2 kiện · 19 kg']) {
    expect(await dialog.findByText(text, {}, SLOW)).toBeInTheDocument()
  }
  const packages = within(dialog.getByRole('table', { name: 'Kiện của yêu cầu' })).getAllByRole('row').slice(1)
  expect(packages.map((row) => within(row).getByRole('rowheader').textContent)).toStrictEqual(['PB-HUE-2609-04PK-0057', 'PB-HUE-2609-05PK-0058'])
  expect(within(packages[0]!).getByText('Dễ vỡ')).toBeInTheDocument()
  expect(within(packages[0]!).getByText('Đã nhập')).toBeInTheDocument()
  await user.click(dialog.getByRole('button', { name: 'Đóng' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('the manager creates a requirement: errors sit at the fields, warnings do not block saving', async () => {
  const user = renderPage('companyManager')
  await user.click(await screen.findByRole('button', { name: 'Tạo yêu cầu giao' }, SLOW))
  const dialog = within(await screen.findByRole('dialog', { name: 'Tạo yêu cầu giao' }))
  // Lọc ô chọn kiện theo điểm đến ghi trong file: ba kiện dễ vỡ đi Phú Bài còn tự do (hai kiện kia thuộc REQ-002)
  const filter = await dialog.findByRole('searchbox', { name: 'Lọc theo điểm đến ghi trong file, mã kiện' }, SLOW)
  await user.type(filter, 'phu bai')
  expect(await dialog.findByRole('checkbox', { name: 'Chọn cả nhóm Hàng Dễ vỡ (3)' })).toBeInTheDocument()

  // Gửi form trống: lỗi nằm ở từng ô
  await user.click(dialog.getByRole('button', { name: 'Tạo yêu cầu' }))
  expect(await dialog.findByText('Nhập tên điểm đến.')).toBeInTheDocument()
  expect(dialog.getByText('Nhập địa chỉ.')).toBeInTheDocument()
  expect(dialog.getByText('Chọn ngày của hạn giao.')).toBeInTheDocument()
  expect(dialog.getByText('Chọn ít nhất một kiện.')).toBeInTheDocument()
  expect(dialog.getByRole('textbox', { name: 'Tên điểm đến' })).toHaveAccessibleDescription('Nhập tên điểm đến.')

  await user.type(dialog.getByRole('textbox', { name: 'Tên điểm đến' }), 'KCN Phú Bài')
  // Chọn địa danh mẫu (FE-4b-03): hai ô toạ độ nhận toạ độ của địa danh; ô địa chỉ đang trống nên được điền theo địa danh
  const coordinates = within(dialog.getByRole('group', { name: 'Toạ độ điểm đến' }))
  await user.type(coordinates.getByRole('combobox', { name: 'Tìm địa danh' }), 'phu bai')
  await user.click(await coordinates.findByRole('option', { name: /KCN Phú Bài/ }))
  expect(dialog.getByRole('textbox', { name: 'Địa chỉ' })).toHaveValue('KCN Phú Bài, TX. Hương Thuỷ, Thừa Thiên Huế')
  expect(dialog.queryByText('Nhập địa chỉ.')).toBeNull()
  expect([coordinates.getByRole('textbox', { name: 'Vĩ độ' }), coordinates.getByRole('textbox', { name: 'Kinh độ' })].map((input) => (input as HTMLInputElement).value)).toStrictEqual(['16.4022', '107.696'])
  // Toạ độ gõ dở: lỗi tại ô, form không lưu
  await user.clear(coordinates.getByRole('textbox', { name: 'Kinh độ' }))
  expect(coordinates.getByText('Nhập cả kinh độ')).toBeInTheDocument()
  await user.type(coordinates.getByRole('textbox', { name: 'Kinh độ' }), '107.696')
  // Hạn đã qua: lỗi tại ô ngày
  fireEvent.change(dialog.getByLabelText(/^Hạn giao/), { target: { value: '2020-01-01' } })
  await user.click(dialog.getByRole('button', { name: 'Tạo yêu cầu' }))
  expect(await dialog.findByText('Hạn giao phải ở tương lai.')).toBeInTheDocument()
  fireEvent.change(dialog.getByLabelText(/^Hạn giao/), { target: { value: '2099-12-31' } })
  expect(dialog.getByLabelText(/^Giờ/)).toHaveValue('17:00')

  await user.click(dialog.getByRole('checkbox', { name: 'Chọn cả nhóm Hàng Dễ vỡ (3)' }))
  expect(dialog.getByText('Đã chọn 3 kiện · 28,5 kg')).toBeInTheDocument()
  expect(dialog.queryByText('Cần xem lại, vẫn lưu được')).toBeNull()
  // Thêm một kiện giá trị cao đi KCN Thăng Long: hai cảnh báo, vẫn lưu được
  await user.clear(filter)
  await user.type(filter, 'TL-HNI-2609-01')
  await user.click(await dialog.findByRole('checkbox', { name: /^PK-0064/ }))
  expect(await dialog.findByText('Cần xem lại, vẫn lưu được')).toBeInTheDocument()
  expect(dialog.getByText('Yêu cầu có kiện thuộc nhiều loại hàng: Giá trị cao và Dễ vỡ.')).toBeInTheDocument()
  expect(dialog.getByText('1 kiện có điểm đến ghi trong file khác điểm đến của yêu cầu: PK-0064.')).toBeInTheDocument()

  await user.click(dialog.getByRole('button', { name: 'Tạo yêu cầu' }))
  expect(await screen.findByText('Đã tạo yêu cầu REQ-007.', {}, SLOW)).toBeInTheDocument()
  expect(await screen.findByText('7 yêu cầu chờ xếp chuyến', {}, SLOW)).toBeInTheDocument()
  const row = within(rowOf('REQ-007'))
  for (const text of ['KCN Phú Bài', '31/12/2099', '17:00', 'Bình thường', '4 kiện', '35,7 kg', 'Chờ xếp chuyến']) expect(row.getByText(text)).toBeInTheDocument()
  expect(await getMockDb().getPackage('PK-0064')).toMatchObject({ requirementId: 'REQ-007', status: 'IMPORTED' })
  expect(await getMockDb().getDeliveryRequirement('REQ-007')).toMatchObject({ address: 'KCN Phú Bài, TX. Hương Thuỷ, Thừa Thiên Huế', lat: 16.4022, lng: 107.696 })
})

test('the manager edits a pending requirement and deletes it; its packages go back to the pool', async () => {
  const user = renderPage('companyManager')
  await screen.findByText('7 yêu cầu chờ xếp chuyến', {}, SLOW)
  await user.click((await openMenu(user, 'REQ-007')).getByRole('menuitem', { name: 'Sửa yêu cầu' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Sửa yêu cầu REQ-007' }))
  expect(dialog.getByRole('textbox', { name: 'Tên điểm đến' })).toHaveValue('KCN Phú Bài')
  expect(dialog.getByLabelText(/^Hạn giao/)).toHaveValue('2099-12-31')
  // Kiện của chính yêu cầu vẫn nằm trong ô chọn, đang được chọn — kể cả khi ô lọc không khớp chúng
  await user.type(await dialog.findByRole('searchbox', { name: 'Lọc theo điểm đến ghi trong file, mã kiện' }, SLOW), 'tra noc')
  await waitFor(() => expect(dialog.getAllByRole('checkbox', { name: /^PK-/ })).toHaveLength(4 + 3), SLOW)
  expect(dialog.getByRole('checkbox', { name: /^PK-0064/ })).toBeChecked()
  await user.click(dialog.getByRole('combobox', { name: 'Ưu tiên' }))
  await user.click(await screen.findByRole('option', { name: 'Khẩn' }))
  await user.click(dialog.getByRole('checkbox', { name: /^PK-0064/ }))
  await user.click(dialog.getByRole('button', { name: 'Lưu yêu cầu' }))
  expect(await screen.findByText('Đã lưu yêu cầu REQ-007.', {}, SLOW)).toBeInTheDocument()
  await waitFor(() => expect(within(rowOf('REQ-007')).getByText('Khẩn')).toBeInTheDocument(), SLOW)
  expect(within(rowOf('REQ-007')).getByText('3 kiện')).toBeInTheDocument()
  expect((await getMockDb().getPackage('PK-0064')).requirementId).toBeUndefined()

  await user.click((await openMenu(user, 'REQ-007')).getByRole('menuitem', { name: 'Xoá yêu cầu' }))
  const confirm = within(await screen.findByRole('dialog', { name: 'Xoá yêu cầu REQ-007?' }))
  expect(confirm.getByText('Yêu cầu giao tới KCN Phú Bài sẽ bị xoá. 3 kiện của yêu cầu ở lại kho kiện và chọn được cho yêu cầu khác.')).toBeInTheDocument()
  await user.click(confirm.getByRole('button', { name: 'Xoá yêu cầu' }))
  expect(await screen.findByText('Đã xoá yêu cầu REQ-007.', {}, SLOW)).toBeInTheDocument()
  expect(await screen.findByText('6 yêu cầu chờ xếp chuyến', {}, SLOW)).toBeInTheDocument()
  expect(screen.queryByRole('row', { name: /REQ-007/ })).toBeNull()
  expect((await getMockDb().getPackage('PK-0054')).requirementId).toBeUndefined()
})

test('the dispatcher only reads and puts a requirement on a planning trip; the dialog says which stop it will share or add', async () => {
  const user = renderPage('dispatcher')
  await screen.findByText('6 yêu cầu chờ xếp chuyến', {}, SLOW)
  expect(screen.queryByRole('button', { name: 'Tạo yêu cầu giao' })).toBeNull()
  const menu = await openMenu(user, 'REQ-006')
  expect(menu.getAllByRole('menuitem').map((item) => item.textContent)).toStrictEqual(['Xem chi tiết', 'Đưa vào chuyến'])
  await user.click(menu.getByRole('menuitem', { name: 'Đưa vào chuyến' }))

  const dialog = within(await screen.findByRole('dialog', { name: 'Đưa yêu cầu REQ-006 vào chuyến' }))
  await user.click(await dialog.findByRole('combobox', { name: 'Chuyến' }, SLOW))
  await user.click(await screen.findByRole('option', { name: /^TRIP-014 · Tuyến Tân An – Dĩ An/ }))
  // Không chọn điểm giao (FE-4b-04): điểm 2 của TRIP-014 cùng địa chỉ và toạ độ với yêu cầu nên yêu cầu gộp vào đó
  expect(dialog.queryByRole('combobox', { name: 'Điểm giao' })).toBeNull()
  expect(dialog.getByRole('status')).toHaveTextContent('Điểm giao: gộp vào điểm 2 · Kho Bách Hoá Xanh Dĩ An — cùng địa chỉ và toạ độ.')
  // Chuyến khác chưa có điểm nào như vậy: chuyến đó sẽ có thêm điểm cuối tuyến
  await user.click(dialog.getByRole('combobox', { name: 'Chuyến' }))
  await user.click(await screen.findByRole('option', { name: /^TRIP-012 · Tuyến Bình Chánh – Biên Hoà/ }))
  expect(dialog.getByRole('status')).toHaveTextContent('Điểm giao: chuyến có thêm điểm 3 · Kho Bách Hoá Xanh Dĩ An ở cuối tuyến.')
  await user.click(dialog.getByRole('combobox', { name: 'Chuyến' }))
  await user.click(await screen.findByRole('option', { name: /^TRIP-014 · Tuyến Tân An – Dĩ An/ }))
  await user.click(dialog.getByRole('button', { name: 'Đưa vào chuyến' }))

  expect(await screen.findByText('Đã đưa yêu cầu REQ-006 vào Tuyến Tân An – Dĩ An, điểm 2.', {}, SLOW)).toBeInTheDocument()
  expect(await screen.findByText('5 yêu cầu chờ xếp chuyến', {}, SLOW)).toBeInTheDocument()
  const row = within(rowOf('REQ-006'))
  expect(row.getByText('Đã vào chuyến')).toBeInTheDocument()
  expect(row.getByText('TRIP-014 · Điểm 2')).toBeInTheDocument()
  expect(row.getByRole('link', { name: 'Tuyến Tân An – Dĩ An' })).toHaveAttribute('href', '/chuyen/TRIP-014')
  // Đã vào chuyến: menu đổi sang "Gỡ khỏi chuyến"
  expect((await openMenu(user, 'REQ-006')).getAllByRole('menuitem').map((item) => item.textContent)).toStrictEqual(['Xem chi tiết', 'Gỡ khỏi chuyến'])
})

test('once on a trip the manager changes only the deadline and the priority; deleting is blocked with the reason', async () => {
  const user = renderPage('companyManager')
  await screen.findByText('5 yêu cầu chờ xếp chuyến', {}, SLOW)
  const menu = await openMenu(user, 'REQ-006')
  const remove = menu.getByRole('menuitem', { name: /^Xoá yêu cầu/ })
  expect(remove).toHaveAttribute('aria-disabled', 'true')
  expect(remove).toHaveTextContent('Chỉ làm được khi yêu cầu còn chờ xếp chuyến')
  await user.click(menu.getByRole('menuitem', { name: 'Sửa yêu cầu' }))

  const dialog = within(await screen.findByRole('dialog', { name: 'Sửa yêu cầu REQ-006' }))
  expect(dialog.getByText('Yêu cầu đã vào chuyến: chỉ còn sửa được hạn giao và ưu tiên.')).toBeInTheDocument()
  expect(dialog.getByRole('textbox', { name: 'Tên điểm đến' })).toHaveAttribute('readonly')
  expect(dialog.getByRole('textbox', { name: 'Địa chỉ' })).toHaveAttribute('readonly')
  expect(await dialog.findByRole('group', { name: 'Kiện hàng' }, SLOW)).toBeDisabled()
  fireEvent.change(dialog.getByLabelText(/^Hạn giao/), { target: { value: '2099-12-30' } })
  await user.click(dialog.getByRole('combobox', { name: 'Ưu tiên' }))
  await user.click(await screen.findByRole('option', { name: 'Khẩn' }))
  await user.click(dialog.getByRole('button', { name: 'Lưu yêu cầu' }))
  expect(await screen.findByText('Đã lưu yêu cầu REQ-006.', {}, SLOW)).toBeInTheDocument()
  // Dòng kiện của yêu cầu trong chuyến mang ưu tiên mới (D-93): Khẩn là 4 và bắt buộc xếp
  const trip = await getMockDb().getTrip('TRIP-014')
  expect(trip.packages.filter((line) => line.groupId === 'REQ-006').map((line) => [line.priority, line.mustLoad])).toStrictEqual([[4, true]])
  expect(await getMockDb().getDeliveryRequirement('REQ-006')).toMatchObject({ status: 'ASSIGNED', priority: 'URGENT', destinationName: 'Kho Bách Hoá Xanh Dĩ An' })
})
