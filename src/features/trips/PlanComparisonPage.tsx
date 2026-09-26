import { ArrowRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useT } from '@/lib/i18n'
import { plannerPath } from '@/lib/planner-path'
import { ComparisonMatrix } from './ComparisonMatrix'
import { bestValues, defaultRevisionId, revisionCards, type RevisionCardModel } from './revision-comparison'
import { useTripRevisionsQuery } from './useTripsQuery'

/**
 * So sánh các revision đã lưu của chuyến (LM-051, D-37, V2): ma trận chỉ số × bản lưu, đọc thiết lập và metrics thật của từng revision.
 * Hành động chính duy nhất: mở revision đang chọn trong Planner (`?revision=<mã revision>`). Chưa đủ hai revision thì hiện
 * trạng thái rỗng dẫn tới Thiết lập tối ưu.
 */
export function PlanComparisonPage() {
  const { tripId = '' } = useParams()
  const t = useT()
  const query = useTripRevisionsQuery(tripId)
  const cards = useMemo(() => (query.data ? revisionCards(query.data.trip, query.data.revisions) : []), [query.data])
  // Chuyến đã sang pha vận hành thì không tối ưu thêm (D-45, LM-088): bỏ lối tới Thiết lập tối ưu
  const canRun = query.data?.trip.phase === 'planning'

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap
        title={t('trips.compare.title')}
        meta={tripId}
        description={query.data ? `${query.data.trip.name} · ${t('trips.compare.subtitle', { count: cards.length })}` : undefined}
        back={{ to: `/chuyen/${tripId}`, label: t('trips.compare.back') }}
      />

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
        <NotEnoughRevisions tripId={tripId} cards={cards} canRun={canRun} />
      ) : (
        <Comparison tripId={tripId} cards={cards} canRun={canRun} />
      )}
    </div>
  )
}

function NotEnoughRevisions({ tripId, cards, canRun }: { tripId: string; cards: readonly RevisionCardModel[]; canRun: boolean }) {
  const t = useT()
  const only = cards[0]
  return (
    <div className="px-shell py-6">
      <EmptyState
        title={t('trips.compare.emptyTitle')}
        description={t('trips.compare.emptyDescription', { count: cards.length })}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {only ? (
              <Button variant="secondary" asChild>
                <Link to={plannerPath({ tripId, jobId: only.jobId, revisionId: only.id })}>{t('trips.compare.openOnly')}</Link>
              </Button>
            ) : null}
            {canRun ? (
              <Button variant="primary" asChild>
                <Link to={`/chuyen/${tripId}/toi-uu`}>{t('trips.compare.emptyAction')}</Link>
              </Button>
            ) : null}
          </div>
        }
      />
    </div>
  )
}

function Comparison({ tripId, cards, canRun }: { tripId: string; cards: readonly RevisionCardModel[]; canRun: boolean }) {
  const t = useT()
  const [chosenId, setChosenId] = useState<string>()
  const best = useMemo(() => bestValues(cards), [cards])
  const selected = cards.find((card) => card.id === chosenId) ?? cards.find((card) => card.id === defaultRevisionId(cards))

  return (
    <>
      <div className="sky-overlap flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-shell pb-6">
        <ComparisonMatrix cards={cards} best={best} selectedId={selected?.id} onSelect={setChosenId} />
      </div>

      <div className="flex h-16 flex-none items-center justify-between gap-4 border-t border-border bg-chrome px-shell">
        <span className="truncate text-caption text-text-3">
          {selected ? t('trips.compare.selectedLabel', { id: selected.id }) : null}
        </span>
        <div className="flex flex-none gap-2">
          {canRun ? (
            <Button variant="secondary" asChild>
              <Link to={`/chuyen/${tripId}/toi-uu`}>{t('trips.compare.runMore')}</Link>
            </Button>
          ) : null}
          {selected ? (
            <Button variant="primary" asChild>
              <Link to={plannerPath({ tripId, jobId: selected.jobId, revisionId: selected.id })}>
                {t('trips.compare.open', { id: selected.id })}
                <ArrowRight strokeWidth={1.5} />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </>
  )
}
