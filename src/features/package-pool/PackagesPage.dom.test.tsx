import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { Toaster } from 'sonner'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { PackagesPage } from './PackagesPage'

/**
 * Kho kiện `/kien-hang` (FE-3b-03, FE-3b-02) trên kho mock thật, seed neo 14/09/2026: Long Bình có 2.951 kiện — 88 kiện `PK-0001…0088`
 * đều "Đã nhập" đứng đầu bảng (40 kiện cuối nhập từ file, 5 kiện mỗi điểm đến; `PK-0063` mang cờ "Không tìm thấy", `PK-0078` "Hư hỏng";
 * 30 kiện thuộc sáu yêu cầu giao chờ xếp chuyến — 22 kiện đầu và hai kiện cuối của bốn đợt nhập), rồi 2.863 kiện nhập tay của 15 chuyến seed (`PK-T…`, FE-3b-07): 2.692 kiện còn thuộc chuyến,
 * `PK-T00739` kho báo thiếu nên mang cờ "Không tìm thấy". Các test dùng chung kho và chạy theo thứ tự: test gỡ cờ, thêm kiện, nhập file ghi vào kho — số đếm ghi ngay ở từng test.
 */
const SLOW = { timeout: 5000 }

function UrlProbe() {
  const location = useLocation()
  return <output data-testid="url">{location.pathname + location.search}</output>
}

function renderPool(role: Role, path = '/kien-hang') {
  const router = createMemoryRouter(
    [
      { path: '/kien-hang', element: <><PackagesPage /><UrlProbe /></> },
      { path: '/kien-hang/nhan', element: <UrlProbe /> },
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
const poolIds = () => bodyRows().map((row) => /PK-(?:T\d{5}|\d{4})/.exec(row.textContent ?? '')?.[0])
const headers = () => within(screen.getByRole('table')).getAllByRole('columnheader').map((cell) => cell.textContent)
const csvFile = (lines: readonly string[]) =>
  new File([['package_code,length,width,height,weight,handling_class,destination,package_type', ...lines].join('\r\n')], 'kien.csv', { type: 'text/csv' })

test('the dispatcher sees the pool newest first with every column; search ignores accents and the filters live on the URL', async () => {
  const user = renderPool('dispatcher')
  expect(await screen.findByText('2.951 kiện trong kho kiện', {}, SLOW)).toBeInTheDocument()
  // Cột đầu là ô chọn (không chữ), rồi chín cột dữ liệu
  expect(headers().slice(1)).toStrictEqual(['Mã kiện', 'Kích thước (D × R × C)', 'Khối lượng', 'Loại hàng', 'Điểm đến', 'Trạng thái', 'Cờ', 'Yêu cầu', 'Chuyến'])
  expect(screen.getByRole('checkbox', { name: 'Chọn mọi kiện khớp bộ lọc' })).toBeInTheDocument()
  // FE-3b-06: điều phối viên mở Tra cứu kiện từ đây
  expect(screen.getByRole('link', { name: 'Tra cứu kiện' })).toHaveAttribute('href', '/tra-cuu-kien')
  expect(poolIds().slice(0, 3)).toStrictEqual(['PK-0088', 'PK-0087', 'PK-0086'])
  const newest = screen.getByRole('row', { name: /PK-0088/ })
  for (const text of ['PT-QNH-2609-05', '70 × 50 × 45 cm', '26 kg', 'Thường', 'KCN Phú Tài, TP. Quy Nhơn, Bình Định', 'Đã nhập']) expect(newest).toHaveTextContent(text)

  // Tìm bỏ dấu theo điểm đến: 5 kiện đi Phú Bài
  await user.type(screen.getByRole('searchbox'), 'phu bai')
  await waitFor(() => expect(poolIds()).toStrictEqual(['PK-0058', 'PK-0057', 'PK-0056', 'PK-0055', 'PK-0054']), SLOW)
  expect(screen.getByRole('tab', { name: /^Tất cả/ })).toHaveTextContent(/^Tất cả\s*5$/)
  await user.click(screen.getByRole('button', { name: 'Xoá lọc' }))

  // Lọc cờ, loại hàng, đã vào yêu cầu giao: giá trị là slug không dấu trên URL
  await user.click(screen.getByRole('combobox', { name: 'Cờ' }))
  await user.click(await screen.findByRole('option', { name: 'Không tìm thấy' }))
  // PK-0063 của file nhập, và kiện kho báo thiếu của chuyến TRIP-003
  await waitFor(() => expect(poolIds()).toStrictEqual(['PK-0063', 'PK-T00739']), SLOW)
  expect(screen.getByTestId('url')).toHaveTextContent('/kien-hang?co=khong-tim-thay')
  expect(within(screen.getByRole('row', { name: /PK-0063/ })).getByText('Không tìm thấy')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Xoá lọc' }))
  await user.click(screen.getByRole('combobox', { name: 'Yêu cầu / chuyến' }))
  await user.click(await screen.findByRole('option', { name: 'Đã vào yêu cầu hoặc chuyến' }))
  // 30 kiện của sáu yêu cầu giao chờ xếp chuyến và 2.692 kiện đang thuộc chuyến; tab trạng thái đếm theo bộ lọc
  await waitFor(() => expect(screen.getByRole('tab', { name: /^Tất cả/ })).toHaveTextContent(/^Tất cả\s*2\.722$/), SLOW)
  expect(screen.getAllByRole('tab').map((tab) => tab.textContent?.replace(/\s+/g, ' '))).toStrictEqual([
    'Tất cả2.722', 'Đã nhập30', 'Đã gán chuyến548', 'Đã soạn280', 'Đã xếp210', 'Đang vận chuyển120', 'Đã giao1.533', 'Hoàn trả1',
  ])
  expect(screen.getByTestId('url')).toHaveTextContent('/kien-hang?gan=da-vao')
  expect(within(screen.getByRole('row', { name: /PK-0022/ })).getByRole('link', { name: 'REQ-006' })).toHaveAttribute('href', '/yeu-cau-giao?q=REQ-006')
})

test('filters read from the URL: handling class and "not in a requirement or a trip"', async () => {
  renderPool('dispatcher', '/kien-hang?loai-hang=hang-lanh&gan=chua')
  await screen.findByText('2.951 kiện trong kho kiện', {}, SLOW)
  // Năm kiện hàng lạnh đi Cần Thơ; PK-0072, PK-0073 thuộc yêu cầu REQ-004
  expect(poolIds()).toStrictEqual(['PK-0071', 'PK-0070', 'PK-0069'])
  expect(screen.getByRole('combobox', { name: 'Loại hàng' })).toHaveTextContent('Hàng lạnh')
})

test('the company manager reads the pool but gets no write button, no selection and no flag action', async () => {
  const user = renderPool('manager')
  expect(await screen.findByText('2.951 kiện trong kho kiện', {}, SLOW)).toBeInTheDocument()
  for (const name of ['Thêm kiện', 'Nhập file']) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Loại kiện' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Tra cứu kiện' })).not.toBeInTheDocument()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(headers()[0]).toBe('Mã kiện')

  // Chi tiết kiện mang cờ: xem được mã QR, cờ và lịch sử; không có Gỡ cờ, không có In nhãn
  await user.type(screen.getByRole('searchbox'), 'PK-0078')
  await waitFor(() => expect(poolIds()).toStrictEqual(['PK-0078']), SLOW)
  await user.click(screen.getByRole('button', { name: 'AM-BHA-2609-05' }))
  const panel = within(await screen.findByRole('complementary', { name: 'Chi tiết kiện AM-BHA-2609-05' }, SLOW))
  expect(await panel.findByRole('img', { name: /^Mã QR LM-/ }, SLOW)).toBeInTheDocument()
  expect(panel.getByText('Hư hỏng')).toBeInTheDocument()
  expect(panel.queryByRole('button', { name: /Gỡ cờ/ })).not.toBeInTheDocument()
  expect(panel.queryByRole('link', { name: 'In nhãn QR' })).not.toBeInTheDocument()
})

test('the detail panel shows the QR code and the history the store kept; the dispatcher clears a flag and the history grows', async () => {
  const user = renderPool('dispatcher', '/kien-hang?co=khong-tim-thay')
  await screen.findByText('2.951 kiện trong kho kiện', {}, SLOW)
  // Bấm dòng mở panel; panel mở thì bảng nhường bốn cột đã có trong panel
  await user.click(screen.getByRole('row', { name: /PK-0063/ }))
  const panel = within(await screen.findByRole('complementary', { name: 'Chi tiết kiện BV-VIN-2609-05' }, SLOW))
  const qr = await panel.findByRole('img', { name: /^Mã QR LM-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/ }, SLOW)
  expect(qr).toBeInTheDocument()
  expect(headers().slice(1)).toStrictEqual(['Mã kiện', 'Loại hàng', 'Điểm đến', 'Trạng thái', 'Cờ'])
  for (const text of ['PK-0063', '80 × 60 × 50 cm', '32 kg', 'KCN Bắc Vinh, TP. Vinh, Nghệ An', 'Không gắn loại kiện', 'Nhập file', 'Chưa vào yêu cầu giao hay chuyến']) {
    expect(panel.getByText(text)).toBeInTheDocument()
  }
  expect(panel.getByRole('link', { name: 'In nhãn QR' })).toHaveAttribute('href', '/kien-hang/nhan?kien=PK-0063')
  // Lịch sử từ kho, mới nhất trước: gắn cờ 17:05, nhập file 16:20 ngày 13/09 — do điều phối viên Nguyễn Thanh Tùng
  const history = () => within(panel.getByRole('list', { name: 'Lịch sử' })).getAllByRole('listitem').map((item) => item.textContent)
  expect(history()).toStrictEqual(['Gắn cờ Không tìm thấy17:05 13/09/2026 · Nguyễn Thanh Tùng', 'Vào kho kiện: Nhập file16:20 13/09/2026 · Nguyễn Thanh Tùng'])

  await user.click(panel.getByRole('button', { name: 'Gỡ cờ Không tìm thấy' }))
  expect(await panel.findByText('Kiện không mang cờ nào.', {}, SLOW)).toBeInTheDocument()
  expect(history()).toHaveLength(3)
  expect(history()[0]).toMatch(/^Gỡ cờ Không tìm thấy.* · Nguyễn Thanh Tùng$/)
  expect((await getMockDb().getPackage('PK-0063')).flags).toStrictEqual([])
  const [event] = await getMockDb().listEvents()
  expect(event).toMatchObject({ action: 'package.flagCleared', actorId: 'US-0001', target: { id: 'PK-0063' } })

  // Đóng panel: bảng trả đủ cột, con trỏ về nút mã kiện
  await user.click(panel.getByRole('button', { name: 'Đóng chi tiết kiện' }))
  await waitFor(() => expect(screen.queryByRole('complementary')).not.toBeInTheDocument())
  expect(headers()).toHaveLength(10)
})

test('adding one package: the form names what is missing, then the package lands on top with its QR code shown at once', async () => {
  const user = renderPool('dispatcher')
  await screen.findByText('2.951 kiện trong kho kiện', {}, SLOW)
  await user.click(screen.getByRole('button', { name: 'Thêm kiện' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Thêm kiện' }))
  await user.click(dialog.getByRole('button', { name: 'Thêm kiện' }))
  expect(await dialog.findByText('Nhập điểm đến.')).toBeInTheDocument()
  expect(dialog.getAllByText('Nhập một số.')).toHaveLength(4)

  await user.type(dialog.getByRole('textbox', { name: 'Mã kiện của bên gửi' }), 'HK-DNG-2609-06')
  await user.type(dialog.getByRole('spinbutton', { name: 'Dài' }), '60')
  await user.type(dialog.getByRole('spinbutton', { name: 'Rộng' }), '40')
  await user.type(dialog.getByRole('spinbutton', { name: 'Cao' }), '0')
  await user.type(dialog.getByRole('spinbutton', { name: 'Khối lượng' }), '18.5')
  await user.click(dialog.getByRole('combobox', { name: 'Loại hàng' }))
  await user.click(await screen.findByRole('option', { name: 'Dễ vỡ' }))
  await user.type(dialog.getByRole('textbox', { name: 'Điểm đến' }), 'KCN Hoà Khánh, Q. Liên Chiểu, Đà Nẵng')
  await user.click(dialog.getByRole('button', { name: 'Thêm kiện' }))
  expect(await dialog.findByText('Kích thước phải lớn hơn 0.')).toBeInTheDocument()
  await user.clear(dialog.getByRole('spinbutton', { name: 'Cao' }))
  await user.type(dialog.getByRole('spinbutton', { name: 'Cao' }), '40')
  await user.click(dialog.getByRole('button', { name: 'Thêm kiện' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), SLOW)
  expect(await screen.findByText('2.952 kiện trong kho kiện', {}, SLOW)).toBeInTheDocument()
  expect(await screen.findByText('Đã thêm kiện HK-DNG-2609-06 vào kho kiện.', {}, SLOW)).toBeInTheDocument()
  // Chi tiết kiện vừa thêm mở ngay, đã có mã QR; kiện đứng đầu bảng
  const panel = within(await screen.findByRole('complementary', { name: 'Chi tiết kiện HK-DNG-2609-06' }, SLOW))
  expect(await panel.findByRole('img', { name: /^Mã QR LM-/ }, SLOW)).toBeInTheDocument()
  expect(panel.getByText('Vào kho kiện: Thêm lẻ')).toBeInTheDocument()
  expect(poolIds()[0]).toBe('PK-0089')
  expect(await getMockDb().getPackage('PK-0089')).toMatchObject({
    packageCode: 'HK-DNG-2609-06', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 18.5, handlingClass: 'FRAGILE', status: 'IMPORTED', source: 'MANUAL',
  })
})

test('importing a file: an error row disables Confirm and creates nothing; a clean file is imported in one go and selected for labels', async () => {
  const user = renderPool('dispatcher')
  await screen.findByText('2.952 kiện trong kho kiện', {}, SLOW)
  await user.click(screen.getByRole('button', { name: 'Nhập file' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Nhập file vào kho kiện' }))
  expect(dialog.getByRole('button', { name: 'Xác nhận nhập' })).toBeDisabled()

  // Dòng 3 cao 0; dòng 4 trùng mã với dòng 2
  await user.upload(dialog.getByLabelText('File kiện (.csv, .xlsx)'), csvFile(['DN-0001,60,40,40,18,STANDARD,Huế,', 'DN-0002,60,40,0,18,STANDARD,Huế,', 'DN-0001,60,40,40,18,STANDARD,Huế,']))
  expect(await dialog.findByText('2 dòng có lỗi nên chưa nhập được dòng nào. Sửa file rồi chọn lại.', {}, SLOW)).toBeInTheDocument()
  expect(within(dialog.getByRole('group', { name: 'Kết quả kiểm tra file' })).getAllByRole('definition').map((item) => item.textContent)).toStrictEqual(['3', '1', '2', '0'])
  expect(dialog.getByRole('row', { name: /^3/ })).toHaveTextContent('Chiều cao phải là số lớn hơn 0')
  expect(dialog.getByRole('row', { name: /^4/ })).toHaveTextContent('Trùng mã kiện với dòng 2')
  expect(dialog.getByRole('button', { name: 'Xác nhận nhập' })).toBeDisabled()
  expect(await getMockDb().listPackages()).toHaveLength(2952)

  // File sạch, một dòng trùng mã đã có trong kho kiện: cảnh báo, vẫn nhập được
  await user.upload(dialog.getByLabelText('File kiện (.csv, .xlsx)'), csvFile(['DN-0001,60,40,40,18,STANDARD,"KCN Hoà Khánh, Đà Nẵng",', 'HK-DNG-2609-01,50,40,30,"9,5",FRAGILE,Huế,']))
  expect(await dialog.findByText('1 dòng có cảnh báo; vẫn nhập được.', {}, SLOW)).toBeInTheDocument()
  expect(dialog.getByRole('row', { name: /^3/ })).toHaveTextContent('Mã kiện đã có trong kho kiện (PK-0049)')
  await user.click(dialog.getByRole('button', { name: 'Xác nhận nhập 2 kiện' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), SLOW)
  expect(await screen.findByText('2.954 kiện trong kho kiện', {}, SLOW)).toBeInTheDocument()
  expect(await screen.findByText('Đã nhập 2 kiện vào kho kiện.', {}, SLOW)).toBeInTheDocument()
  expect(poolIds().slice(0, 2)).toStrictEqual(['PK-0091', 'PK-0090'])
  const selection = within(screen.getByRole('region', { name: 'Đã chọn 2 kiện' }))
  expect(selection.getByRole('link', { name: 'In nhãn QR' })).toHaveAttribute('href', '/kien-hang/nhan?kien=PK-0090,PK-0091')
  const [event] = await getMockDb().listEvents()
  expect(event).toMatchObject({ action: 'package.importConfirmed', params: { count: 2, lastPackageId: 'PK-0091' } })
})
