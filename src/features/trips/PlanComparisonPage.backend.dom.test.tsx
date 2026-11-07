import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend } from '@/test/fake-backend'
import { PlanComparisonPage } from './PlanComparisonPage'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

/**
 * So sánh phương án khi chuyến nối backend: ba thẻ A · B · C của một lần chạy với đúng chỉ số máy chủ trả, "Tốt nhất" trung tính,
 * không MOCK RESULT, không nút chính — mỗi thẻ mở Planner.
 */
const plan = (id: number, label: string, objective: string, volume: string, rehandling: number | null, placements: readonly object[] = []) => ({
  id, tripId: 42, jobUuid: 'job-1', objective, candidateLabel: label, algorithmName: 'EP_DBLF', computationMs: null,
  volumeUtilization: volume, weightUtilization: null, approved: id === 3, approvedByName: id === 3 ? 'Trần Bình' : null,
  rehandlingCount: rehandling, placements, unplaced: [],
})

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('ba phương án của lần chạy, giá trị tốt nhất đánh dấu trung tính, không MOCK RESULT', async () => {
  stubBackend({
    'GET /api/trips/optimization-jobs/job-1/plans': { body: envelope([
      plan(3, 'C', 'MIN_REHANDLING', '0.5', 0), plan(1, 'A', 'MAX_VOLUME', '0.8', 4), plan(2, 'B', 'AXLE_BALANCE', '0.6', null),
    ]) },
  })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/chuyen/TRIP-42/so-sanh?lan-chay=job-1']}>
          <Routes><Route path="/chuyen/:tripId/so-sanh" element={<PlanComparisonPage />} /></Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
  const headings = await screen.findAllByRole('heading', { level: 2 })
  expect(headings.map((heading) => heading.textContent)).toEqual(['Phương án A', 'Phương án B', 'Phương án CĐã duyệt'])
  expect(screen.queryByText('MOCK RESULT')).not.toBeInTheDocument()
  expect(screen.queryByText(/kiện đã ghim/)).not.toBeInTheDocument()
  // Thể tích: A tốt nhất. Dỡ-xếp lại: B không có số nên không đánh dấu ai
  expect(screen.getAllByText('Tốt nhất')).toHaveLength(1)
  const volumeA = within(headings[0]!.closest('div')!).getByText('Tốt nhất')
  expect(volumeA).toBeInTheDocument()
  const links = screen.getAllByRole('link', { name: 'Mở trong Planner' })
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    '/chuyen/TRIP-42/phuong-an?revision=1', '/chuyen/TRIP-42/phuong-an?revision=2', '/chuyen/TRIP-42/phuong-an?revision=3',
  ])
})

test('lần chạy giữ ghim nói số kiện giữ nguyên chỗ, một lần cho cả lần chạy', async () => {
  const pinnedBox = { id: 7, packageId: 70, packageCode: 'KT-A-001', posX: '0', posY: '0', posZ: '0', packedLength: '600', packedWidth: '400', packedHeight: '300', pinned: true }
  const loose = { ...pinnedBox, id: 8, packageId: 71, packageCode: 'KT-A-002', posX: '600', pinned: false }
  stubBackend({
    'GET /api/trips/optimization-jobs/job-1/plans': { body: envelope([
      plan(1, 'A', 'MAX_VOLUME', '0.8', 0, [pinnedBox, loose]), plan(2, 'B', 'AXLE_BALANCE', '0.6', 0, [pinnedBox, loose]),
    ]) },
  })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/chuyen/TRIP-42/so-sanh?lan-chay=job-1']}>
          <Routes><Route path="/chuyen/:tripId/so-sanh" element={<PlanComparisonPage />} /></Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
  expect(await screen.findByText('Lần chạy này giữ nguyên chỗ 1 kiện đã ghim.')).toBeInTheDocument()
  expect(screen.getAllByText(/kiện đã ghim/)).toHaveLength(1)
})
