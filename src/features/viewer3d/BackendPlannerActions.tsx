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

/**
 * Bên phải thanh trên Planner bản máy chủ: "Đã duyệt" (kèm người duyệt — máy chủ chưa trả giờ duyệt) hoặc nút chính "Duyệt phương án",
 * và So sánh mở các phương án của lần chạy. `approve`: `ready` duyệt được, `draft` chuyến còn Nháp (nút mờ kèm lý do), `null` không có
 * nút (người xem không duyệt được, hoặc chuyến đã sang pha vận hành — thanh khoá nói lý do).
 */
export function BackendPlannerActions({ tripCode, plan, approve }: { tripCode: string; plan: LoadPlan; approve: 'ready' | 'draft' | null }) {
  const t = useT()
  const mutation = useApproveBackendPlanMutation()
  const [open, setOpen] = useState(false)
  const reasonId = useId()
  const compare = t('viewer.plan.compare')
  function handleConfirm() {
    mutation.mutate(plan.id, {
      onSuccess: () => { setOpen(false); toast.success(t('serverPlans.planner.approved')) },
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }
  return (
    <div className="flex shrink-0 items-center gap-2">
      {plan.approved ? (
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
      {!plan.approved && approve !== null ? (
        <>
          <Button variant="primary" className="h-14 px-4 text-body-lg xl:h-10 xl:text-body" disabled={approve === 'draft'}
            aria-describedby={approve === 'draft' ? reasonId : undefined} onClick={() => setOpen(true)}>
            {approve === 'draft' ? <CircleAlert strokeWidth={1.5} /> : <Check strokeWidth={1.5} />}
            {t('serverPlans.planner.approve')}
          </Button>
          {approve === 'draft' ? <span id={reasonId} className="sr-only">{t('serverPlans.planner.draftReason')}</span> : null}
        </>
      ) : null}
      <ConfirmDialog open={open} onOpenChange={setOpen} title={t('serverPlans.planner.approveTitle')}
        description={t('serverPlans.planner.approveDescription')} cancelLabel={t('serverPlans.planner.approveCancel')}
        confirmLabel={t('serverPlans.planner.approve')} pending={mutation.isPending} onConfirm={handleConfirm} />
    </div>
  )
}
