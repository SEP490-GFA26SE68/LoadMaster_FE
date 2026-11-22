import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { toast } from 'sonner'
import { I18nProvider, createTranslator, dataErrorMessage } from '@/lib/i18n'
import { ApiError, connectApiAuth } from '@/lib/api-client'
import { getMockDb } from '@/lib/mock-db'
import { envelope, page, stubBackend } from '@/test/fake-backend'
import { RequirementAssignDialog } from './RequirementAssignDialog'
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))
const trip = { id: 17, tripCode: 'FIXTURE-17', tripName: 'Fixture trip', status: 'DRAFT', departureTime: '2099-12-31T08:00:00' }
const counts = { expectedCount: 4, receivedCount: 3, missingCount: 1 }
const viMessage = 'Chưa đủ kiện hàng để đưa vào chuyến. Đã nhận 3/4 kiện, còn thiếu 1 kiện.'
beforeEach(() => { connectApiAuth(() => Promise.resolve('fixture-token')); vi.clearAllMocks() })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const close = vi.fn()
  const requirement = { id: '70', companyId: '1', destinationName: 'Fixture', address: 'Fixture',
    deadline: '2099-12-31T17:00:00Z', priority: 'NORMAL' as const, status: 'PENDING' as const,
    packageIds: [], createdBy: '8', createdAt: '2026-11-11T00:00:00Z', expectedPackageCount: 4, receivedPackageCount: 3 }
  render(<I18nProvider><QueryClientProvider client={client}><RequirementAssignDialog open requirementId="70" requirement={requirement} onOpenChange={close} /></QueryClientProvider></I18nProvider>)
  expect(await screen.findByText(/^Đã liên kết 3\/4 kiện/)).toBeInTheDocument()
  await userEvent.click(await screen.findByRole('combobox', { name: 'Chuyến' }))
  await userEvent.click(await screen.findByRole('option', { name: /FIXTURE-17/ }))
  return { close, invalidate }
}
test.each([
  ['REQUIREMENT_PACKAGES_INCOMPLETE', 409, counts, viMessage],
  ['TRIP_NOT_EDITABLE', 409, {}, 'Chuyến đã sang pha vận hành, không sửa được nữa.'],
  ['UNAUTHORIZED', 403, {}, 'Bạn không có quyền thực hiện thao tác này.'],
  ['INVALID_INPUT', 400, {}, 'Máy chủ không nhận thao tác này: dữ liệu chưa hợp lệ hoặc trạng thái hiện tại không cho phép.'],
])('assignment error %s preserves dialog/selection and does not fake success', async (code, status, errors, message) => {
  const spy = vi.spyOn(getMockDb(), 'assignDeliveryRequirement')
  const { calls } = stubBackend({
    'GET /api/trips': { body: envelope(page([trip])) },
    'POST /api/trips/17/delivery-requirements/70': { status, body: { success: false, code, errors } },
  })
  const { close } = await mount()
  await userEvent.click(screen.getByRole('button', { name: 'Đưa vào chuyến' }))
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent(message)
  expect(screen.getByRole('combobox', { name: 'Chuyến' })).toHaveTextContent('FIXTURE-17')
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Đưa vào chuyến' })).toBeEnabled()
  expect(close).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
  expect(calls.filter(c => c.method === 'POST')).toHaveLength(1)
  expect(spy).not.toHaveBeenCalled()
})
test('successful assignment invalidates server requirements/trips, uses existing empty-body POST', async () => {
  const spy = vi.spyOn(getMockDb(), 'assignDeliveryRequirement')
  const { calls } = stubBackend({
    'GET /api/trips': { body: envelope(page([trip])) },
    'POST /api/trips/17/delivery-requirements/70': { body: envelope({ id: 9, tripId: 17, deliveryRequirementId: 70, stopSequence: 1 }) },
  })
  const { close, invalidate } = await mount()
  await userEvent.click(screen.getByRole('button', { name: 'Đưa vào chuyến' }))
  await waitFor(() => expect(close).toHaveBeenCalledWith(false))
  for (const key of ['requirements', 'trips']) expect(invalidate).toHaveBeenCalledWith({ queryKey: [key] })
  expect(calls.filter(c => c.method === 'POST').map(c => [c.path, c.body])).toEqual([['/api/trips/17/delivery-requirements/70', undefined]])
  expect(spy).not.toHaveBeenCalled()
})
test('counts translate in Vietnamese and English; missing metadata never invents counts', () => {
  const error = new ApiError('REQUIREMENT_PACKAGES_INCOMPLETE', { status: 409, params: counts })
  expect(dataErrorMessage(error, createTranslator('vi'))).toBe(viMessage)
  expect(dataErrorMessage(error, createTranslator('en'))).toBe('Not all packages have been received. Received 3/4; 1 remaining.')
  expect(dataErrorMessage(new ApiError('REQUIREMENT_PACKAGES_INCOMPLETE', { status: 409 }), createTranslator('vi'))).not.toContain('{')
})
