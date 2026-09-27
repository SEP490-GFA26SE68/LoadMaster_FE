import { ClipboardCheck } from 'lucide-react'
import { ScreenShell } from '@/components/ScreenShell'
import { useT } from '@/lib/i18n'
import { useReviewQueueQuery } from './useReviewQuery'

/** Hàng đợi chờ duyệt `/duyet` (luồng 4, LM-104) — quản lý công ty. Khung màn: đếm phương án chờ duyệt; bảng và quyết định dựng tiếp. */
export function ReviewQueuePage() {
  const t = useT()
  const query = useReviewQueueQuery()
  const count = query.data?.length ?? 0
  return (
    <ScreenShell
      title={t('review.title')}
      description={t('pageHero.review')}
      icon={ClipboardCheck}
      loading={query.isPending}
      error={query.error}
      summary={count === 0 ? t('review.empty') : t('review.count', { count })}
    />
  )
}
