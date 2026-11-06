import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { LoadPlan } from '@/features/optimization/load-plan-dto'
import { ApiError, connectApiAuth } from '@/lib/api-client'
import { createTranslator, dataErrorMessage, I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend } from '@/test/fake-backend'
import { sceneBox } from '@/test/scene'
import { BackendRerunDialog } from './BackendRerunDialog'
import { SelectedPackagePanel } from './panels/SelectedPackagePanel'
import type { ScenePlacement } from './scene-input'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

/**
 * Planner nối backend: ghim từ thẻ kiện đang chọn (máy chủ lưu ngay, không chờ "Duyệt bản chỉnh"), và "Chạy lại giữ ghim" — máy chủ lưu
 * một phương án mới, màn mở chính phương án đó trong Planner; lỗi của máy chủ giữ hộp mở kèm toast.
 */
const PLAN: LoadPlan = {
  id: '12', tripId: '42', jobId: 'job-1', objective: 'AXLE_BALANCE', label: 'B', algorithmName: 'EP_DBLF', computationMs: null, name: null,
  volumePercent: 60, payloadPercent: null, approved: false, approvedByName: null, centerOfGravityCm: null, frontAxleLoadKg: null,
  rearAxleLoadKg: null, rehandlingCount: null, manuallyEdited: false, stale: false, placements: [], unplaced: [],
}

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function Planner() {
  const [params] = useSearchParams()
  return <p>Planner phương án {params.get('revision')}</p>
}

function renderRerun() {
  const onOpenChange = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/chuyen/TRIP-42/phuong-an?revision=12']}>
          <Routes>
            <Route path="/chuyen/:tripId/phuong-an" element={<><Planner /><BackendRerunDialog tripCode="TRIP-42" plan={PLAN} pinnedCount={2} open onOpenChange={onOpenChange} /></>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
  return onOpenChange
}

test('chạy lại giữ ghim gửi mục tiêu của phương án đang xem rồi mở phương án mới trong Planner', async () => {
  const { calls } = stubBackend({ 'POST /api/load-plans/12/rerun': { body: envelope({ id: 13, jobUuid: 'job-2', parentPlanId: 12 }) } })
  const onOpenChange = renderRerun()
  const dialog = within(await screen.findByRole('dialog', { name: 'Chạy lại giữ 2 kiện đã ghim?' }))
  expect(dialog.getByText(/dùng 1 credit/)).toBeInTheDocument()
  await userEvent.click(dialog.getByRole('button', { name: 'Chạy lại' }))
  expect(await screen.findByText('Planner phương án 13')).toBeInTheDocument()
  expect(calls[0]?.body).toEqual({ timeLimitSec: 10, objective: 'AXLE_BALANCE' })
  expect(onOpenChange).toHaveBeenCalledWith(false)
})

test('máy chủ từ chối (hết credit): hộp vẫn mở, toast nói lý do, Planner giữ phương án cũ', async () => {
  const { toast } = await import('sonner')
  stubBackend({ 'POST /api/load-plans/12/rerun': { status: 402, body: { success: false, code: 'INSUFFICIENT_CREDITS', message: 'Hết credit' } } })
  const onOpenChange = renderRerun()
  await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Chạy lại' }))
  await waitFor(() => expect(toast.error).toHaveBeenCalled())
  expect(onOpenChange).not.toHaveBeenCalled()
  expect(screen.getByText('Planner phương án 12')).toBeInTheDocument()
})

function renderCard(placement: ScenePlacement, onToggle: (placement: ScenePlacement) => void, disabledReason?: string) {
  render(
    <MemoryRouter>
      <I18nProvider>
        <SelectedPackagePanel placement={placement} placements={[placement]} totalSteps={1} stops={[]} tripId="TRIP-42" onFocus={() => undefined}
          pin={{ pending: false, onToggle, disabledReason }} />
      </I18nProvider>
    </MemoryRouter>,
  )
  return within(screen.getByRole('complementary', { name: 'Kiện đang chọn' }))
}

test('thẻ kiện đang chọn: kiện chưa ghim có nút "Ghim", bấm là gửi kiện đó', async () => {
  const onToggle = vi.fn()
  const card = renderCard(sceneBox('PK-0007'), onToggle)
  await userEvent.click(card.getByRole('button', { name: 'Ghim' }))
  expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'PK-0007', pinned: false }))
})

test('kiện đã ghim: chữ "Đã ghim" và nút "Bỏ ghim"', () => {
  const card = renderCard(sceneBox('PK-0008', 0, 0, 0, { pinned: true }), vi.fn())
  expect(card.getByRole('button', { name: 'Bỏ ghim' })).toBeInTheDocument()
  expect(card.getAllByText(/Đã ghim/).length).toBeGreaterThan(0)
})

test('chuyến còn Nháp: nút "Ghim" mờ, lý do ngay dưới nút; bấm không gửi gì', async () => {
  const onToggle = vi.fn()
  const card = renderCard(sceneBox('PK-0007'), onToggle, 'Chuyến còn Nháp: chỉ ghim và chạy lại được khi chuyến Đã lập kế hoạch.')
  const button = card.getByRole('button', { name: 'Ghim' })
  expect(button).toBeDisabled()
  expect(button).toHaveAccessibleDescription('Chuyến còn Nháp: chỉ ghim và chạy lại được khi chuyến Đã lập kế hoạch.')
  await userEvent.click(button)
  expect(onToggle).not.toHaveBeenCalled()
})

test('máy chủ từ chối vì chuyến đã rời Đã lập kế hoạch (409 TRIP_LOCKED): câu nói đúng lý do', () => {
  const message = dataErrorMessage(new ApiError('TRIP_LOCKED', { status: 409 }), createTranslator('vi'))
  expect(message).toBe('Chuyến không còn ở Đã lập kế hoạch nên không ghim, bỏ ghim hay chạy lại phương án được nữa. Tải lại để xem trạng thái mới.')
})
