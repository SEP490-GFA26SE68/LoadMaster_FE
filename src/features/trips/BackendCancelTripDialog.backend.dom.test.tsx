import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend, type FakeRoutes } from '@/test/fake-backend'
import { BackendCancelTripDialog } from './BackendCancelTripDialog'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

/**
 * Huỷ chuyến Đang vận chuyển ở Chi tiết chuyến máy chủ: hộp đọc sự cố của chuyến, chỉ cho huỷ khi còn sự cố chưa xử lý (như máy chủ:
 * `TRIP_CANCEL_NEEDS_OPEN_EXCEPTION`), huỷ xong nói số kiện thành Hoàn trả.
 */
const exception = (id: string, status: string) => ({
  id, tripId: 'TRIP-0051', type: 'VEHICLE_BREAKDOWN', description: 'Xe hỏng máy', delayMinutes: 60, status, reportedAt: '2026-10-17T14:25:00', reportedBy: '3',
})

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
  vi.mocked(toast.success).mockClear()
  return () => vi.unstubAllGlobals()
})

function renderDialog(routes: FakeRoutes) {
  const backend = stubBackend(routes)
  render(
    <I18nProvider>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <BackendCancelTripDialog tripId="51" tripCode="TRIP-0051" inTransit open onOpenChange={() => {}} />
      </QueryClientProvider>
    </I18nProvider>,
  )
  return backend
}

test('a trip in transit without an unresolved exception cannot be cancelled: the button is disabled with the reason', async () => {
  const { calls } = renderDialog({ 'GET /api/trips/51/exceptions': { body: envelope([exception('EXC-1', 'RESOLVED')]) } })
  const note = await screen.findByRole('status')
  expect(note).toHaveTextContent('chỉ huỷ được khi có sự cố cấp chuyến chưa xử lý')
  const confirm = screen.getByRole('button', { name: 'Huỷ chuyến' })
  expect(confirm).toBeDisabled()
  expect(confirm).toHaveAccessibleDescription(note.textContent ?? '')
  expect(calls.filter((call) => call.method === 'POST')).toStrictEqual([])
})

test('a trip in transit with an open exception is cancelled and the toast says how many packages became Returned', async () => {
  const { calls } = renderDialog({
    'GET /api/trips/51/exceptions': { body: envelope([exception('EXC-1', 'RESOLVED'), exception('EXC-2', 'ESCALATED')]) },
    'POST /api/trips/51/cancel': { body: envelope({ id: 51, status: 'CANCELLED', cancelReturnedCount: 7 }) },
  })
  expect(await screen.findByRole('status')).toHaveTextContent('kiện chưa giao sẽ thành Hoàn trả')
  await userEvent.type(screen.getByRole('textbox', { name: 'Lý do huỷ' }), 'Xe hỏng, không sửa kịp')
  await userEvent.click(screen.getByRole('button', { name: 'Huỷ chuyến' }))
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã huỷ chuyến TRIP-0051: 7 kiện chưa giao thành Hoàn trả'))
  expect(calls.find((call) => call.method === 'POST')).toMatchObject({ path: '/api/trips/51/cancel', body: { reason: 'Xe hỏng, không sửa kịp' } })
})

test('the server still refuses (exception resolved meanwhile): its sentence shows in the dialog', async () => {
  renderDialog({
    'GET /api/trips/51/exceptions': { body: envelope([exception('EXC-2', 'OPEN')]) },
    'POST /api/trips/51/cancel': { status: 409, body: { success: false, code: 'TRIP_CANCEL_NEEDS_OPEN_EXCEPTION', message: 'x' } },
  })
  await screen.findByRole('status')
  await userEvent.type(screen.getByRole('textbox', { name: 'Lý do huỷ' }), 'Khách huỷ đơn')
  await userEvent.click(screen.getByRole('button', { name: 'Huỷ chuyến' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Báo sự cố ở màn Giám sát trước')
})
