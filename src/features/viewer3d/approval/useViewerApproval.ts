import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useT } from '@/lib/i18n'
import type { ViewerSceneModel } from '../scene-input'
import type { LoadPlanViewerState } from '../useLoadPlanViewer'
import { useApproveRevisionMutation } from '../usePlanSourceQuery'
import { planApproval } from './plan-approval'

/**
 * Duyệt trong Planner (LM-050): kiểm lại theo draft hiện tại, lý do chặn cho header, và lệnh Duyệt gửi patch của draft — bản chỉnh tay
 * được duyệt cùng lúc, không có bước lưu riêng (FE-0-07). Duyệt xong mở đúng revision approved theo mã revision; phiên Planner mới
 * có draft rỗng.
 */
export function useViewerApproval(model: ViewerSceneModel, state: LoadPlanViewerState) {
  const t = useT()
  const navigate = useNavigate()
  const mutation = useApproveRevisionMutation(model.tripId)
  const approval = useMemo(() => planApproval(model, state.placements, state.draft), [model, state.placements, state.draft])

  const errorCount = approval?.blockers.issues.length ?? 0
  const blockedReason = !model.revision || !approval ? null
    : approval.blockers.stale ? t('viewer.plan.blockedStale')
      : errorCount > 0 ? t('viewer.plan.blocked', { count: errorCount }) : null

  function confirm(onDone: () => void) {
    const revision = model.revision
    if (!revision || !approval?.blockers.canApprove) return
    mutation.mutate({ revisionId: revision.id, patches: approval.patches }, {
      onSuccess: (approved) => {
        onDone()
        toast.success(t('viewer.plan.dialog.done'))
        void navigate(`/chuyen/${model.tripId}/phuong-an?revision=${approved.id}`, { replace: true })
      },
      onError: () => toast.error(t('viewer.plan.dialog.failed')),
    })
  }

  return { approval, blockedReason, confirm, pending: mutation.isPending, canSubmit: Boolean(model.revision) }
}
