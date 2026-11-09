import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend } from '@/test/fake-backend'
import { BackendOptimizationSetupRoute } from './BackendOptimizationSetupPage'

/**
 * Thiết lập tối ưu bản máy chủ mở từ "Chạy lại giữ ghim" của Planner (`?giu-ghim=<mã phương án>`): thẻ "Giữ kiện đã ghim" bật sẵn, lần chạy
 * ba phương án gửi `keepPinsFromPlanId`; tắt công tắc thì lần chạy là bình thường, không gửi gì.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const placement = (id: number, pinned: boolean) => ({
  id, packageId: 300 + id, packageCode: `PK-${300 + id}`, weightKg: '20', posX: '0', posY: '0', posZ: '0', packedLength: '100',
  packedWidth: '50', packedHeight: '40', rotationType: 1, stepSequence: id, stopId: 91, stopSequence: 1, pinned,
})

const PLAN = {
  id: 12, tripId: 42, jobUuid: 'job-1', objective: 'MAX_VOLUME', candidateLabel: 'A', algorithmName: 'EP_DBLF', computationMs: 800,
  volumeUtilization: '0.5', weightUtilization: null, approved: false, approvedByName: null, rehandlingCount: 0,
  placements: [placement(1, true), placement(2, true), placement(3, false)], unplaced: [],
}

let calls: ReturnType<typeof stubBackend>['calls']

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
  calls = stubBackend({
    'GET /api/trips/42/detail': { body: envelope({ trip: { id: 42, tripCode: 'TRIP-0042', status: 'PLANNED' }, stops: [{ id: 91, stopSequence: 1 }] }) },
    'GET /api/trips/42/load-plans': { body: envelope({ tripId: 42, approvedPlanId: null, plans: [PLAN] }) },
    'POST /api/trips/42/optimize-loading': { body: envelope({ jobId: 'job-2', tripId: 42, pinnedCount: 2 }) },
    'GET /api/trips/optimization-jobs/job-2': { body: envelope({ jobId: 'job-2', status: 'RUNNING', pinnedCount: 2 }) },
  }).calls
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderSetup(query: string) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <MemoryRouter initialEntries={[`/chuyen/42/toi-uu${query}`]}>
          <Routes><Route path="/chuyen/:tripId/toi-uu" element={<BackendOptimizationSetupRoute />} /></Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

const optimizeBodies = () => calls.filter((call) => call.method === 'POST' && call.path === '/api/trips/42/optimize-loading').map((call) => call.body)

test('giữ ghim bật sẵn: lần chạy gửi mã số phương án nguồn, hộp chạy nói số kiện máy chủ giữ', async () => {
  renderSetup('?giu-ghim=12')
  const toggle = await screen.findByRole('switch', { name: 'Giữ nguyên chỗ 2 kiện đã ghim' })
  expect(toggle).toBeChecked()

  await userEvent.click(screen.getByRole('button', { name: 'Chạy tối ưu' }))
  await waitFor(() => expect(optimizeBodies()).toEqual([{ keepPinsFromPlanId: 12 }]))
  expect(await screen.findByText('Giữ 2 kiện đã ghim')).toBeInTheDocument()
})

test('tắt giữ ghim: lần chạy bình thường, không gửi phương án nguồn', async () => {
  renderSetup('?giu-ghim=12')
  await userEvent.click(await screen.findByRole('switch', { name: 'Giữ nguyên chỗ 2 kiện đã ghim' }))
  expect(screen.getByText('Chạy bình thường: mọi kiện được xếp lại từ đầu.')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Chạy tối ưu' }))
  await waitFor(() => expect(optimizeBodies()).toEqual([undefined]))
})

test('không mở từ Planner thì không có thẻ giữ ghim', async () => {
  renderSetup('')
  expect(await screen.findByRole('button', { name: 'Chạy tối ưu' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Giữ kiện đã ghim' })).not.toBeInTheDocument()
})
