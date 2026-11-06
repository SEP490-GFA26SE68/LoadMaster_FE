import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PlanComparisonPage } from '@/features/trips/PlanComparisonPage'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend } from '@/test/fake-backend'
import { BackendLoadPlansCard } from './BackendLoadPlansCard'
import { BackendOptimizationSetupRoute } from './BackendOptimizationSetupPage'

/**
 * Thuật toán thật của từng phương án khi nhóm `trips` nối backend: màn So sánh có thẻ lần chạy "Thuật toán của gói" (hạng của job) và mỗi
 * thẻ phương án một dòng "Thuật toán tạo phương án"; bảng lần chạy và hộp chạy của Thiết lập tối ưu cũng ghi; Chi tiết chuyến (thẻ không
 * bật `showAlgorithms`) không ghi. Mã lạ hiện nguyên mã; không có chữ "(mock)".
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }))

const plan = (id: number, label: string | null, objective: string, algorithmName: string, runAlgorithm: string | null) => ({
  id, tripId: 42, jobUuid: 'job-1', objective, candidateLabel: label, algorithmName, runAlgorithm, computationMs: null,
  volumeUtilization: '0.5', weightUtilization: null, approved: false, approvedByName: null, rehandlingCount: 0, placements: [], unplaced: [],
})

const RUN = [
  plan(1, 'A', 'MAX_VOLUME', 'GA', 'EP_DBLF_GA_AI'),
  plan(2, 'B', 'AXLE_BALANCE', 'LUMO_R2', 'EP_DBLF_GA_AI'),
  plan(3, 'C', 'MIN_REHANDLING', 'NEW_ENGINE_X', 'EP_DBLF_GA_AI'),
]

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderAt(path: string, route: string, element: ReactNode) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes><Route path={route} element={element} /></Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

const cardOf = (heading: HTMLElement) => heading.closest('header')!.parentElement!

test('So sánh: thẻ lần chạy ghi hạng của gói, mỗi thẻ ghi thuật toán đã tạo ra phương án, mã lạ giữ nguyên', async () => {
  stubBackend({ 'GET /api/trips/optimization-jobs/job-1/plans': { body: envelope(RUN) } })
  renderAt('/chuyen/TRIP-42/so-sanh?lan-chay=job-1', '/chuyen/:tripId/so-sanh', <PlanComparisonPage />)

  const headings = await screen.findAllByRole('heading', { level: 2 })
  const runCard = document.querySelector<HTMLElement>('[data-run-card]')!
  expect(within(runCard).getByText('Thuật toán của gói')).toBeInTheDocument()
  expect(within(runCard).getByText('EP + DBLF + GA/SA + AI (Lumo-R1, R1.1, R2)')).toBeInTheDocument()
  const rowOf = (index: number) => within(cardOf(headings[index]!)).getByText('Thuật toán tạo phương án').nextElementSibling?.textContent
  expect(rowOf(0)).toBe('GA — giải thuật di truyền (giải mã bằng EP + DBLF)')
  expect(rowOf(1)).toBe('AI · Lumo-R2 (bản thử nghiệm)')
  expect(rowOf(2)).toBe('NEW_ENGINE_X')
  expect(screen.queryByText(/\(mock\)/)).not.toBeInTheDocument()
})

test('So sánh: phương án cũ không có thuật toán riêng đọc theo hạng của lần chạy; máy chủ cũ không trả hạng thì không có thẻ lần chạy', async () => {
  stubBackend({ 'GET /api/trips/optimization-jobs/job-1/plans': { body: envelope([
    plan(1, 'A', 'MAX_VOLUME', 'EP_DBLF_GA', null), plan(2, 'B', 'AXLE_BALANCE', 'EP_LUMO_R1_1', null),
  ]) } })
  renderAt('/chuyen/TRIP-42/so-sanh?lan-chay=job-1', '/chuyen/:tripId/so-sanh', <PlanComparisonPage />)

  const headings = await screen.findAllByRole('heading', { level: 2 })
  expect(document.querySelector('[data-run-card]')).toBeNull()
  expect(within(cardOf(headings[0]!)).getByText('EP + DBLF + GA/SA')).toBeInTheDocument()
  expect(within(cardOf(headings[1]!)).getByText('EP + DBLF, Lumo-R1.1 chấm điểm chỗ đặt')).toBeInTheDocument()
})

test('bảng lần chạy: Thiết lập tối ưu ghi thuật toán, Chi tiết chuyến thì không', async () => {
  stubBackend({ 'GET /api/trips/42/load-plans': { body: envelope({ tripId: 42, approvedPlanId: null, plans: RUN }) } })
  renderAt('/x', '/x', <><BackendLoadPlansCard tripId="42" tripCode="TRIP-42" showAlgorithms /><div data-detail><BackendLoadPlansCard tripId="42" tripCode="TRIP-42" /></div></>)

  expect(await screen.findByText('Thuật toán của gói: EP + DBLF + GA/SA + AI (Lumo-R1, R1.1, R2)')).toBeInTheDocument()
  const rows = [...document.querySelectorAll('[data-plan-algorithm]')].map((node) => node.textContent)
  expect(rows).toEqual([
    'Thuật toán tạo phương án: GA — giải thuật di truyền (giải mã bằng EP + DBLF)',
    'Thuật toán tạo phương án: AI · Lumo-R2 (bản thử nghiệm)',
    'Thuật toán tạo phương án: NEW_ENGINE_X',
  ])
  const detail = document.querySelector<HTMLElement>('[data-detail]')!
  expect(detail.querySelector('[data-run-algorithm], [data-plan-algorithm]')).toBeNull()
})

test('hộp chạy của Thiết lập tối ưu ghi hạng của gói máy chủ báo cho job', async () => {
  stubBackend({
    'GET /api/trips/42/detail': { body: envelope({ trip: { id: 42, tripCode: 'TRIP-0042', status: 'PLANNED' }, stops: [{ id: 91, stopSequence: 1 }] }) },
    'GET /api/trips/42/load-plans': { body: envelope({ tripId: 42, approvedPlanId: null, plans: [] }) },
    'POST /api/trips/42/optimize-loading': { body: envelope({ jobId: 'job-2', tripId: 42 }) },
    'GET /api/trips/optimization-jobs/job-2': { body: envelope({ jobId: 'job-2', status: 'RUNNING', runAlgorithm: 'EP_DBLF_GA' }) },
  })
  renderAt('/chuyen/42/toi-uu', '/chuyen/:tripId/toi-uu', <BackendOptimizationSetupRoute />)

  await userEvent.click(await screen.findByRole('button', { name: 'Chạy tối ưu' }))
  const dialog = await screen.findByRole('dialog')
  expect(await within(dialog).findByText('EP + DBLF + GA/SA')).toBeInTheDocument()
  expect(within(dialog).getByText('Thuật toán của gói')).toBeInTheDocument()
})
