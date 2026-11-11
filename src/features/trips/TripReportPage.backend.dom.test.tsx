import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend } from '@/test/fake-backend'
import { TripReportPage } from './TripReportPage'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

/**
 * Báo cáo chuyến khi nhóm `trips` nối backend: đọc `GET /api/trips/{mã chuyến}/report`, cùng bố cục với bản kho mẫu nhưng chỉ số máy
 * chủ trả — không ô "Thời gian giao", không MOCK RESULT ngoài tuyến thay thế; chuyến chưa có báo cáo hiện câu của mã máy chủ.
 */
const REPORT = {
  tripId: 42, tripCode: 'TRIP-2026-0042', tripName: 'Tân Bình – Quận 7', status: 'DELIVERED', vehicleName: 'Hino 500', licensePlate: '51C-123.45',
  driverName: 'Trần Văn Tài', departureTime: '2026-11-10T07:00:00', completedAt: '2026-11-10T11:40:00', cancellation: null,
  loading: { startedAt: '2026-11-10T05:30:00', completedAt: '2026-11-10T06:45:00', sealNumber: 'SEAL-0091', sealedAt: '2026-11-10T06:50:00' },
  overrideReason: null,
  stops: [
    {
      stopId: 901, sequence: 1, stopType: 'DELIVERY', name: 'Cửa hàng Tân Bình', address: '12 Cộng Hoà', packageCount: 6, unloaded: 6, returned: 0,
      issues: 0, plannedArrival: '2026-11-10T08:00:00', actualArrival: '2026-11-10T08:10:00', deadline: null, plannedStatus: null, arrivedOnTime: null,
      completed: true,
    },
    {
      stopId: 902, sequence: 2, stopType: 'DELIVERY', name: 'Siêu thị Quận 7', address: '1 Nguyễn Văn Linh', packageCount: 4, unloaded: 3, returned: 1,
      issues: 1, plannedArrival: '2026-11-10T10:30:00', actualArrival: '2026-11-10T10:55:00', deadline: '2026-11-10T10:45:00', plannedStatus: 'AT_RISK',
      arrivedOnTime: false, completed: true,
    },
  ],
  packages: { total: 11, staged: 11, loaded: 10, damaged: 1, delivered: 9, returned: 1, withIssue: 1 },
  verifications: [{ step: 'STAGING', label: 11, manual: 0 }, { step: 'LOADING', label: 9, manual: 1 }, { step: 'UNLOADING', label: 9, manual: 0 }],
  manualConfirmations: [],
  exceptions: [],
  reroutes: [],
}

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: '/chuyen/:tripId/bao-cao', element: <TripReportPage /> }], { initialEntries: [path] })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('the report shows only what the server counted, without MOCK RESULT', async () => {
  stubBackend({ 'GET /api/trips/TRIP-2026-0042/report': { body: envelope(REPORT) } })
  renderAt('/chuyen/TRIP-2026-0042/bao-cao')
  const stops = await screen.findByRole('group', { name: 'Điểm giao đã xong' })
  expect(stops).toHaveTextContent('2 / 2')
  expect(screen.getByRole('group', { name: 'Kiện đã giao' })).toHaveTextContent('9 / 10')
  expect(screen.getByRole('group', { name: 'Sự cố' })).toHaveTextContent('1')
  expect(screen.getByRole('group', { name: 'Thời gian xếp' })).toHaveTextContent('1 giờ 15 phút')
  expect(screen.queryByRole('group', { name: 'Thời gian giao' })).toBeNull()
  expect(screen.queryByText('MOCK RESULT')).toBeNull()
  const late = screen.getByRole('row', { name: /Siêu thị Quận 7/ })
  expect(within(late).getByText('Đến trễ hạn')).toBeInTheDocument()
  expect(screen.getByText('SEAL-0091 · ghi lúc 06:50')).toBeInTheDocument()
  expect(screen.getByRole('rowheader', { name: 'Xếp hàng' }).closest('tr')).toHaveTextContent('91')
  expect(screen.getByText('Số liệu máy chủ đếm từ dữ liệu kho và tài xế đã ghi.')).toBeInTheDocument()
})

test('a trip without a report shows the server reason', async () => {
  stubBackend({ 'GET /api/trips/TRIP-2026-0044/report': { status: 409, body: { success: false, code: 'TRIP_REPORT_NOT_AVAILABLE', message: 'x' } } })
  renderAt('/chuyen/TRIP-2026-0044/bao-cao')
  expect(await screen.findByText('Chuyến chưa có báo cáo: chỉ chuyến đã giao hoặc bị huỷ lúc đang vận chuyển mới có.')).toBeInTheDocument()
})
