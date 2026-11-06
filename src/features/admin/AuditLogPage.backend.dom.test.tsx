import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { auditPage, serverAuditLog } from '@/test/audit-backend'
import { envelope, page, stubBackend, type FakeRoutes } from '@/test/fake-backend'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { AuditLogPage } from './AuditLogPage'

/**
 * Nhật ký khi `users` nối backend: bảng là bản ghi của máy chủ (một trang, tổng của máy chủ), hành động dịch theo mã, mã lạ hiện nguyên
 * mã, giá trị dài không hiện; bộ lọc trên URL thành tham số của máy chủ. Không còn màn "Máy chủ chưa có nhật ký".
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['users']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'users',
}))

const USERS = [
  { id: 7, email: 'dieuphoi@longbinh.vn', fullName: 'Phạm Minh Khôi', phoneNumber: null, userRoleType: 'DISPATCHER', status: 'ACTIVE', companyId: 1 },
]

const ROWS = [
  serverAuditLog(),
  serverAuditLog({
    id: 502, actionType: 'TRIP_UPDATED', oldValues: { tripName: 'Tuyến cũ', vehicleId: '3' }, newValues: { tripName: 'Tuyến mới', vehicleId: '4' },
  }),
  serverAuditLog({
    id: 503, actionType: 'ROUTE_OPTIMIZED', userId: null, userName: null, userRole: null, oldValues: null,
    newValues: { totalKm: 42.5, stops: [{ id: 1 }], summary: 'tuyến dài rất nhiều chữ' },
  }),
  serverAuditLog({ id: 504, actionType: 'WAREHOUSE_REOPENED', entityName: 'Warehouse', entityId: 'batch', oldValues: null, newValues: null }),
]

function routes(extra: FakeRoutes = {}): FakeRoutes {
  return {
    'GET /api/audit-logs': { body: auditPage(ROWS, { totalElements: 137 }) },
    'GET /api/users': { body: envelope(page(USERS)) },
    'GET /api/companies': { body: envelope({ content: [{ id: 1, companyName: 'Vận tải Long Bình' }] }) },
    ...extra,
  }
}

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

function renderLog(role: Role, search = '') {
  signedInAs(role)
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[`/nhat-ky${search}`]}>
            <AuditLogPage />
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

test('bảng là bản ghi của máy chủ: hành động dịch theo mã, mã lạ hiện nguyên mã, tổng là của máy chủ', async () => {
  const backend = stubBackend(routes())
  renderLog('companyAdmin')

  const table = within(await screen.findByRole('table'))
  expect(screen.getByText('137 sự kiện')).toBeInTheDocument()
  expect(table.getAllByRole('row')).toHaveLength(ROWS.length + 1)
  expect(table.getByText('Đổi trạng thái chuyến')).toBeInTheDocument()
  expect(table.getByText('Sửa chuyến')).toBeInTheDocument()
  expect(table.getByText('Tối ưu tuyến')).toBeInTheDocument()
  expect(table.getByText('WAREHOUSE_REOPENED')).toBeInTheDocument()
  // Trạng thái trước → sau dịch sang chữ; sửa chuyến chỉ nêu tên trường; giá trị dài và lồng nhau không hiện
  expect(table.getByText('Trước: Đã lập kế hoạch · Sau: Đang xếp hàng')).toBeInTheDocument()
  expect(table.getByText('Đã đổi: Tên chuyến và Xe')).toBeInTheDocument()
  expect(table.queryByText(/tuyến dài rất nhiều chữ/)).not.toBeInTheDocument()
  // Người làm: tên + vai trò của app; bản ghi không có người làm là của hệ thống
  expect(table.getAllByText('Phạm Minh Khôi').length).toBeGreaterThan(0)
  expect(table.getAllByText('Điều phối viên').length).toBeGreaterThan(0)
  expect(table.getByText('Hệ thống')).toBeInTheDocument()
  // Đối tượng là chữ, không liên kết (máy chủ chỉ trả mã số)
  expect(table.getAllByText('Chuyến').length).toBeGreaterThan(0)
  expect(table.queryByRole('link')).not.toBeInTheDocument()
  // Quản trị công ty: không cột Công ty; trang đầu, 50 dòng
  expect(table.getAllByRole('columnheader').map((cell) => cell.textContent)).not.toContain('Công ty')
  expect(backend.calls.find((call) => call.path === '/api/audit-logs')?.query).toStrictEqual({ page: '0', size: '50' })
  expect(screen.queryByText('Máy chủ chưa có nhật ký hoạt động')).not.toBeInTheDocument()
})

test('bộ lọc trên URL thành tham số của máy chủ; quản trị hệ thống lọc bản ghi nền tảng', async () => {
  const backend = stubBackend(routes())
  renderLog('systemAdmin', '?tu=2026-11-01&den=2026-11-05&nguoi-lam=7&hanh-dong=TRIP_CANCELLED&cong-ty=nen-tang&q=hu%E1%BB%B7&trang=3')

  const table = within(await screen.findByRole('table'))
  expect(backend.calls.filter((call) => call.path === '/api/audit-logs').map((call) => call.query)).toStrictEqual([{
    page: '2', size: '50', from: '2026-11-01', to: '2026-11-05', userId: '7', actionType: 'TRIP_CANCELLED', companyId: 'platform', q: 'huỷ',
  }])
  expect(table.getAllByRole('columnheader').map((cell) => cell.textContent)).toContain('Công ty')
  expect(table.getAllByText('Vận tải Long Bình').length).toBeGreaterThan(0)
})

test('máy chủ từ chối: nói lý do, có nút thử lại', async () => {
  stubBackend(routes({ 'GET /api/audit-logs': { status: 403, body: { success: false, code: 'FORBIDDEN', message: 'Không có quyền' } } }))
  renderLog('companyAdmin')
  expect(await screen.findByText('Không tải được nhật ký')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
})
