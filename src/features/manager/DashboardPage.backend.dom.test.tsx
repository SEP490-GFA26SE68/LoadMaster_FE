import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { can, type Permission } from '@/features/auth/permissions'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { serverDashboard } from '@/test/dashboard-backend'
import { envelope, stubBackend } from '@/test/fake-backend'
import { DashboardPage } from './DashboardPage'

/**
 * Bảng điều khiển khi `monitoring` (và `trips`) nối backend: số là của máy chủ, số không có nguồn hiện "—" kèm lý do, không MOCK RESULT;
 * bảng chuyến bỏ cột máy chủ không trả; mã chuyến của máy chủ mở Chi tiết chuyến bản máy chủ vì chuyến cũng đọc máy chủ.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: {
    authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['monitoring', 'trips']), keycloak: { url: '', realm: '', clientId: '' },
  },
  usesBackend: (feature: string) => feature === 'monitoring' || feature === 'trips',
}))

vi.mock('@/features/auth/useCan', () => ({
  useCan: () => (permission: Permission) => can('companyManager', permission),
}))

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-05T03:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function renderDashboard() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/tong-quan']}>
          <DashboardPage />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

test('số của máy chủ theo kỳ 30 ngày; số không có nguồn là "—" kèm lý do, không MOCK RESULT', async () => {
  const backend = stubBackend({ 'GET /api/manager/dashboard': { body: envelope(serverDashboard()) } })
  renderDashboard()

  const trips = within(await screen.findByRole('group', { name: 'Chuyến hoàn thành' }))
  expect(trips.getByText('5')).toBeInTheDocument()
  expect(trips.getByText('/ 12 chuyến')).toBeInTheDocument()
  const fill = within(screen.getByRole('group', { name: 'Lấp đầy thể tích trung bình' }))
  expect(fill.getByText('—')).toBeInTheDocument()
  expect(fill.getByText('Chưa có chuyến nào được duyệt phương án')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Khối lượng đã giao' })).getByText('3.251')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Kiện giao không sự cố' })).getByText('87,5%')).toBeInTheDocument()
  expect(screen.queryByText('MOCK RESULT')).not.toBeInTheDocument()
  expect(backend.calls.map((call) => call.query)).toStrictEqual([{ from: '2026-10-07', to: '2026-11-05' }])

  // Đội xe của máy chủ có thêm Ngừng sử dụng
  const fleet = within(screen.getByRole('region', { name: 'Trạng thái đội xe' }))
  expect(fleet.getByText('Ngừng sử dụng')).toBeInTheDocument()
})

test('bảng chuyến chỉ có cột máy chủ trả, mã chuyến mở Chi tiết chuyến của máy chủ', async () => {
  stubBackend({ 'GET /api/manager/dashboard': { body: envelope(serverDashboard()) } })
  renderDashboard()

  const table = within(await screen.findByRole('table'))
  const headers = table.getAllByRole('columnheader').map((cell) => cell.textContent)
  expect(headers).toStrictEqual(['Chuyến', 'Ngày chạy', 'Xe', 'Trạng thái', 'Lấp đầy'])
  expect(table.getByRole('link', { name: /TRIP-20261104-01/ })).toHaveAttribute('href', '/chuyen/TRIP-20261104-01')
  // Tổng là số chuyến của cả kỳ, không phải số dòng máy chủ trả
  expect(screen.getByText('12 chuyến')).toBeInTheDocument()
})

test('máy chủ từ chối kỳ: nói đúng lý do', async () => {
  stubBackend({ 'GET /api/manager/dashboard': { status: 400, body: { success: false, code: 'INVALID_INPUT', message: 'Kỳ không hợp lệ' } } })
  renderDashboard()
  expect(await screen.findByText('Máy chủ chỉ đọc được kỳ tối đa 366 ngày. Chọn kỳ ngắn hơn.')).toBeInTheDocument()
})
