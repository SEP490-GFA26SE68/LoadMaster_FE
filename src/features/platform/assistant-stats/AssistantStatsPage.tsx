import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { Banner } from '@/components/Banner'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/features/auth/AuthProvider'
import { landingPath } from '@/features/auth/landing'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { vnDate } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import { DEFAULT_RANGE_DAYS, lastDays, rangeIssue } from './assistant-stats'
import { ASSISTANT_STATS_ON_BACKEND, type RouteStatsRange } from './assistant-stats-api'
import { AssistantStatsBody } from './AssistantStatsBody'
import { AssistantStatsRange } from './AssistantStatsRange'
import { useAssistantStatsQuery } from './useAssistantStatsQuery'

/**
 * Số đếm xu hướng của trợ lý Lumo ở trang công khai `/nen-tang/tro-ly-lumo` (`assistantStats.view`: quản trị hệ thống, quản lý nền
 * tảng). Chỉ có khi nhóm `assistant` nối máy chủ — kho mẫu không đếm gì (D-20): không có mục điều hướng, mở thẳng đường dẫn thì về màn
 * chính của vai trò, như Phiếu xin chuyến.
 */
export function AssistantStatsPage() {
  const { user } = useAuth()
  if (!ASSISTANT_STATS_ON_BACKEND) return <Navigate to={user ? landingPath(user.role) : '/'} replace />
  return <AssistantStatsScreen />
}

/** Ngày `YYYY-MM-DD` là nửa đêm giờ máy để `format.date` in đúng ngày đó. */
const dayOf = (value: string) => new Date(`${value}T00:00:00`)

function AssistantStatsScreen() {
  const t = useT()
  const format = useFormat()
  const [params, setParams] = useSearchParams()
  // "Hôm nay" theo giờ Việt Nam, chốt lúc mở màn: để qua nửa đêm không làm nút chọn nhanh đổi nghĩa giữa chừng
  const [today] = useState(() => vnDate(new Date()))
  const fallback = lastDays(today, DEFAULT_RANGE_DAYS)
  const from = params.get('tu') ?? fallback.from
  const to = params.get('den') ?? fallback.to
  const issue = rangeIssue(from, to)
  const stats = useAssistantStatsQuery(issue === null ? { from, to } : null)

  function handleApply(range: RouteStatsRange) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set('tu', range.from)
      next.set('den', range.to)
      return next
    })
  }

  const period = stats.data ? t('assistantStats.period', { from: format.date(dayOf(stats.data.from)), to: format.date(dayOf(stats.data.to)) }) : undefined

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero title={t('assistantStats.title')} meta={period} description={t('pageHero.assistantStats')} />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-shell py-6">
        <AssistantStatsRange today={today} from={from} to={to} onApply={handleApply} />
        <p className="flex-none text-small text-ink-3">{t('assistantStats.privacy')}</p>
        {issue !== null ? (
          <Banner tone="danger" role="alert">{t('assistantStats.range.invalidUrl')}</Banner>
        ) : stats.isError ? (
          <EmptyState
            mascot="error"
            title={t('assistantStats.errorTitle')}
            description={dataErrorMessage(stats.error, t)}
            action={<Button variant="secondary" onClick={() => void stats.refetch()}>{t('assistantStats.retry')}</Button>}
          />
        ) : stats.isPending ? (
          <div role="status" aria-label={t('assistantStats.loading')} className="flex h-24 flex-none items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <div aria-busy={stats.isFetching || undefined} className={cn('flex flex-none flex-col gap-4', stats.isPlaceholderData && 'opacity-60')}>
            <AssistantStatsBody stats={stats.data} />
          </div>
        )}
      </div>
    </div>
  )
}
