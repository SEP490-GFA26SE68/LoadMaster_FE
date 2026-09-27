import { Lock, MessageSquareWarning } from 'lucide-react'
import { Link } from 'react-router'
import { DecisionSummary, type DecisionView } from '@/features/review/DecisionSummary'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { PlannerLock } from './approval/planner-access'

/**
 * Dòng dưới thanh trên Planner (LM-094, LM-104). Có quyết định trả lại của quản lý công ty trên bản đang xem thì dòng kể quyết định đó
 * (lý do nguyên văn, ai, lúc nào) — điều phối viên đọc ở đây thay vì câu "Chờ quản lý công ty duyệt" — kèm lối tới Thiết lập tối ưu khi
 * người xem chạy lại được (`rerunTo`). Không có quyết định thì là dòng khoá cũ: một câu lý do vì sao chỉ xem.
 */
export function PlanDecisionNotice({ lock, decision, rerunTo }: {
  lock: PlannerLock | null
  decision: DecisionView | null
  rerunTo?: string
}) {
  const t = useT()
  if (decision) {
    const rejected = decision.kind === 'rejected'
    return (
      <div role="status" data-plan-decision={decision.kind}
        className={cn('flex flex-none items-start gap-3 border-b px-4 py-2 text-body',
          rejected ? 'border-badge-danger-border bg-badge-danger-bg' : 'border-badge-warning-border bg-badge-warning-bg')}>
        <MessageSquareWarning className={cn('mt-0.5 size-4 flex-none', rejected ? 'text-danger' : 'text-warning')} strokeWidth={1.5} aria-hidden />
        <div className="min-w-0 flex-1"><DecisionSummary decision={decision} layout="inline" /></div>
        {rerunTo ? <Link to={rerunTo} className="flex-none rounded-sm font-medium whitespace-nowrap text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{t('viewer.plan.rerun')}</Link> : null}
      </div>
    )
  }
  if (!lock) return null
  return (
    <div role="status" className="flex flex-none items-center gap-2 border-b border-border bg-surface px-4 py-2 text-body-lg text-text-2 xl:text-body" data-planner-lock={lock}>
      <Lock className="size-4 flex-none" strokeWidth={1.5} aria-hidden />
      <span>{t(`viewer.lock.${lock}`)}</span>
    </div>
  )
}
