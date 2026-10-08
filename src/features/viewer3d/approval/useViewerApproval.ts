import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { blockerSummary, deadlineReview } from '@/domain/constraints'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { ViewerSceneModel } from '../scene-input'
import type { LoadPlanViewerState } from '../useLoadPlanViewer'
import { useApproveRevisionMutation } from '../usePlanSourceQuery'
import { planApproval } from './plan-approval'

/**
 * Duyệt trong Planner (LM-050): kiểm lại theo draft hiện tại, lý do chặn cho header, và lệnh Duyệt gửi patch của draft — bản chỉnh tay
 * được duyệt cùng lúc, không có bước lưu riêng (FE-0-07). Duyệt xong mở đúng revision approved theo mã revision; phiên Planner mới
 * có draft rỗng.
 *
 * Luật duyệt (FE-5b-08, D-80): lý do chặn nói theo từng loại — lỗi thời, dòng kiện bắt buộc chưa xếp đủ, vượt tải trục, lỗi ràng buộc
 * khác. Mức hạn của các điểm giao (`deadlines`) lấy từ tuyến đã tối ưu của chuyến: có điểm trễ hạn dự kiến thì `confirm` phải mang
 * `force` — hộp thoại hỏi xác nhận trước; kho từ chối thì câu của kho hiện ở toast.
 */
export function useViewerApproval(model: ViewerSceneModel, state: LoadPlanViewerState) {
  const t = useT()
  const format = useFormat()
  const navigate = useNavigate()
  const mutation = useApproveRevisionMutation(model.tripId)
  const approval = useMemo(() => planApproval(model, state.placements, state.draft), [model, state.placements, state.draft])
  const deadlines = useMemo(() => deadlineReview(model.stops), [model.stops])

  const blockedReason = useMemo(() => {
    if (!model.revision || !approval) return null
    const summary = blockerSummary(approval.blockers)
    const reasons = [
      summary.stale ? t('viewer.plan.blockedBy.stale') : null,
      summary.mustLoadUnplaced > 0 ? t('viewer.plan.blockedBy.mustLoad', { count: summary.mustLoadUnplaced }) : null,
      summary.axleOverload > 0 ? t('viewer.plan.blockedBy.axle') : null,
      summary.constraintErrors > 0 ? t('viewer.plan.blockedBy.errors', { count: summary.constraintErrors }) : null,
    ].filter((reason): reason is string => reason !== null)
    return reasons.length > 0 ? t('viewer.plan.blockedReason', { reasons: format.list(reasons) }) : null
  }, [model.revision, approval, t, format])

  function confirm(onDone: () => void, { force = false }: { force?: boolean } = {}) {
    const revision = model.revision
    if (!revision || !approval?.blockers.canApprove) return
    mutation.mutate({ revisionId: revision.id, patches: approval.patches, pinned: approval.pinned, force }, {
      onSuccess: (approved) => {
        onDone()
        toast.success(t('viewer.plan.dialog.done'))
        void navigate(`/chuyen/${model.tripId}/phuong-an?revision=${approved.id}`, { replace: true })
      },
      onError: (error) => toast.error(t('viewer.plan.dialog.failed'), { description: dataErrorMessage(error, t) }),
    })
  }

  return { approval, deadlines, blockedReason, confirm, pending: mutation.isPending, canSubmit: Boolean(model.revision) }
}
