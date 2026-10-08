import { Zap } from 'lucide-react'
import { useId, useMemo } from 'react'
import { Link } from 'react-router'
import { Banner } from '@/components/Banner'
import { EmptyState } from '@/components/EmptyState'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import type { DeadlineStatus } from '@/domain/routing'
import { useCan } from '@/features/auth/useCan'
import { useFormat, useT } from '@/lib/i18n'
import type { OptimizationRun, Revision, Trip, TripEta } from '@/lib/mock-db'
import { bestCandidates, candidateCards } from './candidate-comparison'
import { CandidateCard } from './CandidateCard'
import { PackageStopMarker } from './PackageStopMarker'
import type { RunComparison } from './plan-compare-api'

/** Mức hạn: kịp hạn xanh lá, sát hạn hổ phách, trễ hạn dự kiến đỏ — luôn kèm chữ (như chi tiết chuyến, FE-4b-09). */
const DEADLINE_TONE: Readonly<Record<DeadlineStatus, BadgeTone>> = { OK: 'success', AT_RISK: 'warning', MISSED: 'danger' }

/**
 * So sánh ba phương án ứng viên của một lần chạy (FE-5b-06, D-77; `/chuyen/:tripId/so-sanh?lan-chay=<mã lần chạy>`): thẻ đầu nói lần
 * chạy nào (người chạy, thiết lập và **tên thuật toán đã chạy** — màn so sánh là nơi được dùng từ vựng thuật toán) rồi mức hạn của các
 * điểm giao **một lần** (ba phương án cùng một tuyến); dưới đó ba thẻ A · B · C cạnh nhau. Giá trị tốt nhất của từng chỉ số được đánh
 * dấu trung tính. Màn không có nút primary: mỗi thẻ một nút phụ "Mở trong Planner", việc duyệt ở Planner.
 */
export function CandidateComparison({ tripId, runId, data }: { tripId: string; runId: string; data: RunComparison }) {
  const t = useT()
  const can = useCan()
  const { trip, run, revisions, eta } = data
  const cards = useMemo(() => (run ? candidateCards(trip, run, revisions) : []), [trip, run, revisions])
  const best = useMemo(() => bestCandidates(cards), [cards])
  const allRevisions = (
    <Button variant="secondary" asChild><Link to={`/chuyen/${tripId}/so-sanh`}>{t('trips.compare.candidates.allRevisions')}</Link></Button>
  )

  if (!run || cards.length === 0) {
    return (
      <div className="sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6">
        <Card className="flex flex-none flex-col">
          <EmptyState mascot="notFound" wide className="py-10" title={t('trips.compare.candidates.notFoundTitle')}
            description={t('trips.compare.candidates.notFoundDescription', { run: runId })} action={allRevisions} />
        </Card>
      </div>
    )
  }

  // Chạy lại chỉ khi chuyến còn lập kế hoạch và người xem được chạy tối ưu (D-45, LM-088)
  const canRun = trip.phase === 'planning' && can('optimization.run')
  return (
    <div className="sky-overlap flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-shell pb-6">
      <RunCard run={run} first={cards[0]?.revision} runnerName={data.runnerName} trip={trip} eta={eta} />
      {cards.some((card) => card.stale) ? <Banner tone="warning" className="flex-none">{t('trips.compare.candidates.stale')}</Banner> : null}
      <p className="flex-none px-1 text-small text-ink-3">{t('trips.compare.candidates.bestHint')}</p>
      <div className="grid flex-none grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        {cards.map((card) => <CandidateCard key={card.id} tripId={tripId} card={card} best={best} />)}
      </div>
      <div className="flex flex-none flex-wrap items-center gap-2.5">
        {allRevisions}
        {canRun ? (
          <Button variant="secondary" asChild>
            <Link to={`/chuyen/${tripId}/toi-uu`}><Zap strokeWidth={1.5} />{t('trips.compare.candidates.runAgain')}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/** Thẻ đầu màn: lần chạy (thời điểm, người chạy, thuật toán và thiết lập chung của ba phương án) và mức hạn các điểm giao. */
function RunCard({ run, first, runnerName, trip, eta }: {
  run: OptimizationRun
  first: Revision | undefined
  runnerName: string | null
  trip: Trip
  eta: TripEta | null
}) {
  const t = useT()
  const format = useFormat()
  const titleId = useId()
  const deadlinesId = useId()
  const settings = first?.request.settings
  const onOff = (value: boolean) => (value ? t('optimization.running.on') : t('optimization.running.off'))
  const when = { time: format.time(run.at), date: format.date(run.at) }
  const stopName = (stopId: string) => trip.stops.find((stop) => stop.id === stopId)?.name ?? stopId

  return (
    <Card role="region" aria-labelledby={titleId} className="flex-none overflow-hidden">
      <CardHeader>
        <CardTitle as="h2" id={titleId}>{t('trips.compare.candidates.runTitle', { run: run.id })}</CardTitle>
        <CardMeta>
          {runnerName ? t('trips.compare.candidates.runLine', { ...when, runner: runnerName }) : t('trips.compare.candidates.runLineNoRunner', when)}
        </CardMeta>
        {run.pinnedCount ? <CardMeta data-run-pinned className="basis-full">{t('trips.compare.candidates.pinned', { count: run.pinnedCount })}</CardMeta> : null}
        {settings ? (
          <CardMeta data-run-settings className="basis-full">
            {t('trips.compare.candidates.settings', {
              algorithm: t(`runs.algorithms.${run.algorithm}`),
              seed: settings.randomSeed === undefined ? t('trips.compare.noSeed') : String(settings.randomSeed),
              lifo: onOff(settings.enforceLifo),
              lowCenter: onOff(settings.prioritizeLowCenterOfGravity),
              seconds: format.integer(settings.timeLimitSeconds),
            })}
          </CardMeta>
        ) : null}
      </CardHeader>
      <section aria-labelledby={deadlinesId} className="flex flex-col gap-3 px-4.5 pt-3.5 pb-4">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 id={deadlinesId} className="text-body font-semibold text-ink-strong">{t('trips.compare.candidates.deadlinesTitle')}</h3>
          {eta?.isMockResult ? <Badge shape="tag" tone="mock">MOCK RESULT</Badge> : null}
          <span className="text-small text-ink-3">{t('trips.compare.candidates.deadlinesHint')}</span>
        </div>
        {eta ? (
          <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-x-5 gap-y-3 p-0">
            {eta.stops.map((stop) => (
              <li key={stop.stopId} data-stop-deadline={stop.number} className="flex items-start gap-2.5">
                <PackageStopMarker number={stop.number} className="mt-0.5" />
                <span className="flex min-w-0 flex-col gap-0.5 text-small text-ink-2">
                  <span className="font-semibold text-ink-strong">{t('trips.compare.candidates.stop', { number: stop.number, name: stopName(stop.stopId) })}</span>
                  <span className="tabular-nums">{t('trips.compare.candidates.eta', { time: format.time(stop.eta), date: format.dayMonth(stop.eta) })}</span>
                  <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 tabular-nums">
                    {stop.deadline ? t('trips.compare.candidates.deadline', { time: format.time(stop.deadline), date: format.dayMonth(stop.deadline) }) : t('trips.compare.candidates.noDeadline')}
                    {stop.deadlineStatus ? <Badge shape="tag" tone={DEADLINE_TONE[stop.deadlineStatus]}>{t(`common.deadlineStatuses.${stop.deadlineStatus}`)}</Badge> : null}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        ) : <p className="text-small text-ink-2">{t('trips.compare.candidates.noRoute')}</p>}
      </section>
    </Card>
  )
}
