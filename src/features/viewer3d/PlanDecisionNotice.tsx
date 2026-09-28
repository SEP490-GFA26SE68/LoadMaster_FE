import { Lock, MessageSquareWarning, SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { DecisionSummary, type DecisionView } from '@/features/review/DecisionSummary'
import { useT } from '@/lib/i18n'
import type { PlannerLock } from './approval/planner-access'
import { PlannerNoticeBar, PlannerNoticeLink } from './PlannerNoticeBar'

/** Pha chuyến đã chốt phương án (D-45): thanh khoá tông thông tin; lý do do quyền (chỉ xem, chờ duyệt) tông trung tính. */
const PHASE_LOCKS: ReadonlySet<PlannerLock> = new Set(['loading', 'loaded', 'delivering', 'completed', 'cancelled'])

/**
 * Dòng dưới thanh trên Planner (LM-094, LM-104; V2.3 LM-107). Có quyết định trả lại của quản lý công ty trên bản đang xem thì thanh kể
 * quyết định đó (lý do nguyên văn, ai, lúc nào) — điều phối viên đọc ở đây thay vì câu "Chờ quản lý công ty duyệt" — kèm lối tới Thiết
 * lập tối ưu khi người xem chạy lại được (`rerunTo`). Không có quyết định thì là thanh khoá: một câu lý do vì sao chỉ xem, kho đang / đã
 * xếp thì thêm câu giải thích và dòng tiến độ kho (`detail`, V2.3 `Planner3DKhoa`).
 */
export function PlanDecisionNotice({ lock, decision, rerunTo, detail }: {
  lock: PlannerLock | null
  decision: DecisionView | null
  rerunTo?: string
  /** Dòng thứ hai của thanh khoá: tiến độ kho khi chuyến đang / đã xếp. */
  detail?: ReactNode
}) {
  const t = useT()
  if (decision) {
    const rejected = decision.kind === 'rejected'
    return (
      <PlannerNoticeBar role="status" data-plan-decision={decision.kind} tone={rejected ? 'danger' : 'warning'} icon={MessageSquareWarning}
        action={rerunTo ? <PlannerNoticeLink tone={rejected ? 'danger' : 'warning'} to={rerunTo} icon={SlidersHorizontal}>{t('viewer.plan.rerun')}</PlannerNoticeLink> : null}>
        {/* Câu quyết định dùng chung với Thiết lập tối ưu (nền sáng): đổi màu mực sang chữ sáng của thanh tối */}
        <div className={rejected
          ? 'text-body-lg xl:text-small [&_.text-ink-1]:text-red-50 [&_.text-ink-3]:text-red-200 [&_.text-ink-strong]:font-semibold [&_.text-ink-strong]:text-sky-text'
          : 'text-body-lg xl:text-small [&_.text-ink-1]:text-amber-50 [&_.text-ink-3]:text-amber-200 [&_.text-ink-strong]:font-semibold [&_.text-ink-strong]:text-sky-text'}>
          <DecisionSummary decision={decision} layout="inline" />
        </div>
      </PlannerNoticeBar>
    )
  }
  if (!lock) return null
  const phase = PHASE_LOCKS.has(lock)
  const reason = lock === 'loading' || lock === 'loaded' ? t(`viewer.lock.detail.${lock}`) : null
  return (
    <PlannerNoticeBar role="status" data-planner-lock={lock} tone={phase ? 'info' : 'neutral'} icon={Lock} detail={detail}
      title={<>{t(`viewer.lock.${lock}`)}{reason ? <span className="font-normal"> {reason}</span> : null}</>} />
  )
}
