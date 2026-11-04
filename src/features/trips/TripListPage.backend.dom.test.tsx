import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { envelope, page, stubBackend, type FakeReply } from '@/test/fake-backend'
import { signedInAs } from '@/test/signed-in'
import { TripListPage } from './TripListPage'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

/**
 * Danh sách chuyến khi nhóm `trips` nối backend: dòng đọc `GET /api/trips` (đăng nhập vẫn là phiên kho mẫu, chỉ để dựng màn); tab,
 * bộ lọc, số đếm tính ở client. Không có nút tạo, cột lấp đầy, tên tuyến hay dòng phụ phương án — máy chủ chưa trả các phần đó.
 */
const TRIPS = [
  {
    id: 42, tripCode: 'TRIP-20261019-7F3A', tripName: 'Biên Hoà – Dĩ An', vehicleId: 5, vehicleName: 'Hino 500', licensePlate: '51C-284.19',
    driverId: 9, driverName: 'Trần Văn Hùng', departureTime: '2026-10-19T06:30:00', status: 'IN_TRANSIT', stopCount: 2, packageCount: 14,
  },
  {
    id: 43, tripCode: 'TRIP-20261020-1B2C', tripName: 'Thủ Đức', vehicleId: 6, vehicleName: 'Isuzu QKR', licensePlate: '60C-111.22',
    driverId: null, driverName: null, departureTime: '2026-10-20T07:00:00', status: 'DRAFT', stopCount: 1, packageCount: 3,
  },
]

let reply: FakeReply = { body: envelope(page(TRIPS)) }

beforeEach(() => {
  reply = { body: envelope(page(TRIPS)) }
  connectApiAuth(() => Promise.resolve('token-1'))
  stubBackend({ 'GET /api/trips': () => reply })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function renderList() {
  signedInAs('dispatcher')
  const router = createMemoryRouter(
    [
      { path: '/chuyen', element: <TripListPage /> },
      { path: '/chuyen/:tripId', element: <p>Chi tiết chuyến</p> },
    ],
    { initialEntries: ['/chuyen'] },
  )
  render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
  return { user: userEvent.setup(), router }
}

test('dòng chuyến là của máy chủ, không đọc kho mẫu; không nút tạo, không cột lấp đầy, không tên tuyến', async () => {
  const listTrips = vi.spyOn(getMockDb(), 'listTrips')
  const { user, router } = renderList()
  const link = await screen.findByRole('link', { name: 'TRIP-20261019-7F3A' })
  expect(screen.getByRole('link', { name: 'TRIP-20261020-1B2C' })).toBeInTheDocument()
  const row = link.closest('tr')
  if (!row) throw new Error('thiếu dòng')
  expect(within(row).getByText('Biên Hoà – Dĩ An')).toBeInTheDocument()
  expect(within(row).getByText('2 điểm')).toBeInTheDocument()
  expect(within(row).getByText('51C-284.19')).toBeInTheDocument()
  expect(within(row).getByText('14')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Tạo chuyến/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: /Lấp đầy/ })).not.toBeInTheDocument()
  expect(screen.queryByText(/Chưa tối ưu/)).not.toBeInTheDocument()
  expect(listTrips).not.toHaveBeenCalled()

  // Tab trạng thái lọc ở client trên danh sách của máy chủ
  await user.click(screen.getByRole('tab', { name: /Nháp/ }))
  expect(screen.queryByRole('link', { name: 'TRIP-20261019-7F3A' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'TRIP-20261020-1B2C' })).toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: 'TRIP-20261020-1B2C' }))
  expect(router.state.location.pathname).toBe('/chuyen/TRIP-20261020-1B2C')
})

test('máy chủ từ chối vai trò: màn nói lý do của máy chủ', async () => {
  reply = { status: 403, body: { success: false, message: 'Access Denied' } }
  renderList()
  expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được danh sách chuyến. Bạn không có quyền thực hiện thao tác này.')
})

test('máy chủ chưa có chuyến nào: màn rỗng không mời tạo chuyến', async () => {
  reply = { body: envelope(page([])) }
  renderList()
  expect(await screen.findByText('Máy chủ chưa có chuyến nào của công ty.')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Tạo chuyến/ })).not.toBeInTheDocument()
})
