import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend, type FakeCall } from '@/test/fake-backend'
import { signedInAs } from '@/test/signed-in'
import { TripClaimsCard } from './TripClaimsCard'

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: toastError, warning: vi.fn(), success: vi.fn(), info: vi.fn() } }))

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

type ClaimDto = {
  id: number
  tripId: number
  driverUserId: number
  driverName: string
  driverPhone: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  note: string | null
  createdAt: string
  decidedById: number | null
  decidedByName: string | null
  decidedAt: string | null
  rejectReason: string | null
}

const pendingClaim: ClaimDto = {
  id: 3,
  tripId: 1,
  driverUserId: 21,
  driverName: 'Nguyễn An',
  driverPhone: '0901234567',
  status: 'PENDING',
  note: 'Có thể nhận chuyến sớm',
  createdAt: '2026-11-20 21:05:33',
  decidedById: null,
  decidedByName: null,
  decidedAt: null,
  rejectReason: null,
}

const alreadyApproved: ClaimDto = {
  ...pendingClaim,
  id: 4,
  driverName: 'Trần Bình',
  status: 'APPROVED',
  note: null,
  decidedById: 2,
  decidedByName: 'Điều phối viên',
  decidedAt: '2026-11-20 21:10:00',
}

let claims: ClaimDto[]
let backend: ReturnType<typeof stubBackend>
let failApprove: boolean

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
  claims = [{ ...pendingClaim }, { ...alreadyApproved }]
  failApprove = false
  toastError.mockClear()
  backend = stubBackend({
    'GET /api/trips/1/claims': () => ({ body: envelope(claims) }),
    'POST /api/trips/1/claims/3/approve': () => {
      if (failApprove) return { status: 409, body: { success: false, code: 'TRIP_CLAIM_TRIP_TAKEN', message: 'Chuyến này đã có tài xế nhận' } }
      claims = claims.map((claim) => claim.id === 3 ? { ...claim, status: 'APPROVED' } : claim)
      return { body: envelope({ ...pendingClaim, status: 'APPROVED' }) }
    },
    'POST /api/trips/1/claims/3/reject': (call: FakeCall) => {
      claims = claims.map((claim) => claim.id === 3 ? { ...claim, status: 'REJECTED' } : claim)
      return { body: envelope({ ...pendingClaim, status: 'REJECTED', rejectReason: (call.body as { reason: string }).reason }) }
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderCard(role: 'dispatcher' | 'companyManager' = 'dispatcher') {
  signedInAs(role)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={client}>
          <TripClaimsCard tripId="1" />
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
  return { user: userEvent.setup(), client, invalidate }
}

const card = () => within(screen.getByRole('region', { name: 'Phiếu xin chuyến (1)' }))

test('điều phối viên chỉ thấy phiếu đang chờ; duyệt gọi đúng endpoint và làm mới chuyến cùng danh sách phiếu', async () => {
  const { user, invalidate } = renderCard()

  expect(await screen.findByText('Nguyễn An')).toBeInTheDocument()
  expect(card().getByText('0901234567')).toBeInTheDocument()
  expect(card().getByText('Lời nhắn: Có thể nhận chuyến sớm')).toBeInTheDocument()
  expect(card().queryByText('Trần Bình')).not.toBeInTheDocument()

  await user.click(card().getByRole('button', { name: 'Duyệt phiếu của Nguyễn An' }))

  await waitFor(() => expect(screen.queryByRole('region', { name: 'Phiếu xin chuyến (1)' })).not.toBeInTheDocument())
  expect(backend.calls.find((call) => call.method === 'POST')).toMatchObject({
    path: '/api/trips/1/claims/3/approve',
    body: undefined,
  })
  const invalidatedKeys = invalidate.mock.calls.map(([filters]) => filters?.queryKey)
  expect(invalidatedKeys).toContainEqual(['trips', '1', 'backend-detail'])
  expect(invalidatedKeys).toContainEqual(['trips', '1', 'claims'])
  expect(invalidatedKeys).toContainEqual(['trips', 'claims', 'pending'])
})

test('lý do từ chối để trống báo đúng trường cần sửa', async () => {
  const { user } = renderCard()
  await screen.findByText('Nguyễn An')
  await user.click(card().getByRole('button', { name: 'Từ chối phiếu của Nguyễn An' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Từ chối phiếu xin chuyến của Nguyễn An?' }))
  await user.click(dialog.getByRole('button', { name: 'Từ chối phiếu' }))

  expect(await dialog.findByText('Nhập lý do từ chối.')).toBeInTheDocument()
  expect(backend.calls.some((call) => call.method === 'POST' && call.path.endsWith('/reject'))).toBe(false)
})

test('lý do từ chối dài hơn 300 ký tự báo lỗi độ dài riêng', async () => {
  const { user } = renderCard()
  await screen.findByText('Nguyễn An')
  await user.click(card().getByRole('button', { name: 'Từ chối phiếu của Nguyễn An' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Từ chối phiếu xin chuyến của Nguyễn An?' }))
  await user.type(dialog.getByRole('textbox', { name: 'Lý do từ chối' }), 'a'.repeat(301))
  await user.click(dialog.getByRole('button', { name: 'Từ chối phiếu' }))

  expect(await dialog.findByText('Lý do từ chối không được dài quá 300 ký tự.')).toBeInTheDocument()
  expect(backend.calls.some((call) => call.method === 'POST' && call.path.endsWith('/reject'))).toBe(false)
})

test('lý do hợp lệ được gửi trong body rồi danh sách phiếu được đọc lại', async () => {
  const { user, invalidate } = renderCard()
  await screen.findByText('Nguyễn An')
  await user.click(card().getByRole('button', { name: 'Từ chối phiếu của Nguyễn An' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Từ chối phiếu xin chuyến của Nguyễn An?' }))
  await user.type(dialog.getByRole('textbox', { name: 'Lý do từ chối' }), 'Không thể bố trí chuyến này')
  await user.click(dialog.getByRole('button', { name: 'Từ chối phiếu' }))

  await waitFor(() => expect(backend.calls.find((call) => call.method === 'POST')).toMatchObject({
    path: '/api/trips/1/claims/3/reject',
    body: { reason: 'Không thể bố trí chuyến này' },
  }))
  expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toContainEqual(['trips', '1', 'claims'])
  expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toContainEqual(['trips', 'claims', 'pending'])
})

test('quản lý công ty chỉ xem danh sách và không có nút thao tác', async () => {
  renderCard('companyManager')

  expect(await screen.findByText('Nguyễn An')).toBeInTheDocument()
  expect(card().getByText('Bạn có thể xem các phiếu xin chuyến nhưng không thể quyết định.')).toBeInTheDocument()
  expect(card().queryByRole('button')).not.toBeInTheDocument()
})

test('lỗi chuyến đã có tài xế hiện đúng câu dịch', async () => {
  failApprove = true
  const { user } = renderCard()
  await screen.findByText('Nguyễn An')
  await user.click(card().getByRole('button', { name: 'Duyệt phiếu của Nguyễn An' }))

  await waitFor(() => expect(toastError).toHaveBeenCalledWith('Chuyến này đã có tài xế nhận.'))
})

test('không hiện thẻ khi không còn phiếu đang chờ', async () => {
  claims = [{ ...alreadyApproved }]
  renderCard()

  await waitFor(() => expect(screen.queryByRole('region', { name: 'Phiếu xin chuyến (1)' })).not.toBeInTheDocument())
  expect(screen.queryByRole('region', { name: /Phiếu xin chuyến/ })).not.toBeInTheDocument()
})
