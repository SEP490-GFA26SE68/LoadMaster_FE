import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { Toaster } from 'sonner'
import { afterEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { envelope, page, stubBackend, type FakeRoutes } from '@/test/fake-backend'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { PackagesPage } from './PackagesPage'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['packages']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'packages',
}))

/**
 * Kho kiện `/kien-hang` khi nhóm packages đọc từ backend (backend giả): bảng chỉ có cột backend trả, panel chi tiết đọc điểm đến và chuyến
 * từ lượt quét, xoá kiện Đã nhập, nhập file qua máy chủ; quản lý công ty thấy câu lý do và màn không gọi backend.
 */
const SLOW = { timeout: 5000 }
const TOKEN_1 = '63abd059-f710-4bf5-abe1-a1c120f2c6d9'
const TOKEN_3 = '301a4619-a65b-4540-8d12-2f7060b268d5'
const MANUAL = {
  id: 1, orderId: null, trackingBarcode: 'QA-BARCODE-0001', actualLength: 1205, actualWeightKg: 12.5, packageCode: 'QA PK-0001', qrToken: TOKEN_1,
  handlingClass: 'FRAGILE', status: 'PENDING',
}
const PLANNED = { ...MANUAL, id: 3, orderId: 1, trackingBarcode: null, actualLength: 500, actualWeightKg: '3.00', packageCode: 'QA HK-7', qrToken: TOKEN_3, handlingClass: null, status: 'PLANNED' }
const IMPORTED = { ...PLANNED, id: 9, orderId: 2, actualLength: 600, packageCode: 'QA IMP-1', qrToken: '0c6f8a1e-2b3d-4e5f-8a9b-1c2d3e4f5a6b', status: 'PENDING' }
const scanOf = (dto: typeof MANUAL, destination: string, trip: { id: number; name: string } | null = null) => envelope({
  id: dto.id, packageCode: dto.packageCode, qrToken: dto.qrToken, handlingClass: dto.handlingClass ?? 'STANDARD', actualWeightKg: dto.actualWeightKg,
  status: dto.status, orderId: dto.orderId, trip, stop: null, destination,
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function UrlProbe() {
  const location = useLocation()
  return <output data-testid="url">{location.pathname + location.search}</output>
}

function renderPool(role: Role, routes: FakeRoutes) {
  const backend = stubBackend(routes)
  const router = createMemoryRouter([{ path: '/kien-hang', element: <><PackagesPage /><UrlProbe /></> }, { path: '*', element: <UrlProbe /> }], { initialEntries: ['/kien-hang'] })
  signedInAs(role)
  render(
    <I18nProvider>
      <AuthProvider source="mock">
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <RouterProvider router={router} />
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
  return { user: userEvent.setup(), calls: backend.calls }
}

const headers = () => within(screen.getByRole('table')).getAllByRole('columnheader').map((cell) => cell.textContent)
const listCalls = (calls: readonly { method: string; path: string }[]) => calls.filter((call) => call.method === 'GET' && call.path === '/api/packages')

test('the dispatcher sees only what the backend returns, opens a package and deletes it after confirming', async () => {
  let rows = [MANUAL, PLANNED]
  const { user, calls } = renderPool('dispatcher', {
    'GET /api/packages': () => ({ body: envelope(page(rows)) }),
    'GET /api/packages/1': { body: envelope(MANUAL) },
    'GET /api/packages/3': { body: envelope(PLANNED) },
    [`GET /api/packages/scan/${TOKEN_1}`]: { body: scanOf(MANUAL, 'QA Kho Bình Dương') },
    [`GET /api/packages/scan/${TOKEN_3}`]: { body: scanOf(PLANNED, 'QA Kho Đà Nẵng', { id: 12, name: 'QA TRIP-A' }) },
    'DELETE /api/packages/1': () => {
      rows = [PLANNED]
      return { body: envelope(null) }
    },
  })
  expect(await screen.findByText('2 kiện trong kho kiện', {}, SLOW)).toBeInTheDocument()
  // Backend không trả chiều rộng, chiều cao, điểm đến, cờ, yêu cầu giao: không có cột, bộ lọc, lối sang Loại kiện
  expect(headers().slice(1)).toStrictEqual(['Mã kiện', 'Chiều dài', 'Khối lượng', 'Loại hàng', 'Trạng thái'])
  expect(screen.getAllByRole('tab').map((tab) => tab.textContent?.replace(/\d+$/, ''))).toStrictEqual(['Tất cả', 'Đã nhập', 'Đã gán chuyến', 'Đã xếp', 'Đã giao'])
  expect(screen.getByRole('combobox', { name: 'Loại hàng' })).toBeInTheDocument()
  for (const name of ['Cờ', 'Yêu cầu / chuyến']) expect(screen.queryByRole('combobox', { name })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Loại kiện' })).not.toBeInTheDocument()
  expect(screen.getByText(/^Kiện đọc từ máy chủ\./)).toBeInTheDocument()
  const newest = screen.getByRole('row', { name: /QA PK-0001/ })
  for (const text of ['120,5 cm', '12,5 kg', 'Dễ vỡ', 'Đã nhập']) expect(newest).toHaveTextContent(text)
  expect(listCalls(calls)[0]?.query).toMatchObject({ sort: 'id,asc' })

  // Kiện đã vào chuyến: chuyến đọc từ lượt quét, không xoá được
  await user.click(screen.getByRole('button', { name: 'QA HK-7' }))
  const planned = within(await screen.findByRole('complementary', { name: 'Chi tiết kiện QA HK-7' }, SLOW))
  expect(await planned.findByText('QA Kho Đà Nẵng', {}, SLOW)).toBeInTheDocument()
  expect(planned.getByText('QA TRIP-A')).toBeInTheDocument()
  expect(planned.getByRole('button', { name: 'Xoá kiện' })).toBeDisabled()
  expect(planned.getByRole('button', { name: 'Xoá kiện' })).toHaveAccessibleDescription('Chỉ xoá được kiện đang ở trạng thái Đã nhập.')
  for (const name of ['Lịch sử', 'Cờ']) expect(planned.queryByRole('heading', { name })).not.toBeInTheDocument()

  // Kiện Đã nhập: hỏi lại rồi xoá ở backend; bảng đọc lại, panel đóng
  await user.click(screen.getByRole('button', { name: 'QA PK-0001' }))
  const manual = within(await screen.findByRole('complementary', { name: 'Chi tiết kiện QA PK-0001' }, SLOW))
  expect(await manual.findByText('QA Kho Bình Dương', {}, SLOW)).toBeInTheDocument()
  for (const text of ['Thêm lẻ', '120,5 cm', '12,5 kg']) expect(manual.getByText(text)).toBeInTheDocument()
  await user.click(manual.getByRole('button', { name: 'Xoá kiện' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Xoá kiện QA PK-0001?' }))
  await user.click(dialog.getByRole('button', { name: 'Xoá kiện' }))
  expect(await screen.findByText('Đã xoá kiện QA PK-0001 khỏi kho kiện.', {}, SLOW)).toBeInTheDocument()
  expect(await screen.findByText('1 kiện trong kho kiện', {}, SLOW)).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('complementary')).not.toBeInTheDocument())
  expect(calls.filter((call) => call.method === 'DELETE').map((call) => call.path)).toStrictEqual(['/api/packages/1'])
  // Chi tiết của kiện vừa xoá không đọc lại (backend trả 404)
  expect(calls.filter((call) => call.path === '/api/packages/1' && call.method === 'GET')).toHaveLength(1)
})

test('the company manager gets a reason instead of the pool, and the screen does not call the backend', async () => {
  const { calls } = renderPool('manager', { 'GET /api/packages': { body: envelope(page([MANUAL])) } })
  expect(await screen.findByText('Máy chủ hiện chỉ cho điều phối viên đọc kho kiện, nên tài khoản của bạn chưa xem được kiện ở đây.')).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(calls).toStrictEqual([])
})

test('importing goes through the server preview: an error row blocks Confirm, a clean file is imported and selected for labels', async () => {
  let rows = [MANUAL]
  const validRow = { rowIndex: 2, packageCode: 'QA IMP-1', lengthCm: 60, widthCm: 40, heightCm: 30, weightKg: 3, handlingClass: 'STANDARD', destination: 'QA Huế' }
  let preview: unknown = {
    totalRows: 2, validCount: 1, validRows: [validRow], warnings: [],
    errors: [{ rowIndex: 3, field: 'lengthCm', errorCode: 'IMPORT_INVALID_LENGTH', detail: '0' }],
  }
  const { user, calls } = renderPool('dispatcher', {
    'GET /api/packages': () => ({ body: envelope(page(rows)) }),
    'POST /api/packages/import/preview': () => ({ body: envelope(preview) }),
    'POST /api/packages/import/confirm': () => {
      rows = [MANUAL, IMPORTED]
      return { body: envelope({ totalImported: 1, packageIds: [9] }) }
    },
  })
  await screen.findByText('1 kiện trong kho kiện', {}, SLOW)
  await user.click(screen.getByRole('button', { name: 'Nhập file' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Nhập file vào kho kiện' }))
  // File mẫu là .xlsx của máy chủ, tối đa 1 MB
  expect(dialog.getByRole('button', { name: 'Tải mẫu .xlsx' })).toBeInTheDocument()
  expect(dialog.queryByRole('button', { name: 'Tải mẫu .csv' })).not.toBeInTheDocument()
  expect(dialog.getByText(/dòng và 1 MB\./)).toBeInTheDocument()
  expect(dialog.getByText(/^Dùng file mẫu của máy chủ/)).toBeInTheDocument()

  const file = () => new File(['packageCode,lengthCm\nQA IMP-1,60'], 'kien.csv', { type: 'text/csv' })
  await user.upload(dialog.getByLabelText('File kiện (.csv, .xlsx)'), file())
  expect(await dialog.findByText('1 dòng có lỗi nên chưa nhập được dòng nào. Sửa file rồi chọn lại.', {}, SLOW)).toBeInTheDocument()
  expect(dialog.getByRole('row', { name: /^3/ })).toHaveTextContent('Chiều dài phải là số lớn hơn 0')
  expect(dialog.getByRole('button', { name: 'Xác nhận nhập' })).toBeDisabled()

  preview = { totalRows: 1, validCount: 1, validRows: [validRow], errors: [], warnings: [{ rowIndex: 2, field: 'packageCode', errorCode: 'IMPORT_EXISTING_CODE' }] }
  await user.upload(dialog.getByLabelText('File kiện (.csv, .xlsx)'), file())
  expect(await dialog.findByText('1 dòng có cảnh báo; vẫn nhập được.', {}, SLOW)).toBeInTheDocument()
  expect(dialog.getByRole('row', { name: /^2/ })).toHaveTextContent('Mã kiện đã có trong kho kiện trên máy chủ')
  await user.click(dialog.getByRole('button', { name: 'Xác nhận nhập 1 kiện' }))

  expect(await screen.findByText('Đã nhập 1 kiện vào kho kiện.', {}, SLOW)).toBeInTheDocument()
  expect(await screen.findByText('2 kiện trong kho kiện', {}, SLOW)).toBeInTheDocument()
  const selection = within(screen.getByRole('region', { name: 'Đã chọn 1 kiện' }))
  expect(selection.getByRole('link', { name: 'In nhãn QR' })).toHaveAttribute('href', '/kien-hang/nhan?kien=9')
  // Bước xác nhận gửi lại đúng file đã xem trước
  const sent = calls.filter((call) => call.method === 'POST').map((call) => [call.path, (call.form?.get('file') as File | null)?.name])
  expect(sent).toStrictEqual([['/api/packages/import/preview', 'kien.csv'], ['/api/packages/import/preview', 'kien.csv'], ['/api/packages/import/confirm', 'kien.csv']])
})
