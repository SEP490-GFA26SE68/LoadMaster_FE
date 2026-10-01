import { Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import { useT } from '@/lib/i18n'
import type { PlannerLock } from './approval/planner-access'
import { PlannerNoticeBar } from './PlannerNoticeBar'

/** Pha chuyến đã chốt phương án (D-45): thanh khoá tông thông tin; lý do do quyền (chỉ xem, chờ duyệt) tông trung tính. */
const PHASE_LOCKS: ReadonlySet<PlannerLock> = new Set(['loading', 'loaded', 'delivering', 'completed', 'cancelled'])

/**
 * Thanh khoá dưới thanh trên Planner (LM-094; V2.3 LM-107): một câu lý do vì sao chỉ xem, kho đang / đã xếp thì thêm câu giải thích và
 * dòng tiến độ kho (`detail`, V2.3 `Planner3DKhoa`). Không khoá thì không vẽ gì.
 */
export function PlannerLockNotice({ lock, detail }: {
  lock: PlannerLock | null
  /** Dòng thứ hai của thanh khoá: tiến độ kho khi chuyến đang / đã xếp. */
  detail?: ReactNode
}) {
  const t = useT()
  if (!lock) return null
  const phase = PHASE_LOCKS.has(lock)
  const reason = lock === 'loading' || lock === 'loaded' ? t(`viewer.lock.detail.${lock}`) : null
  return (
    <PlannerNoticeBar role="status" data-planner-lock={lock} tone={phase ? 'info' : 'neutral'} icon={Lock} detail={detail}
      title={<>{t(`viewer.lock.${lock}`)}{reason ? <span className="font-normal"> {reason}</span> : null}</>} />
  )
}
