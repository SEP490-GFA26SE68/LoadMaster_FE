import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import type { TFunction } from '@/lib/i18n'
import type { ApprovalCheck } from '../ApprovePlanDialog'
import { stopOrderConsistent } from './operations-model'
import { countLifoIssues } from './unloading'

export function operationApprovalChecks(placements: readonly ScenePlacement[], edited: boolean, t: TFunction): ApprovalCheck[] {
  const consistent = stopOrderConsistent(placements)
  const checks: ApprovalCheck[] = [{ tone: consistent ? 'success' : 'warning', text: consistent
    ? t('viewer.operations.orderConsistent') : t('viewer.operations.orderInconsistent') }]
  // Kiểm LIFO của domain (Spec 7.11, D-26): chỉ nói kiện giao sau có che lối dỡ hay không, không khẳng định dỡ được thực tế.
  const { blocked, partial } = countLifoIssues(placements)
  if (blocked) checks.push({ tone: 'warning', text: t('viewer.operations.approval.lifoBlocked', { count: blocked }) })
  if (partial) checks.push({ tone: 'warning', text: t('viewer.operations.approval.lifoPartial', { count: partial }) })
  if (!blocked && !partial) checks.push({ tone: 'warning', text: t('viewer.operations.approval.lifoClear') })
  // Tải trục (D-78) không kiểm ở đây: vượt giới hạn là issue `AXLE_OVERLOAD` của constraint engine và chặn Duyệt qua `approvalBlockers`.
  if (edited) checks.push({ tone: 'warning', text: t('viewer.operations.manualEdits') })
  return checks
}
