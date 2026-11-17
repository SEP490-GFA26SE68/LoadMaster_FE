import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend, type FakeRoutes } from '@/test/fake-backend'
import { WarehouseStaffAssignments } from './WarehouseStaffAssignments'
import type { CompanyWarehouse } from './company-warehouses-api'
const auth = vi.hoisted(() => ({ user: { id: '12', companyId: '1', role: 'companyManager' } }))
vi.mock('@/features/auth/AuthProvider', () => ({ useAuthSafe: () => auth }))
vi.mock('@/lib/backend-config', () => ({ usesBackend: () => true, backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['companies']), keycloak: { url: '', realm: '', clientId: '' } } }))
const base = '/api/company-warehouses'
const path = `${base}/101/staff-assignments`
const warehouse = { id: 101, companyId: 1, warehouseName: 'A1', isActive: true } as CompanyWarehouse
const person = { userId: 7, fullName: 'Worker A', status: 'ACTIVE' }
const routes = (extra: FakeRoutes = {}): FakeRoutes => ({
  [`GET ${base}/staff`]: { body: envelope([person, { userId: 15, fullName: 'Inactive worker', status: 'SUSPENDED' }]) },
  [`GET ${path}`]: { body: envelope([]) },
  [`GET ${path}/history`]: { body: envelope([]) },
  [`POST ${path}`]: { body: envelope([{ ...person, active: true }]) },
  [`DELETE ${path}/7`]: { body: envelope([{ ...person, active: false }]) }, ...extra,
})
function mount(w = warehouse) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return { client, ...render(<QueryClientProvider client={client}><I18nProvider><WarehouseStaffAssignments warehouse={w} /></I18nProvider></QueryClientProvider>) }
}
async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('Phân công nhân viên kho'))
  await screen.findByRole('option', { name: 'Worker A (#7)' })
}
beforeEach(() => { auth.user = { id: '12', companyId: '1', role: 'companyManager' }; connectApiAuth(() => Promise.resolve('synthetic')) })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
test.each(['dispatcher', 'warehouse', 'companyAdmin', 'systemAdmin'])('role %s has no management UI or requests', role => {
  auth.user.role = role; const { calls } = stubBackend(routes()); mount(); expect(screen.queryByText('Phân công nhân viên kho')).not.toBeInTheDocument(); expect(calls).toHaveLength(0)
})
test('no company means no assignment UI or requests', () => {
  auth.user.companyId = ''; const { calls } = stubBackend(routes()); mount(); expect(screen.queryByText('Phân công nhân viên kho')).not.toBeInTheDocument(); expect(calls).toHaveLength(0)
})
test('opening is read-only and excludes inactive worker choices', async () => {
  const { calls } = stubBackend(routes()); mount(); expect(calls).toHaveLength(0); await open(userEvent.setup())
  expect(screen.queryByRole('option', { name: /Inactive worker/ })).not.toBeInTheDocument(); expect(calls.every(c => c.method === 'GET')).toBe(true)
})
test('grant has only userId; double click sends one mutation; success re-reads state', async () => {
  stubBackend(routes()); const original = globalThis.fetch; let assigned = false; const writes: RequestInit[] = []
  vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
    if (init.method === 'POST') { assigned = true; writes.push(init) }
    if (assigned && url.endsWith('/staff-assignments') && (!init.method || init.method === 'GET')) return Promise.resolve(new Response(JSON.stringify(envelope([{ ...person, active: true }])), { status: 200 }))
    return original(url, init)
  })
  mount(); const user = userEvent.setup(); await open(user); await user.selectOptions(screen.getByRole('combobox', { name: 'Chọn nhân viên kho' }), '7'); await user.dblClick(screen.getByRole('button', { name: 'Phân công' }))
  await screen.findByText(/Worker A.*Đang phân công/); expect(writes).toHaveLength(1); expect(JSON.parse(String(writes[0]?.body))).toEqual({ userId: 7 }); expect(screen.getByText('Máy chủ đã ghi nhận thay đổi phân công.')).toBeInTheDocument()
})
test('failed grant refetches and never claims success', async () => {
  const { calls } = stubBackend(routes({ [`POST ${path}`]: { status: 409, body: { success: false, code: 'WAREHOUSE_ASSIGNMENT_INVALID' } } })); mount(); const user = userEvent.setup(); await open(user)
  await user.selectOptions(screen.getByRole('combobox', { name: 'Chọn nhân viên kho' }), '7'); await user.click(screen.getByRole('button', { name: 'Phân công' })); await screen.findByRole('alert')
  expect(screen.queryByText('Máy chủ đã ghi nhận thay đổi phân công.')).not.toBeInTheDocument(); expect(calls.filter(c => c.method === 'GET' && c.path === path).length).toBeGreaterThan(1)
})
test('revoke requires explicit confirmation; timeout refetches server result', async () => {
  stubBackend(routes({ [`GET ${path}`]: { body: envelope([{ ...person, active: true }]) } })); const original = globalThis.fetch; let revoked = false; let writes = 0
  vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
    if (init.method === 'DELETE') { writes++; revoked = true; return Promise.reject(new TypeError('synthetic timeout')) }
    if (revoked && url.endsWith('/staff-assignments') && (!init.method || init.method === 'GET')) return Promise.resolve(new Response(JSON.stringify(envelope([{ ...person, active: false }])), { status: 200 }))
    return original(url, init)
  })
  mount(); const user = userEvent.setup(); await user.click(screen.getByText('Phân công nhân viên kho')); await user.click(await screen.findByRole('button', { name: 'Thu hồi phân công' })); expect(writes).toBe(0)
  await user.click(screen.getByRole('button', { name: 'Hủy' })); expect(writes).toBe(0); await user.click(screen.getByRole('button', { name: 'Thu hồi phân công' })); await user.click(screen.getByRole('button', { name: 'Xác nhận thu hồi' }))
  await screen.findByText(/Worker A.*Đã thu hồi/); expect(writes).toBe(1); expect(screen.queryByText('Máy chủ đã ghi nhận thay đổi phân công.')).not.toBeInTheDocument()
})
test('inactive warehouse disallows grants but permits revocation', async () => {
  stubBackend(routes({ [`GET ${path}`]: { body: envelope([{ ...person, active: true }]) } })); mount({ ...warehouse, isActive: false }); const user = userEvent.setup(); await user.click(screen.getByText('Phân công nhân viên kho'))
  expect(await screen.findByRole('button', { name: 'Thu hồi phân công' })).toBeEnabled(); expect(screen.getByRole('button', { name: 'Phân công' })).toBeDisabled()
})
test('scope-specific cache is not shared across company accounts', async () => {
  stubBackend(routes()); const { client, rerender } = mount(); const user = userEvent.setup(); await open(user); expect(client.getQueryData(['warehouse-staff', '1:12', 101, 'current'])).toEqual([])
  auth.user = { id: '13', companyId: '2', role: 'companyManager' }; rerender(<QueryClientProvider client={client}><I18nProvider><WarehouseStaffAssignments warehouse={warehouse} /></I18nProvider></QueryClientProvider>)
  expect(client.getQueryData(['warehouse-staff', '2:13', 101, 'current'])).toBeUndefined(); expect(screen.queryByText('Kho chưa có phân công nhân viên.')).not.toBeInTheDocument()
})
test('history shows actor, UTC time and old/new states without granting access', async () => {
  const event = { id: 1, actorId: 12, actorName: 'Manager A', userId: 7, oldActive: true, newActive: false, recordedAt: '2030-01-01T00:00:00Z' }
  const { calls } = stubBackend(routes({ [`GET ${path}/history`]: { body: envelope([event]) } })); mount(); await open(userEvent.setup())
  expect(await screen.findByText(/Manager A/)).toBeInTheDocument(); expect(screen.getByText(event.recordedAt)).toHaveAttribute('dateTime', event.recordedAt); expect(calls.every(c => c.method === 'GET')).toBe(true)
})
test('failed reads disable mutations until refreshed', async () => {
  stubBackend(routes({ [`GET ${path}`]: { status: 403, body: { success: false, code: 'UNAUTHORIZED' } } })); mount(); await userEvent.setup().click(screen.getByText('Phân công nhân viên kho'))
  await screen.findByRole('alert'); await waitFor(() => expect(screen.getByRole('button', { name: 'Phân công' })).toBeDisabled())
})

test('history pagination preserves earlier rows and requests the next page explicitly', async () => {
  const event = (id: number) => ({ id, actorId: 12, actorName: `Manager ${id}`, userId: 7, oldActive: null, newActive: true, recordedAt: '2030-01-01T00:00:00Z' })
  const { calls } = stubBackend(routes({ [`GET ${path}/history`]: call => ({ body: envelope(call.query.page === '0' ? Array.from({ length: 50 }, (_, i) => event(i + 1)) : [event(51)]) }) }))
  mount(); const user = userEvent.setup(); await open(user); await user.click(await screen.findByRole('button', { name: 'Xem lịch sử trước đó' }))
  expect(await screen.findByText(/Manager 51/)).toBeInTheDocument(); expect(screen.getByText(/Manager 1 ·/)).toBeInTheDocument(); expect(calls.filter(c => c.path.endsWith('/history')).map(c => c.query.page)).toEqual(['0', '1'])
})
test('already assigned workers are excluded from grant choices', async () => {
  stubBackend(routes({ [`GET ${path}`]: { body: envelope([{ ...person, active: true }]) } })); mount(); await userEvent.setup().click(screen.getByText('Phân công nhân viên kho'))
  await screen.findByRole('button', { name: 'Thu hồi phân công' }); expect(screen.queryByRole('option', { name: 'Worker A (#7)' })).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Phân công' })).toBeDisabled()
})
