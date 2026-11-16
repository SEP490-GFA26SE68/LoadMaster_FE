import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { serverAuditLog } from '@/test/audit-backend'
import { envelope, stubBackend } from '@/test/fake-backend'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { PackageHistorySection } from './PackageHistorySection'
import { PackageLabelsPage } from './PackageLabelsPage'

/**
 * Kho kiện khi `packages` nối backend: nhãn theo chuyến là file PDF máy chủ dựng cho mọi kiện chuyến đang giữ; lịch sử kiện là nhật ký
 * của máy chủ về kiện đó, câu dịch như Nhật ký máy chủ.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['packages']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'packages',
}))

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
  // jsdom không có URL của Blob: trang xem trước file PDF qua một URL giả
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:nhan-chuyen') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
})

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

function renderAt(role: Role, path: string, ui: ReactNode) {
  signedInAs(role)
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

test('nhãn theo chuyến: trang xem trước PDF máy chủ dựng cho chuyến, có nút In nhãn và lối về chuyến', async () => {
  const backend = stubBackend({ 'GET /api/packages/export/labels/trip/TRIP-2026-0914': { text: '%PDF-chuyen' } })
  renderAt('dispatcher', '/kien-hang/nhan?chuyen=TRIP-2026-0914', <PackageLabelsPage />)

  expect(await screen.findByTitle('In nhãn QR')).toHaveAttribute('src', 'blob:nhan-chuyen')
  expect(screen.getByRole('button', { name: 'In nhãn' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Về chuyến TRIP-2026-0914' })).toHaveAttribute('href', '/chuyen/TRIP-2026-0914')
  expect(backend.calls.map((call) => `${call.method} ${call.path}`)).toEqual(['GET /api/packages/export/labels/trip/TRIP-2026-0914'])
})

test('chuyến chưa có kiện: trang nói rõ thay cho lỗi, không có nút In nhãn', async () => {
  stubBackend({
    'GET /api/packages/export/labels/trip/TRIP-RONG': { status: 409, body: { success: false, code: 'TRIP_HAS_NO_PACKAGES', message: 'Chuyến chưa có kiện' } },
  })
  renderAt('warehouse', '/kien-hang/nhan?chuyen=TRIP-RONG', <PackageLabelsPage />)

  expect(await screen.findByText('Chuyến chưa có kiện nào nên chưa có nhãn để in.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'In nhãn' })).not.toBeInTheDocument()
})

test('lịch sử kiện: việc mới nhất trước, chi tiết đọc được, người làm hoặc Hệ thống; kiện chưa có việc nào thì một câu', async () => {
  stubBackend({
    'GET /api/packages/5/history': { body: envelope([
      serverAuditLog({
        id: 41, actionType: 'PACKAGE_FOUND', entityName: 'CargoPackage', entityId: '5', userName: 'Lê Văn Kho', userRole: 'WAREHOUSE_WORKER',
        oldValues: null, newValues: { packageId: 5, packageCode: 'LB-0005', flag: 'NOT_FOUND' },
      }),
      serverAuditLog({
        id: 40, actionType: 'STAGING_SHORTAGE_RESOLVED', entityName: 'StagingShortage', entityId: '2', userId: null, userName: null, userRole: null,
        oldValues: null, newValues: { packageId: 5, tripId: 9, decision: 'DROP' },
      }),
    ]) },
    'GET /api/packages/6/history': { body: envelope([]) },
  })
  renderAt('dispatcher', '/kien-hang', <><PackageHistorySection titleId="kien-5" packageId="5" /><PackageHistorySection titleId="kien-6" packageId="6" /></>)

  const [withHistory] = await screen.findAllByRole('list', { name: 'Lịch sử' })
  const items = within(withHistory ?? document.body).getAllByRole('listitem')
  expect(items.map((item) => item.firstChild?.textContent)).toEqual(['Kho tìm thấy lại kiện', 'Điều phối quyết định kiện kho báo thiếu'])
  expect(within(items[0] ?? document.body).getByText('Kiện LB-0005')).toBeInTheDocument()
  expect(within(items[0] ?? document.body).getByText(/Lê Văn Kho/)).toBeInTheDocument()
  expect(within(items[1] ?? document.body).getByText('Bỏ kiện khỏi chuyến — chuyến chờ lập lại phương án')).toBeInTheDocument()
  expect(within(items[1] ?? document.body).getByText(/Hệ thống/)).toBeInTheDocument()
  expect(await screen.findByText('Chưa có việc nào được ghi với kiện này.')).toBeInTheDocument()
})
