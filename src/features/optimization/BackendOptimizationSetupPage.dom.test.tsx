import { connectApiAuth } from '@/lib/api-client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { canFetchOptimizationPlans } from './backend-job-status'
import { isOptimizationTerminal } from './initial-optimization-action'
import { BackendOptimizationSetupPage } from './BackendOptimizationSetupPage'

const identity = vi.hoisted(() => ({ user: { id: '1', companyId: '10' as string | undefined } }))
vi.mock('@/features/auth/AuthProvider', async importOriginal => ({
  ...await importOriginal<typeof import('@/features/auth/AuthProvider')>(),
  useCurrentUser: () => identity.user,
}))
vi.mock('@/lib/backend-config', () => ({ backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test' }, usesBackend: () => false }))

const KEY_A = '11111111-1111-4111-8111-111111111111'
const KEY_B = '22222222-2222-4222-8222-222222222222'
const posts: { key: string | null; url: string; body: BodyInit | null | undefined }[] = []
let status = 'RUNNING'
let plans: unknown[] = []
let planReads = 0
let postResponse: () => Promise<Response>
let polls: string[] = []
const clients: QueryClient[] = []
function json(data: unknown, code = 200) { return new Response(JSON.stringify({ success: code < 400, data }), { status: code }) }
function runButton() { return screen.getByRole('button', { name: 'Chạy tối ưu xếp hàng mới' }) }
function retryButton() { return screen.getByRole('button', { name: 'Thử lại yêu cầu hiện tại' }) }
function saved() {
  return Object.keys(sessionStorage).filter(k => k.startsWith('loadmaster.initial-optimization.v1:'))
    .map(k => JSON.parse(sessionStorage.getItem(k)!))
}
function mount(tripId = '7', client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  clients.push(client)
  const tree = (id: string) => <QueryClientProvider client={client}><I18nProvider><MemoryRouter>
    <BackendOptimizationSetupPage tripId={id} />
  </MemoryRouter></I18nProvider></QueryClientProvider>
  const view = render(tree(tripId))
  return { ...view, change: (id = tripId) => view.rerender(tree(id)), client }
}
beforeEach(() => {
  connectApiAuth(() => Promise.resolve('TEST_ONLY_TOKEN'))
  sessionStorage.clear(); posts.length = 0; polls = []; status = 'RUNNING'; plans = []; planReads = 0
  identity.user = { id: '1', companyId: '10' }
  vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(KEY_A).mockReturnValueOnce(KEY_B)
  postResponse = async () => json({ job_id: 'job-1', dispatch_status: 'ACCEPTED' })
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (url, init) => {
    const path = new URL(String(url)).pathname
    if (init?.method === 'POST' && /\/optimize-loading$/.test(path)) {
      posts.push({ key: new Headers(init.headers).get('Idempotency-Key'), url: String(url), body: init.body })
      return postResponse()
    }
    if (/\/optimization-jobs\/[^/]+$/.test(path)) {
      polls.push(path)
      return json({ job_uuid: path.split('/').at(-1), status })
    }
    if (path.endsWith('/plans')) { planReads++; return json(plans) }
    throw new Error(`Unexpected offline test request: ${path}`)
  }))
})
afterEach(() => {
  clients.splice(0).forEach(client => client.clear())
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers()
})

test('one explicit action creates one UUID; a rapid double click sends one POST', async () => {
  let finish!: (value: Response) => void
  postResponse = () => new Promise(resolve => { finish = resolve })
  mount()
  act(() => { runButton().click(); runButton().click() })
  await waitFor(() => expect(posts).toHaveLength(1))
  expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
  expect(posts[0]?.key).toBe(KEY_A)
  expect(saved()[0]).toEqual({ key: KEY_A, request: { tripId: '7' } })
  await act(async () => finish(json({ job_id: 'job-1' })))
})

test('network error keeps the immutable action; retry sends identical key and request', async () => {
  postResponse = async () => { throw new TypeError('offline') }
  mount(); fireEvent.click(runButton())
  await screen.findByText(/Chưa xác nhận được/)
  expect(runButton()).toBeDisabled()
  postResponse = async () => json({ job_id: 'job-1', dispatch_status: 'ACCEPTED' })
  fireEvent.click(retryButton())
  await waitFor(() => expect(saved()[0]?.jobId).toBe('job-1'))
  expect(posts).toHaveLength(2); expect(posts[1]).toEqual(posts[0])
  expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
})

test('a real transport timeout retains the action key', async () => {
  vi.useFakeTimers()
  vi.mocked(fetch).mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')))
  }))
  mount(); fireEvent.click(runButton())
  await act(async () => { await vi.advanceTimersByTimeAsync(15_001) })
  expect(screen.getByText(/Chưa xác nhận được/)).toBeInTheDocument()
  expect(saved()[0]?.key).toBe(KEY_A)
  expect(runButton()).toBeDisabled()
})

test('malformed acknowledgement can retry without rotating the key', async () => {
  postResponse = async () => json({ dispatch_status: 'UNKNOWN' })
  mount(); fireEvent.click(runButton())
  await screen.findByText(/Chưa xác nhận được/)
  fireEvent.click(retryButton())
  await waitFor(() => expect(posts).toHaveLength(2))
  expect(posts[1]?.key).toBe(KEY_A); expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
})

test('UNKNOWN with job ID keeps key/job, polls it and retries only GET', async () => {
  postResponse = async () => json({ job_id: 'job-1', dispatch_status: 'UNKNOWN' })
  mount(); fireEvent.click(runButton())
  await screen.findByText(/Chưa xác nhận được/)
  await waitFor(() => expect(polls.length).toBeGreaterThan(0))
  expect(saved()[0]).toEqual({ key: KEY_A, request: { tripId: '7' }, jobId: 'job-1', dispatchStatus: 'UNKNOWN' })
  expect(runButton()).toBeDisabled()
  const count = polls.length
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại trạng thái' }))
  await waitFor(() => expect(polls.length).toBeGreaterThan(count))
  expect(posts).toHaveLength(1)
})

test('normal acknowledgement never reposts, even when status polling errors', async () => {
  const view = mount(); fireEvent.click(runButton())
  await waitFor(() => expect(saved()[0]?.jobId).toBe('job-1'))
  vi.mocked(fetch).mockRejectedValue(new TypeError('offline status'))
  await act(async () => { await view.client.invalidateQueries({ queryKey: ['backend'] }) })
  expect(runButton()).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại trạng thái' }))
  expect(posts).toHaveLength(1); expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
})

test('409 displays a conflict, preserves key, and never silently starts another action', async () => {
  postResponse = async () => json(null, 409)
  mount(); fireEvent.click(runButton())
  await screen.findByText(/chưa khớp với lần chạy/)
  fireEvent.click(retryButton())
  await waitFor(() => expect(posts).toHaveLength(2))
  expect(posts.every(p => p.key === KEY_A)).toBe(true)
  expect(runButton()).toBeDisabled(); expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
})

test.each(['COMPLETED', 'FAILED', 'TIMEOUT', 'PARTIAL', 'NO_SOLUTION', 'SUCCESS'])(
  'only an explicit click after confirmed %s starts a new action with a new key', async terminal => {
    const view = mount(); fireEvent.click(runButton())
    await waitFor(() => expect(polls.length).toBeGreaterThan(0))
    expect(runButton()).toBeDisabled()
    status = terminal
    await act(async () => { await view.client.invalidateQueries({ queryKey: ['backend'] }) })
    await waitFor(() => expect(runButton()).toBeEnabled())
    expect(posts).toHaveLength(1)
    fireEvent.click(runButton())
    await waitFor(() => expect(posts).toHaveLength(2))
    expect(posts[1]?.key).toBe(KEY_B)
  },
)

test('reload recovers an uncertain action without auto POST; retry keeps its snapshot', async () => {
  postResponse = async () => { throw new TypeError('lost response') }
  const first = mount(); fireEvent.click(runButton()); await screen.findByText(/Chưa xác nhận được/)
  first.unmount()
  mount(); expect(runButton()).toBeDisabled(); expect(posts).toHaveLength(1)
  postResponse = async () => json({ job_id: 'job-1' })
  fireEvent.click(retryButton())
  await waitFor(() => expect(posts).toHaveLength(2))
  expect(posts[1]).toEqual(posts[0])
})

test('reload with a job resumes polling without a new POST or UUID', async () => {
  const first = mount(); fireEvent.click(runButton())
  await waitFor(() => expect(saved()[0]?.jobId).toBe('job-1'))
  first.unmount(); const count = polls.length
  mount(); await waitFor(() => expect(polls.length).toBeGreaterThan(count))
  expect(posts).toHaveLength(1); expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
  expect(JSON.stringify(saved())).not.toContain('TEST_ONLY_TOKEN')
})

test.each(['user', 'company', 'trip'])('switching %s never restores or sends the old action key', async kind => {
  const view = mount(); fireEvent.click(runButton())
  await waitFor(() => expect(saved()[0]?.jobId).toBe('job-1'))
  if (kind === 'user') identity.user = { ...identity.user, id: '2' }
  if (kind === 'company') identity.user = { ...identity.user, companyId: '20' }
  view.change(kind === 'trip' ? '8' : '7')
  expect(runButton()).toBeEnabled(); expect(posts).toHaveLength(1)
  fireEvent.click(runButton()); await waitFor(() => expect(posts).toHaveLength(2))
  expect(posts[1]?.key).toBe(KEY_B); expect(saved()).toHaveLength(2)
})

test('storage failure prevents POST rather than forgetting an unresolved action', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  mount(); fireEvent.click(runButton())
  expect(await screen.findByText(/Chưa thể lưu hoặc khôi phục/)).toBeInTheDocument()
  expect(posts).toHaveLength(0); expect(runButton()).toBeDisabled()
})

test('no company cannot create or resume any action', () => {
  identity.user.companyId = undefined; mount()
  expect(screen.getByRole('alert')).toHaveTextContent('Cần đăng nhập tài khoản thuộc công ty')
  expect(posts).toHaveLength(0)
})


test.each(['PARTIAL', 'NO_SOLUTION', 'TIMEOUT', 'FAILED', 'COMPLETED', 'SUCCESS'])(
  '%s is terminal: polling stops, UI leaves running state, and no second POST occurs', async terminal => {
    status = terminal
    const view = mount(); fireEvent.click(runButton())
    await waitFor(() => expect(runButton()).toBeEnabled())
    await waitFor(() => expect(screen.queryByText('Đang xử lý tối ưu xếp hàng...')).not.toBeInTheDocument())
    const query = view.client.getQueryCache().find({ queryKey: ['backend', '1', '10', 'optimization-job', 'job-1'] })!
    const interval = query.observers[0]!.options.refetchInterval
    expect(typeof interval === 'function' ? interval(query) : interval).toBe(false)
    expect(isOptimizationTerminal(terminal)).toBe(true)
    expect(planReads).toBe(canFetchOptimizationPlans(terminal) ? 1 : 0)
    expect(posts).toHaveLength(1)
  },
)

test('PARTIAL fetches the saved plan and shows its packed count without starting another job', async () => {
  status = 'PARTIAL'
  plans = [{ id: 47, plan_name: 'Validated partial plan', packed_items_count: 17,
    placements: [], volume_utilization: 0.5, weight_utilization: 0.4 }]
  mount(); fireEvent.click(runButton())
  expect(await screen.findByText('Validated partial plan')).toBeInTheDocument()
  expect(await screen.findByText(/17/)).toBeInTheDocument()
  expect(planReads).toBe(1); expect(posts).toHaveLength(1)
})

test.each(['PENDING', 'RUNNING'])('%s keeps polling the same job and never reposts', async active => {
  status = active
  const view = mount(); fireEvent.click(runButton())
  await waitFor(() => expect(polls.length).toBeGreaterThan(0))
  const query = view.client.getQueryCache().find({ queryKey: ['backend', '1', '10', 'optimization-job', 'job-1'] })!
  const interval = query.observers[0]!.options.refetchInterval
  expect(typeof interval === 'function' ? interval(query) : interval).toBe(2000)
  expect(runButton()).toBeDisabled(); expect(planReads).toBe(0); expect(posts).toHaveLength(1)
})
