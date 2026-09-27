import { Box, SlidersHorizontal } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { useFormat, useT } from '@/lib/i18n'
import { plannerPath } from '@/lib/planner-path'
import { RevisionCreatedAt, RevisionTags } from './ComparisonColumnHeader'
import { comparisonGroups, ComparisonValue } from './ComparisonRows'
import { PlanThumbnail } from './PlanThumbnail'
import type { RevisionCardModel } from './revision-comparison'

/**
 * Chưa đủ hai bản để so sánh (V2.3 `SoSanhPhuongAnTrong.jpg`, LM-106): Card đè dải trời, trạng thái rỗng có Lumo và hai lối (mở bản
 * đã có, Thiết lập tối ưu — chỉ khi chuyến còn ở pha lập kế hoạch). Có một bản thì dưới đó là mục "Phương án đã lưu" liệt kê kết quả
 * và thiết lập thật của bản đó, cùng dòng với ma trận.
 */
export function PlanCompareEmpty({ tripId, cards, canRun }: { tripId: string; cards: readonly RevisionCardModel[]; canRun: boolean }) {
  const t = useT()
  const only = cards[0]
  return (
    <div className="sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6">
      <Card className="flex flex-none flex-col overflow-hidden">
        <EmptyState
          mascot="empty"
          className="py-10"
          title={t('trips.compare.emptyTitle')}
          description={t('trips.compare.emptyDescription', { count: cards.length })}
          action={
            <div className="flex flex-wrap justify-center gap-2.5">
              {only ? (
                <Button variant="secondary" asChild>
                  <Link to={plannerPath({ tripId, jobId: only.jobId, revisionId: only.id })}>
                    <Box strokeWidth={1.5} />{t('trips.compare.openOnly')}
                  </Link>
                </Button>
              ) : null}
              {canRun ? (
                <Button variant="primary" asChild>
                  <Link to={`/chuyen/${tripId}/toi-uu`}><SlidersHorizontal strokeWidth={1.5} />{t('trips.compare.emptyAction')}</Link>
                </Button>
              ) : null}
            </div>
          }
        />
        {cards.length > 0 ? <SavedRevisions cards={cards} /> : null}
      </Card>
    </div>
  )
}

function SavedRevisions({ cards }: { cards: readonly RevisionCardModel[] }) {
  const t = useT()
  const titleId = useId()
  const format = useFormat()
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3 border-t border-border bg-surface px-6 pt-5 pb-6">
      <div className="flex items-center gap-2">
        <CardTitle as="h2" id={titleId}>{t('trips.compare.savedTitle')}</CardTitle>
        <Badge shape="tag">{format.integer(cards.length)}</Badge>
      </div>
      {cards.map((card) => <SavedRevision key={card.id} card={card} />)}
    </section>
  )
}

/** Một bản lưu: ảnh đẳng cự, mã + nhãn + giờ tạo, rồi hai hàng Kết quả / Thiết lập đọc từ `comparisonGroups` như ma trận. */
function SavedRevision({ card }: { card: RevisionCardModel }) {
  const t = useT()
  const format = useFormat()
  const groups = comparisonGroups(t, format)
  return (
    <article aria-label={card.id} className="flex gap-5 rounded-lg border border-border bg-bg p-3.5 max-lg:flex-col">
      <div className="w-70 flex-none overflow-hidden rounded-md max-lg:w-full">
        <PlanThumbnail revisionId={card.id} request={card.revision.request} placements={card.revision.result.placements}
          totalCount={card.placedCount + card.unplacedCount} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 py-0.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-h3 leading-5 font-semibold text-ink-strong">{card.id}</span>
          <RevisionTags card={card} />
          <RevisionCreatedAt card={card} className="ml-auto text-small text-ink-3" />
        </div>
        {groups.map((group, index) => (
          <div key={group.key} className={index > 0 ? 'flex gap-4 border-t border-line-soft pt-3' : 'flex gap-4'}>
            <span className="w-18 flex-none text-small font-semibold text-ink-2">{group.title}</span>
            <dl className="grid min-w-0 flex-1 grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-4 gap-y-2.5 xl:grid-cols-[repeat(5,minmax(0,1fr))_minmax(0,1.2fr)]">
              {group.rows.map((row) => (
                <div key={row.key} className="flex min-w-0 flex-col gap-0.5">
                  <dt className="text-small text-ink-3">{row.label}</dt>
                  <dd className="text-body text-ink-strong"><ComparisonValue row={row} card={card} /></dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </article>
  )
}
