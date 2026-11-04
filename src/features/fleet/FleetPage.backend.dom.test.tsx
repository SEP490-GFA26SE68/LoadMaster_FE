import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { VehicleTypesPage } from '@/features/vehicle-types/VehicleTypesPage'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend, type FakeCall, type FakeRoutes } from '@/test/fake-backend'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { FleetPage } from './FleetPage'
import { VehicleDetailPage } from './VehicleDetailPage'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['fleet']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'fleet',
}))

/**
 * Đội xe, cấu hình xe và loại xe khi nhóm fleet đọc từ backend (backend giả): bảng và bốn ô số đọc từ máy chủ, không nút ghi nào, trạng
 * thái "Ngừng sử dụng" lọc được; quản lý công ty thấy câu lý do và màn không gọi backend.
 */
const SLOW = { timeout: 5000 }
const BOX_TRUCK = {
  id: 7, name: 'Xe tải 5 tấn thùng kín', innerLength: 620, innerWidth: 235, innerHeight: 240, doorWidth: 230, doorHeight: 230, maxPayloadKg: 5000,
  frontAxleLimitKg: 6000, rearAxleLimitKg: 11000, maxCogOffsetRatio: 0.15, hazardousCapable: false, vehicleCount: 2,
  obstacles: [{ id: 3, name: 'Hốc bánh trái', type: 'WHEEL_ARCH', x: 400, y: 0, z: 0, length: 100, width: 25, height: 30, loadBearing: true }],
}
const VAN = {
  id: 8, name: 'Xe van 1 tấn', innerLength: 300, innerWidth: 170, innerHeight: 160, doorWidth: null, doorHeight: null, maxPayloadKg: 1000,
  frontAxleLimitKg: null, rearAxleLimitKg: null, maxCogOffsetRatio: 0.15, hazardousCapable: false, vehicleCount: 1, obstacles: [],
}
const HINO = { id: 11, name: 'Hino 500', licensePlate: '51C-123.45', vehicleTypeId: 7, vehicleTypeName: BOX_TRUCK.name, companyId: 1, companyName: 'Long Bình', status: 'AVAILABLE' }
const ISUZU = { ...HINO, id: 12, name: 'Isuzu NQR', licensePlate: '60C-446.32', status: 'IN_TRIP' }
const FORD = { ...HINO, id: 13, name: 'Ford Transit', licensePlate: '51D-118.63', vehicleTypeId: 8, vehicleTypeName: VAN.name, status: 'RETIRED' }
const pageOf = (data: readonly unknown[]) => ({ body: { success: true, message: 'ok', data, page: 0, size: 200, totalElements: data.length, totalPages: 1, last: true } })
const CONFIG = {
  vehicleId: 11, vehicleName: 'Hino 500', licensePlate: '51C-123.45', vehicleTypeId: 7, vehicleTypeName: BOX_TRUCK.name, innerLength: 620,
  innerWidth: 235, innerHeight: 240, doorWidth: 230, doorHeight: 230, maxPayloadKg: 5000, frontAxleLimitKg: 6000, rearAxleLimitKg: 11000,
  maxCogOffsetRatio: 0.15, frontAxleX: -100, rearAxleX: 450, emptyFrontAxleLoadKg: 2500, emptyRearAxleLoadKg: 1800, obstacles: BOX_TRUCK.obstacles,
}
const ROUTES: FakeRoutes = {
  'GET /api/vehicles': pageOf([HINO, ISUZU, FORD]),
  'GET /api/vehicle-types': pageOf([BOX_TRUCK, VAN]),
  'GET /api/vehicles/11/config': { body: envelope(CONFIG) },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderAt(path: string, role: Role, routes: FakeRoutes = ROUTES): readonly FakeCall[] {
  const backend = stubBackend(routes)
  const router = createMemoryRouter(
    [
      { path: '/doi-xe', element: <FleetPage /> },
      { path: '/doi-xe/loai-xe', element: <VehicleTypesPage /> },
      { path: '/doi-xe/moi', element: <VehicleDetailPage /> },
      { path: '/doi-xe/:vehicleId', element: <VehicleDetailPage /> },
    ],
    { initialEntries: [path] },
  )
  signedInAs(role)
  render(
    <I18nProvider>
      <AuthProvider source="mock">
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
  return backend.calls
}

const tileValue = (label: string) => screen.getByRole('group', { name: label }).textContent

test('the dispatcher reads the fleet and its four counts from the server, with no write button', async () => {
  renderAt('/doi-xe', 'dispatcher')

  const running = await screen.findByRole('row', { name: /Isuzu NQR/ }, SLOW)
  expect(within(running).getByText('Đang phục vụ chuyến')).toBeInTheDocument()
  // Backend không trả chuyến đang dùng xe: không có liên kết chuyến nào
  expect(within(running).queryByRole('link', { name: /TRIP-/ })).not.toBeInTheDocument()
  expect(within(screen.getByRole('row', { name: /Ford Transit/ })).getByText('Ngừng sử dụng')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Hino 500 · 51C-123.45' })).toHaveAttribute('href', '/doi-xe/11')

  expect(tileValue('Xe trong danh mục')).toContain('3')
  expect(tileValue('Sẵn sàng')).toContain('1')
  expect(tileValue('Đang phục vụ chuyến')).toContain('1')
  expect(tileValue('Bảo dưỡng')).toContain('0')
  expect(screen.queryByRole('link', { name: 'Thêm xe' })).not.toBeInTheDocument()
  expect(screen.getByText(/Xe đọc từ máy chủ\./)).toBeInTheDocument()
})

test('the status filter on the URL reaches the retired vehicles the server has', async () => {
  renderAt('/doi-xe?trang-thai=ngung-su-dung', 'dispatcher')

  expect(await screen.findByRole('row', { name: /Ford Transit/ }, SLOW)).toBeInTheDocument()
  expect(screen.queryByRole('row', { name: /Hino 500/ })).not.toBeInTheDocument()
})

test('a manager the server does not let read vehicles sees why, and the screens call nothing', async () => {
  const calls = renderAt('/doi-xe', 'manager')

  expect(await screen.findByText('Máy chủ hiện chỉ cho điều phối viên đọc đội xe, nên tài khoản của bạn chưa xem được xe ở đây.')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Đội xe' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(calls).toStrictEqual([])
})

test('the manager gets the same reason on a vehicle type list and a vehicle page', async () => {
  const calls = renderAt('/doi-xe/loai-xe', 'manager')
  expect(await screen.findByText(/chỉ cho điều phối viên đọc loại xe/)).toBeInTheDocument()
  expect(calls).toStrictEqual([])
})

test('a vehicle page reads its config view-only, with the two axles of its type', async () => {
  renderAt('/doi-xe/11', 'dispatcher')

  expect(await screen.findByRole('heading', { level: 1, name: 'Hino 500 · 51C-123.45' }, SLOW)).toBeInTheDocument()
  expect(screen.getByText(/Cấu hình đọc từ máy chủ và chỉ xem/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Lưu' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Đưa vào bảo dưỡng' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Tên trục 1')).toHaveValue('Trục trước')
  expect(screen.getByLabelText('Vị trí X 2')).toHaveValue(450)
  // Backend không có khoảng hở quanh kiện
  expect(screen.queryByLabelText(/^Khoảng hở quanh kiện/)).not.toBeInTheDocument()
})

test('there is no page to add a vehicle on the server', async () => {
  const calls = renderAt('/doi-xe/moi', 'dispatcher')
  expect(await screen.findByText(/Máy chủ chưa có lối thêm xe từ màn này/)).toBeInTheDocument()
  expect(calls).toStrictEqual([])
})

test('the vehicle types list each type with its vehicles, view-only', async () => {
  renderAt('/doi-xe/loai-xe', 'dispatcher')

  // Dòng của loại xe (tên loại đứng đầu) kèm xe đang gắn; dòng của xe ở bảng gắn loại ghi tên loại dạng chữ
  const van = await screen.findByRole('row', { name: /^Xe van 1 tấn/ }, SLOW)
  expect(within(van).getByText('Ford Transit · 51D-118.63')).toBeInTheDocument()
  expect(within(screen.getByRole('row', { name: /^Ford Transit/ })).getByText('Xe van 1 tấn')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Thêm loại xe' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Thao tác với/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('combobox', { name: /Loại xe của/ })).not.toBeInTheDocument()
  expect(screen.getByText(/Máy chủ chưa có lối đổi loại của xe/)).toBeInTheDocument()
})
