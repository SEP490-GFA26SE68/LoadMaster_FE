import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, test, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { I18nProvider } from '@/lib/i18n'
import { plannerAccess, type PlannerAccess } from '../approval/planner-access'
import { PlannerActions } from './PlannerActions'

/** Bên phải thanh trên Planner (LM-094, FE-0-07): "Đã duyệt lúc …", "Duyệt bản chỉnh", lý do chặn trong mô tả nút, khoá, chỉ xem. */

/** 09:15 ngày 14/09/2026 theo giờ máy chạy test, nên chuỗi mong đợi không phụ thuộc múi giờ. */
const APPROVED_AT = new Date(2026, 8, 14, 9, 15).toISOString()

function renderActions(access: PlannerAccess, { blockedReason = null as string | null, onEdit = undefined as (() => void) | undefined } = {}) {
  const onApprove = vi.fn()
  render(
    <I18nProvider>
      <TooltipProvider>
        <MemoryRouter>
          <PlannerActions tripId="TRIP-2026-0914" access={access} blockedReason={blockedReason} onApprove={onApprove} onEdit={onEdit} />
        </MemoryRouter>
      </TooltipProvider>
    </I18nProvider>,
  )
  return { onApprove, user: userEvent.setup() }
}

test('an approved plan without edits says when it was approved and has no Approve button', () => {
  renderActions(plannerAccess({ canApprove: true, approvedAt: APPROVED_AT, hasEdits: false }), { onEdit: () => {} })
  expect(screen.getByText('Đã duyệt lúc')).toBeInTheDocument()
  expect(screen.getByText('09:15 14/09')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Duyệt/ })).toBeNull()
  expect(screen.getByRole('button', { name: 'Chỉnh sửa' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'So sánh phương án' })).toHaveAttribute('href', '/chuyen/TRIP-2026-0914/so-sanh')
})

test('when the store knows who approved, the label names them; an account that only reads has no Edit and no Approve', () => {
  const onApprove = vi.fn()
  render(
    <I18nProvider>
      <TooltipProvider>
        <MemoryRouter>
          <PlannerActions tripId="TRIP-2026-0914" access={plannerAccess({ canApprove: false, approvedAt: APPROVED_AT, hasEdits: false })}
            blockedReason={null} onApprove={onApprove} approvedBy="Nguyễn Thanh Tùng" />
        </MemoryRouter>
      </TooltipProvider>
    </I18nProvider>,
  )
  expect(screen.getByText('Duyệt bởi Nguyễn Thanh Tùng lúc')).toBeInTheDocument()
  expect(screen.getByText('09:15 14/09')).toBeInTheDocument()
  // Quản lý công ty (không có quyền duyệt): Planner không đưa `onEdit`, và không có nút Duyệt nào
  expect(screen.queryByRole('button', { name: 'Chỉnh sửa' })).toBeNull()
  expect(screen.queryByRole('button', { name: /^Duyệt/ })).toBeNull()
})

test('a candidate of an optimisation run opens the comparison of that run; any other revision opens the matrix of all revisions', () => {
  const access = plannerAccess({ canApprove: true, approvedAt: null, hasEdits: false })
  const view = render(
    <I18nProvider>
      <TooltipProvider>
        <MemoryRouter>
          <PlannerActions tripId="TRIP-2026-0914" access={access} blockedReason={null} onApprove={vi.fn()} compareRunId="RUN-002" />
        </MemoryRouter>
      </TooltipProvider>
    </I18nProvider>,
  )
  expect(screen.getByRole('link', { name: 'So sánh phương án' })).toHaveAttribute('href', '/chuyen/TRIP-2026-0914/so-sanh?lan-chay=RUN-002')
  view.unmount()
  renderActions(access)
  expect(screen.getByRole('link', { name: 'So sánh phương án' })).toHaveAttribute('href', '/chuyen/TRIP-2026-0914/so-sanh')
})

test('an unapproved plan read by an account without the approve permission has no Approve button either', () => {
  renderActions(plannerAccess({ canApprove: false, approvedAt: null, hasEdits: false }))
  expect(screen.queryByRole('button', { name: /^Duyệt/ })).toBeNull()
  expect(screen.queryByText('Đã duyệt lúc')).toBeNull()
  expect(screen.getByRole('link', { name: 'So sánh phương án' })).toBeInTheDocument()
})

test('edits turn the primary action into "Duyệt bản chỉnh"', async () => {
  const { onApprove, user } = renderActions(plannerAccess({ canApprove: true, approvedAt: APPROVED_AT, hasEdits: true }))
  expect(screen.queryByText('Đã duyệt lúc')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Duyệt bản chỉnh' }))
  expect(onApprove).toHaveBeenCalledOnce()
})

test('the blocking reason describes the Approve button instead of sitting in the bar as red text', () => {
  renderActions(plannerAccess({ canApprove: true, approvedAt: null, hasEdits: false }), { blockedReason: 'Chưa duyệt được: kết quả lỗi thời.' })
  expect(screen.getByRole('button', { name: 'Duyệt phương án' })).toHaveAccessibleDescription('Chưa duyệt được: kết quả lỗi thời.')
  expect(document.querySelector('.text-badge-danger-fg')).toBeNull()
})

test('a locked plan offers neither Edit nor Approve', () => {
  renderActions(plannerAccess({ phase: 'loading', canApprove: true, approvedAt: APPROVED_AT, hasEdits: false }))
  expect(screen.queryByRole('button', { name: 'Chỉnh sửa' })).toBeNull()
  expect(screen.queryByRole('button', { name: /^Duyệt/ })).toBeNull()
  expect(screen.getByText('09:15 14/09')).toBeInTheDocument()
})
