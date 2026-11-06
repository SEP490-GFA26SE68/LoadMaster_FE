import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { LoadPlan } from '@/features/optimization/load-plan-dto'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { useRerunBackendPlanMutation } from './useBackendPlanQuery'

/**
 * Hộp xác nhận "Chạy lại giữ ghim" của Planner bản máy chủ (`POST /api/load-plans/{id}/rerun`). Máy chủ trừ 1 credit, chạy xong mới trả
 * lời và lưu **một** phương án mới chưa duyệt (không phải ba phương án A · B · C), nên chạy xong màn mở chính phương án đó trong Planner
 * (`?revision=`), không mở màn So sánh. Lỗi (hết credit, dịch vụ tối ưu không phản hồi) giữ hộp mở kèm toast.
 */
export function BackendRerunDialog({ tripCode, plan, pinnedCount, open, onOpenChange }: {
  tripCode: string; plan: LoadPlan; pinnedCount: number; open: boolean; onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const navigate = useNavigate()
  const mutation = useRerunBackendPlanMutation(plan.id, plan.objective)
  function handleConfirm() {
    mutation.mutate(undefined, {
      onSuccess: ({ planId }) => {
        onOpenChange(false)
        toast.success(t('serverPlans.planner.rerunDone'))
        void navigate(`/chuyen/${encodeURIComponent(tripCode)}/phuong-an?revision=${encodeURIComponent(planId)}`)
      },
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }
  return (
    <ConfirmDialog open={open} onOpenChange={(next) => { if (!mutation.isPending) onOpenChange(next) }}
      title={t('serverPlans.planner.rerunTitle', { count: pinnedCount })} description={t('serverPlans.planner.rerunDescription')}
      cancelLabel={t('serverPlans.planner.approveCancel')} confirmLabel={t('serverPlans.planner.rerunConfirm')}
      pending={mutation.isPending} onConfirm={handleConfirm} />
  )
}
