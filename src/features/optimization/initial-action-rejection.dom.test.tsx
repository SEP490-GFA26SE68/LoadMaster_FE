import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ApiError } from '@/lib/api-client'
import { useInitialOptimizationAction } from './useInitialOptimizationAction'
import { restoreOptimizationAction, saveOptimizationAction } from './initial-optimization-action'
vi.mock('./optimization-api', () => ({ createBackendOptimizationJob: vi.fn() }))
vi.mock('@/lib/backend-config', () => ({ backendConfig: { apiUrl: 'http://fixture.test' } }))
import { createBackendOptimizationJob } from './optimization-api'
const scope = { userId: 'user-a', companyId: 'company-a', tripId: '7' }
const jobId = '41858661-1c23-372e-9329-e09660e2648b'
function mount() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return renderHook(() => useInitialOptimizationAction(scope), { wrapper: ({ children }: { children: ReactNode }) =>
    <QueryClientProvider client={client}>{children}</QueryClientProvider> })
}
beforeEach(() => { sessionStorage.clear(); vi.resetAllMocks() })
test('typed rejection retains reserved job/key; retry only polls known job', async () => {
  vi.mocked(createBackendOptimizationJob).mockRejectedValue(new ApiError('PACKING_PROFILE_ORIENTATION_INVALID', {
    status: 400, params: { job_id: jobId, trip_id: 7 },
  }))
  const hook = mount()
  act(() => hook.result.current.handleStartNew(null))
  await waitFor(() => expect(hook.result.current.action?.jobId).toBe(jobId))
  const key = hook.result.current.action?.key
  expect(hook.result.current.notice).toBe('rejected')
  act(() => hook.result.current.handleRetry())
  expect(createBackendOptimizationJob).toHaveBeenCalledTimes(1)
  expect(restoreOptimizationAction(scope)?.key).toBe(key)
  expect(restoreOptimizationAction({ ...scope, companyId: 'company-b' })).toBeNull()
  hook.unmount()
  expect(mount().result.current.action?.jobId).toBe(jobId)
})
test.each([{ job_id: jobId, trip_id: 8 }, { job_id: 'bad', trip_id: 7 }])('untrusted error reference stays uncertain: %j', async params => {
  vi.mocked(createBackendOptimizationJob).mockRejectedValue(new ApiError('PACKING_PROFILE_ORIENTATION_INVALID', { status: 400, params }))
  const hook = mount(); act(() => hook.result.current.handleStartNew(null))
  await waitFor(() => expect(hook.result.current.notice).toBe('uncertain'))
  expect(hook.result.current.action?.jobId).toBeUndefined()
})

vi.mock('@/features/auth/AuthProvider', () => ({ useCurrentUser: () => ({ id: 'user-a', companyId: 'company-a' }) }))
vi.mock('./backend-optimization-api', () => ({ fetchBackendOptimizationJob: vi.fn(), fetchBackendLoadPlans: vi.fn() }))
import { fetchBackendOptimizationJob } from './backend-optimization-api'
import { BackendInitialActionPanel } from './BackendInitialActionPanel'
import { I18nProvider } from '@/lib/i18n'

test.each(['REFUND_PENDING', 'REFUNDED'] as const)('restored terminal job displays authoritative %s and only GETs', async creditStatus => {
  saveOptimizationAction(scope, { key: crypto.randomUUID(), request: { tripId: '7' }, jobId })
  vi.mocked(fetchBackendOptimizationJob).mockResolvedValue({ jobId, status: 'FAILED', creditStatus })
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <I18nProvider><BackendInitialActionPanel tripId="7" /></I18nProvider>
  </QueryClientProvider>)
  const expected = creditStatus === 'REFUND_PENDING' ? 'Đang xử lý hoàn Credit.' : 'Đã hoàn Credit theo giao dịch gốc.'
  expect(await screen.findByText(expected)).toBeInTheDocument()
  expect(fetchBackendOptimizationJob).toHaveBeenCalledWith(jobId)
  expect(createBackendOptimizationJob).not.toHaveBeenCalled()
})

test('FAILED without settlement evidence never claims refunded', async () => {
  saveOptimizationAction(scope, { key: crypto.randomUUID(), request: { tripId: '7' }, jobId })
  vi.mocked(fetchBackendOptimizationJob).mockResolvedValue({ jobId, status: 'FAILED' })
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <I18nProvider><BackendInitialActionPanel tripId="7" /></I18nProvider>
  </QueryClientProvider>)
  await waitFor(() => expect(fetchBackendOptimizationJob).toHaveBeenCalled())
  expect(screen.queryByText('Đã hoàn Credit theo giao dịch gốc.')).not.toBeInTheDocument()
  expect(createBackendOptimizationJob).not.toHaveBeenCalled()
})
