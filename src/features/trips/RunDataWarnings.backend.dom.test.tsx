import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { BackendRunDialog } from '@/features/optimization/BackendRunDialog'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend } from '@/test/fake-backend'
import { signedInAs } from '@/test/signed-in'

import { PlanComparisonPage } from './PlanComparisonPage'

/**
 * Cảnh báo dữ liệu của lần chạy tối ưu máy chủ (`dataWarnings` của job): banner cảnh báo không chặn ở So sánh `?lan-chay=` — số kiện,
 * mã kiện khi phương án cho biết, lối sửa theo quyền — và ở hộp thoại chạy của Thiết lập tối ưu (chỉ số kiện). Mã lạ không bao giờ hiện.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

const box = (id: number, packageId: number, packageCode: string | null) => ({
  id, packageId, packageCode, posX: String(id * 100), posY: '0', posZ: '0', packedLength: '60', packedWidth: '40', packedHeight: '40', pinned: false,
})
const plan = (id: number, label: string, objective: string) => ({
  id, tripId: 42, jobUuid: 'job-1', objective, candidateLabel: label, algorithmName: 'EP_DBLF', computationMs: null, volumeUtilization: '0.5',
  weightUtilization: null, approved: false, approvedByName: null, rehandlingCount: 0,
  placements: [box(1, 70, 'KT-A-001'), box(2, 71, 'KT-A-002'), box(3, 72, null)], unplaced: [],
})
const WARNINGS = [
  { code: 'TOP_LOAD_CAPACITY_MISSING', packageIds: ['70', '71', '72'] },
  { code: 'PACKAGE_TYPE_MISSING', packageIds: ['72'] },
  { code: 'FUTURE_SERVER_WARNING', packageIds: ['70'] },
]

beforeEach(() => connectApiAuth(() => Promise.resolve('token-1')))
afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

function renderComparison() {
  render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter initialEntries={['/chuyen/TRIP-42/so-sanh?lan-chay=job-1']}>
            <Routes><Route path="/chuyen/:tripId/so-sanh" element={<PlanComparisonPage />} /></Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
}

test('So sánh: một banner cho cả lần chạy, mã kiện đổi từ mã số, lối sửa theo quyền của điều phối viên', async () => {
  signedInAs('dispatcher')
  stubBackend({
    'GET /api/trips/optimization-jobs/job-1/plans': { body: envelope([plan(1, 'A', 'MAX_VOLUME'), plan(2, 'B', 'AXLE_BALANCE')]) },
    'GET /api/trips/optimization-jobs/job-1': { body: envelope({ jobId: 'job-1', status: 'COMPLETED', dataWarnings: WARNINGS }) },
  })
  renderComparison()

  expect(await screen.findByText('Dữ liệu kiện còn thiếu')).toBeInTheDocument()
  expect(screen.getByText(/^3 kiện chưa có sức chịu nén mặt trên/)).toBeInTheDocument()
  expect(screen.getByText('Kiện: KT-A-001, KT-A-002 và 1 kiện khác')).toBeInTheDocument()
  expect(screen.getByText('1 kiện chưa gắn loại kiện nên không được xoay khi xếp.')).toBeInTheDocument()
  expect(screen.queryByText(/FUTURE_SERVER_WARNING|PACKAGE_TYPE_MISSING|TOP_LOAD_CAPACITY_MISSING/)).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Mở Kho kiện' })).toHaveAttribute('href', '/kien-hang')
  expect(screen.queryByRole('link', { name: 'Mở Loại kiện' })).not.toBeInTheDocument()
})

test('So sánh: nhân viên kho có thêm lối tới Loại kiện', async () => {
  signedInAs('warehouse')
  stubBackend({
    'GET /api/trips/optimization-jobs/job-1/plans': { body: envelope([plan(1, 'A', 'MAX_VOLUME')]) },
    'GET /api/trips/optimization-jobs/job-1': { body: envelope({ jobId: 'job-1', status: 'COMPLETED', dataWarnings: WARNINGS }) },
  })
  renderComparison()
  expect(await screen.findByRole('link', { name: 'Mở Loại kiện' })).toHaveAttribute('href', '/loai-kien')
})

test('So sánh: job không đọc được thì bỏ qua cảnh báo', async () => {
  signedInAs('dispatcher')
  stubBackend({ 'GET /api/trips/optimization-jobs/job-1/plans': { body: envelope([plan(1, 'A', 'MAX_VOLUME')]) } })
  renderComparison()
  expect(await screen.findByRole('heading', { level: 2, name: 'Phương án A' })).toBeInTheDocument()
  expect(screen.queryByText('Dữ liệu kiện còn thiếu')).not.toBeInTheDocument()
})

test('hộp thoại chạy: cảnh báo hiện ngay khi job trả, chỉ có số kiện', () => {
  render(
    <I18nProvider>
      <MemoryRouter>
        <BackendRunDialog
          open
          onOpenChange={() => undefined}
          jobId="job-1"
          job={{
            jobId: 'job-1', status: 'RUNNING', finished: false, packedPlanCount: null, pinnedCount: null, computationMs: null, createdAt: null,
            runAlgorithm: null, dataWarnings: [{ code: 'TOP_LOAD_CAPACITY_MISSING', packageIds: ['70', '71'] }],
          }}
          error={null}
          hasPlans={false}
          compareTo="/so-sanh"
        />
      </MemoryRouter>
    </I18nProvider>,
  )
  expect(screen.getByText(/^2 kiện chưa có sức chịu nén mặt trên/)).toBeInTheDocument()
  expect(screen.queryByText(/^Kiện:/)).not.toBeInTheDocument()
})
