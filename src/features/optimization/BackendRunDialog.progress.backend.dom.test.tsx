import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend } from '@/test/fake-backend'
import { installMatchMedia, type MatchMediaControl } from '@/test/match-media'
import { BackendRunDialog } from './BackendRunDialog'
import { optimizationJobOf, type OptimizationJob, type OptimizationJobDto } from './load-plan-dto'
import { fetchOptimizationJob } from './load-plans-backend-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

/**
 * Hộp thoại chạy tối ưu máy chủ khi máy chủ báo tiến trình (`elapsedMs`, `progress`): đồng hồ so giới hạn và không lùi, các bước theo
 * `progress.stage` (bước cải thiện chỉ khi máy chủ báo), số sống đúng số máy chủ trả, hình theo phần kiện xếp được; máy chủ cũ không có
 * `progress` thì chỉ có bước mà trạng thái chứng minh; giá trị lạ bị bỏ; giảm chuyển động thì số đặt thẳng.
 */
const JOB: OptimizationJobDto = { jobId: 'job-1', status: 'RUNNING', timeLimitSec: 60, computationMs: null }

const INPUTS = { packageCount: 120, stopCount: 3, vehicleName: 'Xe tải 1,5 tấn · 51C-123.45' }

let media: MatchMediaControl | null = null

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  media?.restore()
  media = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function Shell({ children }: { children: ReactNode }) {
  return <I18nProvider><MemoryRouter>{children}</MemoryRouter></I18nProvider>
}

const dialog = (job: OptimizationJob | null) => (
  <Shell>
    <BackendRunDialog open onOpenChange={() => undefined} jobId="job-1" job={job} error={null} hasPlans={false} compareTo="/so-sanh" inputs={INPUTS} />
  </Shell>
)

/** Đọc job qua lớp API thật với `fetch` giả rồi đưa vào hộp thoại, như Thiết lập tối ưu. */
function FetchedDialog() {
  const job = useQuery({ queryKey: ['job'], queryFn: () => fetchOptimizationJob('job-1') })
  return <BackendRunDialog open onOpenChange={() => undefined} jobId="job-1" job={job.data ?? null} error={null} hasPlans={false} compareTo="/so-sanh" inputs={INPUTS} />
}

const steps = () => [...document.querySelectorAll<HTMLElement>('[data-server-step]')].map((item) => `${item.dataset.serverStep}:${item.dataset.state}`)

test('tiến trình đủ: bước, ghi chú, thuật toán, số sống, đầu vào; một vùng status chỉ nói bước', async () => {
  stubBackend({
    'GET /api/trips/optimization-jobs/job-1': { body: envelope({
      ...JOB,
      elapsedMs: 12_000,
      progress: { stage: 'IMPROVING', algorithm: 'GA', layoutsTried: 42, totalPackages: 120, bestPlacedCount: 118, bestVolumePercent: '81.5', updatedAt: '2026-11-27T01:00:00Z' },
    }) },
  })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Shell><FetchedDialog /></Shell>
    </QueryClientProvider>,
  )
  await screen.findByText('118 / 120 kiện')
  expect(steps()).toEqual(['queue:done', 'build:done', 'improve:current', 'select:pending', 'save:pending'])
  expect(screen.getByText('Đang tìm cách xếp được nhiều hàng hơn, cân hơn từ các cách đã có.')).toBeInTheDocument()
  const status = screen.getAllByRole('status')
  expect(status).toHaveLength(1)
  expect(status[0]).toHaveTextContent(/— Tìm cách xếp tốt hơn$/)
  const live = document.querySelector<HTMLElement>('[data-run-live]')!
  expect(within(live).getByText('42')).toBeInTheDocument()
  expect(within(live).getByText('81,5%')).toBeInTheDocument()
  expect(within(live).getByText('GA — giải thuật di truyền (giải mã bằng EP + DBLF)')).toBeInTheDocument()
  expect(document.querySelector('[data-run-elapsed]')).toHaveTextContent('00:12')
  expect(screen.getByText('Giới hạn 01:00')).toBeInTheDocument()
  expect(document.querySelector<HTMLElement>('[data-run-time-bar]')!.style.width).toBe('20%')
  const inputs = document.querySelector<HTMLElement>('[data-run-inputs]')!
  expect(within(inputs).getByText('120')).toBeInTheDocument()
  expect(within(inputs).getByText('Xe tải 1,5 tấn · 51C-123.45')).toBeInTheDocument()
  // Hình theo phần kiện xếp được: không còn dải chạy vòng
  expect(document.querySelector('[data-run-figure]')).toHaveAttribute('data-run-figure', 'determinate')
})

test('máy chủ cũ không có progress, elapsedMs: chỉ bước trạng thái chứng minh, không số sống, đồng hồ đếm từ lúc thấy job chạy', () => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  const { rerender } = render(dialog(optimizationJobOf({ ...JOB, status: 'PENDING' })))
  expect(steps()).toEqual(['queue:current', 'compute:pending'])
  expect(document.querySelector('[data-run-clock]')).toBeNull()
  act(() => { vi.advanceTimersByTime(5000) })
  rerender(dialog(optimizationJobOf(JOB)))
  expect(steps()).toEqual(['queue:done', 'compute:current'])
  expect(document.querySelector('[data-run-live]')).toBeNull()
  expect(document.querySelector('[data-run-elapsed]')).toHaveTextContent('00:00')
  act(() => { vi.advanceTimersByTime(3000) })
  expect(document.querySelector('[data-run-elapsed]')).toHaveTextContent('00:03')
  expect(screen.getByRole('status')).not.toHaveTextContent('—')
})

test('đồng hồ neo theo elapsedMs, chạy tiếp ở trình duyệt, không lùi; quá giới hạn thì đang hoàn tất', () => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
  const { rerender } = render(dialog(optimizationJobOf({ ...JOB, elapsedMs: 4000 })))
  expect(document.querySelector('[data-run-elapsed]')).toHaveTextContent('00:04')
  act(() => { vi.advanceTimersByTime(2000) })
  expect(document.querySelector('[data-run-elapsed]')).toHaveTextContent('00:06')
  rerender(dialog(optimizationJobOf({ ...JOB, elapsedMs: 5000 })))
  expect(document.querySelector('[data-run-elapsed]')).toHaveTextContent('00:06')
  rerender(dialog(optimizationJobOf({ ...JOB, elapsedMs: 61_000 })))
  expect(document.querySelector('[data-run-elapsed]')).toHaveTextContent('01:01')
  expect(document.querySelector<HTMLElement>('[data-run-time-bar]')!.style.width).toBe('100%')
  expect(document.querySelector('[data-run-finishing]')).toHaveTextContent('Đã tới giới hạn thời gian')
})

test('giá trị lạ bị bỏ: bước lạ coi như không có, thuật toán lạ không có dòng, số âm không vẽ', () => {
  render(dialog(optimizationJobOf({
    ...JOB, elapsedMs: -3,
    progress: { stage: 'WARMING_UP', algorithm: 'QUANTUM', layoutsTried: -1, totalPackages: 120, bestPlacedCount: 500, bestVolumePercent: 140 },
  })))
  expect(steps()).toEqual(['queue:done', 'compute:current'])
  expect(screen.queryByText('Thuật toán đang chạy')).not.toBeInTheDocument()
  expect(screen.queryByText(/QUANTUM|WARMING_UP/)).not.toBeInTheDocument()
  expect(screen.queryByText('Xếp được nhiều nhất')).not.toBeInTheDocument()
  expect(screen.queryByText('Lấp đầy cao nhất')).not.toBeInTheDocument()
  expect(document.querySelector('[data-run-elapsed]')).toHaveTextContent('00:00')
})

test('giảm chuyển động: số sống đặt thẳng giá trị mới, không đếm', () => {
  media = installMatchMedia({ '(prefers-reduced-motion: reduce)': true })
  const progress = (placed: number) => ({ stage: 'BUILDING', layoutsTried: placed, totalPackages: 120, bestPlacedCount: placed, bestVolumePercent: 40 })
  const { rerender } = render(dialog(optimizationJobOf({ ...JOB, progress: progress(10) })))
  expect(screen.getByText('10 / 120 kiện')).toBeInTheDocument()
  expect(steps()).toEqual(['queue:done', 'build:current', 'select:pending', 'save:pending'])
  rerender(dialog(optimizationJobOf({ ...JOB, progress: progress(97) })))
  expect(screen.getByText('97 / 120 kiện')).toBeInTheDocument()
})

test('đã xong: không còn bước, đồng hồ hay số sống; thời gian tính viết bằng giây', () => {
  render(dialog(optimizationJobOf({ ...JOB, status: 'COMPLETED', computationMs: 60_000, packedPlanCount: 3, elapsedMs: 60_000,
    progress: { stage: 'SAVING', totalPackages: 120, bestPlacedCount: 120 } })))
  expect(document.querySelector('[data-server-step]')).toBeNull()
  expect(document.querySelector('[data-run-clock]')).toBeNull()
  expect(document.querySelector('[data-run-live]')).toBeNull()
  expect(document.querySelector('[data-run-computation]')).toHaveTextContent('60,0 giây')
})
