import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { keycloak } from '@/features/auth/keycloak'
import { createBackendOptimizationJob } from './optimization-api'

vi.mock('@/features/auth/keycloak', () => ({ keycloak: {
  authenticated: true, token: 'TEST_ONLY', updateToken: vi.fn(() => Promise.resolve(false)),
} }))
const KEY = '11111111-1111-4111-8111-111111111111'
const fetchMock = vi.fn<typeof fetch>()
const response = (data: unknown) => new Response(JSON.stringify({ success: true, data }))
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset().mockResolvedValue(response({ job_id: 'job-1', dispatch_status: 'ACCEPTED' }))
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

test('POST sends the supplied action key and preserves UNKNOWN with its job ID', async () => {
  fetchMock.mockResolvedValue(response({ job_id: 'job-1', dispatch_status: 'UNKNOWN' }))
  expect(await createBackendOptimizationJob('7', KEY)).toEqual({ job_id: 'job-1', dispatch_status: 'UNKNOWN' })
  const [url, init] = fetchMock.mock.calls[0]!
  expect(String(url)).toMatch(/\/api\/trips\/7\/optimize-loading$/)
  expect(new Headers(init?.headers).get('Idempotency-Key')).toBe(KEY)
  expect(init?.method).toBe('POST')
  expect(init?.body).toBeUndefined() // INITIAL currently has no client-defined price/tier/options payload.
})

test('retry uses exactly the same key, URL, method and body', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('offline'))
  await expect(createBackendOptimizationJob('7', KEY)).rejects.toThrow()
  await createBackendOptimizationJob('7', KEY)
  const [first, second] = fetchMock.mock.calls
  expect(first?.[0]).toBe(second?.[0])
  expect(first?.[1]?.body).toBe(second?.[1]?.body)
  expect(first?.[1]?.method).toBe(second?.[1]?.method)
  expect(new Headers(first?.[1]?.headers).get('Idempotency-Key')).toBe(KEY)
  expect(new Headers(second?.[1]?.headers).get('Idempotency-Key')).toBe(KEY)
})

test('missing job ID is uncertain rather than a successful action', async () => {
  fetchMock.mockResolvedValue(response({ dispatch_status: 'UNKNOWN' }))
  await expect(createBackendOptimizationJob('7', KEY)).rejects.toThrow('OPTIMIZATION_RESPONSE_UNKNOWN')
})

test('a blank action key is rejected before making any request', async () => {
  await expect(createBackendOptimizationJob('7', '')).rejects.toThrow('OPTIMIZATION_ACTION_KEY_REQUIRED')
  expect(fetchMock).not.toHaveBeenCalled()
})

test('account switch cancellation during token refresh prevents the old POST', async () => {
  let completeRefresh!: (value: boolean) => void
  vi.mocked(keycloak.updateToken).mockImplementationOnce(() => new Promise(resolve => { completeRefresh = resolve }))
  const controller = new AbortController()
  const pending = createBackendOptimizationJob('7', KEY, controller.signal)
  controller.abort()
  completeRefresh(false)
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  expect(fetchMock).not.toHaveBeenCalled()
})
