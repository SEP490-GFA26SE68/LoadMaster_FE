import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { getMockDb, tripStatus } from '@/lib/mock-db'
import { envelope, stubBackend } from '@/test/fake-backend'
import { useBackendTripDetailQuery, useTripDetailQuery } from './useTripsQuery'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: () => false,
}))

/**
 * Chi tiết chuyến (kho mẫu và máy chủ) đọc lại mỗi 30 giây và khi cửa sổ được focus lại **chỉ khi** chuyến Đang xếp hàng hoặc Đang
 * vận chuyển — kho và tài xế ghi tiến độ ở thiết bị khác. Chuyến ở trạng thái khác không có nhịp nào. Chỉ giả `setInterval` (nhịp
 * của TanStack Query); độ trễ của kho mẫu vẫn chạy thật.
 */
let client: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  // Như app: mặc định không đọc lại khi focus — truy vấn chi tiết chuyến tự bật
  client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  client.clear()
  focusManager.setFocused(undefined)
})

/** Chờ tới khi điều kiện đúng bằng setTimeout thật — `waitFor` của Testing Library thăm dò bằng setInterval, mà nhịp đó đang bị giả. */
async function until(check: () => void) {
  for (let attempt = 0; ; attempt++) {
    try {
      check()
      return
    } catch (error) {
      if (attempt > 300) throw error
      await act(() => new Promise((resolve) => setTimeout(resolve, 10)))
    }
  }
}

async function tripIn(status: 'IN_TRANSIT' | 'DELIVERED') {
  const db = getMockDb()
  const trips = await db.listTrips()
  const trip = trips.find((item) => tripStatus(item) === status)
  if (!trip) throw new Error(`Seed không có chuyến ${status}`)
  return trip.id
}

test('chuyến kho mẫu đang vận chuyển: đọc lại sau 30 giây và khi focus lại; chuyến đã giao thì không', async () => {
  const live = await tripIn('IN_TRANSIT')
  const done = await tripIn('DELIVERED')
  const getTrip = vi.spyOn(getMockDb(), 'getTrip')
  const reads = (id: string) => getTrip.mock.calls.filter(([tripId]) => tripId === id).length
  const fetching = (id: string) => client.getQueryState(['trips', id, 'detail'])?.fetchStatus === 'fetching'

  const liveHook = renderHook(() => useTripDetailQuery(live), { wrapper })
  const doneHook = renderHook(() => useTripDetailQuery(done), { wrapper })
  await until(() => expect(liveHook.result.current.data?.status).toBe('IN_TRANSIT'))
  await until(() => expect(doneHook.result.current.data?.status).toBe('DELIVERED'))
  expect(reads(live)).toBe(1)
  expect(reads(done)).toBe(1)

  await act(() => vi.advanceTimersByTimeAsync(29_000))
  expect(reads(live)).toBe(1)
  await act(() => vi.advanceTimersByTimeAsync(1_000))
  await until(() => expect(reads(live)).toBe(2))
  // Lượt đọc đang chạy thì lượt focus dùng chung nó — chờ xong đã
  await until(() => expect(fetching(live)).toBe(false))

  act(() => {
    focusManager.setFocused(false)
    focusManager.setFocused(true)
  })
  await until(() => expect(reads(live)).toBe(3))
  await until(() => expect(fetching(live) || fetching(done)).toBe(false))

  // Chuyến đã giao không có nhịp nào: chỉ lượt mở và lượt focus
  const doneReads = reads(done)
  await act(() => vi.advanceTimersByTimeAsync(30_000))
  await until(() => expect(reads(live)).toBe(4))
  await until(() => expect(fetching(live)).toBe(false))
  await act(() => vi.advanceTimersByTimeAsync(30_000))
  await until(() => expect(reads(live)).toBe(5))
  expect(reads(done)).toBe(doneReads)
})

test('chuyến máy chủ: nhịp 30 giây khi Đang xếp hàng, dừng khi máy chủ báo chuyến đã sang trạng thái khác', async () => {
  let status = 'LOADING'
  const { calls } = stubBackend({
    'GET /api/trips/42/detail': () => ({ body: envelope({ trip: { id: 42, tripCode: 'TRIP-42', status }, stops: [] }) }),
  })
  const reads = () => calls.filter((call) => call.path === '/api/trips/42/detail').length
  const { result } = renderHook(() => useBackendTripDetailQuery('42'), { wrapper })
  await until(() => expect(result.current.data?.trip.status).toBe('LOADING'))
  expect(reads()).toBe(1)

  status = 'DELIVERED'
  await act(() => vi.advanceTimersByTimeAsync(30_000))
  await until(() => expect(result.current.data?.trip.status).toBe('DELIVERED'))
  expect(reads()).toBe(2)

  await act(() => vi.advanceTimersByTimeAsync(90_000))
  expect(reads()).toBe(2)
})
