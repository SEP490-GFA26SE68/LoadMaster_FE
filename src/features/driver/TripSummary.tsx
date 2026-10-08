import { CircleCheck, TriangleAlert } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Lumo } from '@/components/brand/Lumo'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { StopDot } from '@/components/StopChip'
import { TouchTopBar } from '@/components/TouchTopBar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { expandPackages } from '@/domain/cargo'
import { ExitIconButton } from '@/features/auth/ExitControl'
import { useFormat, useT } from '@/lib/i18n'
import type { Revision, Trip } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import { deliverySummary, summaryStops } from './delivery-progress'
import { DRIVER_TRIP_SCREEN } from './DriverStopHeader'

/**
 * Tổng kết chuyến (LM-087; V2.3 đợt 6, `TaiXeTongKet.jpg`) khi giao xong điểm cuối, và khi mở lại một chuyến đã hoàn thành: Lumo nhỏ và
 * tên chuyến, bốn ô số (số điểm giao, kiện đã giao, sự cố — nền hổ phách khi có —, thời gian), khối sự cố (loại, kiện, ghi chú) và danh
 * sách điểm giao (số điểm trên màu điểm giao, giờ hoàn tất, số kiện, số sự cố, dấu kiểm). Mọi số đọc từ tiến độ giao trong kho (D-47),
 * không có số nào gõ tay.
 */
export function TripSummary({ trip, plan }: { trip: Trip; plan: Revision }) {
  const t = useT()
  const format = useFormat()
  const summary = deliverySummary(trip)
  const stops = summaryStops(trip)
  const nameOf = useMemo(() => {
    const { packageIdByInstanceId } = expandPackages(plan.request.packages)
    const names = new Map(plan.request.packages.map((pkg) => [pkg.id, pkg.name]))
    return (instanceId: string) => names.get(packageIdByInstanceId.get(instanceId) ?? '') ?? ''
  }, [plan])
  const { startedAt, completedAt } = summary
  const hasIssues = summary.issues.length > 0

  return (
    <div className="flex h-dvh flex-col bg-app text-body-lg">
      <TouchTopBar
        leading={<ExitIconButton tone="sky" screenHome={DRIVER_TRIP_SCREEN} contextual="/tai-xe" label={t('driver.toTrips')} iconClassName="size-7" />}
        trailing={<LanguageSwitch size="touch" tone="sky" className="flex-none [&>svg]:hidden min-[400px]:[&>svg]:block" />}
      >
        <h1 className="min-w-0 font-display text-h2 leading-6 font-bold text-balance text-sky-text font-stretch-106%">{t('driver.tripSummary.title')}</h1>
      </TouchTopBar>

      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-4">
        {/* Lumo giơ ngón cái: xong việc lớn (LM-105), nhỏ ở đầu thẻ */}
        <Card className="flex items-center gap-3 p-4">
          <Lumo pose="done" size="sm" />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="m-0 font-display text-h3 leading-6 font-[650] text-ink-strong font-stretch-106%">{t('driver.tripSummary.heading', { tripId: trip.id })}</p>
            <p className="m-0 text-ink-2">{trip.name}</p>
          </div>
        </Card>

        <dl className="m-0 grid grid-cols-2 gap-3">
          <Fact label={t('driver.tripSummary.stops')}><Figure>{format.integer(summary.stopCount)}</Figure></Fact>
          <Fact label={t('driver.tripSummary.delivered')}><Figure>{format.integer(summary.delivered)}</Figure></Fact>
          <Fact label={t('driver.tripSummary.issues')} warn={hasIssues}><Figure>{format.integer(summary.issues.length)}</Figure></Fact>
          <Fact label={t('driver.tripSummary.time')}>
            {startedAt && completedAt
              ? t('driver.tripSummary.timeRange', { start: format.time(startedAt), end: format.time(completedAt), date: format.date(startedAt) })
              : null}
          </Fact>
        </dl>

        <section aria-labelledby="tong-ket-su-co" className="flex flex-col gap-2">
          <h2 id="tong-ket-su-co" className="m-0 font-display text-h3 font-[650] text-ink-strong font-stretch-106%">{t('driver.tripSummary.issues')}</h2>
          {hasIssues ? (
            <ul className="m-0 flex list-none flex-col overflow-hidden rounded-lg border border-badge-warning-border bg-badge-warning-bg p-0">
              {summary.issues.map((issue) => (
                <li key={issue.id} className="flex flex-col gap-0.5 border-b border-badge-warning-border px-4 py-3 last:border-b-0">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-badge-warning-fg">
                    <TriangleAlert className="size-4 flex-none" strokeWidth={2} aria-hidden />
                    {t(`common.deliveryIssueKinds.${issue.kind}`)}
                  </span>
                  <span className="font-mono text-ink-strong">
                    {issue.packageInstanceId
                      ? t('driver.tripSummary.issueWhere', { id: issue.packageInstanceId, stop: issue.stopNumber })
                      : t('driver.tripSummary.wholeStop', { stop: issue.stopNumber })}
                  </span>
                  {issue.packageInstanceId ? <span className="text-ink-2">{nameOf(issue.packageInstanceId)}</span> : null}
                  {issue.note ? <span className="text-pretty text-ink-strong">{issue.note}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-ink-2">{t('driver.tripSummary.noIssues')}</p>
          )}
        </section>

        {stops.length > 0 ? (
          <section aria-labelledby="tong-ket-diem" className="flex flex-col gap-2">
            <h2 id="tong-ket-diem" className="m-0 font-display text-h3 font-[650] text-ink-strong font-stretch-106%">{t('driver.tripSummary.stopsTitle')}</h2>
            <ol className="m-0 flex list-none flex-col overflow-hidden rounded-lg border border-border bg-bg p-0 shadow-card">
              {stops.map((stop) => (
                <li key={stop.number} className="flex min-h-16 items-center gap-3 border-b border-line-soft px-4 py-2.5 last:border-b-0">
                  <StopDot stop={stop.number} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold text-pretty text-ink-strong">
                      <span className="sr-only">{t('common.stop', { number: stop.number })} · </span>
                      {stop.name}
                    </span>
                    <span className="text-ink-2">
                      {stop.kind === 'PICKUP' ? t('driver.stopKinds.PICKUP') : stop.completedAt ? t('driver.tripSummary.stopLine', { time: format.time(stop.completedAt), count: stop.delivered }) : t('driver.stopList.state.waiting')}
                      {stop.issues > 0 ? <span className="font-semibold text-badge-warning-fg"> · {t('driver.list.issues', { count: stop.issues })}</span> : null}
                    </span>
                  </div>
                  {stop.completedAt ? (
                    <span className="flex-none text-badge-success-fg">
                      <CircleCheck className="size-6" strokeWidth={2} aria-hidden />
                      <span className="sr-only">{t('driver.stopList.state.done')}</span>
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </main>

      <div className="flex-none border-t border-line-soft bg-bg px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <Button asChild variant="primary" block className="h-15 text-[18px]">
          <Link to="/tai-xe">{t('driver.toTrips')}</Link>
        </Button>
      </div>
    </div>
  )
}

function Figure({ children }: { children: ReactNode }) {
  return <span className="font-display text-[32px] leading-10 font-bold tabular-nums">{children}</span>
}

/** Ô số của tổng kết; `warn` tô hổ phách khi ô nói về sự cố và có sự cố (chữ vẫn nói đủ, màu chỉ nhấn). */
function Fact({ label, warn = false, children }: { label: string; warn?: boolean; children: ReactNode }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 rounded-lg border p-3', warn ? 'border-badge-warning-border bg-badge-warning-bg text-badge-warning-fg' : 'border-border bg-bg text-ink-strong shadow-card')}>
      <dt className={warn ? undefined : 'text-ink-3'}>{label}</dt>
      <dd className="m-0 font-semibold">{children}</dd>
    </div>
  )
}
