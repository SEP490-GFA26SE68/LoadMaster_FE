import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { envelope, page, stubBackend, type FakeCall } from '@/test/fake-backend'
import { signedInAs } from '@/test/signed-in'
import { TripDetailPage } from './TripDetailPage'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['trips', 'monitoring']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips' || feature === 'monitoring',
}))

/**
 * Chi tiết chuyến khi nhóm `trips` (cùng `monitoring`) nối backend: thông tin chuyến và điểm giao đọc từ máy chủ, vị trí xe và giờ đến
 * máy chủ tính cho chuyến Đang vận chuyển; không thẻ, nút hay liên kết nào đọc kho mẫu theo mã chuyến của máy chủ.
 */
const CODE = 'TRIP-20261019-7F3A'
const ROW = {
  id: 42, tripCode: CODE, tripName: 'Biên Hoà – Dĩ An', vehicleId: 5, vehicleName: 'Hino 500', licensePlate: '51C-284.19', driverId: 9,
  driverName: 'Trần Văn Hùng', departureTime: '2026-10-19T06:30:00', status: 'IN_TRANSIT', stopCount: 2, packageCount: 14,
}
const DETAIL = {
  trip: { ...ROW, stopCount: null, packageCount: null, originName: 'Kho Long Bình', originAddress: 'KCN Long Bình', originLatitude: 10.93, originLongitude: 106.88 },
  stops: [
    { id: 7, stopSequence: 1, stopName: 'Co.opmart Biên Hoà', address: '125 Phạm Văn Thuận, Biên Hoà', latitude: 10.95, longitude: 106.82, status: 'ARRIVED', plannedArrival: '2026-10-19T08:00:00' },
    { id: 8, stopSequence: 2, stopName: 'Bách Hoá Xanh Dĩ An', address: 'Dĩ An, Bình Dương', latitude: null, longitude: null, status: 'PENDING', plannedArrival: '2026-10-19T09:15:00', deadline: '2026-10-19T11:00:00' },
  ],
}
const MONITORING = {
  tripId: CODE,
  location: { lat: 10.94, lng: 106.83, speedKmh: 0, heading: 90, recordedAt: '2026-10-19T08:05:00', source: 'GPS' },
  stops: [{ stopId: 8, number: 2, eta: '2026-10-19T10:40:00', deadline: '2026-10-19T11:00:00', deadlineStatus: 'AT_RISK' }],
  alerts: [],
  exceptions: [],
  refreshMs: 30000,
  isMockResult: false,
}

let calls: FakeCall[] = []

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
  calls = stubBackend({
    'GET /api/trips': { body: envelope(page([ROW])) },
    'GET /api/trips/42/detail': { body: envelope(DETAIL) },
    [`GET /api/trips/${CODE}/monitoring`]: { body: envelope(MONITORING) },
  }).calls
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function renderDetail(tripId: string) {
  signedInAs('dispatcher')
  const router = createMemoryRouter(
    [
      { path: '/chuyen', element: <p>Danh sách chuyến</p> },
      { path: '/chuyen/:tripId', element: <TripDetailPage /> },
    ],
    { initialEntries: [`/chuyen/${tripId}`] },
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
}

/** Mọi hàm kho mẫu mà Chi tiết chuyến của kho mẫu đọc theo mã chuyến. */
function storeReads() {
  const db = getMockDb()
  return [
    vi.spyOn(db, 'getTrip'), vi.spyOn(db, 'listRevisions'), vi.spyOn(db, 'listTrips'), vi.spyOn(db, 'getTripEta'),
    vi.spyOn(db, 'getTripMonitoring'), vi.spyOn(db, 'listTripPackages'), vi.spyOn(db, 'listEvents'),
  ]
}

test('thông tin chuyến, điểm giao và giờ đến lấy từ máy chủ; không đọc kho mẫu, không nút ghi', async () => {
  const reads = storeReads()
  renderDetail(CODE)
  expect(await screen.findByRole('heading', { level: 1, name: 'Biên Hoà – Dĩ An' })).toBeInTheDocument()
  expect(screen.getByText('Đang vận chuyển')).toBeInTheDocument()
  expect(screen.getByText('51C-284.19')).toBeInTheDocument()
  expect(screen.getByText('Trần Văn Hùng')).toBeInTheDocument()
  expect(screen.getByText('14 kiện')).toBeInTheDocument()
  expect(screen.getByText('06:30')).toBeInTheDocument()
  expect(await screen.findByRole('status', { name: 'Vị trí xe' })).toHaveTextContent('GPS')

  const stops = screen.getByRole('list', { name: 'Kho xuất phát rồi các điểm giao theo thứ tự đi' })
  const [origin, first, second] = within(stops).getAllByRole('listitem')
  expect(origin).toHaveTextContent('Kho Long Bình')
  expect(first).toHaveTextContent('Co.opmart Biên Hoà')
  expect(first).toHaveTextContent('Xe đang ở điểm')
  expect(first).toHaveTextContent('Dự kiến đến 08:00')
  // Đang vận chuyển: giờ đến máy chủ tính từ vị trí xe thay giờ kế hoạch, kèm mức hạn bằng chữ, không MOCK RESULT
  expect(second).toHaveTextContent('Máy chủ dự kiến đến 10:40')
  expect(second).toHaveTextContent('Sát hạn')
  expect(second).toHaveTextContent('Hạn 11:00')
  expect(second).toHaveTextContent('Chưa có toạ độ')
  expect(screen.queryByText('MOCK RESULT')).not.toBeInTheDocument()

  for (const name of [/Xem phương án 3D/, /Chạy tối ưu/, /Thao tác/, /Thêm điểm giao/, /In nhãn QR/]) {
    expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
  }
  expect(screen.getByText(/Kiện, phương án xếp hàng, tiến độ kho và lịch sử của chuyến chưa có ở đây/)).toBeInTheDocument()
  for (const read of reads) expect(read).not.toHaveBeenCalled()
  expect(calls.map((call) => call.path)).toEqual(expect.arrayContaining(['/api/trips', '/api/trips/42/detail', `/api/trips/${CODE}/monitoring`]))
})

test('mã của kho mẫu không có trên máy chủ: "Không tìm thấy", không gọi /detail, không đọc kho mẫu', async () => {
  const reads = storeReads()
  renderDetail('TRIP-2026-0914')
  expect(await screen.findByRole('heading', { level: 2, name: 'Không tìm thấy chuyến TRIP-2026-0914' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Về danh sách chuyến' })).toHaveAttribute('href', '/chuyen')
  expect(calls.map((call) => call.path)).toEqual(['/api/trips'])
  for (const read of reads) expect(read).not.toHaveBeenCalled()
})
