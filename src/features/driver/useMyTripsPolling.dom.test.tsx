import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ReactNode } from 'react'
import { fetchMyTrips } from './driver-api'
import { myTripsOf } from './driver-dto'
import { useMyTripsQuery } from './useDriverQueries'
const controls = vi.hoisted(() => ({ backend: true }))
vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'driver-fixture' } }) }))
vi.mock('./driver-api', async importOriginal => {
  const actual = await importOriginal<typeof import('./driver-api')>()
  return { ...actual, fetchMyTrips: vi.fn(), DRIVER_CAPABILITIES: { ...actual.DRIVER_CAPABILITIES, get backend() { return controls.backend } } }
})
const preparing = () => myTripsOf([{ tripId: 10, tripCode: 'FIXTURE', vehicleLicensePlate: 'STEP6', stopCount: 1, departureTime: null, status: 'LOADING', loadingCompleted: false }])
const ready = () => myTripsOf([{ tripId: 10, tripCode: 'FIXTURE', vehicleLicensePlate: 'STEP6', stopCount: 1, departureTime: null, status: 'LOADING', loadingCompleted: true }])
const fetch = vi.mocked(fetchMyTrips)
beforeEach(() => { vi.useFakeTimers(); controls.backend = true; fetch.mockReset(); focusManager.setFocused(true) })
afterEach(() => { focusManager.setFocused(undefined); vi.useRealTimers() })
async function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const hook = renderHook(() => { const query = useMyTripsQuery(); void query.data; void query.isError; return query }, { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> })
  await act(async () => { await vi.advanceTimersByTimeAsync(50) })
  return { ...hook, client }
}
test('preparing polls GET and stops after server confirms loading complete', async () => {
  fetch.mockResolvedValueOnce(preparing()).mockResolvedValue(ready())
  const h = await open()
  expect(h.result.current.data?.preparing).toHaveLength(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(h.result.current.data?.loaded).toHaveLength(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(fetch).toHaveBeenCalledTimes(2)
  h.client.clear()
})
test('without preparing trips there is no polling', async () => {
  fetch.mockResolvedValue(ready())
  const h = await open()
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(fetch).toHaveBeenCalledTimes(1)
  h.client.clear()
})
test('mock mode does not poll', async () => {
  controls.backend = false
  fetch.mockResolvedValue(preparing())
  const h = await open()
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(fetch).toHaveBeenCalledTimes(1)
  h.client.clear()
})
test('background tab does not poll', async () => {
  fetch.mockResolvedValue(preparing())
  const h = await open()
  focusManager.setFocused(false)
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(fetch).toHaveBeenCalledTimes(1)
  h.client.clear()
})
test('query errors stop interval retries', async () => {
  fetch.mockRejectedValue(new Error('fixture read failed'))
  const h = await open()
  expect(h.result.current.isError).toBe(true)
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(fetch).toHaveBeenCalledTimes(1)
  h.client.clear()
})
test('polling stops after twenty minutes; explicit refresh still reads from server', async () => {
  fetch.mockResolvedValue(preparing())
  const h = await open()
  await act(async () => { await vi.advanceTimersByTimeAsync(20 * 60_000) })
  expect(fetch.mock.calls.length).toBeGreaterThan(1)
  const count = fetch.mock.calls.length
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(fetch).toHaveBeenCalledTimes(count)
  fetch.mockResolvedValue(ready())
  await act(async () => {
    const refreshed = await h.result.current.refetch()
    expect(refreshed.data?.loaded).toHaveLength(1)
  })
  await act(async () => { await vi.advanceTimersByTimeAsync(50) })
  expect(h.result.current.data?.loaded).toHaveLength(1)
  h.client.clear()
})
