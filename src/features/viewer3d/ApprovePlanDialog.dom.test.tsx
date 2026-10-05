import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { deadlineReview, type ConstraintIssue } from '@/domain/constraints'
import { I18nProvider } from '@/lib/i18n'
import { twoCartonResult } from '@/test/mock-db-samples'
import { ApprovePlanDialog } from './ApprovePlanDialog'
import type { PlanApproval } from './approval/plan-approval'
import type { SceneStop } from './scene-input'

/**
 * Hộp thoại Duyệt theo luật mới (FE-5b-08, D-80): điểm sát hạn chỉ hiện; có điểm trễ hạn dự kiến thì phải qua bước xác nhận liệt kê
 * điểm, giờ đến dự kiến và hạn rồi mới gửi Duyệt kèm `force`; còn lý do chặn thì nút Duyệt khoá.
 */

/** Giờ theo múi giờ của máy chạy test, nên chuỗi mong đợi không phụ thuộc múi giờ. */
const at = (hour: number, minute: number) => new Date(2026, 8, 16, hour, minute).toISOString()

const ON_TIME: SceneStop = { number: 1, name: 'Co.opmart Biên Hoà', packageCount: 40, deadline: at(12, 0), eta: at(8, 40), deadlineStatus: 'OK' }
const CLOSE: SceneStop = { number: 2, name: 'Bách Hoá Xanh Dĩ An', packageCount: 52, deadline: at(10, 0), eta: at(9, 45), deadlineStatus: 'AT_RISK' }
const LATE: SceneStop = { number: 3, name: 'Co.opmart Bình Dương', packageCount: 30, deadline: at(10, 30), eta: at(11, 5), deadlineStatus: 'MISSED' }
const NO_DEADLINE: SceneStop = { number: 4, name: 'Kho Sóng Thần', packageCount: 10, eta: at(11, 50) }

const CLEAN: PlanApproval = { blockers: { canApprove: true, issues: [], stale: false }, warnings: [], patches: [] }

function renderDialog(stops: readonly SceneStop[], approval: PlanApproval = CLEAN) {
  const onConfirm = vi.fn()
  render(
    <I18nProvider>
      <ApprovePlanDialog open onOpenChange={() => {}} metrics={twoCartonResult().metrics} canSubmit approval={approval}
        deadlines={deadlineReview(stops)} checks={[]} pending={false} onConfirm={onConfirm} isMockResult />
    </I18nProvider>,
  )
  return { onConfirm, user: userEvent.setup() }
}

test('stops close to the deadline are listed with ETA and deadline, and approving asks nothing more', async () => {
  const { onConfirm, user } = renderDialog([ON_TIME, CLOSE, NO_DEADLINE])
  const dialog = within(screen.getByRole('dialog', { name: 'Duyệt phương án này?' }))
  expect(dialog.getByText('1 điểm giao sát hạn (không chặn duyệt).')).toBeInTheDocument()
  expect(dialog.getByText('Điểm 2 · Bách Hoá Xanh Dĩ An')).toBeInTheDocument()
  expect(dialog.getByText('Dự kiến đến 09:45 16/09 · hạn 10:00 16/09')).toBeInTheDocument()
  expect(dialog.queryByText(/trễ hạn dự kiến/)).toBeNull()
  await user.click(dialog.getByRole('button', { name: 'Duyệt' }))
  expect(onConfirm.mock.calls).toStrictEqual([[false]])
  expect(screen.getByRole('dialog', { name: 'Duyệt phương án này?' })).toBeInTheDocument()
})

test('a stop expected to miss its deadline needs a second, explicit confirmation that lists it; only then approval is sent with force', async () => {
  const { onConfirm, user } = renderDialog([ON_TIME, CLOSE, LATE, NO_DEADLINE])
  const review = within(screen.getByRole('dialog', { name: 'Duyệt phương án này?' }))
  expect(review.getByText('1 điểm giao trễ hạn dự kiến — cần xác nhận khi duyệt.')).toBeInTheDocument()
  expect(review.getByText('Dự kiến đến 11:05 16/09 · hạn 10:30 16/09')).toBeInTheDocument()
  expect(review.getByText('1 điểm giao sát hạn (không chặn duyệt).')).toBeInTheDocument()
  await user.click(review.getByRole('button', { name: 'Duyệt' }))
  expect(onConfirm).not.toHaveBeenCalled()

  const confirm = within(screen.getByRole('dialog', { name: 'Duyệt dù có điểm trễ hạn?' }))
  const late = within(confirm.getByRole('list', { name: 'Điểm giao trễ hạn dự kiến' })).getAllByRole('listitem')
  expect(late.map((item) => item.textContent)).toStrictEqual(['Điểm 3 · Co.opmart Bình DươngDự kiến đến 11:05 16/09 · hạn 10:30 16/09'])
  // ETA là kết quả của mock tối ưu tuyến
  expect(confirm.getByText('MOCK RESULT')).toBeInTheDocument()
  // Quay lại không gửi gì; lần sau vẫn phải xác nhận
  await user.click(confirm.getByRole('button', { name: 'Quay lại' }))
  expect(onConfirm).not.toHaveBeenCalled()
  await user.click(within(screen.getByRole('dialog', { name: 'Duyệt phương án này?' })).getByRole('button', { name: 'Duyệt' }))
  await user.click(within(screen.getByRole('dialog', { name: 'Duyệt dù có điểm trễ hạn?' })).getByRole('button', { name: 'Vẫn duyệt' }))
  expect(onConfirm.mock.calls).toStrictEqual([[true]])
})

test('every stop with a deadline on time says so; a trip without a route says nothing about deadlines', () => {
  renderDialog([ON_TIME, NO_DEADLINE])
  expect(screen.getByText('Mọi điểm giao có hạn đều kịp hạn.')).toBeInTheDocument()
})

test('a plan with blockers lists them and cannot be approved, late stops or not', async () => {
  const mustLoad: ConstraintIssue = { code: 'MUST_LOAD_UNPLACED', severity: 'blockApproval', params: { packageId: 'PKG-002' } }
  const overload: ConstraintIssue = { code: 'AXLE_OVERLOAD', severity: 'error', params: { group: 'rear', loadKg: 6240.5, limitKg: 6000, overKg: 240.5 } }
  const { onConfirm, user } = renderDialog([LATE], { blockers: { canApprove: false, issues: [overload, mustLoad], stale: false }, warnings: [], patches: [] })
  const dialog = within(screen.getByRole('dialog', { name: 'Duyệt phương án này?' }))
  expect(within(dialog.getByRole('alert')).getAllByRole('listitem')).toHaveLength(2)
  const approve = dialog.getByRole('button', { name: 'Duyệt' })
  expect(approve).toBeDisabled()
  await user.click(approve)
  expect(onConfirm).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog', { name: 'Duyệt dù có điểm trễ hạn?' })).toBeNull()
})
