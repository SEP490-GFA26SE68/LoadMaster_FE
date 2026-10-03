import { Box, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useT } from '@/lib/i18n'
import { plannerPath } from '@/lib/planner-path'
import { CandidateComparison } from './CandidateComparison'
import { ComparisonMatrix } from './ComparisonMatrix'
import { Highlight } from './ComparisonRows'
import { PlanCompareEmpty } from './PlanCompareEmpty'
import { PlanCompareHero } from './PlanCompareHero'
import { bestValues, defaultRevisionId, revisionCards, type RevisionCardModel } from './revision-comparison'
import { useRunComparisonQuery } from './usePlanCompareQuery'
import { useTripDetailQuery, useTripRevisionsQuery } from './useTripsQuery'

/** Tham số URL chọn lần chạy để so ba phương án ứng viên của nó (FE-5b-06). */
const RUN_PARAM = 'lan-chay'

/**
 * So sánh phương án `/chuyen/:tripId/so-sanh`. Có `?lan-chay=<mã lần chạy>` (FE-5b-06, D-77) thì là ba phương án ứng viên của lần chạy
 * đó — mức hạn các điểm một lần phía trên, ba thẻ A · B · C (`CandidateComparison`); màn Thiết lập tối ưu mở thẳng vào đây khi chạy xong.
 * Không có thì là các revision đã lưu của chuyến như D-37 (`RevisionComparison`).
 */
export function PlanComparisonPage() {
  const { tripId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const runId = searchParams.get(RUN_PARAM)
  return runId === null ? <RevisionComparison tripId={tripId} /> : <RunComparisonView tripId={tripId} runId={runId} />
}

function RunComparisonView({ tripId, runId }: { tripId: string; runId: string }) {
  const t = useT()
  const query = useRunComparisonQuery(tripId, runId)
  const detail = useTripDetailQuery(tripId)
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PlanCompareHero tripId={tripId} detail={detail.data} run={query.data?.run ? { id: query.data.run.id, plans: query.data.run.plans?.length ?? 0 } : undefined} />
      {query.isPending ? (
        <div role="status" aria-label={t('trips.compare.loading')} className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : query.isError ? (
        <div className="flex flex-col items-start gap-4 px-shell py-6">
          <span className="text-body-lg font-semibold">{t('trips.compare.errorTitle')}</span>
          <Button variant="secondary" asChild>
            <Link to="/chuyen">{t('trips.compare.backToTrips')}</Link>
          </Button>
        </div>
      ) : (
        <CandidateComparison tripId={tripId} runId={runId} data={query.data} />
      )}
    </div>
  )
}

/**
 * So sánh các revision đã lưu của chuyến (LM-051, D-37, V2.3 LM-106): ma trận chỉ số × bản lưu trong Card đè dải trời, đọc thiết lập
 * và metrics thật của từng revision. Hành động chính duy nhất: mở revision đang chọn trong Planner (`?revision=<mã revision>`), ở chân
 * thẻ dính đáy vùng cuộn. Chưa đủ hai revision thì hiện trạng thái rỗng dẫn tới Thiết lập tối ưu.
 */
function RevisionComparison({ tripId }: { tripId: string }) {
  const t = useT()
  const query = useTripRevisionsQuery(tripId)
  // Trạng thái, xe của dải trời — cùng khoá với Chi tiết chuyến nên thường đã có sẵn trong cache
  const detail = useTripDetailQuery(tripId)
  const cards = useMemo(() => (query.data ? revisionCards(query.data.trip, query.data.revisions) : []), [query.data])
  // Chuyến đã sang pha vận hành thì không tối ưu thêm (D-45, LM-088): bỏ lối tới Thiết lập tối ưu
  const canRun = query.data?.trip.phase === 'planning'

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PlanCompareHero tripId={tripId} detail={detail.data} revisionCount={query.data ? cards.length : undefined} />

      {query.isPending ? (
        <div role="status" aria-label={t('trips.compare.loading')} className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : query.isError ? (
        <div className="flex flex-col items-start gap-4 px-shell py-6">
          <span className="text-body-lg font-semibold">{t('trips.compare.errorTitle')}</span>
          <Button variant="secondary" asChild>
            <Link to="/chuyen">{t('trips.compare.backToTrips')}</Link>
          </Button>
        </div>
      ) : cards.length < 2 ? (
        <PlanCompareEmpty tripId={tripId} cards={cards} canRun={canRun} />
      ) : (
        <Comparison tripId={tripId} cards={cards} canRun={canRun} />
      )}
    </div>
  )
}

function Comparison({ tripId, cards, canRun }: { tripId: string; cards: readonly RevisionCardModel[]; canRun: boolean }) {
  const t = useT()
  const [chosenId, setChosenId] = useState<string>()
  const best = useMemo(() => bestValues(cards), [cards])
  const selected = cards.find((card) => card.id === chosenId) ?? cards.find((card) => card.id === defaultRevisionId(cards))

  const footer = (
    <div className="sticky -bottom-6 z-20 flex flex-wrap items-center gap-2.5 rounded-b-lg border-t border-border bg-surface px-5 py-3.5">
      <span className="mr-auto truncate text-small text-ink-3">
        {selected ? (
          <Highlight text={t('trips.compare.selectedLabel', { id: selected.id })} parts={[selected.id]}
            className="font-mono text-caption font-semibold text-ink-strong" />
        ) : null}
      </span>
      {canRun ? (
        <Button variant="secondary" asChild>
          <Link to={`/chuyen/${tripId}/toi-uu`}><Zap strokeWidth={1.5} />{t('trips.compare.runMore')}</Link>
        </Button>
      ) : null}
      {selected ? (
        <Button variant="primary" asChild>
          <Link to={plannerPath({ tripId, jobId: selected.jobId, revisionId: selected.id })}>
            <Box strokeWidth={1.5} />{t('trips.compare.open', { id: selected.id })}
          </Link>
        </Button>
      ) : null}
    </div>
  )

  return (
    <div className="sky-overlap flex min-h-0 flex-1 flex-col overflow-auto px-shell pb-6">
      <ComparisonMatrix cards={cards} best={best} selectedId={selected?.id} onSelect={setChosenId} footer={footer} />
    </div>
  )
}
