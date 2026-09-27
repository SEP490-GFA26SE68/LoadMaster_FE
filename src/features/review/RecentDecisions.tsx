import { Link } from 'react-router'
import { Card, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { ReviewStateBadge } from './ReviewStateBadge'
import { useRecentDecisionsQuery } from './useReviewQuery'

/**
 * Cột phụ của `/duyet` (LM-104): vài quyết định trả lại gần nhất — chuyến, loại quyết định, lý do nguyên văn, người và lúc quyết định.
 * Phương án đã quyết định rời hàng đợi, nên đây là chỗ quản lý thấy lại việc mình vừa làm.
 */
export function RecentDecisions() {
  const t = useT()
  const format = useFormat()
  const query = useRecentDecisionsQuery()
  const decisions = query.data ?? []

  return (
    <Card role="region" aria-labelledby="recent-decisions" data-recent-decisions>
      <CardHeader>
        <CardTitle id="recent-decisions">{t('review.recent.title')}</CardTitle>
        <CardMeta className="basis-full">{t('review.recent.description')}</CardMeta>
      </CardHeader>
      {query.isPending ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : query.error ? (
        <p className="m-0 px-4.5 py-4 text-small text-danger">{dataErrorMessage(query.error, t)}</p>
      ) : decisions.length === 0 ? (
        <p className="m-0 px-4.5 py-4 text-small text-ink-3">{t('review.recent.empty')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {decisions.map((decision) => (
            <li key={decision.id} className="flex flex-col gap-1.5 border-b border-line-soft px-4.5 py-3 last:border-b-0">
              <div className="flex items-center justify-between gap-2">
                <Link to={`/chuyen/${encodeURIComponent(decision.tripId)}`}
                  className="rounded-sm font-mono text-caption font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  {decision.tripId}
                </Link>
                <ReviewStateBadge state={decision.kind} />
              </div>
              <p className="m-0 line-clamp-2 text-small text-ink-1">{decision.reason}</p>
              {decision.vehicleName ? <p className="m-0 text-small text-ink-2">{t('review.notice.suggestedVehicle', { vehicle: decision.vehicleName })}</p> : null}
              <span className="text-caption text-ink-3">
                {t('review.notice.byLine', { name: decision.byName ?? t('review.notice.someone'), time: format.time(decision.at), date: format.dayMonth(decision.at) })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
