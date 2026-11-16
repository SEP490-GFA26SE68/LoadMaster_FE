import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { toast } from 'sonner'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend, type FakeReply } from '@/test/fake-backend'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { PackageDetailPanel } from './PackageDetailPanel'
import type { PackageStatus } from './packages-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://fixture.test', features: new Set(['packages']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'packages',
}))
vi.mock('@/components/PackageQrImage', () => ({ PackageQrImage: () => null }))
vi.mock('./PackageFormDialog', () => ({ PackageFormDialog: () => null }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
beforeEach(() => { sessionStorage.clear(); vi.clearAllMocks(); connectApiAuth(() => Promise.resolve('SYNTHETIC_ONLY')) })
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear() })

function mount(role: Role = 'dispatcher', status: PackageStatus = 'PENDING', reply: FakeReply = { body: envelope(null) }) {
  const pkg = { id: 5, packageCode: 'LB-0005', packageTypeId: null, qrToken: 'qr-5', actualLength: 60, actualWidth: 40, actualHeight: 30,
    actualWeightKg: 12.5, handlingClass: 'STANDARD', destination: 'Fixture', status, isPinned: false, orientation: '0', stackable: true }
  let deleted = false
  const backend = stubBackend({
    'GET /api/packages/5': () => deleted ? { status: 404, body: { success: false, code: 'PACKAGE_NOT_FOUND' } } : { body: envelope(pkg) },
    'GET /api/package-types': { body: { success: true, data: [], page: 0, size: 100, totalElements: 0, totalPages: 1, last: true } },
    'GET /api/packages/5/history': { body: envelope([]) },
    'DELETE /api/packages/5': () => {
      if ((reply.status ?? 200) < 400 && (reply.body as { success?: boolean } | undefined)?.success === true) deleted = true
      return reply
    },
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const close = vi.fn(); signedInAs(role)
  render(<QueryClientProvider client={client}><I18nProvider><AuthProvider><MemoryRouter>
    <PackageDetailPanel id="details" packageId="5" onClose={close} />
  </MemoryRouter></AuthProvider></I18nProvider></QueryClientProvider>)
  return { ...backend, close, client }
}
async function openDelete() {
  await userEvent.click(await screen.findByRole('button', { name: 'Xoá kiện' }))
  return within(await screen.findByRole('dialog', { name: 'Xoá kiện LB-0005?' }))
}

test('dispatcher confirms deletion using existing DELETE API, invalidates lists and closes only on success', async () => {
  const ctx = mount(); const invalidation = vi.spyOn(ctx.client, 'invalidateQueries')
  const dialog = await openDelete()
  expect(ctx.calls.filter(c => c.method === 'DELETE')).toHaveLength(0)
  await userEvent.click(dialog.getByRole('button', { name: 'Xoá kiện' }))
  await waitFor(() => expect(ctx.close).toHaveBeenCalledOnce())
  expect(ctx.calls.filter(c => c.method === 'DELETE').map(c => [c.path, c.body])).toEqual([['/api/packages/5', undefined]])
  expect(toast.success).toHaveBeenCalledOnce()
  expect(invalidation).toHaveBeenCalledWith({ queryKey: ['cargo-packages', 'list'] })
  expect(invalidation).toHaveBeenCalledWith({ queryKey: ['cargo-packages', 'detail', '5'], refetchType: 'none' })
  expect(invalidation).toHaveBeenCalledWith({ queryKey: ['package-pool'] })
})
test.each(['warehouse', 'companyManager', 'driver', 'systemAdmin'] as const)('%s cannot see the dispatcher delete action', async role => {
  const ctx = mount(role)
  await screen.findByRole('heading', { name: 'LB-0005' })
  expect(screen.queryByRole('button', { name: 'Xoá kiện' })).not.toBeInTheDocument()
  expect(ctx.calls.filter(c => c.method === 'DELETE')).toHaveLength(0)
})
test.each(['PLANNED', 'LOADED', 'DELIVERED', 'RETURNED', 'CANCELLED'] as const)('%s package cannot be deleted from UI', async status => {
  const ctx = mount('dispatcher', status)
  expect(await screen.findByRole('button', { name: 'Xoá kiện' })).toBeDisabled()
  expect(ctx.calls.filter(c => c.method === 'DELETE')).toHaveLength(0)
})
test('cancel never sends DELETE', async () => {
  const ctx = mount(); const dialog = await openDelete()
  await userEvent.click(dialog.getByRole('button', { name: 'Huỷ' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(ctx.calls.filter(c => c.method === 'DELETE')).toHaveLength(0)
  expect(ctx.close).not.toHaveBeenCalled()
})
test('server authorization rejection leaves confirmation open without success or closing detail', async () => {
  const ctx = mount('dispatcher', 'PENDING', { status: 403, body: { success: false, code: 'FORBIDDEN' } })
  const dialog = await openDelete(); await userEvent.click(dialog.getByRole('button', { name: 'Xoá kiện' }))
  await waitFor(() => expect(ctx.calls.filter(c => c.method === 'DELETE')).toHaveLength(1))
  await waitFor(() => expect(dialog.getByRole('button', { name: 'Xoá kiện' })).not.toBeDisabled())
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(ctx.close).not.toHaveBeenCalled(); expect(toast.success).not.toHaveBeenCalled()
})
test('network failure cannot report success; pending double-click sends just one request', async () => {
  const ctx = mount(); const base = globalThis.fetch; let reject!: (error: Error) => void; let deletes = 0
  const pending = new Promise<Response>((_, fail) => { reject = fail })
  vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
    if (init?.method === 'DELETE') { deletes++; return pending }
    return base(input, init)
  })
  const dialog = await openDelete(); const confirm = dialog.getByRole('button', { name: 'Xoá kiện' })
  fireEvent.click(confirm); fireEvent.click(confirm)
  await waitFor(() => expect(deletes).toBe(1))
  expect(ctx.close).not.toHaveBeenCalled()
  reject(new TypeError('Synthetic network failure'))
  await waitFor(() => expect(confirm).not.toBeDisabled())
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(ctx.close).not.toHaveBeenCalled(); expect(toast.success).not.toHaveBeenCalled()
})

test('HTTP 200 success=false is not a successful deletion', async () => {
  const ctx = mount('dispatcher', 'PENDING', { body: { success: false, code: 'FORBIDDEN' } })
  const dialog = await openDelete(); await userEvent.click(dialog.getByRole('button', { name: 'Xoá kiện' }))
  await waitFor(() => expect(ctx.calls.filter(c => c.method === 'DELETE')).toHaveLength(1))
  await waitFor(() => expect(dialog.getByRole('button', { name: 'Xoá kiện' })).not.toBeDisabled())
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(ctx.close).not.toHaveBeenCalled(); expect(toast.success).not.toHaveBeenCalled()
})

test('slower list refresh cannot lose the successful delete confirmation when detail returns 404', async () => {
  const ctx = mount(); let reads = 0
  const observer = new QueryObserver(ctx.client, {
    queryKey: ['cargo-packages', 'list', 0],
    queryFn: async () => { if (++reads > 1) await new Promise(resolve => setTimeout(resolve, 100)); return [] },
  })
  const unsubscribe = observer.subscribe(() => {})
  try {
    const dialog = await openDelete()
    await userEvent.click(dialog.getByRole('button', { name: 'Xoá kiện' }))
    await waitFor(() => expect(ctx.close).toHaveBeenCalledOnce())
    expect(toast.success).toHaveBeenCalledOnce()
  } finally { unsubscribe() }
})
