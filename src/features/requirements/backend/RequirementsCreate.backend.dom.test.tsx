import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { toast } from 'sonner'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { connectApiAuth } from '@/lib/api-client'
import { getMockDb } from '@/lib/mock-db'
import { envelope, stubBackend } from '@/test/fake-backend'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { RequirementsPage } from './RequirementsPage'
import { REQUIREMENT_SERVER_SUPPORT } from './requirements-capabilities'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))
const saved = {
  id: 741, companyId: 1, customerId: 12, customerName: 'Khách fixture', destination: 'Địa chỉ máy chủ',
  destinationLat: null, destinationLng: null, deadline: '2099-12-31T17:00:00', priority: 'NORMAL',
  status: 'PENDING', expectedPackageCount: 3, receivedPackageCount: 0, packageIds: [],
  tripId: null, tripCode: null, createdBy: 8, createdAt: '2026-11-11T08:00:00', note: null,
}
const list = (data: unknown[]) => ({ success: true, data, page: 0, size: 100, totalPages: 1, totalElements: data.length, last: true })
const customers = { body: list([{ id: 12, companyId: 1, name: 'Khách fixture', contactPhone: '', address: '' }]) }
beforeEach(() => { connectApiAuth(() => Promise.resolve('fixture-token')); vi.clearAllMocks() })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

function mount(role: Role = 'dispatcher') {
  signedInAs(role)
  return render(<I18nProvider><AuthProvider><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <MemoryRouter><RequirementsPage /></MemoryRouter>
  </QueryClientProvider></AuthProvider></I18nProvider>)
}
async function open() {
  await userEvent.click(await screen.findByRole('button', { name: 'Tạo yêu cầu giao' }))
  return within(await screen.findByRole('dialog', { name: 'Tạo yêu cầu giao' }))
}
async function fill() {
  const dialog = await open()
  await userEvent.click(await dialog.findByRole('combobox', { name: 'Khách hàng / Chủ hàng' }))
  await userEvent.click(await screen.findByRole('option', { name: 'Khách fixture' }))
  fireEvent.change(dialog.getByLabelText(/^Số kiện dự kiến/), { target: { value: '3' } })
  fireEvent.change(dialog.getByLabelText(/^Tên điểm đến/), { target: { value: 'Tên hiển thị' } })
  fireEvent.change(dialog.getByLabelText(/^Địa chỉ/), { target: { value: '  Địa chỉ máy chủ  ' } })
  fireEvent.change(dialog.getByLabelText(/^Hạn giao/), { target: { value: '2099-12-31' } })
  return dialog
}
test.each([{ data: [] }, { data: [saved] }])('Dispatcher can open existing form with empty/nonempty list %j', async ({ data }) => {
  stubBackend({ 'GET /api/delivery-requirements': { body: list(data) }, 'GET /api/customers': customers })
  mount()
  const dialog = await open()
  expect(await dialog.findByLabelText(/^Số kiện dự kiến/)).not.toHaveAttribute('readonly')
  expect(REQUIREMENT_SERVER_SUPPORT).toEqual({ create: true, manage: true, unassign: true })
})
test('read-only Manager cannot create', async () => {
  const { calls } = stubBackend({ 'GET /api/delivery-requirements': { body: list([]) } })
  mount('companyManager')
  await screen.findByText('Chưa có yêu cầu giao nào.')
  expect(screen.queryByRole('button', { name: 'Tạo yêu cầu giao' })).not.toBeInTheDocument()
  expect(calls.every(c => c.method === 'GET')).toBe(true)
})
test('invalid form does not POST and shows field validation', async () => {
  const { calls } = stubBackend({ 'GET /api/delivery-requirements': { body: list([]) }, 'GET /api/customers': customers })
  mount()
  const dialog = await open()
  await userEvent.click(await dialog.findByRole('button', { name: 'Tạo yêu cầu' }))
  expect((await dialog.findAllByText('Vui lòng chọn khách hàng')).length).toBeGreaterThan(0)
  expect(calls.some(c => c.method === 'POST')).toBe(false)
})
test('valid submit uses server contract, refetches server row, closes and never writes mock DB', async () => {
  let created = false
  const mockCreate = vi.spyOn(getMockDb(), 'createDeliveryRequirement')
  const { calls } = stubBackend({
    'GET /api/delivery-requirements': () => ({ body: list(created ? [saved] : []) }),
    'GET /api/customers': customers,
    'POST /api/delivery-requirements': () => { created = true; return { status: 201, body: envelope(saved) } },
  })
  mount()
  const dialog = await fill()
  await userEvent.click(dialog.getByRole('button', { name: 'Tạo yêu cầu' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await screen.findByRole('button', { name: 'Xem chi tiết yêu cầu 741' })).toBeInTheDocument()
  expect(calls.filter(c => c.method === 'POST').map(c => c.body)).toEqual([{
    customerId: 12, destination: 'Địa chỉ máy chủ', destinationLat: null, destinationLng: null,
    deadline: expect.stringMatching(/^2099-12-31T/), priority: 'NORMAL', expectedPackageCount: 3, note: null, packageIds: [],
  }])
  expect(calls.filter(c => c.path === '/api/delivery-requirements' && c.method === 'GET').length).toBeGreaterThan(1)
  expect(mockCreate).not.toHaveBeenCalled()
  expect(toast.success).toHaveBeenCalled()
})
test('server rejection keeps entered fields and error; no success or fake row', async () => {
  const { calls } = stubBackend({
    'GET /api/delivery-requirements': { body: list([]) }, 'GET /api/customers': customers,
    'POST /api/delivery-requirements': { status: 403, body: { success: false, message: 'Fixture denied', code: 'FORBIDDEN' } },
  })
  mount()
  const dialog = await fill()
  await userEvent.click(dialog.getByRole('button', { name: 'Tạo yêu cầu' }))
  expect(await dialog.findByRole('alert')).toBeInTheDocument()
  expect(dialog.getByLabelText(/^Địa chỉ/)).toHaveValue('  Địa chỉ máy chủ  ')
  expect(toast.success).not.toHaveBeenCalled()
  expect(calls.filter(c => c.method === 'POST')).toHaveLength(1)
})
test('two synchronous submits make only one POST while pending', async () => {
  const { calls } = stubBackend({
    'GET /api/delivery-requirements': { body: list([]) }, 'GET /api/customers': customers,
    'POST /api/delivery-requirements': { body: envelope(saved) },
  })
  const fetchFixture = globalThis.fetch
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
    const response = await fetchFixture(input, init)
    if (init?.method === 'POST') await pending
    return response
  })
  mount()
  const dialog = await fill()
  const submit = dialog.getByRole('button', { name: 'Tạo yêu cầu' })
  fireEvent.submit(submit.closest('form')!)
  fireEvent.submit(submit.closest('form')!)
  await waitFor(() => expect(calls.filter(c => c.method === 'POST')).toHaveLength(1))
  expect(submit).toBeDisabled()
  release()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(calls.filter(c => c.method === 'POST')).toHaveLength(1)
})

test('Dispatcher retains merged edit/delete support for an unassigned pending requirement; viewing never writes', async () => {
  const { calls } = stubBackend({ 'GET /api/delivery-requirements': { body: list([saved]) }, 'GET /api/customers': customers })
  mount()
  await userEvent.click(await screen.findByRole('button', { name: 'Thao tác với yêu cầu 741' }))
  const menu = within(await screen.findByRole('menu'))
  expect(menu.getByRole('menuitem', { name: 'Xoá yêu cầu' })).toBeInTheDocument()
  await userEvent.click(menu.getByRole('menuitem', { name: 'Sửa yêu cầu' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Sửa yêu cầu 741' }))
  expect(dialog.getByLabelText(/^Địa chỉ/)).not.toHaveAttribute('readonly')
  expect(dialog.getByRole('button', { name: 'Lưu yêu cầu' })).toBeInTheDocument()
  expect(dialog.queryByRole('button', { name: 'Lưu hạn giao và ưu tiên' })).not.toBeInTheDocument()
  expect(dialog.queryByRole('button', { name: 'Gia hạn giao hàng' })).not.toBeInTheDocument()
  expect(calls.every(c => c.method === 'GET')).toBe(true)
})
