import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, page, stubBackend, type FakeCall } from '@/test/fake-backend'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { MonitoringPage } from './MonitoringPage'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['monitoring']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'monitoring',
}))

/**
 * Màn Giám sát khi nhóm `monitoring` nối backend: bảng và giám sát các chuyến đọc `fetch` giả theo `MonitoringController`; đăng nhập vẫn
 * là phiên kho mẫu (chỉ để dựng màn). Màn chỉ còn việc backend làm được, giờ đến của máy chủ không mang MOCK RESULT.
 */
const TRIP = 'TRIP-20261018-0A1B2C3D'
const EXCEPTION = { id: '31', tripId: TRIP, type: 'TRAFFIC', description: 'Kẹt xe cầu Đồng Nai', delayMinutes: 25, reportedAt: '2026-10-18T09:10:00', reportedBy: '4' }

let status = 'OPEN'
/** Máy chủ từ chối đổi thứ tự vì kiện bị che kín lối dỡ. */
let reorderBlocked = false
let calls: FakeCall[] = []

beforeEach(() => {
  status = 'OPEN'
  reorderBlocked = false
  connectApiAuth(() => Promise.resolve('token-1'))
  calls = stubBackend({
    'GET /api/dispatcher/dashboard': {
      body: envelope({
        trips: [{
          tripId: TRIP, name: TRIP, vehicleName: 'Hino 500 · 51C-284.19', driverName: 'Trần Văn Hùng', depot: { name: 'Kho Long Bình', lat: 10.93, lng: 106.88 },
          stops: [
            { id: 7, number: 1, name: 'Co.opmart Biên Hoà', lat: 10.95, lng: 106.82 },
            { id: 8, number: 2, name: 'Bách Hoá Xanh Dĩ An', lat: 10.9, lng: 106.77 },
          ],
        }],
        userNames: { '4': 'Lê Thị Mai' },
      }),
    },
    'GET /api/trips/monitoring': () => ({
      body: envelope([{
        tripId: TRIP,
        location: { lat: 10.92, lng: 106.8, speedKmh: 40, heading: 270, recordedAt: '2026-10-18T09:05:00', source: 'GPS' },
        stops: [{ stopId: 8, number: 2, eta: '2026-10-18T10:00:00', deadline: '2026-10-18T10:30:00', deadlineStatus: 'OK' }],
        alerts: [],
        exceptions: [{ ...EXCEPTION, status }],
        refreshMs: 30000,
        isMockResult: false,
      }]),
    }),
    [`GET /api/trips/${TRIP}/location/history`]: { body: envelope([]) },
    [`POST /api/trips/${TRIP}/exceptions/31/resolve`]: () => {
      status = 'RESOLVED'
      return { body: envelope({ ...EXCEPTION, status, resolution: { at: '2026-10-18T09:20:00', by: '4' } }) }
    },
    'GET /api/delivery-requirements': {
      body: envelope(page([{ id: 41, customerName: 'Bách Hoá Xanh', destination: '215 Quốc lộ 1K', deadline: '2026-10-18T10:30:00', tripId: 55, tripCode: TRIP }])),
    },
    'GET /api/trips/55/detail': {
      body: envelope({ trip: { id: 55 }, stops: [{ id: 8, deliveryRequirementId: 41, stopSequence: 2, stopName: 'Bách Hoá Xanh Dĩ An', status: 'PENDING' }] }),
    },
    [`POST /api/trips/${TRIP}/exceptions/31/renegotiate`]: () => ({ body: envelope({ ...EXCEPTION, status, escalation: { reason: 'NO_ROUTE', at: '2026-10-18T09:15:00', by: '4' } }) }),
    [`POST /api/trips/${TRIP}/stops/reorder`]: () => (reorderBlocked
      ? { status: 409, body: { success: false, code: 'STOP_ORDER_BLOCKS_CARGO', message: 'x', errors: { packages: ['PK-0012'], stopIds: ['7'] } } }
      : { body: envelope({ tripId: 55, tripCode: TRIP, stops: [{ stopId: 8, sequence: 1 }, { stopId: 7, sequence: 2 }], partial: [] }) }),
    [`POST /api/trips/${TRIP}/exceptions/31/escalate`]: () => {
      status = 'ESCALATED'
      return { body: envelope({ ...EXCEPTION, status, escalation: { reason: 'NO_ROUTE', at: '2026-10-18T09:15:00', by: '4' } }) }
    },
  }).calls
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderPage(role: Role) {
  signedInAs(role)
  const router = createMemoryRouter([{ path: '/giam-sat', element: <MonitoringPage /> }], { initialEntries: ['/giam-sat'] })
  return render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <RouterProvider router={router} />
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
}

const SLOW = { timeout: 8000 }

test('điều phối viên xem chuyến của backend: không liên kết chuyến; xử lý sự cố gọi backend', async () => {
  const user = userEvent.setup()
  renderPage('dispatcher')
  const panel = within(await screen.findByRole('region', { name: `Giám sát chuyến ${TRIP}` }, SLOW))
  expect(panel.queryByRole('link', { name: 'Mở chuyến' })).toBeNull()
  expect(panel.getByRole('button', { name: 'Đổi thứ tự điểm' })).toBeEnabled()
  expect(panel.getByRole('button', { name: 'Báo sự cố' })).toBeInTheDocument()

  // Điểm 1 không còn trong giờ đến của máy chủ: đã giao xong; điểm 2 có giờ đến và hạn theo kế hoạch của tuyến
  const rows = within(panel.getByRole('table', { name: 'Giờ đến từng điểm' })).getAllByRole('row').slice(1)
  await waitFor(() => expect(rows[0]).toHaveTextContent('Đã giao xong'))
  expect(rows[1]).toHaveTextContent('10:00')
  expect(rows[1]).toHaveTextContent('Kịp hạn')
  expect(panel.getByText('Hạn ở đây là giờ đến theo kế hoạch của tuyến — máy chủ chưa trả hạn giao của yêu cầu giao.')).toBeInTheDocument()
  expect(screen.queryAllByText('MOCK RESULT')).toHaveLength(0)

  expect(await panel.findByRole('button', { name: 'Tìm tuyến khác' })).toBeInTheDocument()
  expect(panel.getByRole('button', { name: 'Không có tuyến khả thi — chuyển quản lý' })).toBeInTheDocument()
  await user.click(panel.getByRole('button', { name: 'Đã xử lý' }))
  await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === `/api/trips/${TRIP}/exceptions/31/resolve`)).toBe(true))
  await waitFor(() => expect(panel.queryByRole('button', { name: 'Đã xử lý' })).toBeNull())

  // Chỉ lượt gọi máy chủ của app; bản đồ còn gọi dịch vụ chỉ đường để vẽ đường đi.
  const paths = new Set(calls.filter((call) => call.path.startsWith('/api/')).map((call) => `${call.method} ${call.path}`))
  expect([...paths].sort()).toEqual([
    'GET /api/dispatcher/dashboard',
    `GET /api/trips/${TRIP}/location/history`,
    'GET /api/trips/monitoring',
    `POST /api/trips/${TRIP}/exceptions/31/resolve`,
  ].sort())
})

test('đổi thứ tự điểm qua máy chủ: máy chủ từ chối vì kiện bị che kín thì hộp nêu kiện và điểm; lần sau áp dụng được', async () => {
  const user = userEvent.setup()
  reorderBlocked = true
  renderPage('dispatcher')
  const panel = within(await screen.findByRole('region', { name: `Giám sát chuyến ${TRIP}` }, SLOW))
  await user.click(panel.getByRole('button', { name: 'Đổi thứ tự điểm' }))
  const dialog = within(await screen.findByRole('dialog'))
  await user.click(dialog.getByRole('button', { name: 'Dời Bách Hoá Xanh Dĩ An lên' }))
  await user.click(dialog.getByRole('button', { name: 'Áp dụng thứ tự mới' }))
  const list = await dialog.findByRole('list', { name: 'Kiện bị chắn' })
  expect(list).toHaveTextContent('PK-0012 — điểm 1 · Co.opmart Biên Hoà')

  reorderBlocked = false
  await user.click(dialog.getByRole('button', { name: 'Áp dụng thứ tự mới' }))
  expect(await screen.findByText(`Đã đổi thứ tự điểm giao của chuyến ${TRIP}.`, undefined, SLOW)).toBeInTheDocument()
  expect(calls.filter((call) => call.path === `/api/trips/${TRIP}/stops/reorder`).map((call) => call.body)).toEqual([{ stopIds: [8, 7] }, { stopIds: [8, 7] }])
})

test('điều phối viên chuyển sự cố cho quản lý: gọi backend, sự cố thành Đã chuyển quản lý', async () => {
  const user = userEvent.setup()
  renderPage('dispatcher')
  const panel = within(await screen.findByRole('region', { name: `Giám sát chuyến ${TRIP}` }, SLOW))
  await user.click(await panel.findByRole('button', { name: 'Không có tuyến khả thi — chuyển quản lý' }))
  await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === `/api/trips/${TRIP}/exceptions/31/escalate`)).toBe(true))
  await waitFor(() => expect(panel.queryByRole('button', { name: 'Không có tuyến khả thi — chuyển quản lý' })).toBeNull(), SLOW)
  expect(panel.getAllByText('Đã chuyển quản lý').length).toBeGreaterThan(0)
})

test('quản lý công ty: không xử lý sự cố ở tab chuyến; tab "Sự cố cần xử lý" đọc sự cố máy chủ đã chuyển lên và gia hạn qua máy chủ', async () => {
  status = 'ESCALATED'
  const user = userEvent.setup()
  renderPage('companyManager')
  expect(await screen.findByRole('region', { name: `Giám sát chuyến ${TRIP}` }, SLOW)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Đã xử lý' })).toBeNull()
  await user.click(screen.getByRole('tab', { name: /Sự cố cần xử lý/ }))
  const list = within(await screen.findByRole('list', { name: 'Sự cố cần xử lý' }, SLOW))
  expect(list.getByText('Kẹt xe cầu Đồng Nai')).toBeInTheDocument()
  expect(calls.some((call) => call.method !== 'GET' && call.path.startsWith('/api/'))).toBe(false)

  // Yêu cầu giao của chuyến đọc từ máy chủ: chọn sẵn yêu cầu ở điểm chưa giao, hạn hiện tại điền sẵn
  await user.click(list.getByRole('button', { name: 'Nhập hạn mới' }))
  const dialog = within(await screen.findByRole('dialog', {}, SLOW))
  expect((await dialog.findAllByText(/41 · Bách Hoá Xanh Dĩ An · điểm 2/, {}, SLOW)).length).toBeGreaterThan(0)
  await user.type(dialog.getByRole('textbox', { name: 'Đã liên hệ khách' }), 'Khách đồng ý nhận muộn')
  await user.click(dialog.getByRole('button', { name: 'Lưu hạn mới' }))
  await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === `/api/trips/${TRIP}/exceptions/31/renegotiate`)).toBe(true))
  const post = calls.find((call) => call.path === `/api/trips/${TRIP}/exceptions/31/renegotiate`)
  expect(post?.body).toEqual({ requirementId: 41, newDeadline: '2026-10-18T10:30:00', contactNote: 'Khách đồng ý nhận muộn' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), SLOW)
})
