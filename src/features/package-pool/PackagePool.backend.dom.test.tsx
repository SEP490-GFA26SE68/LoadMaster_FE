import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { envelope, page, stubBackend, type FakeRoutes } from '@/test/fake-backend'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { PackageLabelsPage } from './PackageLabelsPage'
import { PackageLookupPage } from './PackageLookupPage'
import { PackagesPage } from './PackagesPage'
import { PackageTypesPage } from './PackageTypesPage'

const downloaded = vi.hoisted(() => vi.fn())
vi.mock('@/features/trips/download-file', () => ({ downloadBlob: downloaded }))
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['packages']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'packages',
}))

/**
 * Các màn còn lại của kho kiện khi đọc từ backend (backend giả, hình dạng đúng như backend thật đã gọi thử): thêm kiện, nhãn in và PDF,
 * tra cứu theo mã QR và mã của bên gửi, và câu lý do cho nhân viên kho / danh mục loại kiện. Màn Kho kiện: `PackagesPage.backend.dom.test.tsx`.
 */
const SLOW = { timeout: 5000 }
const TOKEN_1 = '63abd059-f710-4bf5-abe1-a1c120f2c6d9'
const TOKEN_3 = '301a4619-a65b-4540-8d12-2f7060b268d5'
const TOKEN_7 = '7a7a7a7a-0000-4000-8000-000000000007'
const TOKEN_8 = '8b8b8b8b-0000-4000-8000-000000000008'
const TOKEN_NEW = '2e26569d-0ca0-4e90-99b4-fc6ae351a651'
/** `PackageResponse` của backend. */
type Dto = {
  id: number; orderId: number | null; packageTypeId: number | null; trackingBarcode: string | null; actualLength: number; actualWeightKg: number
  isPinned: boolean; packageCode: string; qrToken: string; handlingClass: string; status: string
}
const MANUAL: Dto = {
  id: 1, orderId: null, packageTypeId: null, trackingBarcode: 'QA-BARCODE-0001', actualLength: 1205, actualWeightKg: 12.5, isPinned: false,
  packageCode: 'QA PK-0001', qrToken: TOKEN_1, handlingClass: 'FRAGILE', status: 'PENDING',
}
const PLANNED: Dto = { ...MANUAL, id: 3, orderId: 1, trackingBarcode: null, actualLength: 500, actualWeightKg: 3, packageCode: 'QA HK-7', qrToken: TOKEN_3, handlingClass: 'STANDARD', status: 'PLANNED' }
const DUP_A: Dto = { ...MANUAL, id: 7, packageCode: 'QA DUP-1', qrToken: TOKEN_7, handlingClass: 'STANDARD' }
const DUP_B: Dto = { ...PLANNED, id: 8, packageCode: 'QA DUP-1', qrToken: TOKEN_8 }
const scanOf = (dto: Dto, destination: string, trip: { id: number; name: string } | null = null, stop: { number: number; name: string } | null = null) => envelope({
  id: dto.id, packageCode: dto.packageCode, qrToken: dto.qrToken, handlingClass: dto.handlingClass, actualWeightKg: dto.actualWeightKg,
  status: dto.status, orderId: dto.orderId, trip, stop, destination,
})
/** `GET /api/packages` thật trả trang trần của Spring; `packageCode` lọc đúng mã, không kể hoa thường. */
const listOf = (rows: readonly Dto[]) => (call: { query: Readonly<Record<string, string>> }) => ({
  body: page(call.query.packageCode ? rows.filter((row) => row.packageCode.toLowerCase() === call.query.packageCode?.toLowerCase()) : rows),
})

beforeEach(() => {
  downloaded.mockClear()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function renderAt(path: string, route: string, element: ReactElement, role: Role, routes: FakeRoutes) {
  const backend = stubBackend(routes)
  const router = createMemoryRouter([{ path: route, element }, { path: '*', element: <p>elsewhere</p> }], { initialEntries: [path] })
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

const facts = (card: HTMLElement) => Object.fromEntries(within(card).getAllByRole('term').map((term) => [term.textContent, term.nextElementSibling?.textContent]))

test('adding a package sends millimetres and a generated barcode, then opens it with the destination the server kept', async () => {
  const created = { ...MANUAL, id: 21, packageCode: 'QA NEW-1', trackingBarcode: 'generated', actualLength: 605, actualWeightKg: 4.25, handlingClass: 'STANDARD', qrToken: TOKEN_NEW }
  let rows = [PLANNED]
  const { user, calls } = renderAt('/kien-hang', '/kien-hang', <PackagesPage />, 'dispatcher', {
    'GET /api/packages': () => ({ body: page(rows) }),
    'POST /api/packages': () => {
      rows = [PLANNED, created]
      return { status: 201, body: created }
    },
    'GET /api/packages/21': { body: created },
    [`GET /api/packages/scan/${TOKEN_NEW}`]: { body: scanOf(created, 'QA Huế') },
  })
  await screen.findByText('1 kiện trong kho kiện', {}, SLOW)
  await user.click(screen.getByRole('button', { name: 'Thêm kiện' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Thêm kiện' }))
  // Danh mục loại kiện chưa mở ở backend: form không có ô loại kiện
  expect(dialog.queryByRole('combobox', { name: 'Loại kiện' })).not.toBeInTheDocument()
  await user.type(dialog.getByRole('textbox', { name: 'Mã kiện của bên gửi' }), 'QA NEW-1')
  await user.type(dialog.getByRole('spinbutton', { name: 'Dài' }), '60.5')
  await user.type(dialog.getByRole('spinbutton', { name: 'Rộng' }), '40')
  await user.type(dialog.getByRole('spinbutton', { name: 'Cao' }), '30')
  await user.type(dialog.getByRole('spinbutton', { name: 'Khối lượng' }), '4.25')
  await user.type(dialog.getByRole('textbox', { name: 'Điểm đến' }), 'QA Huế')
  await user.click(dialog.getByRole('button', { name: 'Thêm kiện' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), SLOW)
  expect(await screen.findByText('Đã thêm kiện QA NEW-1 vào kho kiện.', {}, SLOW)).toBeInTheDocument()
  expect(await screen.findByText('2 kiện trong kho kiện', {}, SLOW)).toBeInTheDocument()
  const panel = within(await screen.findByRole('complementary', { name: 'Chi tiết kiện QA NEW-1' }, SLOW))
  expect(await panel.findByText('QA Huế', {}, SLOW)).toBeInTheDocument()
  expect(panel.getByRole('button', { name: 'Xoá kiện' })).toBeEnabled()

  const body = calls.find((call) => call.method === 'POST')?.body as Record<string, unknown>
  expect(body).toMatchObject({ packageCode: 'QA NEW-1', actualLength: 605, actualWidth: 400, actualHeight: 300, actualWeightKg: 4.25, handlingClass: 'STANDARD', destination: 'QA Huế' })
  // Không đơn hàng, không loại kiện, không ghim; mã vạch bắt buộc của backend do app cấp
  expect(Object.keys(body).sort()).toStrictEqual([
    'actualHeight', 'actualLength', 'actualWeightKg', 'actualWidth', 'destination', 'handlingClass', 'packageCode', 'trackingBarcode',
  ])
  expect(body.trackingBarcode).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
})

test('labels are drawn from backend packages with the scanned destination, and the server PDF is requested for the same packages', async () => {
  const { user, calls } = renderAt('/kien-hang/nhan?kien=1,3,999', '/kien-hang/nhan', <PackageLabelsPage />, 'dispatcher', {
    'GET /api/packages': listOf([MANUAL, PLANNED]),
    [`GET /api/packages/scan/${TOKEN_1}`]: { body: scanOf(MANUAL, 'QA Kho Bình Dương') },
    [`GET /api/packages/scan/${TOKEN_3}`]: { body: scanOf(PLANNED, 'QA Kho Đà Nẵng') },
    'POST /api/packages/export/labels': { text: '%PDF-1.4' },
  })
  expect(await screen.findByText('2 nhãn có thể in', {}, SLOW)).toBeInTheDocument()
  expect(screen.getByText('1 mã kiện trên đường dẫn không có hoặc không thuộc công ty bạn nên không có nhãn.')).toBeInTheDocument()
  const first = within(screen.getByRole('article', { name: '1' }))
  for (const text of ['QA PK-0001', 'QA Kho Bình Dương', '120,5 cm', '12,5 kg']) expect(first.getByText(text)).toBeInTheDocument()
  expect(first.getByRole('img', { name: `Mã QR ${TOKEN_1}` })).toBeInTheDocument()
  expect(within(screen.getByRole('article', { name: '3' })).getByText('QA Kho Đà Nẵng')).toBeInTheDocument()

  // In bằng trình duyệt vẫn là nút chính; PDF của máy chủ là nút phụ
  expect(screen.getByRole('button', { name: 'In nhãn' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Tải PDF nhãn' }))
  await waitFor(() => expect(downloaded).toHaveBeenCalledTimes(1))
  expect(downloaded.mock.calls[0]?.[0]).toMatchObject({ size: '%PDF-1.4'.length })
  expect(downloaded.mock.calls[0]?.[1]).toBe('nhan-kien.pdf')
  expect(calls.filter((call) => call.method === 'POST').map((call) => [call.path, call.body])).toStrictEqual([['/api/packages/export/labels', { packageIds: [1, 3] }]])
  // Mỗi nhãn một lượt quét để lấy điểm đến; mã 999 không có trong danh sách nên không quét
  expect(calls.filter((call) => call.path.startsWith('/api/packages/scan/'))).toHaveLength(2)
})

test('lookup: an upper-case QR token is lowercased for the server, a repeated sender code lists every match, an unknown code finds nothing', async () => {
  const { user, calls } = renderAt('/tra-cuu-kien', '/tra-cuu-kien', <PackageLookupPage />, 'dispatcher', {
    'GET /api/packages': listOf([MANUAL, PLANNED, DUP_A, DUP_B]),
    [`GET /api/packages/scan/${TOKEN_1}`]: { body: scanOf(MANUAL, 'QA Kho Bình Dương') },
    [`GET /api/packages/scan/${TOKEN_7}`]: { body: scanOf(DUP_A, 'QA Kho Cần Thơ') },
    [`GET /api/packages/scan/${TOKEN_8}`]: { body: scanOf(DUP_B, 'QA Kho Huế', { id: 12, name: 'QA TRIP-A' }, { number: 1, name: 'QA Điểm giao' }) },
  })
  const lookUp = async (code: string) => {
    const input = await screen.findByRole('textbox', { name: 'Mã QR hoặc mã kiện của bên gửi' })
    await user.clear(input)
    await user.type(input, code)
    await user.click(screen.getByRole('button', { name: 'Tra cứu' }))
  }

  await lookUp(TOKEN_1.toUpperCase())
  const card = await screen.findByRole('region', { name: 'Kiện QA PK-0001' }, SLOW)
  // Backend không trả chiều rộng, chiều cao, cờ: thẻ chỉ có phần có nguồn; điểm đến lấy từ lượt quét
  expect(facts(card)).toStrictEqual({
    'Mã của kho kiện': '1', 'Mã của bên gửi': 'QA PK-0001', 'Mã QR': TOKEN_1, 'Khối lượng': '12,5 kg', 'Loại hàng': 'Dễ vỡ',
    'Điểm đến': 'QA Kho Bình Dương', 'Chuyến': 'Chưa vào chuyến nào',
  })
  expect(within(card).getByRole('link', { name: 'In lại nhãn' })).toHaveAttribute('href', '/kien-hang/nhan?kien=1&tu=tra-cuu')
  // Mã của kho là số ngắn nên mở Kho kiện bằng mã QR
  expect(within(card).getByRole('link', { name: 'Mở trong Kho kiện' })).toHaveAttribute('href', `/kien-hang?q=${TOKEN_1}`)
  expect(calls.filter((call) => call.path.startsWith('/api/packages/scan/')).map((call) => call.path)).toContain(`/api/packages/scan/${TOKEN_1}`)

  await lookUp('qa dup-1')
  expect(await screen.findByRole('heading', { name: '2 kiện mang mã qa dup-1' }, SLOW)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Xem kiện 8' }))
  const picked = await screen.findByRole('region', { name: 'Kiện QA DUP-1' }, SLOW)
  // Chuyến ghi bằng mã chuyến của backend, không bằng số nội bộ
  expect(facts(picked)).toMatchObject({ 'Mã của kho kiện': '8', 'Điểm đến': 'QA Kho Huế', 'Chuyến': 'QA TRIP-A', 'Điểm giao': 'Điểm 1 · QA Điểm giao' })

  await lookUp('QA NOPE')
  expect(await screen.findByText('Không có kiện nào của công ty bạn mang mã QA NOPE. Xem lại mã in trên nhãn.', {}, SLOW)).toBeInTheDocument()
})

test('the warehouse worker gets a reason instead of lookup and labels, and nothing is asked of the server', async () => {
  const lookup = renderAt('/tra-cuu-kien?ma=QA%20PK-0001', '/tra-cuu-kien', <PackageLookupPage />, 'warehouse', { 'GET /api/packages': listOf([MANUAL]) })
  expect(await screen.findByText('Máy chủ hiện chỉ cho điều phối viên tra cứu kiện, nên tài khoản của bạn chưa tra cứu được ở đây.')).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Mã QR hoặc mã kiện của bên gửi' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Quét mã QR' })).not.toBeInTheDocument()
  expect(lookup.calls).toStrictEqual([])
})

test('the warehouse worker cannot print labels from the server and the package types page never calls it', async () => {
  const labels = renderAt('/kien-hang/nhan?kien=1', '/kien-hang/nhan', <PackageLabelsPage />, 'warehouse', { 'GET /api/packages': listOf([MANUAL]) })
  expect(await screen.findByText('Máy chủ hiện chỉ cho điều phối viên đọc kiện để in nhãn, nên tài khoản của bạn chưa in nhãn được ở đây.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Tải PDF nhãn' })).not.toBeInTheDocument()
  expect(labels.calls).toStrictEqual([])
})

test('the package types page only explains why there is nothing to show', async () => {
  const types = renderAt('/loai-kien', '/loai-kien', <PackageTypesPage />, 'dispatcher', { 'GET /api/package-types': { status: 403, body: { success: false, message: 'forbidden' } } })
  expect(await screen.findByText('Máy chủ chưa mở danh mục loại kiện cho điều phối viên, nên khi nối máy chủ màn này chưa có dữ liệu.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Thêm loại kiện/ })).not.toBeInTheDocument()
  expect(types.calls).toStrictEqual([])
})
