import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend } from '@/test/fake-backend'
import { signedInAs } from '@/test/signed-in'
import { TripClaimsPage } from './TripClaimsPage'

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: toastError, warning: vi.fn(), success: vi.fn(), info: vi.fn() } }))

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

type PendingClaimDto = {
  claimId: number
  tripId: number
  tripCode: string | null
  tripName: string | null
  departureTime: string | null
  originWarehouse: string | null
  stopCount: number
  driverUserId: number
  driverName: string
  driverPhone: string | null
  note: string | null
  createdAt: string
}

const firstClaim: PendingClaimDto = {
  claimId: 8,
  tripId: 42,
  tripCode: 'TRIP-0042',
  tripName: 'Chuyến Tân Bình – Quận 7',
  departureTime: '2026-11-21 08:30:00',
  originWarehouse: 'Kho Tân Bình',
  stopCount: 3,
  driverUserId: 21,
  driverName: 'Nguyễn An',
  driverPhone: '0901234567',
  note: 'Có thể nhận chuyến sớm',
  createdAt: '2026-11-20 21:05:33',
}

let claims: PendingClaimDto[]
let loadFailures: number
let failApprove: boolean
let backend: ReturnType<typeof stubBackend>

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
  claims = [{ ...firstClaim }]
  loadFailures = 0
  failApprove = false
  toastError.mockClear()
  backend = stubBackend({
    'GET /api/trip-claims': () => {
      if (loadFailures > 0) {
        loadFailures -= 1
        return { status: 500, body: { success: false, code: 'SERVER_ERROR', message: 'Lỗi máy chủ' } }
      }
      return { body: envelope(claims) }
    },
    'POST /api/trips/42/claims/8/approve': () => {
      if (failApprove) return { status: 409, body: { success: false, code: 'TRIP_CLAIM_TRIP_TAKEN', message: 'Chuyến này đã có tài xế nhận' } }
      claims = []
      return { body: envelope({ claimId: 8 }) }
    },
    'POST /api/trips/42/claims/8/reject': (call) => {
      claims = []
      return { body: envelope({ claimId: 8, reason: (call.body as { reason: string }).reason }) }
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderPage(role: 'dispatcher' | 'companyManager' = 'dispatcher') {
  signedInAs(role)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={client}>
          <MemoryRouter><TripClaimsPage /></MemoryRouter>
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
  return { user: userEvent.setup(), client, invalidate }
}

test('liệt kê phiếu toàn công ty và liên kết đúng chuyến chi tiết', async () => {
  renderPage()

  const row = await screen.findByRole('listitem')
  expect(backend.calls.map((call) => [call.method, call.path, call.query])).toStrictEqual([
    ['GET', '/api/trip-claims', { status: 'PENDING' }],
  ])
  expect(within(row).getByText('Chuyến Tân Bình – Quận 7')).toBeInTheDocument()
  expect(within(row).getByText('TRIP-0042')).toBeInTheDocument()
  expect(within(row).getByText('Kho xuất phát: Kho Tân Bình')).toBeInTheDocument()
  expect(within(row).getByText('3 điểm giao')).toBeInTheDocument()
  expect(within(row).getByText('Nguyễn An')).toBeInTheDocument()
  expect(within(row).getByText('0901234567')).toBeInTheDocument()
  expect(within(row).getByText('Lời nhắn: Có thể nhận chuyến sớm')).toBeInTheDocument()
  expect(within(row).getByRole('link', { name: 'Xem chuyến' })).toHaveAttribute('href', '/chuyen/42')
  expect(within(row).getByText(/^Gửi lúc/)).toBeInTheDocument()
})

test('duyệt gọi endpoint theo tripId của phiếu rồi làm mới hàng đợi và chi tiết chuyến', async () => {
  const { user, invalidate } = renderPage()
  const row = await screen.findByRole('listitem')

  await user.click(within(row).getByRole('button', { name: 'Duyệt phiếu của Nguyễn An' }))

  await waitFor(() => expect(screen.queryByRole('listitem')).not.toBeInTheDocument())
  expect(backend.calls.find((call) => call.method === 'POST')).toMatchObject({
    path: '/api/trips/42/claims/8/approve',
    body: undefined,
  })
  const invalidatedKeys = invalidate.mock.calls.map(([filters]) => filters?.queryKey)
  expect(invalidatedKeys).toContainEqual(['trips', 'claims', 'pending'])
  expect(invalidatedKeys).toContainEqual(['trips', '42', 'backend-detail'])
})

test('từ chối với lý do trống báo đúng lỗi bắt buộc', async () => {
  const { user } = renderPage()
  const row = await screen.findByRole('listitem')
  await user.click(within(row).getByRole('button', { name: 'Từ chối phiếu của Nguyễn An' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Từ chối phiếu xin chuyến của Nguyễn An?' }))
  await user.click(dialog.getByRole('button', { name: 'Từ chối phiếu' }))

  expect(await dialog.findByText('Nhập lý do từ chối.')).toBeInTheDocument()
  expect(backend.calls.some((call) => call.method === 'POST' && call.path.endsWith('/reject'))).toBe(false)
})

test('từ chối với lý do dài hơn 300 ký tự báo lỗi độ dài riêng', async () => {
  const { user } = renderPage()
  const row = await screen.findByRole('listitem')
  await user.click(within(row).getByRole('button', { name: 'Từ chối phiếu của Nguyễn An' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Từ chối phiếu xin chuyến của Nguyễn An?' }))
  await user.type(dialog.getByRole('textbox', { name: 'Lý do từ chối' }), 'a'.repeat(301))
  await user.click(dialog.getByRole('button', { name: 'Từ chối phiếu' }))

  expect(await dialog.findByText('Lý do từ chối không được dài quá 300 ký tự.')).toBeInTheDocument()
  expect(backend.calls.some((call) => call.method === 'POST' && call.path.endsWith('/reject'))).toBe(false)
})

test('từ chối phiếu gửi reason, làm mới hàng đợi và chi tiết chuyến liên quan', async () => {
  const { user, invalidate } = renderPage()
  const row = await screen.findByRole('listitem')
  await user.click(within(row).getByRole('button', { name: 'Từ chối phiếu của Nguyễn An' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Từ chối phiếu xin chuyến của Nguyễn An?' }))
  await user.type(dialog.getByRole('textbox', { name: 'Lý do từ chối' }), 'Không thể bố trí chuyến này')
  await user.click(dialog.getByRole('button', { name: 'Từ chối phiếu' }))

  await waitFor(() => expect(backend.calls.find((call) => call.method === 'POST')).toMatchObject({
    path: '/api/trips/42/claims/8/reject',
    body: { reason: 'Không thể bố trí chuyến này' },
  }))
  await waitFor(() => expect(screen.queryByRole('listitem')).not.toBeInTheDocument())
  const invalidatedKeys = invalidate.mock.calls.map(([filters]) => filters?.queryKey)
  expect(invalidatedKeys).toContainEqual(['trips', 'claims', 'pending'])
  expect(invalidatedKeys).toContainEqual(['trips', '42', 'backend-detail'])
})

test('quản lý công ty chỉ xem phiếu và không có nút quyết định', async () => {
  renderPage('companyManager')
  const row = await screen.findByRole('listitem')

  expect(within(row).getByText('Nguyễn An')).toBeInTheDocument()
  expect(screen.getByText('Bạn có thể xem các phiếu xin chuyến nhưng không thể quyết định.')).toBeInTheDocument()
  expect(within(row).queryByRole('button')).not.toBeInTheDocument()
})

test('hiện trạng thái rỗng khi không có phiếu đang chờ', async () => {
  claims = []
  renderPage()

  expect(await screen.findByText('Chưa có phiếu xin chuyến nào đang chờ')).toBeInTheDocument()
})

test('lỗi tải hiện thông báo và nút thử lại tải được danh sách', async () => {
  loadFailures = 1
  const { user } = renderPage()

  expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải danh sách phiếu xin chuyến.')
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))

  expect(await screen.findByText('Nguyễn An')).toBeInTheDocument()
})

test('lỗi chuyến đã có tài xế hiện đúng câu dịch', async () => {
  failApprove = true
  const { user } = renderPage()
  const row = await screen.findByRole('listitem')
  await user.click(within(row).getByRole('button', { name: 'Duyệt phiếu của Nguyễn An' }))

  await waitFor(() => expect(toastError).toHaveBeenCalledWith('Chuyến này đã có tài xế nhận.'))
})
