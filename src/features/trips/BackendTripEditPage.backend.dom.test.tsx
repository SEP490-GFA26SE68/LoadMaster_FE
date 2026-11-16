import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { toast } from 'sonner'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, page, stubBackend, type FakeRoutes } from '@/test/fake-backend'
import { TripFormPage } from './TripFormPage'
import type { TripDetailApiResponse } from './trips-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips', 'companies']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips' || feature === 'companies',
}))

/**
 * Form sửa chuyến khi nhóm `trips` nối backend (`/chuyen/:mã/sua`): mã chuyến trên URL đổi sang mã số, form điền từ Chi tiết chuyến của
 * máy chủ, lưu gửi `PATCH /api/trips/{id}` chỉ với trường đã đổi rồi mở Chi tiết chuyến; chuyến đã sang xếp hàng không có form.
 */
const TRIP: TripDetailApiResponse = {
  id: 42, tripCode: 'TRIP-2026-0042', tripName: 'Tân Bình – Quận 7', companyId: 1, vehicleId: 11, vehicleName: 'Hino 500',
  licensePlate: '51C-123.45', driverId: 7, driverName: 'Trần Văn Tài', createdByDispatcherId: 3, departureTime: '2026-11-12 08:30:00',
  originName: 'Kho Tân Bình', originAddress: '12 Cộng Hoà, Tân Bình', originLatitude: 10.8012, originLongitude: 106.6521,
  status: 'PLANNED', createdAt: '2026-11-10T09:00:00',
}
const TYPE = {
  id: 7, name: 'Xe tải 5 tấn thùng kín', innerLength: 620, innerWidth: 235, innerHeight: 240, doorWidth: 230, doorHeight: 230,
  maxPayloadKg: 5000, frontAxleLimitKg: null, rearAxleLimitKg: null, maxCogOffsetRatio: 0.15, hazardousCapable: false, vehicleCount: 1, obstacles: [],
}
const flatPage = (data: readonly unknown[]) => ({ success: true, data, page: 0, size: 100, totalElements: data.length, totalPages: 1, last: true })
const WAREHOUSE = {
  id: 5, companyId: 1, warehouseName: 'Kho Thủ Đức', address: '1 Võ Văn Ngân, Thủ Đức', latitude: 10.85, longitude: 106.77,
  isDefault: false, isActive: true, createdAt: '2026-01-01T00:00:00', updatedAt: '2026-01-01T00:00:00',
}

function routes(trip: TripDetailApiResponse, extra: FakeRoutes = {}): FakeRoutes {
  return {
    'GET /api/trips': { body: envelope(page([{ id: trip.id, tripCode: trip.tripCode }])) },
    'GET /api/trips/42/detail': { body: envelope({ trip, stops: [] }) },
    'GET /api/vehicles': { body: flatPage([{ id: 11, name: 'Hino 500', licensePlate: '51C-123.45', vehicleTypeId: 7, vehicleTypeName: TYPE.name, companyId: 1, companyName: 'Long Bình', status: 'AVAILABLE' }]) },
    'GET /api/vehicle-types': { body: flatPage([TYPE]) },
    'GET /api/trips/driver-options': { body: envelope([{ id: 7, fullName: 'Trần Văn Tài' }]) },
    'GET /api/company-warehouses': { body: envelope([WAREHOUSE]) },
    ...extra,
  }
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/chuyen/:tripId/sua', element: <TripFormPage /> },
      { path: '/chuyen/:tripId', element: <p>Chi tiết chuyến của máy chủ</p> },
      { path: '/chuyen', element: <p>Danh sách chuyến</p> },
    ],
    { initialEntries: [path] },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>,
  )
  return { user: userEvent.setup(), router }
}

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('điền từ máy chủ, lưu chỉ gửi trường đã đổi rồi mở Chi tiết chuyến', async () => {
  const { calls } = stubBackend(routes(TRIP, { 'PATCH /api/trips/42': { body: envelope({ ...TRIP, tripName: 'Tuyến mới' }) } }))
  const { user, router } = renderAt('/chuyen/TRIP-2026-0042/sua')
  const name = await screen.findByRole('textbox', { name: 'Tên chuyến' })
  expect(name).toHaveValue('Tân Bình – Quận 7')
  expect(screen.getByRole('textbox', { name: 'Tên kho' })).toHaveValue('Kho Tân Bình')
  expect(screen.getByText('Đổi giờ xuất phát hoặc kho xuất phát thì tuyến bị bỏ và chuyến về Nháp. Đổi xe thì phương án đã duyệt thôi hiệu lực.')).toBeInTheDocument()
  await user.clear(name)
  await user.type(name, 'Tuyến mới')
  await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/chuyen/TRIP-2026-0042'))
  const patches = calls.filter((call) => call.method === 'PATCH')
  expect(patches.map((call) => [call.path, call.body])).toEqual([['/api/trips/42', { tripName: 'Tuyến mới' }]])
})

test('chọn kho khác gửi mã kho; không đổi gì thì không gọi máy chủ', async () => {
  const { calls } = stubBackend(routes(TRIP, { 'PATCH /api/trips/42': { body: envelope(TRIP) } }))
  const { user, router } = renderAt('/chuyen/TRIP-2026-0042/sua')
  await screen.findByRole('textbox', { name: 'Tên chuyến' })
  await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
  expect(await screen.findByText('Chưa đổi gì nên chưa có gì để lưu.')).toBeInTheDocument()
  expect(calls.some((call) => call.method === 'PATCH')).toBe(false)

  const warehouse = screen.getByRole('combobox', { name: 'Chọn kho xuất phát' })
  await waitFor(() => expect(screen.getByRole('option', { name: 'Kho Thủ Đức' })).toBeInTheDocument())
  expect(screen.getByRole('option', { name: 'Giữ kho hiện tại (Kho Tân Bình)' })).toBeInTheDocument()
  await user.selectOptions(warehouse, '5')
  expect(screen.getByRole('textbox', { name: 'Tên kho' })).toHaveValue('Kho Thủ Đức')
  await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/chuyen/TRIP-2026-0042'))
  expect(calls.filter((call) => call.method === 'PATCH').map((call) => call.body)).toEqual([{ originWarehouseId: 5 }])
})

test('máy chủ từ chối: báo lỗi, giữ nguyên form và dữ liệu đang nhập', async () => {
  const error = vi.spyOn(toast, 'error')
  stubBackend(routes(TRIP, {
    'PATCH /api/trips/42': { status: 409, body: { success: false, code: 'VEHICLE_CANNOT_CARRY_CARGO', message: 'x' } },
  }))
  const { user, router } = renderAt('/chuyen/TRIP-2026-0042/sua')
  const name = await screen.findByRole('textbox', { name: 'Tên chuyến' })
  await user.type(name, ' (sửa)')
  await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
  await waitFor(() => expect(error).toHaveBeenCalledWith('Không lưu được chuyến.', {
    description: 'Xe này không chở được hàng của chuyến (kích thước, thể tích hoặc tải trọng).',
  }))
  expect(router.state.location.pathname).toBe('/chuyen/TRIP-2026-0042/sua')
  expect(name).toHaveValue('Tân Bình – Quận 7 (sửa)')
})

test('chuyến đã sang xếp hàng: một dòng lý do, không có form', async () => {
  const { calls } = stubBackend(routes({ ...TRIP, status: 'LOADING' }))
  renderAt('/chuyen/TRIP-2026-0042/sua')
  expect(await screen.findByRole('alert')).toHaveTextContent('Chỉ sửa được chuyến Nháp hoặc Đã lập kế hoạch: chuyến TRIP-2026-0042 đã sang xếp hàng hoặc đã kết thúc.')
  expect(screen.queryByRole('textbox', { name: 'Tên chuyến' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Quay lại' })).toHaveAttribute('href', '/chuyen/TRIP-2026-0042')
  expect(calls.some((call) => call.method !== 'GET')).toBe(false)
})
