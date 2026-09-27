import { TriangleAlert } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Lumo } from '@/components/brand/Lumo'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { Button } from '@/components/ui/Button'
import { expandPackages } from '@/domain/cargo'
import { ExitIconButton } from '@/features/auth/ExitControl'
import { useFormat, useT } from '@/lib/i18n'
import type { Revision, Trip } from '@/lib/mock-db'
import { deliverySummary } from './delivery-progress'
import { DRIVER_TRIP_SCREEN } from './DriverStopHeader'

/**
 * Tổng kết chuyến (LM-087) khi giao xong điểm cuối, và khi mở lại một chuyến đã hoàn thành: số điểm giao, kiện đã giao, sự cố (loại,
 * kiện, ghi chú), giờ bắt đầu – kết thúc. Mọi số đọc từ tiến độ giao trong kho (D-47), không có số nào gõ tay.
 */
export function TripSummary({ trip, plan }: { trip: Trip; plan: Revision }) {
  const t = useT()
  const format = useFormat()
  const summary = deliverySummary(trip)
  const nameOf = useMemo(() => {
    const { packageIdByInstanceId } = expandPackages(plan.request.packages)
    const names = new Map(plan.request.packages.map((pkg) => [pkg.id, pkg.name]))
    return (instanceId: string) => names.get(packageIdByInstanceId.get(instanceId) ?? '') ?? ''
  }, [plan])
  const { startedAt, completedAt } = summary

  return (
    <div className="flex h-dvh flex-col bg-bg text-body-lg">
      <header className="flex flex-none items-center gap-1.5 border-b border-border bg-bg px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3">
        <ExitIconButton screenHome={DRIVER_TRIP_SCREEN} contextual="/tai-xe" label={t('driver.toTrips')} className="-ml-2" iconClassName="size-6" />
        <h1 className="min-w-0 flex-1 text-h2 font-semibold">{t('driver.tripSummary.title')}</h1>
        <LanguageSwitch size="touch" className="flex-none [&>svg]:hidden min-[400px]:[&>svg]:block" />
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-4">
        {/* Lumo giơ ngón cái: xong việc lớn (LM-105) */}
        <div className="flex items-center gap-3">
          <Lumo pose="done" size="sm" />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="m-0 text-h3 font-semibold">{t('driver.tripSummary.heading', { tripId: trip.id })}</p>
            <p className="m-0 text-text-2">{trip.name}</p>
          </div>
        </div>

        <dl className="m-0 grid grid-cols-2 gap-3">
          <Fact label={t('driver.tripSummary.stops')}><span className="font-mono text-[28px] leading-9">{format.integer(summary.stopCount)}</span></Fact>
          <Fact label={t('driver.tripSummary.delivered')}><span className="font-mono text-[28px] leading-9">{format.integer(summary.delivered)}</span></Fact>
          <Fact label={t('driver.tripSummary.issues')}><span className="font-mono text-[28px] leading-9">{format.integer(summary.issues.length)}</span></Fact>
          <Fact label={t('driver.tripSummary.time')}>
            {startedAt && completedAt
              ? t('driver.tripSummary.timeRange', { start: format.time(startedAt), end: format.time(completedAt), date: format.date(startedAt) })
              : null}
          </Fact>
        </dl>

        <section aria-labelledby="tong-ket-su-co" className="flex flex-col gap-2">
          <h2 id="tong-ket-su-co" className="text-h3 font-semibold">{t('driver.tripSummary.issues')}</h2>
          {summary.issues.length > 0 ? (
            <ul className="m-0 flex list-none flex-col overflow-hidden rounded-md border border-border p-0">
              {summary.issues.map((issue) => (
                <li key={issue.id} className="flex flex-col gap-0.5 border-b border-border bg-badge-warning-bg px-4 py-3 last:border-b-0">
                  <span className="inline-flex items-center gap-1.5 font-medium text-badge-warning-fg">
                    <TriangleAlert className="size-4 flex-none" strokeWidth={2} aria-hidden />
                    {t(`common.deliveryIssueKinds.${issue.kind}`)}
                  </span>
                  <span className="font-mono">
                    {issue.packageInstanceId
                      ? t('driver.tripSummary.issueWhere', { id: issue.packageInstanceId, stop: issue.stopNumber })
                      : t('driver.tripSummary.wholeStop', { stop: issue.stopNumber })}
                  </span>
                  {issue.packageInstanceId ? <span className="text-text-2">{nameOf(issue.packageInstanceId)}</span> : null}
                  {issue.note ? <span className="text-pretty">{issue.note}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-text-2">{t('driver.tripSummary.noIssues')}</p>
          )}
        </section>
      </main>

      <div className="flex-none border-t border-border bg-bg px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <Button asChild variant="primary" block className="h-15 text-[18px]">
          <Link to="/tai-xe">{t('driver.toTrips')}</Link>
        </Button>
      </div>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-md border border-border p-3">
      <dt className="text-text-3">{label}</dt>
      <dd className="m-0 font-medium">{children}</dd>
    </div>
  )
}
