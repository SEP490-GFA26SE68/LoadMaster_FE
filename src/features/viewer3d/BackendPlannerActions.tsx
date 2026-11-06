import { Check, CircleAlert, Columns2 } from 'lucide-react'
import { useId, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'
import type { LoadPlan } from '@/features/optimization/load-plan-dto'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { useApproveBackendPlanMutation } from './useBackendPlanQuery'

/** "Duyệt bản chỉnh" của Planner bản máy chủ: draft đã dời / xoay hoặc đổi ghim. */
export type BackendEditsAction = {
  /** Lý do chưa gửi được bản chỉnh (lỗi ràng buộc mới), `null` là gửi được. */
  readonly blockedReason: string | null
  readonly pending: boolean
  readonly onConfirm: (done: () => void) => void
}

/**
 * Bên phải thanh trên Planner bản máy chủ: "Đã duyệt" (kèm người duyệt — máy chủ chưa trả giờ duyệt) hoặc nút chính "Duyệt phương án",
 * và So sánh mở các phương án của lần chạy. `approve`: `ready` duyệt được, `draft` chuyến còn Nháp, `stale` phương án lỗi thời (máy chủ
 * từ chối `PLAN_STALE`) — hai trường hợp sau nút mờ kèm lý do ở tooltip và `aria-describedby` —, `null` không có nút (người xem không
 * duyệt được, hoặc chuyến đã sang pha vận hành — thanh khoá nói lý do). Có `edits` thì nút chính là "Duyệt bản chỉnh".
 */
export function BackendPlannerActions({ tripCode, plan, approve, edits }: {
  tripCode: string
  plan: LoadPlan
  approve: 'ready' | 'draft' | 'stale' | null
  edits?: BackendEditsAction
}) {
  const t = useT()
  const mutation = useApproveBackendPlanMutation()
  const [open, setOpen] = useState(false)
  const reasonId = useId()
  const compare = t('viewer.plan.compare')
  const reason = edits ? edits.blockedReason
    : approve === 'draft' ? t('serverPlans.planner.draftReason')
      : approve === 'stale' ? t('serverPlans.planner.staleReason') : null
  const showApprove = edits !== undefined || (!plan.approved && approve !== null)
  const label = t(edits ? 'serverPlans.planner.approveEdits' : 'serverPlans.planner.approve')
  function handleConfirm() {
    if (edits) { edits.onConfirm(() => setOpen(false)); return }
    mutation.mutate(plan.id, {
      onSuccess: () => { setOpen(false); toast.success(t('serverPlans.planner.approved')) },
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }
  return (
    <div className="flex shrink-0 items-center gap-2">
      {plan.approved && !edits ? (
        <p className="flex items-center gap-2 pr-1" data-approved-at>
          <span aria-hidden className="grid size-5.5 flex-none place-items-center rounded-full bg-cyan-400 text-cyan-950 shadow-[0_0_12px_-2px_var(--cyan-400)]">
            <Check className="size-3.5" strokeWidth={2.5} />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-display text-body leading-5 font-semibold text-sky-text">{t('serverPlans.planner.approvedChip')}</span>
            {plan.approvedByName ? (
              <span className="max-w-40 truncate text-caption leading-4 text-glass-dark-muted md:max-w-52" title={plan.approvedByName}>
                {t('serverPlans.planner.approvedBy', { name: plan.approvedByName })}
              </span>
            ) : null}
          </span>
        </p>
      ) : null}
      {plan.jobId ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="glass" className="hidden h-9.5 px-2.5 xl:flex 2xl:px-3.5" asChild>
              <Link to={`/chuyen/${encodeURIComponent(tripCode)}/so-sanh?lan-chay=${encodeURIComponent(plan.jobId)}`} aria-label={compare}>
                <Columns2 strokeWidth={1.5} />
                <span className="hidden 2xl:inline">{compare}</span>
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="2xl:hidden">{compare}</TooltipContent>
        </Tooltip>
      ) : null}
      {showApprove ? (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex" tabIndex={reason ? 0 : undefined}>
                <Button variant="primary" className="h-14 px-4 text-body-lg xl:h-10 xl:text-body" disabled={reason !== null}
                  aria-describedby={reason ? reasonId : undefined} onClick={() => setOpen(true)}>
                  {reason ? <CircleAlert strokeWidth={1.5} /> : <Check strokeWidth={1.5} />}
                  {label}
                </Button>
              </span>
            </TooltipTrigger>
            {reason ? <TooltipContent side="bottom" className="max-w-72">{reason}</TooltipContent> : null}
          </Tooltip>
          {reason ? <span id={reasonId} className="sr-only">{reason}</span> : null}
        </>
      ) : null}
      <ConfirmDialog open={open} onOpenChange={setOpen}
        title={t(edits ? 'serverPlans.planner.approveEditsTitle' : 'serverPlans.planner.approveTitle')}
        description={t(edits ? 'serverPlans.planner.approveEditsDescription' : 'serverPlans.planner.approveDescription')}
        cancelLabel={t('serverPlans.planner.approveCancel')}
        confirmLabel={label} pending={edits ? edits.pending : mutation.isPending} onConfirm={handleConfirm} />
    </div>
  )
}
