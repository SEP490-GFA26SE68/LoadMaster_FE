import { ClipboardCheck } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { ScreenShell } from '@/components/ScreenShell'
import { useT } from '@/lib/i18n'
import { RecentDecisions } from './RecentDecisions'
import { ReviewPlanCard } from './ReviewPlanCard'
import { useReviewQueueQuery } from './useReviewQuery'

/**
 * Hàng đợi chờ duyệt `/duyet` (luồng 4 Review 1, LM-104) — quản lý công ty. Mỗi phương án chờ duyệt một thẻ, chờ lâu nhất trước (kho
 * sắp theo lúc gửi); nút chính duy nhất là "Xem & duyệt" của thẻ đầu. Duyệt, từ chối, yêu cầu tối ưu lại và đề xuất làm trong Planner
 * — nơi quản lý nhìn thấy phương án 3D trước khi quyết định. Cột phải: quyết định gần đây.
 */
export function ReviewQueuePage() {
  const t = useT()
  const query = useReviewQueueQuery()
  // Tuổi của phương án tính theo lúc mở màn; màn đọc lại hàng đợi mỗi lần mở
  const [now] = useState(() => new Date())
  const rows = query.data ?? []

  return (
    <ScreenShell
      title={t('review.title')}
      description={t('pageHero.review')}
      meta={query.data ? t('review.count', { count: rows.length }) : undefined}
      icon={ClipboardCheck}
      loading={query.isPending}
      error={query.error}
    >
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-label={t('review.title')}>
          {rows.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title={t('review.empty')} description={t('review.emptyDescription')} />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2" data-review-queue>
              {rows.map((row, index) => <ReviewPlanCard key={row.revisionId} row={row} primary={index === 0} now={now} />)}
            </div>
          )}
        </section>
        <RecentDecisions />
      </div>
    </ScreenShell>
  )
}
