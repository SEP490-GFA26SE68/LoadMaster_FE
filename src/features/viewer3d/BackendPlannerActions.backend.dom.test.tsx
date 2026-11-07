import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, test, vi } from 'vitest'
import type { LoadPlan } from '@/features/optimization/load-plan-dto'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { I18nProvider } from '@/lib/i18n'
import { BackendPlannerActions, type BackendEditsAction } from './BackendPlannerActions'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

/** Nút Duyệt của Planner bản máy chủ: phương án lỗi thời mờ kèm lý do; draft có chỉnh sửa thì nút chính là "Duyệt bản chỉnh". */
const PLAN: LoadPlan = {
  id: '12', tripId: '42', jobId: null, objective: null, label: null, algorithmName: null, runAlgorithm: null, computationMs: null, name: null,
  volumePercent: 60, payloadPercent: null, approved: true, approvedByName: 'Lê Minh Châu', centerOfGravityCm: null, frontAxleLoadKg: null,
  rearAxleLoadKg: null, rehandlingCount: null, manuallyEdited: false, stale: false, stopZones: null, placements: [], unplaced: [],
}

function renderActions(plan: LoadPlan, approve: 'ready' | 'draft' | 'stale' | null, edits?: BackendEditsAction) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider>
        <MemoryRouter>
          <TooltipProvider>
            <BackendPlannerActions tripCode="TRIP-42" plan={plan} approve={approve} edits={edits} />
          </TooltipProvider>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

test('phương án lỗi thời: nút Duyệt mờ, lý do nối vào nút', () => {
  renderActions({ ...PLAN, approved: false, stale: true }, 'stale')
  const button = screen.getByRole('button', { name: 'Duyệt phương án' })
  expect(button).toBeDisabled()
  expect(button).toHaveAccessibleDescription('Phương án đã lỗi thời: tối ưu lại rồi mới duyệt được.')
})

test('draft có chỉnh sửa trên bản đã duyệt: "Duyệt bản chỉnh" thay chip Đã duyệt, xác nhận gọi lệnh gửi bản chỉnh', async () => {
  const onConfirm = vi.fn()
  renderActions(PLAN, 'ready', { blockedReason: null, pending: false, onConfirm })
  expect(screen.queryByText('Đã duyệt')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Duyệt bản chỉnh' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Duyệt bản chỉnh này?' }))
  await userEvent.click(dialog.getByRole('button', { name: 'Duyệt bản chỉnh' }))
  expect(onConfirm).toHaveBeenCalledTimes(1)
})

test('bản chỉnh gây lỗi ràng buộc: nút mờ kèm số lỗi', () => {
  renderActions(PLAN, 'ready', { blockedReason: 'Chưa duyệt được: bản chỉnh gây 1 lỗi ràng buộc.', pending: false, onConfirm: vi.fn() })
  const button = screen.getByRole('button', { name: 'Duyệt bản chỉnh' })
  expect(button).toBeDisabled()
  expect(button).toHaveAccessibleDescription('Chưa duyệt được: bản chỉnh gây 1 lỗi ràng buộc.')
})
