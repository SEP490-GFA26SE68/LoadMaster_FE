import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend } from '@/test/fake-backend'
import { PREVIEW } from './warehouse-preview-test-fixture'
import { renderWarehouse } from './warehouse-test-utils'
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['warehouse']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'warehouse',
}))
beforeEach(() => connectApiAuth(() => Promise.resolve('fixture-token')))
afterEach(() => vi.unstubAllGlobals())
const ACTIVE = { ...PREVIEW, executionId: 60, status: 'IN_PROGRESS', stagingRequired: true, stagingComplete: true }
const label = 'Xác nhận đã đặt kiện'
const open = async () => userEvent.click(await screen.findByRole('button', { name: 'Nhập Package Code — bước 1' }))
const submit = async (code: string) => {
  await userEvent.type(screen.getByRole('textbox', { name: 'Mã kiện' }), code)
  await userEvent.click(screen.getByRole('button', { name: label }))
}
test('inspect a later package, confirm only next required using real CODE; POST then GET advances backend progress', async () => {
  let data = ACTIVE
  const { calls } = stubBackend({
    'GET /api/warehouse/tasks/7/plan': () => ({ body: envelope(data) }),
    'GET /api/warehouse/tasks/7': () => ({ body: envelope(data) }),
    'POST /api/warehouse/placements/71/confirm': (call) => {
      expect(call.body).toEqual({ tripId: '7', method: 'CODE', code: 'pk-1' })
      data = { ...data, placements: data.placements!.map(p => p.placementId === 71 ? { ...p, status: 'CONFIRMED' } : p) }
      return { body: envelope(null) }
    },
  })
  renderWarehouse('/kho?chuyen=7&xem=3d')
  await userEvent.click(await screen.findByRole('button', { name: '#2 · PK-2 Chưa xếp' }))
  expect(calls.every(c => c.method === 'GET')).toBe(true)
  await open()
  await submit(' pk-1 ')
  expect(await screen.findByText('Phiên xếp đã ghi kết quả 1 / 2 kiện.')).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Nhập Package Code — bước 2' })).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Hướng dẫn vị trí và hướng đặt' })).getByText('PK-2')).toBeInTheDocument()
  const post = calls.findIndex(c => c.method === 'POST')
  expect(calls[post + 1]?.path).toBe('/api/warehouse/tasks/7')
  expect(calls.filter(c => c.method === 'POST')).toHaveLength(1)
})
test.each(['PK-2', 'BC-1', 'QR-1', '1', 'PK -1'])('wrong or non Package Code %s never posts; manual is separate', async code => {
  const { calls } = stubBackend({ 'GET /api/warehouse/tasks/7/plan': { body: envelope(ACTIVE) } })
  renderWarehouse('/kho?chuyen=7&xem=3d')
  await open()
  await submit(code)
  expect(await screen.findByRole('alert')).toHaveTextContent('không phải kiện')
  expect(calls.every(c => c.method === 'GET')).toBe(true)
  expect(screen.queryByRole('tab', { name: 'Xác nhận tay' })).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Mã kiện' })).toHaveValue(code)
})
test.each([
  ['preview', PREVIEW], ['unstaged', { ...ACTIVE, stagingComplete: false }],
  ['completed', { ...ACTIVE, status: 'COMPLETED' }],
  ['missing code', { ...ACTIVE, placements: ACTIVE.placements!.map(p => ({ ...p, packageCode: null })) }],
])('%s has no writable confirmation form', async (_name, data) => {
  const { calls } = stubBackend({ 'GET /api/warehouse/tasks/7/plan': { body: envelope(data) } })
  renderWarehouse('/kho?chuyen=7&xem=3d')
  await screen.findByText('Phiên xếp đã ghi kết quả 0 / 2 kiện.')
  expect(screen.queryByRole('button', { name: /Nhập Package Code/ })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: data.executionId ? /phiên soạn \/ xếp/ : /bắt đầu soạn hàng/ })).toHaveAttribute('href', data.executionId ? '/kho?chuyen=7' : '/kho')
  expect(calls.every(c => c.method === 'GET')).toBe(true)
})
test.each([{ executionId: 61 }, { loadPlanId: 99 }, { innerLength: 650 }])('context change %j invalidates old form and requires review', async change => {
  let data = ACTIVE
  const { calls } = stubBackend({ 'GET /api/warehouse/tasks/7/plan': () => ({ body: envelope(data) }) })
  renderWarehouse('/kho?chuyen=7&xem=3d')
  await open()
  data = { ...ACTIVE, ...change }
  await submit('PK-1')
  expect(await screen.findByRole('button', { name: 'Đã xem lại phiên hiện hành' })).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(calls.every(c => c.method === 'GET')).toBe(true)
  await userEvent.click(screen.getByRole('button', { name: 'Đã xem lại phiên hiện hành' }))
  await open()
  expect(screen.getByRole('textbox', { name: 'Mã kiện' })).toHaveValue('')
})
test.each([false, true])('ambiguous/409 response reconciles GET only; committed=%s', async committed => {
  let data = ACTIVE
  const { calls } = stubBackend({
    'GET /api/warehouse/tasks/7/plan': () => ({ body: envelope(data) }),
    'GET /api/warehouse/tasks/7': () => ({ body: envelope(data) }),
    'POST /api/warehouse/placements/71/confirm': () => {
      if (committed) data = { ...data, placements: data.placements!.map(p => p.placementId === 71 ? { ...p, status: 'CONFIRMED' } : p) }
      return { status: 409, body: { success: false, code: 'CONFLICT' } }
    },
  })
  renderWarehouse('/kho?chuyen=7&xem=3d')
  await open()
  await submit('PK-1')
  expect(await screen.findByText('Phiên xếp đã ghi kết quả ' + (committed ? 1 : 0) + ' / 2 kiện.')).toBeInTheDocument()
  expect(calls.filter(c => c.method === 'POST')).toHaveLength(1)
  expect(calls.some(c => c.path === '/api/warehouse/tasks/7')).toBe(true)
})
test('fresh preflight stale rejection removes open form and prevents POST', async () => {
  let stale = false
  const { calls } = stubBackend({ 'GET /api/warehouse/tasks/7/plan': () => stale
    ? { status: 409, body: { success: false, code: 'PLAN_STALE' } } : { body: envelope(ACTIVE) } })
  renderWarehouse('/kho?chuyen=7&xem=3d')
  await open()
  stale = true
  await submit('PK-1')
  expect(await screen.findByRole('alert')).toHaveTextContent('lỗi thời')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(calls.every(c => c.method === 'GET')).toBe(true)
})

test('lost network ACK observes commit via GET, reload never confirms again', async () => {
  let data = ACTIVE
  const { calls } = stubBackend({
    'GET /api/warehouse/tasks/7/plan': () => ({ body: envelope(data) }),
    'GET /api/warehouse/tasks/7': () => ({ body: envelope(data) }),
    'POST /api/warehouse/placements/71/confirm': () => {
      data = { ...data, placements: data.placements!.map(p => p.placementId === 71 ? { ...p, status: 'CONFIRMED' } : p) }
      return { body: envelope(null) }
    },
  })
  const fixtureFetch = globalThis.fetch
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const response = await fixtureFetch(url, init)
    if (init.method === 'POST') throw new TypeError('fixture ACK lost')
    return response
  })
  const page = renderWarehouse('/kho?chuyen=7&xem=3d')
  await open()
  await submit('PK-1')
  expect(await screen.findByRole('button', { name: 'Nhập Package Code — bước 2' })).toBeInTheDocument()
  expect(screen.getByText('Phiên xếp đã ghi kết quả 1 / 2 kiện.')).toBeInTheDocument()
  page.unmount()
  renderWarehouse('/kho?chuyen=7&xem=3d')
  expect(await screen.findByRole('button', { name: 'Nhập Package Code — bước 2' })).toBeInTheDocument()
  expect(calls.filter(c => c.method === 'POST')).toHaveLength(1)
})
test('failed POST and failed reconciliation lock writes, preserve code, and permit GET-only recovery', async () => {
  let getFails = true
  const { calls } = stubBackend({
    'GET /api/warehouse/tasks/7/plan': { body: envelope(ACTIVE) },
    'GET /api/warehouse/tasks/7': () => getFails
      ? { status: 503, body: { success: false, code: 'SERVER_ERROR' } } : { body: envelope(ACTIVE) },
    'POST /api/warehouse/placements/71/confirm': { status: 503, body: { success: false, code: 'SERVER_ERROR' } },
  })
  renderWarehouse('/kho?chuyen=7&xem=3d')
  await open()
  await submit('PK-1')
  await screen.findByRole('alert')
  expect(screen.getByRole('textbox', { name: 'Mã kiện' })).toHaveValue('PK-1')
  expect(screen.getByRole('button', { name: label })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Đóng' }))
  expect(screen.getByRole('button', { name: 'Nhập Package Code — bước 1' })).toBeDisabled()
  getFails = false
  await userEvent.click(screen.getByRole('button', { name: 'Đọc lại phiên để kiểm tra kết quả' }))
  expect(await screen.findByRole('button', { name: 'Nhập Package Code — bước 1' })).toBeEnabled()
  expect(calls.filter(c => c.method === 'POST')).toHaveLength(1)
  expect(screen.getByText('Phiên xếp đã ghi kết quả 0 / 2 kiện.')).toBeInTheDocument()
})
test('double submit is not queued and cannot confirm next package', async () => {
  const { calls } = stubBackend({
    'GET /api/warehouse/tasks/7/plan': { body: envelope(ACTIVE) },
    'GET /api/warehouse/tasks/7': { body: envelope(ACTIVE) },
    'POST /api/warehouse/placements/71/confirm': { status: 409, body: { success: false, code: 'CONFLICT' } },
  })
  renderWarehouse('/kho?chuyen=7&xem=3d')
  await open()
  await userEvent.type(screen.getByRole('textbox', { name: 'Mã kiện' }), 'PK-1')
  await userEvent.dblClick(screen.getByRole('button', { name: label }))
  await screen.findByRole('alert')
  expect(calls.filter(c => c.method === 'POST')).toHaveLength(1)
})
test.each(['ABORTED', 'PLAN_STALE'])('%s blocks confirmation and exposes no cached form', async status => {
  stubBackend({ 'GET /api/warehouse/tasks/7/plan': { body: envelope({ ...ACTIVE, status: status === 'ABORTED' ? status : 'IN_PROGRESS', stale: status === 'PLAN_STALE' }) } })
  renderWarehouse('/kho?chuyen=7&xem=3d')
  await screen.findByRole('alert')
  expect(screen.queryByRole('button', { name: /Nhập Package Code/ })).not.toBeInTheDocument()
})
test('manual pending is visible and cannot become a CODE fallback; complete remains in existing session', async () => {
  const { calls } = stubBackend({ 'GET /api/warehouse/tasks/7/plan': { body: envelope({ ...ACTIVE, pendingManualCount: 1 }) } })
  renderWarehouse('/kho?chuyen=7&xem=3d')
  expect(await screen.findByText('Xác nhận tay — chờ điều phối viên duyệt')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Nhập Package Code/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Hoàn tất xếp hàng' })).not.toBeInTheDocument()
  expect(calls.every(c => c.method === 'GET')).toBe(true)
})
