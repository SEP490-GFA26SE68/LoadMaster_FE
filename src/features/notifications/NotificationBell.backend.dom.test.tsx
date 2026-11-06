import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend } from '@/test/fake-backend'
import type { Role } from '@/types/user'
import { NotificationBell } from './NotificationBell'

/**
 * Chuông khi nhóm `notifications` nối backend (`GET /api/notifications`): máy chủ đã lọc theo vai trò, công ty, người xem và giữ đã đọc;
 * chuông dịch mã + tham số thành câu, chỉ dẫn tới màn cùng nguồn mà người xem mở được, và đánh dấu đã đọc qua `POST /api/notifications/read`.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: {
    authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['notifications', 'trips', 'driver', 'warehouse']),
    keycloak: { url: '', realm: '', clientId: '' },
  },
  usesBackend: (feature: string) => ['notifications', 'trips', 'driver', 'warehouse'].includes(feature),
}))

const session = vi.hoisted(() => ({ role: 'dispatcher' as string }))

vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'US-0003', role: session.role, fullName: 'Người xem', email: 'x@lb.vn', companyId: 'LOG-001', status: 'active' } }),
}))

vi.mock('@/features/auth/auth-api', async (original) => ({
  ...(await original<typeof import('@/features/auth/auth-api')>()),
  getCachedCurrentUser: () => ({ id: '31' }),
}))

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function notification(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    id: 501, actionType: 'TRIP_EXCEPTION_REPORTED', entityName: 'TripException', entityId: '9', tripId: 42, tripCode: 'TRIP-20261106-A1',
    actorId: 31, actorName: 'Trần Văn Tài', actorRole: 'DRIVER', oldValues: null,
    newValues: { tripId: 42, exceptionId: 9, type: 'TRAFFIC', delayMinutes: 25, stopNumber: 2 },
    createdAt: '2026-11-06T02:15:00Z', read: false, ...overrides,
  }
}

const list = (items: readonly unknown[]) => envelope({ items, unreadCount: 0, windowDays: 7 })

function renderBell(role: Role, variant: 'rail' | 'touch' = 'rail') {
  session.role = role
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <MemoryRouter>
          <NotificationBell variant={variant} />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

test('điều phối viên: câu dịch từ mã + tham số, mở Chi tiết chuyến của máy chủ, đánh dấu đã đọc ở máy chủ', async () => {
  const eta = notification({
    id: 502, actionType: 'DELIVERY_ETA_RISK', entityName: 'Trip', entityId: '42', actorId: null, actorName: null, actorRole: null,
    newValues: { tripId: 42, stopNumber: 3, deadlineStatus: 'MISSED' }, read: true,
  })
  const backend = stubBackend({
    'GET /api/notifications': { body: list([notification(), eta]) },
    'POST /api/notifications/read': { body: list([notification({ read: true }), eta]) },
  })
  renderBell('dispatcher')

  const bell = await screen.findByRole('button', { name: 'Thông báo, 1 chưa đọc' })
  await userEvent.click(bell)
  const menu = await screen.findByRole('menu')
  const reported = within(menu).getByRole('menuitem', { name: /Báo sự cố trên đường/ })
  expect(reported).toHaveAttribute('href', '/chuyen/TRIP-20261106-A1')
  expect(reported).toHaveTextContent('Tắc đường · Điểm 2 · Chậm 25 phút')
  expect(reported).toHaveTextContent('Trần Văn Tài')
  const risk = within(menu).getByRole('menuitem', { name: /Nguy cơ trễ hạn giao/ })
  expect(risk).toHaveTextContent('Điểm 3 · Trễ hạn dự kiến')
  expect(risk).toHaveTextContent('Hệ thống')

  await userEvent.click(within(menu).getByRole('menuitem', { name: 'Đánh dấu đã đọc' }))
  await waitFor(() => expect(backend.calls.find((call) => call.method === 'POST')?.body).toStrictEqual({ ids: [501] }))
  await waitFor(() => expect(within(menu).queryByText('1 chưa đọc')).toBeNull())
})

test('tài xế: chuyến mới nói bằng câu của tài xế và mở màn điểm giao bản máy chủ; chuyến đã bị thay thì không mở', async () => {
  stubBackend({
    'GET /api/notifications': {
      body: list([
        notification({
          id: 610, actionType: 'TRIP_UPDATED', entityName: 'Trip', tripId: 77, tripCode: 'TRIP-20261106-B2', actorName: 'Điều phối',
          actorRole: 'DISPATCHER', oldValues: { driverId: 31, tripStatus: 'LOADING' }, newValues: { driverId: 40, tripStatus: 'LOADING' },
        }),
        notification({
          id: 600, actionType: 'TRIP_STATUS_TRANSITION', entityName: 'Trip', actorName: 'Kho', actorRole: 'WAREHOUSE_WORKER',
          oldValues: { status: 'PLANNED' }, newValues: { status: 'LOADING', driverId: 31 },
        }),
      ]),
    },
  })
  renderBell('driver', 'touch')

  await userEvent.click(await screen.findByRole('button', { name: 'Thông báo, 2 chưa đọc' }))
  const menu = await screen.findByRole('menu')
  const started = within(menu).getByRole('menuitem', { name: /Chuyến mới: kho đang soạn hàng/ })
  expect(started).toHaveAttribute('href', '/tai-xe/diem-giao?chuyen=42')
  expect(started).not.toHaveTextContent('Trạng thái')
  const released = within(menu).getByRole('menuitem', { name: /Bạn không còn chạy chuyến này/ })
  expect(released).not.toHaveAttribute('href')
})

test('nhân viên kho: chuyến bị huỷ lúc đang xếp mở phiên xếp bản máy chủ', async () => {
  stubBackend({
    'GET /api/notifications': {
      body: list([notification({
        id: 700, actionType: 'TRIP_CANCELLED', entityName: 'Trip', actorName: 'Điều phối', actorRole: 'DISPATCHER',
        oldValues: { status: 'LOADING' }, newValues: { status: 'CANCELLED', reason: 'Khách hoãn đơn' },
      })]),
    },
  })
  renderBell('warehouse', 'touch')

  await userEvent.click(await screen.findByRole('button', { name: 'Thông báo, 1 chưa đọc' }))
  const cancelled = within(await screen.findByRole('menu')).getByRole('menuitem', { name: /Huỷ chuyến/ })
  expect(cancelled).toHaveAttribute('href', '/kho?chuyen=42')
  expect(cancelled).toHaveTextContent('Lý do: Khách hoãn đơn')
})

test('quản trị công ty: sắp hết credit không mở màn gói cước khi gói cước còn là kho mẫu', async () => {
  stubBackend({
    'GET /api/notifications': {
      body: list([notification({
        id: 800, actionType: 'CREDIT_LOW_BALANCE', entityName: 'Company', entityId: '1', tripId: null, tripCode: null, actorId: null,
        actorName: null, actorRole: null, newValues: { balance: 3, threshold: 10 },
      })]),
    },
  })
  renderBell('companyAdmin')

  await userEvent.click(await screen.findByRole('button', { name: 'Thông báo, 1 chưa đọc' }))
  const low = within(await screen.findByRole('menu')).getByRole('menuitem', { name: /Sắp hết credit/ })
  expect(low).toHaveTextContent('Còn 3 credit')
  expect(low).not.toHaveAttribute('href')
})

test('hỗ trợ khách hàng không có chuông và không gọi máy chủ', () => {
  const backend = stubBackend({})
  renderBell('systemSupporter')
  expect(screen.queryByRole('button', { name: /Thông báo/ })).toBeNull()
  expect(backend.calls).toStrictEqual([])
})
